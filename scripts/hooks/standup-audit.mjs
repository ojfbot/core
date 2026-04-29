#!/usr/bin/env node
// standup-audit.mjs — next-day audit walker for the standup funnel.
//
// Reads ~/.claude/standup-telemetry.jsonl, finds standup:suggested events
// from the last N days that have no matching standup:closed event, and
// for each pending suggestion whose priority_id is ABSENT from today's
// surfaced priorities, emits a standup:closed event with
// closure_signal=audit-disappeared.
//
// Usage from /frame-standup:
//   node scripts/hooks/standup-audit.mjs \
//     --today-priorities="<priority1>;<priority2>;<priority3>" \
//     [--lookback-days=7] [--dry-run]
//
// Pure-Node, no deps. Reads + appends to ~/.claude/standup-telemetry.jsonl.
// Never blocks: exits 0 on any error path.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const TELEMETRY_PATH = process.env.STANDUP_TELEMETRY_PATH
  ?? resolve(homedir(), ".claude/standup-telemetry.jsonl");

const args = parseArgs(process.argv.slice(2));
const lookbackDays = Number(args["lookback-days"] ?? 7);
const dryRun = args["dry-run"] === true;
const todayPriorities = parsePriorities(args["today-priorities"]);

try {
  const events = readJsonl(TELEMETRY_PATH);
  const sinceMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => parseTs(e.ts) >= sinceMs);

  const closedSuggestionIds = new Set(
    recent.filter((e) => e.event === "standup:closed").map((e) => e.suggestion_id)
  );
  const pending = recent.filter((e) =>
    e.event === "standup:suggested" && !closedSuggestionIds.has(e.suggestion_id)
  );

  const todaySet = new Set(todayPriorities.map(normalize));
  const closures = [];

  for (const suggestion of pending) {
    const pid = normalize(suggestion.priority_id);
    if (!pid) continue;
    if (todaySet.has(pid)) continue; // priority still on the board today
    closures.push({
      ts: nowIso(),
      event: "standup:closed",
      suggestion_id: suggestion.suggestion_id,
      standup_id: suggestion.standup_id,
      closure_signal: "audit-disappeared",
      closure_evidence: `priority_id "${suggestion.priority_id}" absent from ${new Date().toISOString().slice(0, 10)} standup`,
      session_id: process.env.CLAUDE_SESSION_ID ?? "",
      source: "standup-audit",
    });
  }

  // Report
  const summary = {
    pending_count: pending.length,
    today_priority_count: todayPriorities.length,
    audit_closures_emitted: closures.length,
    dry_run: dryRun,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!dryRun && closures.length > 0) {
    for (const c of closures) appendFileSync(TELEMETRY_PATH, JSON.stringify(c) + "\n");
  }
} catch (err) {
  console.error(`standup-audit: ${err.message}`);
  process.exit(0);
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq === -1) out[a.slice(2)] = true;
    else out[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return out;
}

function parsePriorities(raw) {
  if (!raw) return [];
  return String(raw).split(";").map((s) => s.trim()).filter(Boolean);
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const out = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip malformed */ }
  }
  return out;
}

function parseTs(ts) {
  if (typeof ts === "number") return ts;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function normalize(s) {
  return String(s ?? "").trim().toLowerCase();
}
