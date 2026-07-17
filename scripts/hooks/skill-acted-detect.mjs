#!/usr/bin/env node
// skill-acted-detect.mjs — the INDEPENDENT engagement detector for OPAV-S1 (C1).
//
// The two-source contract (adr:skill-action-instrumentation) requires the corroborating
// signal be produced by a DIFFERENT mechanism than the agent's self-emitted skill:acted —
// because agent compliance alone is the exact 0.8% failure mode. This detector derives
// engagement ONLY from the catch-all tool-telemetry (a SKILL.md Read OR a Skill-tool
// invocation of the suggested skill — both captured by log-tool-use.sh, not by the
// agent), reusing S0's single-source-of-truth join (`corroborate-follow.mjs`) — it does
// NOT reimplement it, and it is structurally blind to skill:acted (skillTelemetry is
// never consulted).
//
// Used by: the Stop-hook reconciler that, at session end, scores each suggestion's
// disposition (skill-acted-rate.ts) — `engaged` comes from here, `acted` from the ledger.

import { isCorroboratedFollow, readJsonl } from './corroborate-follow.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Was the suggestion for `skill` in `sessionId` engaged inline at/after `sinceIso`?
 * Engagement = the independent catch-all-telemetry signals ONLY (SKILL.md Read or
 * Skill-tool invocation). `skill:acted` is deliberately not passed through, so a
 * self-report can never masquerade as the independent signal.
 *
 * @returns {boolean}
 */
export function detectEngagement({ skill, sessionId, sinceIso, toolTelemetry = [] }) {
  return isCorroboratedFollow({
    skill,
    sessionId,
    sinceIso,
    toolTelemetry,
    skillTelemetry: [], // independence: never consult the agent's own skill:acted
  });
}

/**
 * Over-capture (false-emit) guard: of all self-emitted `skill:acted`, how many lack any
 * independent engagement signal? Cheap-to-emit / expensive-to-do gaming shows up here.
 * TPM target ≤10%.
 *
 * @param {{acted:boolean, engaged:boolean}[]} rows  one row per suggestion
 * @returns {{total:number, uncorroborated:number, rate:number|null}}
 */
export function computeOverCapture(rows) {
  const acted = rows.filter((r) => r.acted);
  const total = acted.length;
  const uncorroborated = acted.filter((r) => !r.engaged).length;
  return { total, uncorroborated, rate: total === 0 ? null : uncorroborated / total };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// node skill-acted-detect.mjs --session=SID --skill=SLUG --since=ISO [--tool=PATH]
//   exit 0 → engaged (independent SKILL.md Read found)
//   exit 1 → not engaged
function cliMain() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) args[m[1]] = m[2];
  }
  if (!args.session || !args.skill || !args.since) process.exit(1);
  const toolPath = args.tool ?? join(homedir(), '.claude', 'tool-telemetry.jsonl');
  const engaged = detectEngagement({
    skill: args.skill,
    sessionId: args.session,
    sinceIso: args.since,
    toolTelemetry: readJsonl(toolPath),
  });
  process.exit(engaged ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cliMain();
}
