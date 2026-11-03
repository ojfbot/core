import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateToken } from "../auth.js";
import { fleetClient } from "../client.js";
import { JobError, JobStore, writeOutput } from "../jobs.js";
import { fleetServer } from "../server.js";
import { workOnce } from "../worker.js";

let dir: string;
let store: JobStore;
let server: Server;
let base: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "fleet-client-"));
  for (const name of ["owner", "worker"]) generateToken(join(dir, name));
  store = new JobStore(":memory:");
  server = fleetServer(store, { registry: dir, outDir: join(dir, "accepted") });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing listener");
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

it("pulls matching work and uploads only the output of the held attempt", async () => {
  const owner = fleetClient(base, "owner", join(dir, "owner"));
  const worker = fleetClient(base, "worker", join(dir, "worker"));
  const { key } = await owner.enqueue({
    kind: "noop",
    inputs: ["synthetic"],
    payload: null,
    requires: ["test"],
  });
  const options = {
    caps: ["test"],
    outDir: join(dir, "attempts"),
    handlers: {
      noop: async (job: Parameters<typeof writeOutput>[1], ctx: { outDir: string }) =>
        writeOutput(ctx.outDir, job, "synthetic result"),
    },
  };
  await expect(workOnce(worker, { ...options, caps: [] })).resolves.toBe("idle");
  await expect(workOnce(worker, options)).resolves.toBe("completed");
  await expect(workOnce(worker, options)).resolves.toBe("idle");
  await expect(owner.verify(key)).resolves.toMatchObject({
    verified: true,
    period: { byWorker: { worker: { completed: 1 } } },
  });
});

it("reports a handler failure using its code and leaves retry policy to the queue", async () => {
  const owner = fleetClient(base, "owner", join(dir, "owner"));
  const worker = fleetClient(base, "worker", join(dir, "worker"));
  await owner.enqueue({ kind: "noop", inputs: ["synthetic"], payload: null });
  const result = await workOnce(worker, {
    caps: [],
    outDir: join(dir, "attempts"),
    handlers: {
      noop: async () => {
        throw new JobError("test-failure", false);
      },
    },
  });
  expect(result).toBe("failed");
  await expect(owner.report()).resolves.toMatchObject({
    now: { failures: [{ kind: "noop", error: "test-failure", count: 1 }] },
  });
});
