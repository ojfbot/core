#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const evidencePath = process.env.G6_RESULTS && resolve(process.env.G6_RESULTS);
const manifestPath = evidencePath && `${evidencePath}.manifest.json`;
const pnpm = process.env.FLEET_PNPM ?? "pnpm";
const artifactPaths = [
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
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
}
function git(args) {
  const result = run("git", args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

assert.equal(process.versions.node, "24.22.2", "use the pinned Node runtime");
assert.ok(evidencePath && manifestPath, "set G6_RESULTS to a new private file path");
assert.equal(process.argv.length, 2, "the campaign takes no positional arguments");
assert.ok(!existsSync(evidencePath) && !existsSync(manifestPath), "choose new result and manifest paths");
const relativeOutput = relative(root, evidencePath);
assert.ok(relativeOutput.startsWith(`..${sep}`) || relativeOutput === "..", "keep raw evidence outside the source checkout");
const pnpmVersion = run(pnpm, ["--version"]);
assert.equal(pnpmVersion.status, 0, pnpmVersion.stderr);
assert.equal(pnpmVersion.stdout.trim(), "9.15.4", "use the pinned pnpm runtime");
const dirty = git(["status", "--porcelain=v1", "--untracked-files=all", "--", "packages/fleet-runner", "scripts/fleet-runner", "decisions/fleet-runner/release-one-gates.json", "pnpm-lock.yaml", "vitest.config.ts"]);
assert.equal(dirty, "", "commit all source/config before qualification");
const sourceCommit = git(["rev-parse", "HEAD"]);
const sourceTree = git(["rev-parse", "HEAD^{tree}"]);
mkdirSync(dirname(evidencePath), { recursive: true, mode: 0o700 });
const testPath = "packages/fleet-runner/scripts/g6-interruption-campaign.test.ts";
const configPath = "packages/fleet-runner/scripts/vitest.g6.config.ts";
const testRun = run(pnpm, ["exec", "vitest", "run", "--config", configPath, testPath], {
  env: { ...process.env, G6_SOURCE_COMMIT: sourceCommit, G6_SOURCE_TREE: sourceTree },
  stdio: "inherit",
});
if (testRun.error) throw testRun.error;
assert.equal(testRun.status, 0, "campaign failed or is untested; no evidence manifest was written");
assert.equal(git(["rev-parse", "HEAD"]), sourceCommit, "source HEAD moved during the campaign");
assert.equal(git(["rev-parse", "HEAD^{tree}"]), sourceTree, "source tree changed during the campaign");
assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all", "--", "packages/fleet-runner", "scripts/fleet-runner", "decisions/fleet-runner/release-one-gates.json", "pnpm-lock.yaml", "vitest.config.ts"]), "", "source/config changed during the campaign");
const resultsBytes = readFileSync(evidencePath);
const manifest = {
  format: "fleet-runner-g6-evidence/1",
  source_commit: sourceCommit,
  source_tree: sourceTree,
  node: process.versions.node,
  pnpm: pnpmVersion.stdout.trim(),
  results_sha256: hash(resultsBytes),
  artifacts: artifactPaths.map((path) => ({ path, sha256: hash(readFileSync(resolve(root, path))) })),
  pending: {
    physical_lid_sleep_wake: 3,
    physical_wifi_disconnect_rejoin: 3,
    helpdesk_failure_isolation: "PENDING",
    fleetrunner_failure_isolation: "PENDING",
  },
  full_gate_status: "PENDING",
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const checker = "packages/fleet-runner/scripts/g6-interruption-check.mjs";
const checked = run(process.execPath, [checker, evidencePath, manifestPath, root], { stdio: "inherit" });
if (checked.error) throw checked.error;
process.exit(checked.status ?? 1);
