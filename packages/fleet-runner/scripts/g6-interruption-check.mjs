#!/usr/bin/env node
import { readFileSync } from "node:fs";

const REQUIRED = [
  "completion-response-lost-after-commit",
  "worker-sleep-or-partition",
  "lease-lost-during-upload",
  "crash-output-before-db-commit",
  "crash-db-boundary",
  "retry-exhaustion",
  "handler-ignores-cancellation",
  "fencing-disabled-negative-control",
];
const REPETITIONS = 10;

function fail(message) {
  console.error(`G6 evidence rejected: ${message}`);
  process.exit(1);
}

const path = process.argv[2];
if (!path || process.argv.length !== 3) fail("usage: node g6-interruption-check.mjs <results.jsonl>");
let rows;
try {
  rows = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { fail(`line ${index + 1} is not JSON`); }
  });
} catch (error) {
  fail(`cannot read results (${error instanceof Error ? error.message : "unknown error"})`);
}

if (!rows.length) fail("empty evidence file");
const expected = new Set(REQUIRED.flatMap((caseId) =>
  Array.from({ length: REPETITIONS }, (_, index) => `${caseId}#${index + 1}`),
));
const seen = new Set();
for (const row of rows) {
  const key = `${row.case_id}#${row.repetition}`;
  if (!expected.has(key)) fail(`unexpected case/repetition ${key}`);
  if (seen.has(key)) fail(`duplicate repetition ${key}`);
  seen.add(key);
  if (row.result !== "pass") fail(`${key} result is ${String(row.result)}`);
  const started = Date.parse(row.started_at);
  const finished = Date.parse(row.finished_at);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started)
    fail(`${key} has invalid timestamps`);
  if (typeof row.fault_evidence !== "string" || !row.fault_evidence.trim())
    fail(`${key} has no observed fault evidence`);
  if (!Array.isArray(row.attempts) || row.attempts.length === 0)
    fail(`${key} has no attempt/fence evidence`);
  for (const attempt of row.attempts) {
    if (!Number.isSafeInteger(attempt.fence) || attempt.fence < 1 || typeof attempt.worker_id !== "string" || !attempt.worker_id)
      fail(`${key} has malformed attempt/fence evidence`);
  }
  if (!Number.isSafeInteger(row.accepted_output_count) || row.accepted_output_count < 0 || row.accepted_output_count > 1)
    fail(`${key} has invalid accepted_output_count`);
  if (row.accepted_output_count === 1 && !/^[a-f0-9]{64}$/.test(row.accepted_output_sha256 ?? ""))
    fail(`${key} accepted output is missing a SHA-256`);
  if (row.accepted_output_count === 0 && row.accepted_output_sha256 !== null)
    fail(`${key} must use null SHA-256 when no output was accepted`);
  if (row.reclaim_applicable === true) {
    if (!Number.isFinite(row.reclaim_elapsed_ms) || !Number.isFinite(row.reclaim_bound_ms) || row.reclaim_elapsed_ms < 0 || row.reclaim_bound_ms < 0)
      fail(`${key} has invalid reclaim-bound measurements`);
    if (row.reclaim_elapsed_ms > row.reclaim_bound_ms)
      fail(`${key} exceeded its stated reclaim bound`);
  } else if (row.reclaim_applicable !== false) {
    fail(`${key} must state whether the conditional reclaim bound applies`);
  }
  if (row.case_id === "fencing-disabled-negative-control" && row.mutation_detected !== true)
    fail(`${key} did not prove the checker detects a fencing-disabled mutant`);
  if (row.synthetic !== true) fail(`${key} must identify synthetic-only evidence`);
}
for (const key of expected) if (!seen.has(key)) fail(`missing repetition ${key}`);

console.log(`G6 synthetic evidence accepted: ${REQUIRED.length} named cases × ${REPETITIONS} repetitions (${seen.size} rows).`);
console.log("This verdict is deterministic local qualification only; it cannot satisfy physical sleep/wake or Wi-Fi trials.");
