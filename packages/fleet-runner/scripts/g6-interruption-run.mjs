#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const output = process.env.G6_RESULTS;
if (!output || process.argv.length !== 2) {
  console.error("usage: G6_RESULTS=/private/path/results.jsonl node packages/fleet-runner/scripts/g6-interruption-run.mjs");
  process.exit(2);
}
const testPath = "packages/fleet-runner/scripts/g6-interruption-campaign.test.ts";
const config = "packages/fleet-runner/scripts/vitest.g6.config.ts";
const run = spawnSync("pnpm", ["exec", "vitest", "run", "--config", config, testPath], {
  env: process.env,
  stdio: "inherit",
});
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);
const checked = spawnSync(process.execPath, ["packages/fleet-runner/scripts/g6-interruption-check.mjs", output], {
  stdio: "inherit",
});
if (checked.error) throw checked.error;
process.exit(checked.status ?? 1);
