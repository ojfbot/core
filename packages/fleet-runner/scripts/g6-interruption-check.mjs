#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REPETITIONS = 10;
export const REQUIRED_CASES = Object.freeze({
  "completion-response-lost-after-commit": { workers: ["worker-a"], accepted: 1, reclaim: false, fault: "commit_response_loss" },
  "worker-sleep-or-partition": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "clocked_partition" },
  "lease-lost-during-upload": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "in_flight_signed_upload" },
  "crash-output-before-db-commit": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "process_kill_after_output" },
  "crash-db-boundary": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "process_kill_after_db_update" },
  "retry-exhaustion": { workers: ["worker-a", "worker-b"], accepted: 0, reclaim: false, fault: "retry_budget_exhausted" },
  "handler-ignores-cancellation": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "non_cooperative_handler" },
  "stale-fence-rejection": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "stale_fence" },
});

const EXPECTED_ARTIFACTS = [
  "decisions/fleet-runner/release-one-gates.json",
  "packages/fleet-runner/interruption.md",
  "packages/fleet-runner/scripts/g6-interruption-campaign.test.ts",
  "packages/fleet-runner/scripts/g6-interruption-check.mjs",
  "packages/fleet-runner/scripts/g6-interruption-check.test.mjs",
  "packages/fleet-runner/scripts/g6-interruption-run.mjs",
  "packages/fleet-runner/scripts/g6-trial-checkpoint.mjs",
  "packages/fleet-runner/scripts/g6-trial-checkpoint.test.mjs",
  "packages/fleet-runner/scripts/vitest.g6.config.ts",
  "pnpm-lock.yaml",
  "vitest.config.ts",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function reject(message) {
  throw new Error(`G6 evidence rejected: ${message}`);
}

function requireBoolean(value, label) {
  if (value !== true) reject(`${label} must be observed true`);
}

function validateReclaim(row, key) {
  const r = row.reclaim;
  if (!r || r.applicable !== true) reject(`${key} requires reclaim schedule evidence`);
  const values = [r.last_valid_renewal_at_ms, r.lease_expiry_at_ms, r.reclaim_claim_at_ms, r.lease_ms, r.poll_interval_ms];
  if (!values.every(Number.isSafeInteger) || values.some((n) => n < 0)) reject(`${key} has malformed reclaim schedule`);
  if (r.lease_ms !== 300_000 || r.poll_interval_ms !== 5_000) reject(`${key} does not use the gate's L=300s and P=5s`);
  if (r.lease_expiry_at_ms !== r.last_valid_renewal_at_ms + r.lease_ms) reject(`${key} lease expiry is not derived from the observed last renewal`);
  const elapsed = r.reclaim_claim_at_ms - r.last_valid_renewal_at_ms;
  const pollDelay = r.reclaim_claim_at_ms - r.lease_expiry_at_ms;
  if (elapsed < r.lease_ms || pollDelay < 0 || pollDelay > r.poll_interval_ms) reject(`${key} claim time does not match expiry plus an observed poll interval`);
  if (elapsed > r.lease_ms + 2 * r.poll_interval_ms) reject(`${key} exceeds L+2P`);
  if (r.last_valid_renewal_at_ms < row.attempts[0].claim_at_ms || r.lease_expiry_at_ms !== row.attempts[0].lease_expires_at_ms) reject(`${key} renewal/expiry evidence is inconsistent with the first observed attempt`);
  const reclaimed = row.attempts.find((a) => a.claim_at_ms === r.reclaim_claim_at_ms && a.worker_id === "worker-b");
  if (!reclaimed) reject(`${key} reclaim timestamp does not match a recorded attempt`);
}

function validateFault(row, key, spec) {
  if (!row.fault || row.fault.type !== spec.fault || !row.fault.observed || typeof row.fault.observed !== "object")
    reject(`${key} has contradictory or missing case-specific fault evidence`);
  const o = row.fault.observed;
  switch (row.case_id) {
    case "completion-response-lost-after-commit":
      requireBoolean(o.server_commit_observed, `${key}.server_commit_observed`);
      requireBoolean(o.first_response_dropped, `${key}.first_response_dropped`);
      if (o.completion_request_count !== 2 || o.completed_event_count !== 1) reject(`${key} must show two completion requests and one committed event`);
      break;
    case "worker-sleep-or-partition":
      requireBoolean(o.heartbeat_accepted_before_partition, `${key}.heartbeat_accepted_before_partition`);
      requireBoolean(o.partition_clocked, `${key}.partition_clocked`);
      requireBoolean(o.stale_attempt_rejected, `${key}.stale_attempt_rejected`);
      break;
    case "lease-lost-during-upload":
      requireBoolean(o.signed_request, `${key}.signed_request`);
      requireBoolean(o.upload_body_started, `${key}.upload_body_started`);
      requireBoolean(o.newer_claim_before_old_body_finished, `${key}.newer_claim_before_old_body_finished`);
      requireBoolean(o.old_response_rejected, `${key}.old_response_rejected`);
      if (o.old_upload_response !== false) reject(`${key} must retain the observed false response from the old upload`);
      break;
    case "crash-output-before-db-commit":
      if (o.child_signal !== "SIGKILL" || o.kill_point !== "after_output_before_db_update") reject(`${key} lacks the child-process output/DB crash boundary`);
      requireBoolean(o.persistent_store_reopened, `${key}.persistent_store_reopened`);
      if (o.row_after_restart !== "claimed" || o.completed_events_after_restart !== 0) reject(`${key} recovery state contradicts a pre-commit crash`);
      break;
    case "crash-db-boundary":
      if (o.child_signal !== "SIGKILL" || o.kill_point !== "after_db_update_before_transaction_commit") reject(`${key} lacks the transaction crash boundary`);
      requireBoolean(o.persistent_store_reopened, `${key}.persistent_store_reopened`);
      if (o.row_after_restart !== "claimed" || o.completed_events_after_restart !== 0) reject(`${key} did not prove SQLite rolled back the uncommitted completion`);
      break;
    case "retry-exhaustion":
      if (o.retry_events !== 1 || o.terminal_status !== "failed" || o.max_attempts !== 2) reject(`${key} does not show the exact retry exhaustion contract`);
      break;
    case "handler-ignores-cancellation":
      requireBoolean(o.handler_ignored_abort, `${key}.handler_ignored_abort`);
      requireBoolean(o.abort_signal_observed, `${key}.abort_signal_observed`);
      if (o.worker_result !== "lease-lost") reject(`${key} non-cooperative stale attempt did not lose authority`);
      requireBoolean(o.later_worker_accepted, `${key}.later_worker_accepted`);
      break;
    case "stale-fence-rejection":
      requireBoolean(o.stale_attempt_submitted_after_reclaim, `${key}.stale_attempt_submitted_after_reclaim`);
      requireBoolean(o.stale_attempt_rejected, `${key}.stale_attempt_rejected`);
      requireBoolean(o.newer_fence_accepted, `${key}.newer_fence_accepted`);
      break;
    default:
      reject(`${key} is not a named G6 fault case`);
  }
}

export function validateRows(rows, source) {
  if (!Array.isArray(rows) || rows.length !== Object.keys(REQUIRED_CASES).length * REPETITIONS)
    reject(`expected exactly ${Object.keys(REQUIRED_CASES).length * REPETITIONS} raw rows`);
  const expected = new Set(Object.keys(REQUIRED_CASES).flatMap((id) => Array.from({ length: REPETITIONS }, (_, i) => `${id}#${i + 1}`)));
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.case_id}#${row.repetition}`;
    if (!expected.has(key)) reject(`unexpected case/repetition ${key}`);
    if (seen.has(key)) reject(`duplicate repetition ${key}`);
    seen.add(key);
    const spec = REQUIRED_CASES[row.case_id];
    if (row.result !== "pass") reject(`${key} is ${String(row.result)}; untested faults block the deterministic verdict`);
    if (row.source_commit !== source.source_commit || row.source_tree !== source.source_tree) reject(`${key} source pin disagrees with bundle manifest`);
    const start = Date.parse(row.started_at), finish = Date.parse(row.finished_at);
    if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) reject(`${key} has invalid timestamps`);
    if (row.synthetic !== true) reject(`${key} must be explicitly labeled synthetic`);
    if (!Array.isArray(row.attempts) || row.attempts.length !== spec.workers.length) reject(`${key} requires exactly ${spec.workers.length} observed attempts`);
    for (let i = 0; i < row.attempts.length; i++) {
      const a = row.attempts[i];
      if (a.worker_id !== spec.workers[i] || !Number.isSafeInteger(a.fence) || a.fence < 1 || !Number.isSafeInteger(a.claim_at_ms) || !Number.isSafeInteger(a.lease_expires_at_ms) || a.lease_expires_at_ms <= a.claim_at_ms) reject(`${key} has malformed or out-of-order attempt evidence`);
      if (i > 0 && a.fence <= row.attempts[i - 1].fence) reject(`${key} fences must strictly increase`);
      if (i > 0 && a.claim_at_ms <= row.attempts[i - 1].claim_at_ms) reject(`${key} claim timestamps must strictly increase`);
    }
    if (row.accepted_output_count !== spec.accepted || (row.accepted_output_count === 1 && !/^[a-f0-9]{64}$/.test(row.accepted_output_sha256 ?? "")) || (row.accepted_output_count === 0 && row.accepted_output_sha256 !== null)) reject(`${key} accepted output count/hash contradicts its fault case`);
    if (spec.accepted === 1 && row.accepted_fence !== row.attempts.at(-1).fence) reject(`${key} accepted fence must be the final observed attempt`);
    if (spec.accepted === 0 && row.accepted_fence !== null) reject(`${key} must not name an accepted fence`);
    if (spec.reclaim) validateReclaim(row, key);
    else if (row.reclaim !== null) reject(`${key} must not claim a reclaim measurement`);
    validateFault(row, key, spec);
  }
  for (const key of expected) if (!seen.has(key)) reject(`missing repetition ${key}`);
  return { cases: Object.keys(REQUIRED_CASES).length, repetitions: REPETITIONS, rows: seen.size };
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function verifyBundle({ resultsPath, manifestPath, sourceRoot }) {
  const root = resolve(sourceRoot);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const resultsBytes = readFileSync(resultsPath);
  if (manifest.format !== "fleet-runner-g6-evidence/1") reject("manifest format is invalid");
  if (sha256(resultsBytes) !== manifest.results_sha256) reject("results JSONL digest differs from manifest");
  if (git(root, ["rev-parse", "HEAD"]) !== manifest.source_commit || git(root, ["rev-parse", "HEAD^{tree}"]) !== manifest.source_tree) reject("current source commit/tree differs from manifest");
  if (git(root, ["status", "--porcelain=v1", "--untracked-files=all", "--", "packages/fleet-runner", "scripts/fleet-runner", "decisions/fleet-runner/release-one-gates.json", "pnpm-lock.yaml", "vitest.config.ts"])) reject("source-bound paths are dirty");
  if (manifest.node !== "24.22.2" || manifest.pnpm !== "9.15.4") reject("tool versions do not match pinned qualification tools");
  if (manifest.full_gate_status !== "PENDING") reject("synthetic evidence cannot mark the full G6 gate passed");
  const artifacts = manifest.artifacts;
  if (!Array.isArray(artifacts) || artifacts.length !== EXPECTED_ARTIFACTS.length) reject("artifact inventory is incomplete");
  for (let i = 0; i < EXPECTED_ARTIFACTS.length; i++) {
    const item = artifacts[i];
    const expectedPath = EXPECTED_ARTIFACTS[i];
    if (item.path !== expectedPath || !/^[a-f0-9]{64}$/.test(item.sha256 ?? "")) reject(`artifact inventory drift at ${expectedPath}`);
    if (sha256(readFileSync(join(root, expectedPath))) !== item.sha256) reject(`artifact hash mismatch: ${expectedPath}`);
  }
  const rows = resultsBytes.toString("utf8").split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line); } catch { reject(`line ${i + 1} is not JSON`); }
  });
  const counts = validateRows(rows, { source_commit: manifest.source_commit, source_tree: manifest.source_tree });
  if (manifest.pending?.physical_lid_sleep_wake !== 3 || manifest.pending?.physical_wifi_disconnect_rejoin !== 3 || manifest.pending?.helpdesk_failure_isolation !== "PENDING" || manifest.pending?.fleetrunner_failure_isolation !== "PENDING") reject("manifest must preserve physical and service-isolation obligations as pending");
  return { ...counts, source_commit: manifest.source_commit, source_tree: manifest.source_tree };
}

function main() {
  const [resultsPath, manifestPath, sourceRoot] = process.argv.slice(2);
  if (!resultsPath || !manifestPath || !sourceRoot || process.argv.length !== 5) reject("usage: node g6-interruption-check.mjs <results.jsonl> <manifest.json> <source-root>");
  try {
    const summary = verifyBundle({ resultsPath, manifestPath, sourceRoot });
    console.log(`G6 synthetic evidence accepted: ${summary.cases} named cases × ${summary.repetitions} repetitions (${summary.rows} rows), source ${summary.source_commit}.`);
    console.log("Physical sleep/wake, Wi-Fi, and HelpDesk/Fleet isolation remain pending; this is not a full G6 verdict.");
  } catch (error) {
    reject(error instanceof Error ? error.message.replace(/^G6 evidence rejected: /, "") : String(error));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
