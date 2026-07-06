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
  'grill-with-docs': { actExpected: true, scheme: 'path', pathPattern: /(^|\/)CONTEXT\.md$/, description: 'a CONTEXT.md diff' },
  'plan-feature': { actExpected: true, scheme: 'path', description: 'a spec file with acceptance criteria' },
  tdd: { actExpected: true, scheme: 'test', description: 'a new/changed test that ran' },
  validate: { actExpected: true, scheme: 'path', description: 'a verdict record' },
  investigate: { actExpected: true, scheme: 'path', description: 'a cause-map artifact' },
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
