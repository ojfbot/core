import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { generateToken } from "../src/auth.js";
import { fleetClient, type FleetClient } from "../src/client.js";
import { JobStore, writeOutput } from "../src/jobs.js";
import type { Claim } from "../src/jobs.js";
import { fleetServer } from "../src/server.js";
import { workOnce } from "../src/worker.js";

const CASES = [
  "completion-response-lost-after-commit",
  "worker-sleep-or-partition",
  "lease-lost-during-upload",
  "crash-output-before-db-commit",
  "crash-db-boundary",
  "retry-exhaustion",
  "handler-ignores-cancellation",
  "stale-fence-rejection",
] as const;
const repetitions = 10;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

type Evidence = {
  case_id: string;
  repetition: number;
  started_at: string;
  finished_at: string;
  synthetic: true;
  fault_evidence: string;
  attempts: { worker_id: string; fence: number }[];
  accepted_output_count: number;
  accepted_output_sha256: string | null;
  reclaim_applicable: boolean;
  reclaim_elapsed_ms?: number;
  reclaim_bound_ms?: number;
  result: "pass";
};

async function runCase(caseId: (typeof CASES)[number], repetition: number): Promise<Evidence> {
  const started = new Date().toISOString();
  const dir = mkdtempSync(join(tmpdir(), "fleet-g6-"));
  const outputDir = join(dir, "outputs");
  let now = 10_000;
  const store = new JobStore(":memory:", { now: () => now, leaseMs: 300_000 });
  const attempts: Evidence["attempts"] = [];
  let faultEvidence = "";
  let acceptedHash: string | null = null;
  let reclaimApplicable = false;
  let reclaimElapsed: number | undefined;
  const payload = Buffer.from(`${caseId}:${repetition}:synthetic-output\n`);
  const enqueue = (maxAttempts = 3) => store.enqueue({ kind: "noop", inputs: [caseId], payload: null, maxAttempts });
  const claim = (worker: string, key: string) => {
    const value = store.claim(worker, [], ["noop"]);
    if (!value || value.key !== key) throw new Error(`expected claim for ${key}`);
    attempts.push({ worker_id: worker, fence: value.fence });
    return value;
  };
  const accept = (job: Claim, worker: string, bytes = payload) => {
    const accepted = store.complete(job.key, job.fence, worker, () => writeOutput(outputDir, job, bytes));
    if (!accepted) throw new Error(`attempt ${job.fence} was not accepted`);
    acceptedHash = sha(bytes);
  };
  try {
    const { key } = enqueue(caseId === "retry-exhaustion" ? 2 : 3);
    const first = claim("worker-a", key);
    let completed = false;

    if (caseId === "completion-response-lost-after-commit") {
      expect(store.release(key, first.fence, "worker-a")).toBe(true);
      for (const id of ["owner", "worker-a"]) generateToken(join(dir, id));
      const server = fleetServer(store, { registry: dir, outDir: outputDir });
      const workerOutputDir = join(dir, "worker-output");
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing synthetic listener");
      const endpoint = `http://127.0.0.1:${address.port}`;
      const owner = fleetClient(endpoint, "owner", join(dir, "owner"));
      const worker = fleetClient(endpoint, "worker-a", join(dir, "worker-a"));
      const keyFromOwner = await owner.enqueue({ kind: "noop", inputs: [caseId], payload: null });
      expect(keyFromOwner.key).toBe(key);
      const originalFetch = globalThis.fetch;
      let completionPosts = 0;
      globalThis.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        if (new URL(String(input)).pathname === "/complete" && completionPosts++ === 0) {
          await response.arrayBuffer();
          throw new Error("synthetic response lost after local service commit");
        }
        return response;
      };
      try {
        expect(await workOnce(worker, {
          now: () => now,
          caps: [],
          outDir: workerOutputDir,
          handlers: { noop: async (job, context) => writeOutput(context.outDir, job, payload) },
        })).toBe("completed");
        expect(completionPosts).toBe(2);
        const verification = await owner.verify(key);
        expect(verification.verified, JSON.stringify({ row: store.get(key), files: readdirSync(outputDir) })).toBe(true);
        const completedEvent = store.events(0).filter((event) => event.type === "completed");
        expect(completedEvent).toHaveLength(1);
        attempts.push({ worker_id: "worker-a", fence: 2 });
        acceptedHash = sha(payload);
        faultEvidence = "localhost service committed fence=2, first completion response was dropped, retry produced one accepted completion";
      } finally {
        globalThis.fetch = originalFetch;
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      completed = true;
    } else if (caseId === "worker-sleep-or-partition") {
      // Deterministic clock advance represents the interruption; this is not physical sleep or network evidence.
      now += 300_001;
      store.sweep();
      const second = claim("worker-b", key);
      expect(store.complete(key, first.fence, "worker-a", () => writeOutput(outputDir, first, payload))).toBe(false);
      accept(second, "worker-b");
      reclaimApplicable = true;
      reclaimElapsed = now - 10_000;
      completed = true;
      faultEvidence = "synthetic lease expiry after clocked partition; stale fence rejected";
    } else if (caseId === "handler-ignores-cancellation") {
      expect(store.release(key, first.fence, "worker-a")).toBe(true);
      const oldAttempt = claim("worker-a", key);
      let handlerStarted!: () => void;
      let releaseHandler!: () => void;
      const started = new Promise<void>((resolve) => { handlerStarted = resolve; });
      const holdHandler = new Promise<void>((resolve) => { releaseHandler = resolve; });
      const abort = new AbortController();
      const localClient = {
        claim: async () => oldAttempt,
        complete: async (job: Claim, bytes: Buffer, digest: string) => {
          expect(sha(bytes)).toBe(digest);
          return store.complete(job.key, job.fence, "worker-a", () => writeOutput(outputDir, job, bytes));
        },
        heartbeat: async (job: Claim) => store.heartbeat(job.key, job.fence, "worker-a"),
        release: async (job: Claim) => store.release(job.key, job.fence, "worker-a"),
        fail: async (job: Claim, code: string, retryable: boolean) => store.fail(job.key, job.fence, "worker-a", code, retryable),
      } as unknown as FleetClient;
      const running = workOnce(localClient, {
        now: () => now,
        signal: abort.signal,
        caps: [],
        outDir: outputDir,
        heartbeatMs: 100_000,
        handlers: { noop: async (job) => {
          handlerStarted();
          await holdHandler; // Deliberately ignores AbortSignal.
          return writeOutput(outputDir, job, payload);
        } },
      });
      await started;
      now += 300_001;
      store.sweep();
      const second = claim("worker-b", key);
      abort.abort();
      releaseHandler();
      expect(await running).toBe("lease-lost");
      accept(second, "worker-b");
      reclaimApplicable = true;
      reclaimElapsed = now - 10_000;
      completed = true;
      faultEvidence = "handler ignored AbortSignal; late fence=2 output remained unaccepted and fence=3 completed";
    } else if (caseId === "lease-lost-during-upload") {
      const staleBytes = Buffer.from("stale upload bytes\n");
      expect(store.complete(key, first.fence, "worker-a", () => {
        const output = writeOutput(outputDir, first, staleBytes);
        now += 300_001;
        return output;
      })).toBe(false);
      store.sweep();
      const second = claim("worker-b", key);
      accept(second, "worker-b");
      reclaimApplicable = true;
      reclaimElapsed = now - 10_000;
      completed = true;
      faultEvidence = "lease expired during output callback; stale upload fenced before acceptance";
    } else if (caseId === "crash-output-before-db-commit") {
      expect(() => store.complete(key, first.fence, "worker-a", () => {
        writeOutput(outputDir, first, payload);
        throw new Error("synthetic crash before database commit");
      })).toThrow("synthetic crash before database commit");
      expect(store.get(key)).toMatchObject({ status: "claimed", output: null });
      now += 300_001;
      store.sweep();
      const second = claim("worker-b", key);
      accept(second, "worker-b");
      reclaimApplicable = true;
      reclaimElapsed = now - 10_000;
      completed = true;
      faultEvidence = "attempt file written, database transaction rolled back, later fence accepted";
    } else if (caseId === "crash-db-boundary") {
      expect(store.complete(key, first.fence, "worker-a", () => {
        const output = writeOutput(outputDir, first, payload);
        // Deterministically cross lease expiry after durable file creation but before the DB update.
        now += 300_001;
        return output;
      })).toBe(false);
      expect(store.get(key)).toMatchObject({ status: "claimed", output: null });
      store.sweep();
      const second = claim("worker-b", key);
      accept(second, "worker-b");
      reclaimApplicable = true;
      reclaimElapsed = now - 10_000;
      completed = true;
      faultEvidence = "durable artifact preceded expired-lease DB update; stale completion rejected and newer fence accepted";
    } else if (caseId === "retry-exhaustion") {
      expect(store.fail(key, first.fence, "worker-a", "synthetic-retry", true)).toBe(true);
      now += 1;
      const second = claim("worker-b", key);
      expect(store.fail(key, second.fence, "worker-b", "synthetic-retry", true)).toBe(true);
      expect(store.get(key)).toMatchObject({ status: "failed", output: null, attempts: 2 });
      faultEvidence = "retryable failure exhausted maxAttempts=2; terminal failed with no output";
    } else {
      now += 300_001;
      store.sweep();
      const second = claim("worker-b", key);
      expect(store.complete(key, first.fence, "worker-a", () => writeOutput(outputDir, first, payload))).toBe(false);
      accept(second, "worker-b");
      completed = true;
      faultEvidence = "baseline rejected stale attempt after reclaim; newer fence accepted";
    }

    const row = store.get(key);
    expect(row?.status).toBe(completed ? "done" : "failed");
    const acceptedCount = row?.status === "done" ? 1 : 0;
    expect(acceptedCount).toBe(completed ? 1 : 0);
    expect(store.events(0).filter((event) => event.type === "completed")).toHaveLength(acceptedCount);
    if (acceptedCount) {
      expect(row?.output).toBe(acceptedHash);
      expect(row?.outputFile).toBeTruthy();
      expect(sha(readFileSync(join(outputDir, row!.outputFile!))).toString()).toBe(acceptedHash);
    }
    return {
      case_id: caseId,
      repetition,
      started_at: started,
      finished_at: new Date().toISOString(),
      synthetic: true,
      fault_evidence: faultEvidence,
      attempts,
      accepted_output_count: acceptedCount,
      accepted_output_sha256: acceptedHash,
      reclaim_applicable: reclaimApplicable,
      ...(reclaimElapsed === undefined ? {} : { reclaim_elapsed_ms: reclaimElapsed, reclaim_bound_ms: 310_000 }),
      result: "pass",
    };
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

it("runs each named synthetic G6 fault ten times and writes raw attempt evidence", async () => {
  const evidencePath = process.env.G6_RESULTS;
  if (!evidencePath) throw new Error("set G6_RESULTS to a private JSONL output path");
  const rows: Evidence[] = [];
  for (const caseId of CASES) for (let repetition = 1; repetition <= repetitions; repetition++)
    rows.push(await runCase(caseId, repetition));
    writeFileSync(evidencePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", { mode: 0o600 });
  expect(rows).toHaveLength(CASES.length * repetitions);
});
