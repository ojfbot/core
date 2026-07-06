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
//   4. What did humans push back on this week? (S18, I2)  → docs/golden-candidates/YYYY-MM-DD.jsonl
//      (files every bead with labels.outcome rejected|edited as a candidate golden task; SKIPPED
//       with a reason when the Dolt bead store is unreachable — never fails the routine)
//
// Exit 0 always (a measurement run never blocks anything); pass --check to ALSO propagate the
// oracle's regression/staleness gate as the exit code. Designed for launchd/cron/routine use;
// artifacts are plain files so the diff shows up in git and the standup can read them.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
  const prevDoc = JSON.parse(readFileSync(path.join(oracleDir, prior), "utf8"));
  const prev = prevDoc.counts ?? {};
  const cur = JSON.parse(oracleJson);
  const sameVantage =
    !prevDoc.vantage || !cur.vantage ||
    (prevDoc.vantage.host === cur.vantage.host &&
      String(prevDoc.vantage.siblingsFound) === String(cur.vantage.siblingsFound));
  if (sameVantage) {
    const keys = [...new Set([...Object.keys(counts), ...Object.keys(prev)])];
    diffNote =
      `vs ${prior.replace(".json", "")}: ` +
      keys.map((k) => `${k} ${prev[k] ?? 0}→${counts[k] ?? 0}`).join(" · ");
  } else {
    diffNote = `prior artifact (${prior.replace(".json", "")}) was measured from a different vantage — counts not comparable, no diff shown`;
  }
}
console.log(`[1/4] delivery oracle → ${path.relative(CORE, artifact)}`);
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
    console.log(`[2/4] skill-metrics snapshot → ${path.relative(CORE, snap)}`);
  } catch (e) {
    console.log(`[2/4] skill-metrics FAILED: ${e.message.split("\n")[0]} (artifact not written)`);
  }
} else {
  console.log("[2/4] skill-metrics SKIPPED — no live telemetry on this machine (needs ~/selfco/tracking or ~/.claude streams; run from the Mac)");
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
    `[3/4] vault sync age: ${last ? `${age}d (last ${last})` : "never"}${age > 14 || last === undefined ? "  ⚠ run /vault sync" : ""}`
  );
} else {
  console.log("[3/4] vault sync age: selfco not on disk — SKIPPED");
}

// ---- 4. golden-candidate filer (S18, audit I2) ----
// Every bead a human marked rejected|edited (labels.outcome, stamped by bead-emit's
// task-done/bead-close/bead-quarantine --outcome) becomes a candidate golden task: the pushback
// is exactly where an eval case is worth writing. Anti-Goodhart contract: Dolt unreachable →
// SKIP with a logged reason, never fail the routine; an empty run is a success state.
const goldenDir = path.join(CORE, "docs", "golden-candidates");
try {
  const { default: mysql } = await import("mysql2/promise");
  const pool = mysql.createPool({
    host: "127.0.0.1",
    port: parseInt(process.env.DOLT_PORT ?? "3307", 10),
    user: "root",
    database: ".beads-dolt",
    connectionLimit: 1,
  });
  try {
    const priorFiles = existsSync(goldenDir)
      ? readdirSync(goldenDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort()
      : [];
    // Watermark: the newest prior artifact's date bounds the scan; ID-dedup across ALL prior
    // artifacts guarantees a bead is filed at most once even across the watermark boundary.
    const priorDates = priorFiles.map((f) => f.replace(".jsonl", "")).filter((d) => d !== today);
    const since = priorDates.pop() ?? "1970-01-01";
    const seen = new Set(
      priorFiles.flatMap((f) =>
        readFileSync(path.join(goldenDir, f), "utf8")
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l).id)
      )
    );
    const [rows] = await pool.execute(
      `SELECT id, title, labels, closed_at, updated_at FROM beads
        WHERE JSON_UNQUOTE(JSON_EXTRACT(labels, '$.outcome')) IN ('rejected', 'edited')
          AND updated_at >= ?
        ORDER BY updated_at`,
      [since]
    );
    const lines = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      const labels = typeof r.labels === "string" ? JSON.parse(r.labels) : (r.labels ?? {});
      lines.push(
        JSON.stringify({
          id: r.id,
          title: r.title,
          repo: labels.repo ?? "",
          outcome: labels.outcome,
          closed_at: r.closed_at ? new Date(r.closed_at).toISOString() : null,
          source: "bead-store",
        })
      );
    }
    if (lines.length) {
      mkdirSync(goldenDir, { recursive: true });
      appendFileSync(path.join(goldenDir, `${today}.jsonl`), lines.join("\n") + "\n");
    }
    console.log(
      `[4/4] golden-candidate filer: ${lines.length} new candidate(s) since ${since}` +
        (lines.length ? ` → ${path.relative(CORE, path.join(goldenDir, `${today}.jsonl`))}` : " (empty run = success state)")
    );
  } finally {
    await pool.end();
  }
} catch (e) {
  console.log(`[4/4] golden-candidate filer SKIPPED — bead store unreachable (${e.message.split("\n")[0]})`);
}

process.exit(gate ? oracleExit : 0);
