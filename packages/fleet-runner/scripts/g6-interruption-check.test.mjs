import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const checker = new URL("./g6-interruption-check.mjs", import.meta.url);
const caseIds = [
  "completion-response-lost-after-commit",
  "worker-sleep-or-partition",
  "lease-lost-during-upload",
  "crash-output-before-db-commit",
  "crash-db-boundary",
  "retry-exhaustion",
  "handler-ignores-cancellation",
  "fencing-disabled-negative-control",
];

function rows() {
  return caseIds.flatMap((case_id) => Array.from({ length: 10 }, (_, index) => ({
    case_id,
    repetition: index + 1,
    started_at: "2026-11-10T12:00:00.000Z",
    finished_at: "2026-11-10T12:00:01.000Z",
    synthetic: true,
    fault_evidence: "checker fixture only",
    attempts: [{ worker_id: "synthetic-worker", fence: index + 1 }],
    accepted_output_count: case_id === "retry-exhaustion" ? 0 : 1,
    accepted_output_sha256: case_id === "retry-exhaustion" ? null : "a".repeat(64),
    reclaim_applicable: false,
    result: "pass",
    ...(case_id === "fencing-disabled-negative-control" ? { mutation_detected: true } : {}),
  })));
}

function check(data) {
  const dir = mkdtempSync(join(tmpdir(), "g6-checker-test-"));
  const file = join(dir, "rows.jsonl");
  try {
    writeFileSync(file, data.map((row) => JSON.stringify(row)).join("\n") + "\n");
    return spawnSync(process.execPath, [checker.pathname, file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("accepts exactly ten structurally complete rows per named case", () => {
  const result = check(rows());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /8 named cases × 10 repetitions \(80 rows\)/);
});

test("rejects a missing repetition and a duplicate repetition", () => {
  const missing = rows();
  missing.pop();
  assert.notEqual(check(missing).status, 0);

  const duplicate = rows();
  duplicate.push(duplicate[0]);
  assert.match(check(duplicate).stderr, /duplicate repetition/);
});

test("rejects absent output hashes, missed bounds, and an undetected mutant", () => {
  const badHash = rows();
  badHash[0].accepted_output_sha256 = null;
  assert.match(check(badHash).stderr, /missing a SHA-256/);

  const badBound = rows();
  badBound[0].reclaim_applicable = true;
  badBound[0].reclaim_elapsed_ms = 311_000;
  badBound[0].reclaim_bound_ms = 310_000;
  assert.match(check(badBound).stderr, /exceeded its stated reclaim bound/);

  const mutant = rows();
  mutant.find((row) => row.case_id === "fencing-disabled-negative-control").mutation_detected = false;
  assert.match(check(mutant).stderr, /did not prove the checker detects/);
});
