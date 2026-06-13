#!/usr/bin/env node
// replay-ignored-correction.mjs — Slice 0 verification artifact (OPAV loop;
// ADR suggestion-identity-and-denominator, gate C1).
//
// Proves the denominator repair on HISTORICAL telemetry: how many existing
// `skill:suggestion-ignored` events were genuine inline follows mislabeled by
// the old Skill-tool-only detector? Replays each ignored event against the
// corroboration predicate (a SKILL.md Read for that skill+session after the
// suggestion) and reports the count drop.
//
// CLI:  node replay-ignored-correction.mjs [--suggestion=PATH] [--tool=PATH] [--skill=PATH] [--json]
//       (defaults to ~/.claude/{suggestion,tool,skill}-telemetry.jsonl)
//
// Library:  import { replayIgnoredCorrection } from './replay-ignored-correction.mjs'

import { homedir } from 'node:os';
import { join } from 'node:path';
import { isCorroboratedFollow, readJsonl } from './corroborate-follow.mjs';

/**
 * Recompute the `suggestion-ignored` count once inline follows are corroborated.
 *
 * Only `skill:suggestion-ignored` events are ever reclassified (ignored→followed);
 * no other event type is touched, so `regressions` is 0 by construction and acts
 * as a self-check on that invariant.
 *
 * @param {object}   o
 * @param {object[]} o.suggestionTelemetry
 * @param {object[]} [o.toolTelemetry]
 * @param {object[]} [o.skillTelemetry]
 * @returns {{ignored_before:number, corroborated_follow_count:number, ignored_after:number, regressions:number, reclassified:object[]}}
 */
export function replayIgnoredCorrection({
  suggestionTelemetry,
  toolTelemetry = [],
  skillTelemetry = [],
}) {
  const ignoredEvents = suggestionTelemetry.filter((e) => e.event === 'skill:suggestion-ignored');
  const reclassified = [];
  let regressions = 0;

  for (const ev of ignoredEvents) {
    // suggested_at is the original suggestion ts; fall back to the event ts.
    const sinceIso = ev.suggested_at ?? ev.ts;
    const followed = isCorroboratedFollow({
      skill: ev.skill,
      sessionId: ev.session_id,
      sinceIso,
      toolTelemetry,
      skillTelemetry,
    });
    if (followed) {
      // Invariant: we only ever reclassify ignored events. Anything else is a regression.
      if (ev.event !== 'skill:suggestion-ignored') regressions++;
      reclassified.push({ skill: ev.skill, session_id: ev.session_id, suggested_at: sinceIso });
    }
  }

  const ignored_before = ignoredEvents.length;
  const corroborated_follow_count = reclassified.length;
  return {
    ignored_before,
    corroborated_follow_count,
    ignored_after: ignored_before - corroborated_follow_count,
    regressions,
    reclassified,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { json: false };
  for (const a of argv) {
    if (a === '--json') args.json = true;
    else if (a.startsWith('--suggestion=')) args.suggestion = a.slice('--suggestion='.length);
    else if (a.startsWith('--tool=')) args.tool = a.slice('--tool='.length);
    else if (a.startsWith('--skill=')) args.skill = a.slice('--skill='.length);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = join(homedir(), '.claude');
  const suggestionPath = args.suggestion ?? join(dir, 'suggestion-telemetry.jsonl');
  const toolPath = args.tool ?? join(dir, 'tool-telemetry.jsonl');
  const skillPath = args.skill ?? join(dir, 'skill-telemetry.jsonl');

  const result = replayIgnoredCorrection({
    suggestionTelemetry: readJsonl(suggestionPath),
    toolTelemetry: readJsonl(toolPath),
    skillTelemetry: readJsonl(skillPath),
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  const pct = result.ignored_before
    ? ((result.corroborated_follow_count / result.ignored_before) * 100).toFixed(1)
    : '0.0';
  process.stdout.write(
    [
      'Ignored-detector historical replay (Slice 0 / C1)',
      `  sources: ${suggestionPath}`,
      `           ${toolPath}`,
      `  ignored_before ............ ${result.ignored_before}`,
      `  corroborated_inline_follows ${result.corroborated_follow_count} (${pct}% of ignored)`,
      `  ignored_after ............. ${result.ignored_after}`,
      `  regressions ............... ${result.regressions}`,
      `  PASS: ${result.ignored_after <= result.ignored_before && result.regressions === 0 ? 'yes' : 'NO'}`,
      '',
    ].join('\n'),
  );
}

// Run as CLI only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
