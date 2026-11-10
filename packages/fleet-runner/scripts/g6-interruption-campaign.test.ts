import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";
import { generateToken, signer } from "../src/auth.js";
import { fleetClient } from "../src/client.js";
import type { FleetClient } from "../src/client.js";
import { JobStore, writeOutput } from "../src/jobs.js";
import type { Claim, JobStore as JobStoreType } from "../src/jobs.js";
import { fleetServer } from "../src/server.js";
import type { Server } from "node:http";
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
const LEASE_MS = 300_000;
const POLL_MS = 5_000;
const startAt = 10_000;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

type CaseId = (typeof CASES)[number];
type AttemptEvidence = { worker_id: string; fence: number; claim_at_ms: number; lease_expires_at_ms: number };
type ReclaimEvidence = {
  applicable: true;
  last_valid_renewal_at_ms: number;
  lease_expiry_at_ms: number;
  reclaim_claim_at_ms: number;
  lease_ms: number;
  poll_interval_ms: number;
};
type Evidence = {
  case_id: CaseId;
  repetition: number;
  source_commit: string;
  source_tree: string;
  started_at: string;
  finished_at: string;
  synthetic: true;
  fault: { type: string; observed: Record<string, unknown> };
  attempts: AttemptEvidence[];
  accepted_output_count: number;
  accepted_output_sha256: string | null;
  accepted_fence: number | null;
  reclaim: ReclaimEvidence | null;
  result: "pass" | "UNTESTED";
};

async function fixture(caseId: string) {
  const dir = mkdtempSync(join(tmpdir(), "fleet-g6-http-"));
  const outputDir = join(dir, "accepted");
  const now = { value: startAt };
  const dbPath = join(dir, "jobs.sqlite");
  for (const id of ["owner", "worker-a", "worker-b"]) generateToken(join(dir, id));
  let store: JobStoreType = new JobStore(dbPath, { now: () => now.value, leaseMs: LEASE_MS });
  let server: Server = fleetServer(store, { registry: dir, outDir: outputDir });
  let serverClosed = false;
  let storeClosed = false;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing synthetic listener");
  const endpoint = `http://127.0.0.1:${address.port}`;
  const owner = fleetClient(endpoint, "owner", join(dir, "owner"));
  const workerA = fleetClient(endpoint, "worker-a", join(dir, "worker-a"));
  const workerB = fleetClient(endpoint, "worker-b", join(dir, "worker-b"));
  const attempts: AttemptEvidence[] = [];
  const close = async () => {
    if (!serverClosed) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      serverClosed = true;
    }
    if (!storeClosed) { store.close(); storeClosed = true; }
  };
  const reopenStore = () => {
    store = new JobStore(dbPath, { now: () => now.value, leaseMs: LEASE_MS });
    storeClosed = false;
    return store;
  };
  const claim = async (client: FleetClient, workerId: string, kinds = ["noop"]) => {
    const job = await client.claim([], kinds);
    if (!job) throw new Error(`expected claim by ${workerId}`);
    attempts.push({ worker_id: workerId, fence: job.fence, claim_at_ms: now.value, lease_expires_at_ms: job.leaseExpires });
    return job;
  };
  const enqueue = async (id: string, maxAttempts = 3) => {
    const result = await owner.enqueue({ kind: "noop", inputs: [`${caseId}-${id}`], payload: null, maxAttempts });
    return result.key;
  };
  const recordRenewal = async (client: FleetClient, job: Claim) => {
    if (!(await client.heartbeat(job))) throw new Error("expected accepted heartbeat");
    return now.value;
  };
  const reclaimAfterPoll = async (key: string, renewalAt: number) => {
    const expiry = renewalAt + LEASE_MS;
    now.value = expiry + POLL_MS;
    const job = await claim(workerB, "worker-b");
    if (job.key !== key) throw new Error("worker claimed unexpected key");
    return {
      job,
      evidence: {
        applicable: true as const,
        last_valid_renewal_at_ms: renewalAt,
        lease_expiry_at_ms: expiry,
        reclaim_claim_at_ms: now.value,
        lease_ms: LEASE_MS,
        poll_interval_ms: POLL_MS,
      },
    };
  };
  return { dir, outputDir, dbPath, now, get store() { return store; }, set store(value: JobStoreType) { store = value; }, server, owner, workerA, workerB, attempts, close, reopenStore, claim, enqueue, recordRenewal, reclaimAfterPoll };
}

function childKillSource(modulePath: string, key: string, fence: number, outDir: string, bytes: Buffer) {
  return `import { JobStore, writeOutput } from ${JSON.stringify(pathToFileURL(modulePath).href)};
const [dbPath, at, outputDir, jobKey, fence, worker, data] = process.argv.slice(1);
const store = new JobStore(dbPath, { now: () => Number(at), leaseMs: ${LEASE_MS} });
const bytes = Buffer.from(data, "base64");
store.complete(jobKey, Number(fence), worker, () => {
  writeOutput(outputDir, { key: jobKey, fence: Number(fence) }, bytes);
  ${"__KILL_POINT__"}
  return { file: jobKey + "." + fence + ".jsonl", sha256: ${JSON.stringify(sha(bytes))} };
});
store.close();
`;
}

function generateJobsModule(dir: string, killAfterDbUpdate: boolean) {
  let source = readFileSync(new URL("../src/jobs.ts", import.meta.url), "utf8");
  if (killAfterDbUpdate) {
    const anchor = "        .run(accepted.sha256, accepted.file, now, key, fence, worker, now);\n      const ok = Number(res.changes) === 1;";
    if (source.split(anchor).length !== 2) throw new Error("DB-boundary mutation anchor drift");
    source = source.replace(anchor, `        .run(accepted.sha256, accepted.file, now, key, fence, worker, now);\n      process.kill(process.pid, "SIGKILL");\n      const ok = Number(res.changes) === 1;`);
  }
  const modulePath = join(dir, "jobs.mjs");
  writeFileSync(modulePath, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { mode: 0o600 });
  return modulePath;
}

function killChild(f, key: string, job: Claim, bytes: Buffer, killPoint: "after_output_before_db_update" | "after_db_update_before_transaction_commit") {
  const modulePath = generateJobsModule(f.dir, killPoint === "after_db_update_before_transaction_commit");
  const script = childKillSource(modulePath, key, job.fence, f.outputDir, bytes)
    .replace("__KILL_POINT__", killPoint === "after_output_before_db_update" ? 'process.kill(process.pid, "SIGKILL");' : "");
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script,
    f.dbPath, String(f.now.value), f.outputDir, key, String(job.fence), "worker-a", bytes.toString("base64")],
  { encoding: "utf8", stdio: "ignore", timeout: 15_000 });
  return child.signal;
}

async function caseEvidence(caseId: CaseId, repetition: number, source: { commit: string; tree: string }): Promise<Evidence> {
  const started = new Date().toISOString();
  const f = await fixture(caseId);
  const payload = Buffer.from(`${caseId}:${repetition}:synthetic-output\n`);
  let key = "";
  let faultType = "";
  let observed: Record<string, unknown> = {};
  let reclaim: ReclaimEvidence | null = null;
  let acceptedHash: string | null = null;
  let acceptedFence: number | null = null;
  try {
    key = await f.enqueue(`${repetition}`, caseId === "retry-exhaustion" ? 2 : 3);

    if (caseId === "completion-response-lost-after-commit") {
      faultType = "commit_response_loss";
      const first = await f.claim(f.workerA, "worker-a");
      const originalFetch = globalThis.fetch;
      let requests = 0;
      globalThis.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        if (new URL(String(input)).pathname === "/complete" && requests++ === 0) {
          await response.arrayBuffer();
          throw new Error("synthetic response dropped after service commit");
        }
        return response;
      };
      let dropped = false;
      try { await f.workerA.complete(first, payload, sha(payload)); } catch { dropped = true; }
      const retryAccepted = await f.workerA.complete(first, payload, sha(payload));
      globalThis.fetch = originalFetch;
      const events = await f.owner.events();
      observed = { server_commit_observed: f.store.get(key)?.status === "done", first_response_dropped: dropped, completion_request_count: requests, completed_event_count: events.filter((e) => e.key === key && e.type === "completed").length };
      expect(retryAccepted).toBe(true);
      expect(observed).toMatchObject({ server_commit_observed: true, first_response_dropped: true, completion_request_count: 2, completed_event_count: 1 });
      acceptedHash = sha(payload); acceptedFence = first.fence;
    } else if (caseId === "worker-sleep-or-partition") {
      faultType = "clocked_partition";
      const first = await f.claim(f.workerA, "worker-a");
      const renewalAt = await f.recordRenewal(f.workerA, first);
      const { job: second, evidence } = await f.reclaimAfterPoll(key, renewalAt);
      const staleAccepted = await f.workerA.complete(first, payload, sha(payload));
      const accepted = await f.workerB.complete(second, payload, sha(payload));
      reclaim = evidence;
      observed = { heartbeat_accepted_before_partition: true, partition_clocked: true, stale_attempt_rejected: staleAccepted === false };
      expect(accepted).toBe(true); expect(staleAccepted).toBe(false);
      acceptedHash = sha(payload); acceptedFence = second.fence;
    } else if (caseId === "lease-lost-during-upload") {
      faultType = "in_flight_signed_upload";
      const first = await f.claim(f.workerA, "worker-a");
      const renewalAt = await f.recordRenewal(f.workerA, first);
      const staleBytes = Buffer.from(`stale-upload:${repetition}`);
      const staleHash = sha(staleBytes);
      const body = Buffer.from(JSON.stringify({ key, fence: first.fence, sha256: staleHash, output: staleBytes.toString("base64") }));
      const authorization = signer("worker-a", join(f.dir, "worker-a"))("POST", "/complete", body);
      let sawBody!: () => void;
      const bodyStarted = new Promise<void>((resolve) => { sawBody = resolve; });
      const request = httpRequest(`${"http://127.0.0.1"}:${(f.server.address() as { port: number }).port}/complete`, {
        method: "POST", headers: { authorization, "content-type": "application/json", "content-length": String(body.length) },
      });
      const responsePromise = new Promise<{ status: number; json: unknown }>((resolve, reject) => {
        request.once("response", (response: IncomingMessage) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve({ status: response.statusCode ?? 0, json: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
        });
        request.once("error", reject);
      });
      const onRequest = (incoming: IncomingMessage) => {
        if (incoming.url === "/complete") { f.server.off("request", onRequest); incoming.once("data", () => sawBody()); }
      };
      f.server.on("request", onRequest);
      const split = Math.max(1, Math.floor(body.length / 2));
      request.write(body.subarray(0, split));
      await bodyStarted;
      const { job: second, evidence } = await f.reclaimAfterPoll(key, renewalAt);
      request.end(body.subarray(split));
      const staleResponse = await responsePromise;
      const accepted = await f.workerB.complete(second, payload, sha(payload));
      reclaim = evidence;
      observed = { signed_request: true, upload_body_started: true, newer_claim_before_old_body_finished: second.fence > first.fence, old_response_rejected: staleResponse.status === 200 && staleResponse.json === false, old_upload_response: staleResponse.json };
      expect(accepted).toBe(true); expect(staleResponse).toMatchObject({ status: 200, json: false });
      acceptedHash = sha(payload); acceptedFence = second.fence;
    } else if (caseId === "crash-output-before-db-commit" || caseId === "crash-db-boundary") {
      faultType = caseId === "crash-output-before-db-commit" ? "process_kill_after_output" : "process_kill_after_db_update";
      const first = await f.claim(f.workerA, "worker-a");
      const renewalAt = await f.recordRenewal(f.workerA, first);
      await f.close();
      const signal = killChild(f, key, first, payload, caseId === "crash-output-before-db-commit" ? "after_output_before_db_update" : "after_db_update_before_transaction_commit");
      expect(signal).toBe("SIGKILL");
      f.now.value = renewalAt + LEASE_MS + POLL_MS;
      f.store = f.reopenStore();
      const afterRestart = f.store.get(key);
      const completedBeforeRecovery = f.store.events(0).filter((e) => e.key === key && e.type === "completed").length;
      expect(afterRestart).toMatchObject({ status: "claimed", output: null });
      expect(completedBeforeRecovery).toBe(0);
      const second = f.store.claim("worker-b", [], ["noop"]);
      if (!second) throw new Error("expected post-restart claim");
      const claimAt = f.now.value;
      f.attempts.push({ worker_id: "worker-b", fence: second.fence, claim_at_ms: claimAt, lease_expires_at_ms: second.leaseExpires });
      const accepted = f.store.complete(key, second.fence, "worker-b", () => writeOutput(f.outputDir, second, payload));
      expect(accepted).toBe(true);
      reclaim = { applicable: true, last_valid_renewal_at_ms: renewalAt, lease_expiry_at_ms: renewalAt + LEASE_MS, reclaim_claim_at_ms: claimAt, lease_ms: LEASE_MS, poll_interval_ms: POLL_MS };
      observed = { child_signal: signal, kill_point: caseId === "crash-output-before-db-commit" ? "after_output_before_db_update" : "after_db_update_before_transaction_commit", persistent_store_reopened: true, row_after_restart: afterRestart?.status, completed_events_after_restart: completedBeforeRecovery };
      acceptedHash = sha(payload); acceptedFence = second.fence;
    } else if (caseId === "retry-exhaustion") {
      faultType = "retry_budget_exhausted";
      const first = await f.claim(f.workerA, "worker-a");
      expect(await f.workerA.fail(first, "synthetic-retry", true)).toBe(true);
      f.now.value += 1;
      const second = await f.claim(f.workerB, "worker-b");
      expect(await f.workerB.fail(second, "synthetic-retry", true)).toBe(true);
      const events = await f.owner.events();
      observed = { retry_events: events.filter((e) => e.key === key && e.type === "retry").length, terminal_status: f.store.get(key)?.status, max_attempts: 2 };
      expect(f.store.get(key)).toMatchObject({ status: "failed", output: null, attempts: 2 });
    } else if (caseId === "handler-ignores-cancellation") {
      faultType = "non_cooperative_handler";
      const abort = new AbortController();
      let startedHandler!: () => void;
      let releaseHandler!: () => void;
      const handlerStarted = new Promise<void>((resolve) => { startedHandler = resolve; });
      const held = new Promise<void>((resolve) => { releaseHandler = resolve; });
      let claimSeen: Claim | undefined;
      const running = workOnce(f.workerA, {
        now: () => f.now.value, signal: abort.signal, caps: [], outDir: join(f.dir, "worker-a-out"), heartbeatMs: 100_000,
        handlers: { noop: async (job, context) => { claimSeen = job; startedHandler(); await held; expect(context.signal.aborted).toBe(true); return writeOutput(context.outDir, job, payload); } },
      });
      await handlerStarted;
      if (!claimSeen) throw new Error("handler claim was not captured");
      f.attempts.push({ worker_id: "worker-a", fence: claimSeen.fence, claim_at_ms: startAt, lease_expires_at_ms: claimSeen.leaseExpires });
      const renewalAt = await f.recordRenewal(f.workerA, claimSeen);
      const { job: second, evidence } = await f.reclaimAfterPoll(key, renewalAt);
      abort.abort();
      releaseHandler();
      const result = await running;
      const accepted = await f.workerB.complete(second, payload, sha(payload));
      reclaim = evidence;
      observed = { handler_ignored_abort: true, abort_signal_observed: true, worker_result: result, later_worker_accepted: accepted };
      expect(result).toBe("lease-lost"); expect(accepted).toBe(true);
      acceptedHash = sha(payload); acceptedFence = second.fence;
    } else {
      faultType = "stale_fence";
      const first = await f.claim(f.workerA, "worker-a");
      const renewalAt = await f.recordRenewal(f.workerA, first);
      const { job: second, evidence } = await f.reclaimAfterPoll(key, renewalAt);
      const staleAccepted = await f.workerA.complete(first, Buffer.from("stale"), sha(Buffer.from("stale")));
      const newerAccepted = await f.workerB.complete(second, payload, sha(payload));
      reclaim = evidence;
      observed = { stale_attempt_submitted_after_reclaim: true, stale_attempt_rejected: staleAccepted === false, newer_fence_accepted: newerAccepted && second.fence > first.fence };
      expect(staleAccepted).toBe(false); expect(newerAccepted).toBe(true);
      acceptedHash = sha(payload); acceptedFence = second.fence;
    }

    const finalRow = f.store.get(key);
    const acceptedCount = finalRow?.status === "done" ? 1 : 0;
    expect(acceptedCount).toBe(caseId === "retry-exhaustion" ? 0 : 1);
    if (acceptedCount) {
      expect(finalRow?.output).toBe(acceptedHash);
      expect(finalRow?.fence).toBe(acceptedFence);
      expect(finalRow?.outputFile).toBeTruthy();
      expect(sha(readFileSync(join(f.outputDir, finalRow!.outputFile!)))).toBe(acceptedHash);
    }
    return {
      case_id: caseId,
      repetition,
      source_commit: source.commit,
      source_tree: source.tree,
      started_at: started,
      finished_at: new Date().toISOString(),
      synthetic: true,
      fault: { type: faultType, observed },
      attempts: f.attempts,
      accepted_output_count: acceptedCount,
      accepted_output_sha256: acceptedHash,
      accepted_fence: acceptedFence,
      reclaim,
      result: "pass",
    };
  } finally {
    try { await f.close(); } catch {}
    rmSync(f.dir, { recursive: true, force: true });
  }
}

it("runs each named synthetic G6 fault ten times and writes case-specific raw evidence", async () => {
  const evidencePath = process.env.G6_RESULTS;
  const commit = process.env.G6_SOURCE_COMMIT;
  const tree = process.env.G6_SOURCE_TREE;
  if (!evidencePath || !commit || !tree) throw new Error("G6_RESULTS, G6_SOURCE_COMMIT and G6_SOURCE_TREE are required");
  const rows: Evidence[] = [];
  for (const caseId of CASES) for (let repetition = 1; repetition <= repetitions; repetition++)
    rows.push(await caseEvidence(caseId, repetition, { commit, tree }));
  writeFileSync(evidencePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", { mode: 0o600, flag: "wx" });
  expect(rows).toHaveLength(CASES.length * repetitions);
});
