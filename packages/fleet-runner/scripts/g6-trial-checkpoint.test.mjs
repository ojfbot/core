import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const command = new URL("./g6-trial-checkpoint.mjs", import.meta.url).pathname;
const key = "a".repeat(64);
function invoke(args) {
  return spawnSync(process.execPath, [command, ...args], { encoding: "utf8" });
}

test("creates one active unique trial, resumes it, records fences and finishes once", () => {
  const dir = mkdtempSync(join(tmpdir(), "g6-checkpoint-test-"));
  const checkpoint = join(dir, "lid-1.json");
  try {
    assert.equal(invoke(["begin", "lid-1", "worker-a", checkpoint]).status, 0);
    assert.notEqual(invoke(["begin", "wifi-1", "worker-b", join(dir, "wifi-1.json")]).status, 0);
    assert.equal(invoke(["arm", checkpoint, key, "1"]).status, 0);
    assert.equal(invoke(["attempt", checkpoint, "worker-b", key, "2"]).status, 0);
    const resume = invoke(["resume", checkpoint]);
    assert.equal(resume.status, 0, resume.stderr);
    const state = JSON.parse(resume.stdout);
    assert.equal(state.trial_id, "lid-1");
    assert.equal(state.status, "armed");
    assert.deepEqual(state.attempts.map((item) => item.fence), [1, 2]);
    assert.notEqual(invoke(["attempt", checkpoint, "worker-b", key, "2"]).status, 0);
    assert.equal(invoke(["finish", checkpoint, "pass", "private/os-receipt"]).status, 0);
    const finalState = JSON.parse(readFileSync(checkpoint, "utf8"));
    assert.equal(finalState.status, "passed");
    assert.notEqual(invoke(["resume", checkpoint]).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses unstable trial IDs and checkpoint paths that do not match", () => {
  const dir = mkdtempSync(join(tmpdir(), "g6-checkpoint-invalid-test-"));
  try {
    assert.notEqual(invoke(["begin", "lid-4", "worker-a", join(dir, "lid-4.json")]).status, 0);
    assert.notEqual(invoke(["begin", "lid-1", "worker-a", join(dir, "wifi-1.json")]).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
