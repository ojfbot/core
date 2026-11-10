import assert from "node:assert/strict";
import test from "node:test";
import { validateRows } from "./g6-interruption-check.mjs";

const source = { source_commit: "c".repeat(40), source_tree: "d".repeat(40) };
const specs = {
  "completion-response-lost-after-commit": { workers: ["worker-a"], accepted: 1, reclaim: false, fault: "commit_response_loss", observed: { server_commit_observed: true, first_response_dropped: true, completion_request_count: 2, completed_event_count: 1 } },
  "worker-sleep-or-partition": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "clocked_partition", observed: { heartbeat_accepted_before_partition: true, partition_clocked: true, stale_attempt_rejected: true } },
  "lease-lost-during-upload": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "in_flight_signed_upload", observed: { signed_request: true, upload_body_started: true, newer_claim_before_old_body_finished: true, old_response_rejected: true, old_upload_response: false } },
  "crash-output-before-db-commit": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "process_kill_after_output", observed: { child_signal: "SIGKILL", kill_point: "after_output_before_db_update", persistent_store_reopened: true, row_after_restart: "claimed", completed_events_after_restart: 0 } },
  "crash-db-boundary": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "process_kill_after_db_update", observed: { child_signal: "SIGKILL", kill_point: "after_db_update_before_transaction_commit", persistent_store_reopened: true, row_after_restart: "claimed", completed_events_after_restart: 0 } },
  "retry-exhaustion": { workers: ["worker-a", "worker-b"], accepted: 0, reclaim: false, fault: "retry_budget_exhausted", observed: { retry_events: 1, terminal_status: "failed", max_attempts: 2 } },
  "handler-ignores-cancellation": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "non_cooperative_handler", observed: { handler_ignored_abort: true, abort_signal_observed: true, worker_result: "lease-lost", later_worker_accepted: true } },
  "stale-fence-rejection": { workers: ["worker-a", "worker-b"], accepted: 1, reclaim: true, fault: "stale_fence", observed: { stale_attempt_submitted_after_reclaim: true, stale_attempt_rejected: true, newer_fence_accepted: true } },
};

function rows() {
  return Object.entries(specs).flatMap(([case_id, spec]) => Array.from({ length: 10 }, (_, index) => {
    const attempts = spec.workers.map((worker_id, attempt) => ({
      worker_id,
      fence: index * 2 + attempt + 1,
      claim_at_ms: 10_000 + attempt * (spec.reclaim ? 305_000 : 1),
      lease_expires_at_ms: 310_000 + attempt * (spec.reclaim ? 305_000 : 1),
    }));
    return {
      ...source, case_id, repetition: index + 1,
      started_at: "2026-11-10T12:00:00.000Z", finished_at: "2026-11-10T12:00:01.000Z", synthetic: true,
      fault: { type: spec.fault, observed: structuredClone(spec.observed) },
      attempts, accepted_output_count: spec.accepted,
      accepted_output_sha256: spec.accepted ? "a".repeat(64) : null,
      accepted_fence: spec.accepted ? attempts.at(-1).fence : null,
      reclaim: spec.reclaim ? { applicable: true, last_valid_renewal_at_ms: 10_000, lease_expiry_at_ms: 310_000, reclaim_claim_at_ms: 315_000, lease_ms: 300_000, poll_interval_ms: 5_000 } : null,
      result: "pass",
    };
  }));
}

function rejects(mutate, pattern) {
  const data = rows();
  mutate(data);
  assert.throws(() => validateRows(data, source), pattern);
}

test("accepts ten case-specific, source-bound rows for each required fault", () => {
  assert.deepEqual(validateRows(rows(), source), { cases: 8, repetitions: 10, rows: 80 });
});

test("rejects missing, duplicate, unknown, or untested repetitions", () => {
  const missing = rows(); missing.pop();
  assert.throws(() => validateRows(missing, source), /expected exactly 80/);
  rejects((data) => { data[1] = structuredClone(data[0]); }, /duplicate repetition/);
  rejects((data) => { data[0].case_id = "unknown"; }, /unexpected case\/repetition/);
  rejects((data) => { data[0].result = "UNTESTED"; }, /UNTESTED/);
});

test("rejects contradictory upload attempts, reclaim fields, and old response", () => {
  rejects((data) => { const row = data.find((x) => x.case_id === "lease-lost-during-upload"); row.attempts = [row.attempts[0]]; row.reclaim = null; }, /exactly 2 observed attempts/);
  rejects((data) => { const row = data.find((x) => x.case_id === "lease-lost-during-upload"); row.fault.observed.newer_claim_before_old_body_finished = false; }, /newer_claim_before_old_body_finished/);
  rejects((data) => { const row = data.find((x) => x.case_id === "lease-lost-during-upload"); row.reclaim.reclaim_claim_at_ms = 316_000; row.attempts[1].claim_at_ms = 316_000; }, /observed poll interval/);
  rejects((data) => { const row = data.find((x) => x.case_id === "lease-lost-during-upload"); row.fault.observed.old_upload_response = true; }, /false response/);
});

test("rejects incorrect crash, output, retry, fence, and source evidence", () => {
  rejects((data) => { const row = data.find((x) => x.case_id === "crash-db-boundary"); row.fault.observed.child_signal = "SIGTERM"; }, /transaction crash boundary/);
  rejects((data) => { data[0].accepted_output_count = 0; }, /count\/hash contradict/);
  rejects((data) => { const row = data.find((x) => x.case_id === "retry-exhaustion"); row.accepted_output_count = 1; }, /count\/hash contradict/);
  rejects((data) => { const row = data.find((x) => x.case_id === "stale-fence-rejection"); row.attempts[1].fence = row.attempts[0].fence; }, /fences must strictly increase/);
  rejects((data) => { data[0].source_commit = "e".repeat(40); }, /source pin disagrees/);
});
