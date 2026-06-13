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
  for (const ev of toolTelemetry) {
    if (ev.session_id === sessionId && after(ev.ts) && isSkillMdRead(ev, skill)) {
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
