import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { acquireLock, lockHeld } from "../worker-lock.js";
import { parseWorkerSettings } from "../worker-settings.js";

describe("local lock", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "worker-lock-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("has one holder at a time and is free again after release", () => {
    const file = join(dir, "a.lock");
    const first = acquireLock(file);
    expect(first).toBeDefined();
    expect(lockHeld(file)).toBe(true);
    expect(acquireLock(file)).toBeUndefined();
    first!.release();
    first!.release(); // releasing twice is harmless
    expect(lockHeld(file)).toBe(false);
    const second = acquireLock(file);
    expect(second).toBeDefined();
    second!.release();
    expect(existsSync(file)).toBe(false);
  });

  it("never releases a lock another holder has since taken", () => {
    const file = join(dir, "a.lock");
    const first = acquireLock(file)!;
    rmSync(file); // as if an operator cleared it
    const second = acquireLock(file)!;
    first.release();
    expect(lockHeld(file)).toBe(true);
    second.release();
  });

  it("takes over a lock whose owner has died, and one that is unreadable", () => {
    const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], {
      encoding: "utf8",
    });
    const file = join(dir, "a.lock");
    writeFileSync(file, JSON.stringify({ pid: Number(dead.stdout), token: "old" }));
    expect(lockHeld(file)).toBe(false);
    const taken = acquireLock(file);
    expect(taken).toBeDefined();
    expect(acquireLock(file)).toBeUndefined();
    taken!.release();
    writeFileSync(file, "not json");
    const garbage = acquireLock(file);
    expect(garbage).toBeDefined();
    garbage!.release();
    expect(existsSync(`${file}.takeover`)).toBe(false);
  });

  it("refuses while a takeover is in progress", () => {
    const file = join(dir, "a.lock");
    writeFileSync(file, JSON.stringify({ pid: 2_147_483_646, token: "old" }));
    writeFileSync(`${file}.takeover`, "");
    expect(acquireLock(file)).toBeUndefined();
  });
});

// Records when each job starts and ends, holds for a moment, and returns its own output.
const HANDLER = `
const { appendFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
let raw = "";
process.stdin.on("data", (c) => (raw += c)).on("end", () => {
  const { job, outDir } = JSON.parse(raw);
  appendFileSync(process.argv[2], "start " + job.key + " " + Date.now() + "\\n");
  setTimeout(() => {
    const out = job.kind + "\\n";
    const file = job.key + "." + job.fence + ".jsonl";
    writeFileSync(outDir + "/" + file, out);
    appendFileSync(process.argv[2], "end " + job.key + " " + Date.now() + "\\n");
    process.stdout.write(JSON.stringify({ file, sha256: createHash("sha256").update(out).digest("hex") }));
  }, 250);
});
`;

describe("worker against a real local service", () => {
  let dir: string;
  let store: JobStore;
  let server: Server;
  let endpoint: string;
  let controller: AbortController;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "worker-exclusion-"));
    for (const id of ["owner", "worker", "other"]) generateToken(join(dir, id));
    writeFileSync(join(dir, "handler.cjs"), HANDLER, { mode: 0o500 });
    store = new JobStore(join(dir, "jobs.sqlite"));
    server = fleetServer(store, {
      registry: dir,
      outDir: join(dir, "accepted"),
      inputDir: join(dir, "service-inputs"),
      workers: ["worker", "other"],
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
  });

  afterEach(async () => {
    controller.abort();
    await new Promise<void>((ok) => server.close(() => ok()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const log = "log.txt";
  const settings = (worker: string, kind: object = {}, extra: object = {}) =>
    parseWorkerSettings({
      schemaVersion: 1,
      endpoint,
      worker,
      tokenFile: join(dir, worker),
      outDir: join(dir, `attempts-${worker}`),
      statusFile: join(dir, `status-${worker}.json`),
      resourceDir: join(dir, "resources"),
      pollMs: 40,
      ...extra,
      kinds: {
        render: {
          capabilities: [],
          command: [process.execPath, join(dir, "handler.cjs"), join(dir, log)],
          ...kind,
        },
      },
    });
  const owner = () => fleetClient(endpoint, "owner", join(dir, "owner"));
  let sequence = 0;
  const admit = async () =>
    // Identical jobs share a key, so each admitted job carries its own parameters.
    (
      await owner().enqueue({
        kind: "render",
        inputs: [],
        params: { n: ++sequence },
        payload: null,
      })
    ).key;
  const waitFor = async (ready: () => boolean) => {
    const end = Date.now() + 10_000;
    while (!ready()) {
      if (Date.now() >= end) throw Error("condition did not become true");
      await delay(25);
    }
  };
  const status = (worker: string) => {
    try {
      return JSON.parse(readFileSync(join(dir, `status-${worker}.json`), "utf8"));
    } catch {
      return {};
    }
  };
  const intervals = () => {
    const lines = readFileSync(join(dir, log), "utf8").trim().split("\n");
    const spans = new Map<string, { start: number; end: number }>();
    for (const line of lines) {
      const [what, key, at] = line.split(" ") as [string, string, string];
      const span = spans.get(key) ?? { start: 0, end: 0 };
      span[what as "start" | "end"] = Number(at);
      spans.set(key, span);
    }
    return [...spans.values()].sort((a, b) => a.start - b.start);
  };

  it("refuses a second client for the same worker identity before it touches anything", async () => {
    const first = runDeclaredWorker(settings("worker"), controller.signal);
    await waitFor(() => status("worker").state !== undefined);
    const before = readFileSync(join(dir, "status-worker.json"), "utf8");
    const key = await admit();
    const duplicate = settings("worker", {}, { statusFile: join(dir, "status-duplicate.json") });
    await expect(runDeclaredWorker(duplicate, controller.signal)).rejects.toThrow(
      "duplicate-client",
    );
    expect(existsSync(join(dir, "status-duplicate.json"))).toBe(false);
    // The first client is unaffected and finishes the job, which was claimed exactly once.
    await waitFor(() => store.get(key)?.status === "done");
    expect(
      store
        .events(0)
        .filter((e) => e.key === key)
        .map((e) => e.type),
    ).toEqual(["enqueued", "claimed", "completed"]);
    expect(before).toContain('"worker":"worker"');
    controller.abort();
    await first;
    // After a clean stop the identity can be used again.
    const next = new AbortController();
    const again = runDeclaredWorker(settings("worker"), next.signal);
    await waitFor(() => status("worker").state === "idle");
    next.abort();
    await again;
    expect(existsSync(join(dir, "worker.lock"))).toBe(false);
  });

  it("never lets two workers hold the same GPU slot at once", async () => {
    const keys = [await admit(), await admit()];
    const a = runDeclaredWorker(settings("worker", { resource: "gpu" }), controller.signal);
    const b = runDeclaredWorker(settings("other", { resource: "gpu" }), controller.signal);
    // While one holds the slot the other reports why it is not offering the kind.
    await waitFor(
      () =>
        status("worker").unavailable?.render === "resource-busy" ||
        status("other").unavailable?.render === "resource-busy",
    );
    await waitFor(() => keys.every((key) => store.get(key)?.status === "done"));
    controller.abort();
    await Promise.all([a, b]);
    const [first, second] = intervals();
    expect(first!.end).toBeGreaterThan(first!.start);
    expect(second!.start).toBeGreaterThanOrEqual(first!.end); // no overlap
    expect(existsSync(join(dir, "resources", "gpu.slot"))).toBe(false);
  });

  it("would overlap without the shared slot, so the check above is meaningful", async () => {
    const keys = [await admit(), await admit()];
    const a = runDeclaredWorker(settings("worker"), controller.signal);
    const b = runDeclaredWorker(settings("other"), controller.signal);
    await waitFor(() => keys.every((key) => store.get(key)?.status === "done"));
    controller.abort();
    await Promise.all([a, b]);
    const [first, second] = intervals();
    expect(second!.start).toBeLessThan(first!.end);
  });

  it("frees the slot when an attempt fails, so the next job can use it", async () => {
    const failing = join(dir, "failing.cjs");
    writeFileSync(failing, "process.exit(1);\n", { mode: 0o500 });
    const key = await admit();
    const done = runDeclaredWorker(
      settings("worker", { resource: "gpu", command: [process.execPath, failing] }),
      controller.signal,
    );
    await waitFor(() => store.get(key)?.status === "failed");
    controller.abort();
    await done;
    expect(existsSync(join(dir, "resources", "gpu.slot"))).toBe(false);
  });
});
