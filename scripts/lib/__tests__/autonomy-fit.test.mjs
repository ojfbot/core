import { describe, it, expect } from 'vitest';
import { hasMachineCheck, autonomyFit, effectiveClaimable } from '../autonomy-fit.mjs';

describe('hasMachineCheck', () => {
  it('true for a non-empty check command', () => {
    expect(hasMachineCheck({ check: 'pnpm test' })).toBe(true);
  });
  it('false for absent, empty, blank, or non-string check', () => {
    expect(hasMachineCheck({})).toBe(false);
    expect(hasMachineCheck({ check: '' })).toBe(false);
    expect(hasMachineCheck({ check: '   ' })).toBe(false);
    expect(hasMachineCheck({ check: 42 })).toBe(false);
    expect(hasMachineCheck(undefined)).toBe(false);
  });
});

describe('autonomyFit', () => {
  it('agent with a check, human without', () => {
    expect(autonomyFit({ check: 'pnpm test' })).toBe('agent');
    expect(autonomyFit({})).toBe('human');
  });
});

describe('effectiveClaimable', () => {
  it('demotes agent_eligible without a check to human_only, with a stated reason', () => {
    const r = effectiveClaimable({ claimable_by: 'agent_eligible' });
    expect(r.claimable).toBe('human_only');
    expect(r.demoted).toBe(true);
    expect(r.reason).toMatch(/check/);
  });
  it('demotes the default (either) without a check', () => {
    expect(effectiveClaimable({}).claimable).toBe('human_only');
  });
  it('passes agent_eligible through when a check exists', () => {
    expect(effectiveClaimable({ claimable_by: 'agent_eligible', check: 'pnpm test' }))
      .toEqual({ claimable: 'agent_eligible', demoted: false });
  });
  it('never demotes human_only (already human-routed, check or not)', () => {
    expect(effectiveClaimable({ claimable_by: 'human_only' }))
      .toEqual({ claimable: 'human_only', demoted: false });
  });
});
