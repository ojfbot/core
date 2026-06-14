/**
 * C2 SHADOW cross-check validator (OPAV-S1). Verifies PROVENANCE on top of the spine's
 * presence check: the corroborating artifact must be (a) skill-specific, (b) produced by a
 * different mechanism than the emitter, and NOT (c) the agent's own log line. Observe-only:
 * the validator is a pure verdict function — it quarantines nothing (SHADOW until C4 RIDM).
 * See adr:skill-action-instrumentation.
 */

import { describe, it, expect } from 'vitest';
import { buildSkillActed } from '../tracking/skill-acted.js';
import { validateSkillActed } from '../tracking/skill-acted-validator.js';

// A real /adr action: an independent, skill-specific artifact that resolves.
const realAdr = () =>
  buildSkillActed({
    suggestionId: 'SUG-real',
    skill: 'adr',
    mode: 'shadow',
    expectedArtifact: 'decisions/adr/NNNN-*.md',
    evidence: { scheme: 'path', ref: 'decisions/adr/0093-suggestion-identity.md' },
  });

const resolveAll = () => true; // pretend every claimed path exists

describe('validateSkillActed — provenance verdicts', () => {
  it('valid: independent, skill-specific artifact that resolves', () => {
    expect(validateSkillActed(realAdr(), { resolvePath: resolveAll }).verdict).toBe('valid');
  });

  it('invalid: evidence points at the agent\'s own ledger (self-corroboration banned)', () => {
    const ev = buildSkillActed({
      suggestionId: 'SUG-self',
      skill: 'adr',
      expectedArtifact: 'decisions/adr/NNNN-*.md',
      evidence: { scheme: 'path', ref: 'packages/workflows/src/tracking/events.jsonl' },
    });
    const r = validateSkillActed(ev, { resolvePath: resolveAll });
    expect(r.verdict).toBe('invalid');
    expect(r.reason).toMatch(/self/i);
  });

  it('invalid: artifact is not skill-specific (wrong path shape for /adr)', () => {
    const ev = buildSkillActed({
      suggestionId: 'SUG-x',
      skill: 'adr',
      expectedArtifact: 'decisions/adr/NNNN-*.md',
      evidence: { scheme: 'path', ref: 'src/random.ts' },
    });
    expect(validateSkillActed(ev, { resolvePath: resolveAll }).verdict).toBe('invalid');
  });

  it('invalid: an engaged-only skill should not emit skill:acted', () => {
    const ev = buildSkillActed({
      suggestionId: 'SUG-recon',
      skill: 'recon',
      expectedArtifact: 'n/a',
      evidence: { scheme: 'path', ref: 'whatever.md' },
    });
    expect(validateSkillActed(ev, { resolvePath: resolveAll }).verdict).toBe('invalid');
  });

  it('indeterminate (third verdict): claimed path does not resolve (slow/unconventional output)', () => {
    expect(validateSkillActed(realAdr(), { resolvePath: () => false }).verdict).toBe('indeterminate');
  });

  it('indeterminate (third verdict): non-path evidence is not synchronously verifiable', () => {
    const ev = buildSkillActed({
      suggestionId: 'SUG-tdd',
      skill: 'tdd',
      expectedArtifact: 'a test that ran',
      evidence: { scheme: 'test', ref: 'some.test.ts::it works' },
    });
    expect(validateSkillActed(ev).verdict).toBe('indeterminate');
  });

  it('indeterminate: unknown skill has no expected_artifact spec', () => {
    const ev = buildSkillActed({
      suggestionId: 'SUG-?',
      skill: 'not-a-real-skill',
      expectedArtifact: 'x',
      evidence: { scheme: 'path', ref: 'a.md' },
    });
    expect(validateSkillActed(ev, { resolvePath: resolveAll }).verdict).toBe('indeterminate');
  });
});

describe('adversarial trace-injection — catch seeded fakes, zero false-flags', () => {
  it('flags every injected fake invalid while passing every real event', () => {
    const reals = Array.from({ length: 10 }, (_, i) =>
      buildSkillActed({
        suggestionId: `SUG-r${i}`,
        skill: 'adr',
        expectedArtifact: 'decisions/adr/NNNN-*.md',
        evidence: { scheme: 'path', ref: `decisions/adr/00${i}0-real.md` },
      }),
    );
    const fakes = [
      // self-written log as its own corroboration
      buildSkillActed({ suggestionId: 'F1', skill: 'adr', expectedArtifact: 'x', evidence: { scheme: 'path', ref: 'tracking/events.jsonl' } }),
      // not skill-specific
      buildSkillActed({ suggestionId: 'F2', skill: 'adr', expectedArtifact: 'x', evidence: { scheme: 'path', ref: 'README.md' } }),
      // engaged-only skill claiming an action
      buildSkillActed({ suggestionId: 'F3', skill: 'summarize', expectedArtifact: 'x', evidence: { scheme: 'path', ref: 'decisions/adr/0001-x.md' } }),
    ];

    const realVerdicts = reals.map((e) => validateSkillActed(e, { resolvePath: resolveAll }).verdict);
    const fakeVerdicts = fakes.map((e) => validateSkillActed(e, { resolvePath: resolveAll }).verdict);

    // zero false-flags: no real event flagged invalid
    expect(realVerdicts.filter((v) => v === 'invalid')).toHaveLength(0);
    expect(realVerdicts.every((v) => v === 'valid')).toBe(true);
    // 100% catch: every fake flagged invalid
    expect(fakeVerdicts.every((v) => v === 'invalid')).toBe(true);
  });
});
