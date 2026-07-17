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

import { isCorroboratedFollow, readJsonl, skillNameMatches } from './corroborate-follow.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Mirror of opav-capture-quality.mjs's maintenance discriminator, promoted into the
// reconciler path by rm:rm-l1-core#S16 (adr:two-track-skill-telemetry).
const SKILL_DIR_RE = /\/skills\/([^/]+)\//;
const MUTATING_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);

/**
 * Authoring detector (the use-vs-maintenance discriminator): every mutating tool row
 * under the suggested skill's own directory in this session at/after `sinceIso`.
 * SUGGESTION-scoped like every other disposition signal (engagement, artifact proxy) —
 * gold row EBE96AA0 pins this: a skill-dir edit BEFORE the suggestion does not make the
 * later-ignored suggestion an authoring disposition (operator label: `ignored`). The
 * session-scoped view lives in collectAuthoringEvents (the evolution stream), which is
 * suggestion-independent by design. Names are normalized via skillNameMatches
 * (`core:adr` ≈ `adr`). Independent signal: derived from the catch-all tool-telemetry,
 * never from agent self-report.
 *
 * @returns {object[]} the matching tool-telemetry rows (empty → not an authoring session)
 */
export function detectAuthoringEdits({ skill, sessionId, sinceIso, toolTelemetry = [] }) {
  return toolTelemetry.filter((ev) => {
    if (ev.session_id !== sessionId) return false;
    if (!MUTATING_TOOLS.has(ev.tool_name || '')) return false;
    if (sinceIso && !(typeof ev.ts === 'string' && ev.ts >= sinceIso)) return false;
    const m = SKILL_DIR_RE.exec(ev.file_path || '');
    // Both directions: the dir name is a plain slug, but the SUGGESTED name may be
    // segmented (`core:adr`) — skillNameMatches normalizes its first arg only.
    return !!m && (skillNameMatches(m[1], skill) || skillNameMatches(skill, m[1]));
  });
}

/**
 * Evolution-track collector: group ALL skill-dir mutations in the telemetry into
 * one `skill:authoring` event per session×skill pair (adr:two-track-skill-telemetry
 * — authoring is captured whether or not a suggestion was ever minted). `kind` is a
 * documented v0 heuristic: `created` (a Write to SKILL.md), `refactored` (edits touch
 * only SKILL.md), `extended` (edits reach knowledge//scripts//other files). Shadow:
 * no consumer reads this stream until its own capture-quality pass.
 *
 * @returns {{skill:string, session_id:string, ts:string, files_touched:string[], kind:string}[]}
 */
export function collectAuthoringEvents(toolTelemetry = [], { sessionId } = {}) {
  const byPair = new Map();
  for (const ev of toolTelemetry) {
    if (!MUTATING_TOOLS.has(ev.tool_name || '')) continue;
    if (sessionId && ev.session_id !== sessionId) continue;
    if (!ev.session_id || typeof ev.file_path !== 'string') continue;
    const m = SKILL_DIR_RE.exec(ev.file_path);
    if (!m) continue;
    const key = `${ev.session_id} ${m[1]}`;
    const entry = byPair.get(key) ?? { skill: m[1], session_id: ev.session_id, ts: ev.ts, files: new Set(), wroteSkillMd: false, nonSkillMd: false };
    entry.files.add(ev.file_path);
    if (typeof ev.ts === 'string' && (!entry.ts || ev.ts < entry.ts)) entry.ts = ev.ts;
    if (ev.file_path.endsWith('/SKILL.md')) {
      if (ev.tool_name === 'Write') entry.wroteSkillMd = true;
    } else {
      entry.nonSkillMd = true;
    }
    byPair.set(key, entry);
  }
  return [...byPair.values()].map((e) => ({
    skill: e.skill,
    session_id: e.session_id,
    ts: e.ts,
    files_touched: [...e.files].sort(),
    kind: e.wroteSkillMd ? 'created' : e.nonSkillMd ? 'extended' : 'refactored',
  }));
}

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
