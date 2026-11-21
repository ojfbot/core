import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateToken } from "../auth.js";
import { fleetClient } from "../client.js";
import { runDeclaredWorker } from "../declared-worker.js";
import { JobStore } from "../jobs.js";
import { fleetServer } from "../server.js";
import type { PowerSource } from "../claim-policy.js";
import { observationOf } from "../worker-presence.js";
import { parseWorkerSettings } from "../worker-settings.js";

describe("what a worker reports about itself", () => {
  const base = {
    state: "idle",
    claiming: { allowed: true, reason: "ok" } as const,
    power: "ac" as PowerSource,
    kinds: ["proof-fixture", "not-in-the-vocabulary"],
    unavailable: {},
  };
  it("uses only the service's closed vocabulary", () => {
    expect(observationOf(base)).toEqual({
      schemaVersion: 1,
      phase: "idle",
      eligibility: "eligible",
      handlers: ["proof-fixture"],
      busy: false,
    });
    expect(observationOf({ ...base, state: "working" })).toMatchObject({
      phase: "running",
      busy: true,
    });
  });

  it("maps each local reason to a named eligibility", () => {
    const refused = (
      reason: Parameters<typeof observationOf>[0]["claiming"]["reason"],
      more = {},
    ) =>
      observationOf({
        ...base,
        state: "paused",
        claiming: { allowed: false, reason },
        ...more,
      });
    expect(refused("service-paused")).toMatchObject({
      phase: "paused",
      eligibility: "operator-paused",
    });
    expect(refused("power-battery")).toMatchObject({ phase: "idle", eligibility: "battery" });
    expect(refused("power-unknown")).toMatchObject({ eligibility: "power-unknown" });
    expect(refused("outside-window")).toMatchObject({ eligibility: "outside-window" });
    expect(refused("exception-expired", { power: "battery" })).toMatchObject({
      eligibility: "battery",
    });
    expect(refused("exception-expired")).toMatchObject({ eligibility: "outside-window" });
    expect(refused("policy-error")).toMatchObject({ eligibility: "policy-error" });
  });

  it("explains an empty offer, and never leaks an unsafe error message", () => {
    const none = (unavailable: Record<string, string>) =>
      observationOf({ ...base, kinds: [], unavailable }).eligibility;
    expect(none({ a: "gpu-busy" })).toBe("resource-busy");
    expect(none({ a: "resource-busy" })).toBe("resource-busy");
    expect(none({ a: "handler-pin-mismatch" })).toBe("helper-changed");
    expect(none({ a: "unsupported-platform" })).toBe("unsupported-worker");
    expect(none({ a: "missing-file" })).toBe("unsupported-worker");
    expect(
      observationOf({ ...base, state: "request-error", errorCode: "ECONNREFUSED" }),
    ).toMatchObject({ phase: "request-error", errorCode: "ECONNREFUSED" });
    expect(
      observationOf({ ...base, state: "request-error", errorCode: "/private/path leaked" }),
    ).toMatchObject({ errorCode: "unexpected-error" });
  });
});

// Holds each job for the number of milliseconds in its first argument.
const HANDLER = `
const { writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
let raw = "";
process.stdin.on("data", (c) => (raw += c)).on("end", () => {
  const { job, outDir } = JSON.parse(raw);
  setTimeout(() => {
    const out = job.kind + "\\n";
    const file = job.key + "." + job.fence + ".jsonl";
    writeFileSync(outDir + "/" + file, out);
    process.stdout.write(JSON.stringify({ file, sha256: createHash("sha256").update(out).digest("hex") }));
  }, Number(process.argv[2]));
});
`;

describe("owner control of a worker, against a real local service", () => {
  let dir: string;
  let store: JobStore;
  let server: Server;
  let endpoint: string;
  let controller: AbortController;
  let power: PowerSource;
  let sequence: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "worker-control-"));
    for (const id of ["owner", "worker"]) generateToken(join(dir, id));
    writeFileSync(join(dir, "handler.cjs"), HANDLER, { mode: 0o500 });
    store = new JobStore(join(dir, "jobs.sqlite"));
    server = fleetServer(store, {
      registry: dir,
      outDir: join(dir, "accepted"),
      inputDir: join(dir, "service-inputs"),
      workers: ["worker"],
    });
    endpoint = await new Promise<string>((ok, fail) => {
      server.once("error", fail);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") return fail(Error("no listener"));
        ok(`http://127.0.0.1:${address.port}`);
      });
    });
    controller = new AbortController();
    power = "ac";
    sequence = 0;
  });

  afterEach(async () => {
    controller.abort();
    await new Promise<void>((ok) => server.close(() => ok()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const settings = (holdMs: number, extra: object = {}) =>
    parseWorkerSettings({
      schemaVersion: 1,
      endpoint,
      worker: "worker",
      tokenFile: join(dir, "worker"),
      outDir: join(dir, "attempts"),
      statusFile: join(dir, "status.json"),
      pollMs: 40,
      presenceMs: 50,
      ...extra,
      kinds: {
        "proof-fixture": {
          capabilities: [],
          command: [process.execPath, join(dir, "handler.cjs"), String(holdMs)],
        },
      },
    });
  const start = (holdMs = 0, extra: object = {}) =>
    runDeclaredWorker(settings(holdMs, extra), controller.signal, { power: async () => power });
  const owner = () => fleetClient(endpoint, "owner", join(dir, "owner"));
  const admit = async () =>
    (
      await owner().enqueue({
        kind: "proof-fixture",
        inputs: [],
        params: { n: ++sequence },
        payload: null,
      })
    ).key;
  const seen = async () => (await owner().status()).workers.find((w) => w.id === "worker")!;
  const waitFor = async (ready: () => boolean | Promise<boolean>) => {
    const end = Date.now() + 10_000;
    while (!(await ready())) {
      if (Date.now() >= end) throw Error("condition did not become true");
      await delay(25);
    }
  };
  const claimed = (key: string) =>
    store.events(0).some((e) => e.key === key && e.type === "claimed");
  const localStatus = () => {
    try {
      return JSON.parse(readFileSync(join(dir, "status.json"), "utf8"));
    } catch {
      return {};
    }
  };

  it("shows an idle worker in presence", async () => {
    const done = start();
    await waitFor(async () => {
      const worker = await seen();
      return worker.freshness === "fresh" && worker.phase === "idle";
    });
    expect(await seen()).toMatchObject({
      phase: "idle",
      eligibility: "eligible",
      handlers: ["proof-fixture"],
      busy: false,
    });
    controller.abort();
    await done;
  });

  it("shows why a worker is not eligible in presence, such as battery power", async () => {
    power = "battery";
    const done = start(0, { policy: { timezone: "UTC" } });
    await waitFor(async () => {
      const worker = await seen();
      return worker.eligibility === "battery" && worker.phase === "idle";
    });
    expect(await seen()).toMatchObject({ phase: "idle", handlers: ["proof-fixture"] });
    controller.abort();
    await done;
  });

  it("stops claiming when the owner pauses and resumes claiming when the owner resumes", async () => {
    const done = start();
    await waitFor(async () => (await seen()).freshness === "fresh");
    expect(await owner().control("worker", "pause")).toMatchObject({
      paused: true,
      intent: "pause",
    });
    await waitFor(() => localStatus().claiming?.reason === "service-paused");
    const key = await admit();
    await delay(250); // several polls
    expect(claimed(key)).toBe(false);
    expect(await seen()).toMatchObject({ phase: "paused", eligibility: "operator-paused" });
    expect(await owner().control("worker", "resume")).toMatchObject({ paused: false });
    await waitFor(() => store.get(key)?.status === "done");
    controller.abort();
    await done;
  });

  it("drains: the running job finishes, nothing new starts, and resume continues", async () => {
    const done = start(600);
    const first = await admit();
    await waitFor(() => claimed(first));
    expect(await owner().control("worker", "drain")).toMatchObject({
      paused: true,
      intent: "drain",
    });
    const second = await admit();
    await waitFor(async () => (await seen()).phase === "draining"); // held lease while paused
    await waitFor(() => store.get(first)?.status === "done"); // the running job was not cut off
    await delay(250);
    expect(claimed(second)).toBe(false);
    expect(await seen()).toMatchObject({ phase: "paused", eligibility: "operator-paused" });
    await owner().control("worker", "resume");
    await waitFor(() => store.get(second)?.status === "done");
    controller.abort();
    await done;
  });

  it("lets only the owner control a worker", async () => {
    const self = fleetClient(endpoint, "worker", join(dir, "worker"));
    await expect(self.control("worker", "resume")).rejects.toMatchObject({ status: 403 });
    await expect(self.control("worker", "pause")).rejects.toMatchObject({ status: 403 });
    expect(store.workerControl("worker").paused).toBe(false);
  });
});
