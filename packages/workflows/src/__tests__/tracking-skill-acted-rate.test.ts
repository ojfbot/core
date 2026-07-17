/**
 * C1 disposition model (OPAV-S1). Each suggestion projects to exactly one terminal
 * disposition. Artifact existence is the discriminator that separates honest
 * non-completion (`engaged_no_act`) from a self-report failure (`capture_miss`) — so
 * capture-rate = acted / (acted + capture_miss) never punishes honest non-completion.
 * See adr:skill-action-instrumentation.
 */

import { describe, it, expect } from 'vitest';
import { classifyDisposition, computeActionRate } from '../tracking/skill-acted-rate.js';

const base = {
  suggestion: { suggestionId: 'SUG-1', skill: 'adr', sessionId: 'sess-1', ts: '2026-06-13T00:00:00Z' },
  engaged: true,
  acted: false,
  artifactExists: false,
  actExpected: true,
  withinWindow: false,
};

describe('classifyDisposition', () => {
  it('acted: a valid skill:acted exists', () => {
    expect(classifyDisposition({ ...base, acted: true })).toBe('acted');
  });

  it('ignored: never engaged (no SKILL.md read, no acted)', () => {
    expect(classifyDisposition({ ...base, engaged: false })).toBe('ignored');
  });

  it('capture_miss: engaged, no skill:acted, but the artifact exists', () => {
    expect(classifyDisposition({ ...base, engaged: true, acted: false, artifactExists: true })).toBe('capture_miss');
  });

  it('engaged_no_act: engaged, no acted, no artifact, window passed (honest non-completion)', () => {
    expect(classifyDisposition({ ...base, engaged: true, artifactExists: false, withinWindow: false })).toBe('engaged_no_act');
  });

  it('engaged_no_act: engaged-only skill (act_expected=false) terminates here by design', () => {
    expect(classifyDisposition({ ...base, actExpected: false, artifactExists: false })).toBe('engaged_no_act');
  });

  it('pending: engaged, act_expected, within window, artifact not yet present', () => {
    expect(classifyDisposition({ ...base, withinWindow: true, artifactExists: false })).toBe('pending');
  });

  it('acted wins even if other flags are set (terminal precedence)', () => {
    expect(classifyDisposition({ ...base, acted: true, engaged: false })).toBe('acted');
  });

  it('is population-agnostic: the installed/uninstalled tag never changes the disposition', () => {
    // The denominator split (RCA d92e3b15) tags populations for side-by-side REPORTING;
    // classification itself must treat both identically.
    for (const population of ['installed', 'uninstalled'] as const) {
      const suggestion = { ...base.suggestion, population };
      expect(classifyDisposition({ ...base, suggestion, engaged: false })).toBe('ignored');
      expect(classifyDisposition({ ...base, suggestion, acted: true })).toBe('acted');
      expect(classifyDisposition({ ...base, suggestion, artifactExists: true })).toBe('capture_miss');
    }
  });
});

describe('computeActionRate', () => {
  it('capture-rate excludes engaged_no_act from the denominator', () => {
    const dispositions = ['acted', 'acted', 'acted', 'capture_miss', 'engaged_no_act', 'engaged_no_act', 'ignored', 'pending'] as const;
    const rate = computeActionRate(dispositions);
    expect(rate.counts).toMatchObject({ acted: 3, capture_miss: 1, engaged_no_act: 2, ignored: 1, pending: 1 });
    // 3 acted / (3 acted + 1 capture_miss) = 0.75 — engaged_no_act NOT in the denominator
    expect(rate.captureRate).toBeCloseTo(0.75, 5);
  });

  it('captureRate is null when there is nothing to capture (acted+capture_miss = 0)', () => {
    const rate = computeActionRate(['engaged_no_act', 'ignored', 'pending']);
    expect(rate.captureRate).toBeNull();
  });
});
