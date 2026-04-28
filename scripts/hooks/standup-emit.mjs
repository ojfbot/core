#!/usr/bin/env node
// standup-emit.mjs — emit standup funnel events to ~/.claude/standup-telemetry.jsonl.
//
// Usage:
//   node standup-emit.mjs suggested \
//     --standup-id=stnd-2026-04-28-a3f1 \
//     --suggestion-id=s1 \
//     --skill=/plan-feature \
//     --priority-id=p3-cv-builder-session-resume \
//     --rationale="session-resume blocker called out in diagram intake" \
//     [--expected-outcome="spec written, ready to scaffold"] \
//     [--bead-id=cv-stnd-...]
//
// Future commands (PR-X2):
//   node standup-emit.mjs closed \
//     --suggestion-id=s1 --closure-signal=audit-disappeared \
//     --closure-evidence="priority absent from 2026-04-29 standup"
//
// Pure-Node, no deps. Append-only JSONL. Never blocks; never throws (log to
// stderr and exit 0 on bad input — telemetry must never break the skill flow).

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const TELEMETRY_PATH = process.env.STANDUP_TELEMETRY_PATH
  ?? resolve(homedir(), ".claude/standup-telemetry.jsonl");

const [, , command, ...rawArgs] = process.argv;

if (!command) {
  console.error("standup-emit: missing command (try `suggested` or `closed`)");
  process.exit(0);
}

const args = parseArgs(rawArgs);

try {
  switch (command) {
    case "suggested":
      emitSuggested(args);
      break;
    case "closed":
      emitClosed(args);
      break;
    default:
      console.error(`standup-emit: unknown command '${command}'`);
      process.exit(0);
  }
} catch (err) {
  console.error(`standup-emit: ${err.message}`);
  process.exit(0);
}

// ── commands ───────────────────────────────────────────────────────────────

function emitSuggested(a) {
  if (!a["standup-id"] || !a["suggestion-id"] || !a["skill"]) {
    console.error("standup-emit suggested: requires --standup-id, --suggestion-id, --skill");
    process.exit(0);
  }
  const event = {
    ts: nowIso(),
    event: "standup:suggested",
    standup_id: a["standup-id"],
    suggestion_id: a["suggestion-id"],
    skill: a["skill"],
    priority_id: a["priority-id"] ?? "",
    rationale: a["rationale"] ?? "",
    session_id: a["session-id"] ?? process.env.CLAUDE_SESSION_ID ?? "",
    source: "frame-standup",
  };
  if (a["expected-outcome"]) event.expected_outcome = a["expected-outcome"];
  if (a["bead-id"]) event.bead_id = a["bead-id"];
  append(event);
}

function emitClosed(a) {
  // PR-X2 will use this path. Schema sketched here so PR-X1 ships the wiring.
  if (!a["suggestion-id"] || !a["closure-signal"]) {
    console.error("standup-emit closed: requires --suggestion-id, --closure-signal");
    process.exit(0);
  }
  const event = {
    ts: nowIso(),
    event: "standup:closed",
    suggestion_id: a["suggestion-id"],
    closure_signal: a["closure-signal"],
    closure_evidence: a["closure-evidence"] ?? "",
    session_id: a["session-id"] ?? process.env.CLAUDE_SESSION_ID ?? "",
    source: "frame-standup",
  };
  append(event);
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

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function append(event) {
  mkdirSync(dirname(TELEMETRY_PATH), { recursive: true });
  appendFileSync(TELEMETRY_PATH, JSON.stringify(event) + "\n");
}
