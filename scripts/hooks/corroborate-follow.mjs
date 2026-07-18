#!/usr/bin/env node
// corroborate-follow.mjs — single source of truth for "was a skill suggestion
// followed inline?" (Slice 0 of the OPAV loop; ADR suggestion-identity-and-denominator).
//
// ADR-0092 routes uninstalled/contextual skills to an INLINE follow: the agent
// reads the skill's SKILL.md directly instead of invoking the Skill tool, so
// PostToolUse(Skill) never fires and log-skill.sh never emits
// `skill:suggestion-followed`. The old ignored-detector (suggest-skill.sh)
// therefore mislabels every inline follow as `skill:suggestion-ignored`.
//
// This module recognizes an inline funnel-close from signals that exist TODAY,
// with no dependency on S1's not-yet-built `skill:acted`:
//   1. an inline-follow: a Read of `.../skills/<skill>/SKILL.md` in the catch-all
//      tool-telemetry (log-tool-use.sh), same session, at/after the suggestion ts;
//   1b. a Skill-tool invocation of the same skill in the catch-all tool-telemetry
//      (rm:rm-l1-core#S2; `tool_name:"Skill"`, name normalized — `core:adr` ≈
//      `adr:knowledge:x` ≈ `adr`).
//   1c. a script-exec: a Bash run of `.../skills/<skill>/scripts/…` (input_summary
//      signal; rm:rm-l1-core#S17 gap (e) — the third follow path).
//      Paths 1/1b/1c all come from log-tool-use.sh, NOT the agent's self-report, so
//      the two-source independence contract (ADR-0095) is preserved. Before 2026-07-17
//      only path 1 was recognized, which made the dominant real invocation path
//      structurally invisible (204-row ledger read "0 followed" — RCA d92e3b15);
//   2. forward-compat: a future `skill:acted` event carrying the same skill +
//      session (no-op until S1 ships it).
//
// Used by:
//   - suggest-skill.sh  — live ignored-detector OR-clause (CLI mode below)
//   - replay-ignored-correction.mjs — historical replay (imports isCorroboratedFollow)

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Parse a JSONL file into an array of objects; missing/unreadable → []  (fail-open). */
export function readJsonl(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      // skip malformed line, keep going (fail-open)
    }
  }
  return out;
}

/** True if `file_path` points at `.../skills/<skill>/SKILL.md`. */
function isSkillMdRead(ev, skill) {
  if (ev.tool_name !== 'Read' || typeof ev.file_path !== 'string') return false;
  return ev.file_path.endsWith(`/skills/${skill}/SKILL.md`);
}

/**
 * Does a Skill-tool invocation name refer to `skill`? Invocation names in
 * tool-telemetry come in several shapes — `adr`, `core:adr` (repo/plugin prefix),
 * `frame-standup:frame-standup` (dir:skill), `adr:knowledge:adr-template`
 * (knowledge sub-page) — so a name matches when the full name, its first, or its
 * last colon-separated segment equals the suggested slug.
 */
export function skillNameMatches(invoked, skill) {
  if (typeof invoked !== 'string' || !invoked || !skill) return false;
  if (invoked === skill) return true;
  const segs = invoked.split(':');
  return segs[0] === skill || segs[segs.length - 1] === skill;
}

/** True for a catch-all tool-telemetry Skill-tool invocation of `skill`. */
function isSkillToolInvocation(ev, skill) {
  return ev.tool_name === 'Skill' && skillNameMatches(ev.skill, skill);
}

// A skill's deterministic scripts live under .../skills/<skill>/scripts/ (ADR-0084
// layout). Running one via Bash is engagement with the skill (the third follow path,
// rm:rm-l1-core#S17 gap (e); mirrors SKILL_SCRIPT_RE in opav-capture-quality.mjs).
const SKILL_SCRIPT_RE = /\/skills\/([^/]+)\/scripts\//;

/** True for a Bash execution of one of `skill`'s own scripts (input_summary signal). */
function isSkillScriptExec(ev, skill) {
  if (ev.tool_name !== 'Bash' || typeof ev.input_summary !== 'string') return false;
  const m = SKILL_SCRIPT_RE.exec(ev.input_summary);
  // Both directions: the dir name is a plain slug; the suggested name may be segmented.
  return !!m && (skillNameMatches(m[1], skill) || skillNameMatches(skill, m[1]));
}

/**
 * Was the suggestion for `skill` in session `sessionId` followed inline at/after
 * `sinceIso`? Pure over in-memory event arrays.
 *
 * @param {object}   o
 * @param {string}   o.skill            suggested skill slug
 * @param {string}   o.sessionId        session the suggestion was made in
 * @param {string}   o.sinceIso         ISO ts of the suggestion (lower bound, inclusive)
 * @param {object[]} [o.toolTelemetry]  tool:used events (catch-all)
 * @param {object[]} [o.skillTelemetry] skill:* events (forward-compat skill:acted)
 * @returns {boolean}
 */
export function isCorroboratedFollow({
  skill,
  sessionId,
  sinceIso,
  toolTelemetry = [],
  skillTelemetry = [],
}) {
  const after = (ts) => typeof ts === 'string' && ts >= sinceIso;

  // (1) inline-follow: SKILL.md Read in this session at/after the suggestion
  // (1b) Skill-tool invocation of the same skill (also catch-all telemetry)
  // (1c) script-exec: a Bash run of the skill's own scripts/ (also catch-all
  //      telemetry; the third path — closed by rm:rm-l1-core#S17 gap (e))
  for (const ev of toolTelemetry) {
    if (
      ev.session_id === sessionId &&
      after(ev.ts) &&
      (isSkillMdRead(ev, skill) || isSkillToolInvocation(ev, skill) || isSkillScriptExec(ev, skill))
    ) {
      return true;
    }
  }

  // (2) forward-compat: a future `skill:acted` for this skill+session
  for (const ev of skillTelemetry) {
    if (
      ev.event === 'skill:acted' &&
      ev.session_id === sessionId &&
      ev.skill === skill &&
      after(ev.ts)
    ) {
      return true;
    }
  }

  return false;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Used by suggest-skill.sh's ignored-detector. Reads tool/skill telemetry from
// ~/.claude (honoring $HOME), evaluates the predicate, and signals via exit code:
//   exit 0 → corroborated (suggestion WAS followed inline; do NOT mark ignored)
//   exit 1 → not corroborated (genuinely ignored)
//
//   node corroborate-follow.mjs --session=SID --skill=SLUG --since=ISO
//                               [--tool=PATH] [--skill-telemetry=PATH]
function cliMain() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) args[m[1]] = m[2];
  }
  if (!args.session || !args.skill || !args.since) {
    // Missing inputs: fail-open toward "not corroborated" so the caller keeps
    // its existing behavior rather than silently swallowing an ignored event.
    process.exit(1);
  }
  const dir = join(homedir(), '.claude');
  const toolPath = args.tool ?? join(dir, 'tool-telemetry.jsonl');
  const skillPath = args['skill-telemetry'] ?? join(dir, 'skill-telemetry.jsonl');

  const corroborated = isCorroboratedFollow({
    skill: args.skill,
    sessionId: args.session,
    sinceIso: args.since,
    toolTelemetry: readJsonl(toolPath),
    skillTelemetry: readJsonl(skillPath),
  });
  process.exit(corroborated ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cliMain();
}
