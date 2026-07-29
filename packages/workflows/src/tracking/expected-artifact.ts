/**
 * expected-artifact — the per-skill map of what counts as "acted" (OPAV-S1, signed off
 * 2026-06-13). This is the honesty target: for each skill, the independent, causally-derived,
 * skill-specific artifact that proves the action really happened. `actExpected: false` marks
 * engaged-only skills (no durable artifact) — they terminate at `engaged_no_act` by design.
 *
 * The map is the main judgment surface: extend it as skills are added, and surface ambiguous
 * "what counts as acted" calls rather than guessing. See adr:skill-action-instrumentation.
 */

import type { EvidenceScheme } from './types/tracking-event.js';

export interface ExpectedArtifactSpec {
  /** False for engaged-only skills (recon/zoom-out/summarize/caveman). */
  actExpected: boolean;
  /** The evidence scheme the artifact must use. */
  scheme?: EvidenceScheme;
  /** For `path` scheme: the artifact path must match this to be skill-specific. */
  pathPattern?: RegExp;
  description: string;
}

export const EXPECTED_ARTIFACT: Record<string, ExpectedArtifactSpec> = {
  adr: { actExpected: true, scheme: 'path', pathPattern: /(^|\/)decisions\/adr\/\d+.*\.md$/, description: 'a new ADR file' },
  // The expected artifact MUST be one the skill is permitted to write, or the skill has no
  // reachable path to `acted` and the entry silently mis-measures it forever.
  //
  // This entry previously demanded a CONTEXT.md write while grill-with-docs/SKILL.md forbade
  // exactly that ("Do NOT silently edit the file. Show the user; let them apply.") — and in
  // sibling repos `domain-knowledge/CONTEXT.md` is a SYMLINK into core, i.e. a fleet-shared
  // artifact no single repo's session should be writing. The skill therefore wrote nothing to
  // disk at all, so `acted` was unreachable: a hand-applied diff scored `capture_miss` (artifact
  // without self-report) and everything else scored `engaged_no_act`. 0 invocations / 46
  // suggestions, all terminating `ignored`, over the life of the telemetry.
  //
  // Resolved by giving the skill a durable artifact it OWNS and is allowed to write after the
  // Step 8 confirmation stop-gate: the open-unknowns ledger. See adr:harness-loop-instrumentation.
  'grill-with-docs': { actExpected: true, scheme: 'path', pathPattern: /(^|\/)decisions\/open-unknowns\.md$/, description: 'an open-unknowns ledger entry' },
  // AMBIGUOUS — surfaced, not guessed (see docblock). No pathPattern, so ANY path write in the
  // session satisfies it, which is looser than the "skill-specific" contract this field exists to
  // enforce. plan-feature does write specs, but their location is not conventionalised, so there
  // is no honest pattern to pin yet. Needs an operator call on where specs live.
  'plan-feature': { actExpected: true, scheme: 'path', description: 'a spec file with acceptance criteria' },
  tdd: { actExpected: true, scheme: 'test', description: 'a new/changed test that ran' },
  // AMBIGUOUS — surfaced, not guessed. validate/SKILL.md is explicit: "No auto-fixes — findings
  // and verdict only", i.e. it writes NO durable verdict record; its only spine write is a
  // gate-event (a different event type, and only for gated-slice efforts). So `scheme: 'path'`
  // is unreachable the same way grill-with-docs was. The honest options are `actExpected: false`
  // (engaged-only, like recon) or giving validate a durable verdict artifact. Both change what
  // the skill IS, so this is an operator decision, not a silent edit.
  validate: { actExpected: true, scheme: 'path', description: 'a verdict record' },
  // investigate DOES write a durable artifact and names the exact path in its own SKILL.md
  // (Phase 6: `~/.claude/last-investigation-${SESSION_ID}.md`, consumed by bead-session.sh for
  // the PR skill-usage report). Pinning the pattern makes the match skill-specific instead of
  // "any file written this session".
  investigate: { actExpected: true, scheme: 'path', pathPattern: /(^|\/)last-investigation-[^/]*\.md$/, description: 'a cause-map artifact (~/.claude/last-investigation-<session>.md)' },
  techdebt: { actExpected: true, scheme: 'path', pathPattern: /(^|\/)TECHDEBT\.md$/, description: 'a TECHDEBT.md append' },
  'adopt-stack': { actExpected: true, scheme: 'path', pathPattern: /(^|\/)decisions\/adopt-stack\/.*\.md$/, description: 'an adopt-stack decision record' },

  // Engaged-only — no durable artifact; terminate at engaged_no_act by design.
  recon: { actExpected: false, description: 'engaged-only (no durable artifact)' },
  'zoom-out': { actExpected: false, description: 'engaged-only (no durable artifact)' },
  summarize: { actExpected: false, description: 'engaged-only (no durable artifact)' },
  caveman: { actExpected: false, description: 'engaged-only (no durable artifact)' },
};

export function expectedArtifactFor(skill: string): ExpectedArtifactSpec | undefined {
  return EXPECTED_ARTIFACT[skill];
}
