#!/usr/bin/env node
// weekly-measure.mjs — the re-measurement cadence (audit slice rm-l2-ojfbot#S13, plan H7/I8).
//
// One command, safe to run anywhere, that answers three questions with committed artifacts:
//   1. Is the 2026-07-04 audit program being delivered?   → docs/audit-delivery/YYYY-MM-DD.json
//      (runs audit-delivery-check.mjs --json; prints the count diff vs the previous artifact)
//   2. What does skill adoption look like this week?      → docs/skill-metrics-YYYY-MM-DD.md
//      (runs skill-metrics.mjs; SKIPPED with a reason when no live telemetry on this machine —
//       cloud clones have no ~/.claude streams; the snapshot must come from where telemetry lives)
//   3. Is the vault's repo read-model rotting?            → stderr nag when sync age > 14d
//
// Exit 0 always (a measurement run never blocks anything); pass --check to ALSO propagate the
// oracle's regression/staleness gate as the exit code. Designed for launchd/cron/routine use;
// artifacts are plain files so the diff shows up in git and the standup can read them.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);
const gate = process.argv.includes("--check");

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", cwd: CORE });

// ---- 1. delivery oracle ----
const oracleDir = path.join(CORE, "docs", "audit-delivery");
mkdirSync(oracleDir, { recursive: true });
let oracleExit = 0;
let oracleJson;
try {
  oracleJson = run("node", ["scripts/audit-delivery-check.mjs", "--json"]);
} catch (e) {
  oracleJson = e.stdout ?? "{}"; // --json without --check never exits 1; belt and braces
}
const artifact = path.join(oracleDir, `${today}.json`);
writeFileSync(artifact, oracleJson);
const counts = JSON.parse(oracleJson).counts ?? {};

const prior = readdirSync(oracleDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== `${today}.json`)
  .sort()
  .pop();
let diffNote = "first artifact — no prior week to diff";
if (prior) {
  const prev = JSON.parse(readFileSync(path.join(oracleDir, prior), "utf8")).counts ?? {};
  const keys = [...new Set([...Object.keys(counts), ...Object.keys(prev)])];
  diffNote =
    `vs ${prior.replace(".json", "")}: ` +
    keys.map((k) => `${k} ${prev[k] ?? 0}→${counts[k] ?? 0}`).join(" · ");
}
console.log(`[1/3] delivery oracle → ${path.relative(CORE, artifact)}`);
console.log(`      ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
console.log(`      ${diffNote}`);
if (gate) {
  try {
    run("node", ["scripts/audit-delivery-check.mjs", "--check"]);
  } catch {
    oracleExit = 1;
    console.log("      ⚠ gate FAIL (regression or staleness) — propagated to exit code");
  }
}

// ---- 2. skill-metrics snapshot ----
const home = os.homedir();
const dispositions = path.join(home, "selfco", "tracking", "skill-dispositions.jsonl");
const legacy = path.join(home, ".claude", "skill-telemetry.jsonl");
if (existsSync(dispositions) || existsSync(legacy)) {
  const snap = path.join(CORE, "docs", `skill-metrics-${today}.md`);
  try {
    writeFileSync(snap, run("node", ["scripts/skill-metrics.mjs"]));
    console.log(`[2/3] skill-metrics snapshot → ${path.relative(CORE, snap)}`);
  } catch (e) {
    console.log(`[2/3] skill-metrics FAILED: ${e.message.split("\n")[0]} (artifact not written)`);
  }
} else {
  console.log("[2/3] skill-metrics SKIPPED — no live telemetry on this machine (needs ~/selfco/tracking or ~/.claude streams; run from the Mac)");
}

// ---- 3. vault sync age ----
let vaultLog = path.join(home, "selfco", "wiki", "log.md");
if (!existsSync(vaultLog)) vaultLog = path.resolve(CORE, "..", "selfco", "wiki", "log.md");
if (existsSync(vaultLog)) {
  const dates = [...readFileSync(vaultLog, "utf8").matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] sync \|/gm)]
    .map((m) => m[1])
    .sort();
  const last = dates.pop();
  const age = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  console.log(
    `[3/3] vault sync age: ${last ? `${age}d (last ${last})` : "never"}${age > 14 || last === undefined ? "  ⚠ run /vault sync" : ""}`
  );
} else {
  console.log("[3/3] vault sync age: selfco not on disk — SKIPPED");
}

process.exit(gate ? oracleExit : 0);
