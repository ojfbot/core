/**
 * skill-acted-validator — the C2 SHADOW cross-check (OPAV-S1). It verifies PROVENANCE,
 * a strictly stronger check than the spine's `assertHonest` (which only asserts the
 * evidence_ref is present + well-formed). Here the corroborating artifact must be:
 *   - skill-specific   (matches the skill's expected_artifact pattern/scheme),
 *   - independent      (a different mechanism than the emitter), and NOT
 *   - self-written     (the agent's own ledger/telemetry cannot corroborate itself).
 *
 * Observe-only by design: this is a PURE verdict function. It quarantines nothing and
 * touches no ledger — SHADOW until the C4 RIDM promotion. The third verdict
 * `indeterminate` keeps slow/unconventional output from being binary-forced to invalid.
 */

import { existsSync } from 'node:fs';
import type { EvidenceRef, TrackingEvent } from './types/tracking-event.js';
import { expectedArtifactFor } from './expected-artifact.js';

export type Verdict = 'valid' | 'invalid' | 'indeterminate';

export interface ValidationResult {
  verdict: Verdict;
  reason: string;
}

export interface ValidatorOptions {
  /** Does a `path` artifact exist? Injectable for tests; defaults to fs.existsSync. */
  resolvePath?: (p: string) => boolean;
  /** Is this ref the agent's own ledger/telemetry (banned as self-corroboration)? */
  isSelfWritten?: (ref: EvidenceRef) => boolean;
}

/** The agent's own write surfaces — using any of these as evidence is self-corroboration. */
const SELF_WRITTEN = /(skill-telemetry|tool-telemetry|suggestion-telemetry|events\.jsonl|tracking\/.*\.jsonl)/;

const defaultSelfWritten = (ref: EvidenceRef): boolean => SELF_WRITTEN.test(ref.ref);

/**
 * Cross-check a single `skill:acted` event. Pure — returns a verdict, mutates nothing.
 */
export function validateSkillActed(ev: TrackingEvent, opts: ValidatorOptions = {}): ValidationResult {
  const skill = String(ev.payload?.skill ?? '');
  const spec = expectedArtifactFor(skill);
  if (!spec) return { verdict: 'indeterminate', reason: `no expected_artifact spec for skill '${skill}'` };
  if (!spec.actExpected) return { verdict: 'invalid', reason: `'${skill}' is engaged-only — skill:acted not expected` };

  const ref = ev.evidence_ref;
  if (!ref) return { verdict: 'invalid', reason: 'no evidence_ref' };

  const isSelfWritten = opts.isSelfWritten ?? defaultSelfWritten;
  if (isSelfWritten(ref)) return { verdict: 'invalid', reason: 'self-written log cannot corroborate itself' };

  if (spec.scheme && ref.scheme !== spec.scheme) {
    return { verdict: 'invalid', reason: `expected ${spec.scheme} evidence for '${skill}', got ${ref.scheme}` };
  }

  if (ref.scheme === 'path') {
    if (spec.pathPattern && !spec.pathPattern.test(ref.ref)) {
      return { verdict: 'invalid', reason: `artifact '${ref.ref}' is not skill-specific for '${skill}'` };
    }
    const resolve = opts.resolvePath ?? existsSync;
    return resolve(ref.ref)
      ? { verdict: 'valid', reason: 'independent, skill-specific artifact resolves' }
      : { verdict: 'indeterminate', reason: 'claimed artifact not present yet (slow/unconventional output)' };
  }

  // Non-path schemes (pr/tpm/test) are not synchronously verifiable from here.
  return { verdict: 'indeterminate', reason: `${ref.scheme} evidence pending external verification` };
}
