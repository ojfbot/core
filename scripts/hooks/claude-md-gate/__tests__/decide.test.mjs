/**
 * gate.mjs `decide` tests — ADR-0081 Slice 2, checkpoints C4/C5 (the allow/block decision).
 * Run: pnpm vitest run scripts/hooks/claude-md-gate/__tests__/decide.test.mjs
 */
import { describe, it, expect } from 'vitest';
import { decide } from '../gate.mjs';

const COND = { isConditional: true, suggestedLayer: 'L1' };
const OK = { isConditional: false, suggestedLayer: 'L0' };

describe('decide', () => {
  it('shadow + conditional → allow (observe-only), recorded for M5', () => {
    expect(decide({ mode: 'shadow', cleared: false, verdict: COND })).toEqual({ action: 'allow-shadow', block: false });
  });

  it('enforce + conditional + uncleared → BLOCK', () => {
    expect(decide({ mode: 'enforce', cleared: false, verdict: COND })).toEqual({ action: 'block', block: true });
  });

  it('enforce + conditional + cleared → allow (loop broken)', () => {
    expect(decide({ mode: 'enforce', cleared: true, verdict: COND })).toEqual({ action: 'allow-cleared', block: false });
  });

  it('enforce + non-conditional → allow', () => {
    expect(decide({ mode: 'enforce', cleared: false, verdict: OK })).toEqual({ action: 'allow-no-violation', block: false });
  });

  it('enforce + no verdict (judge degraded) → allow, NEVER block', () => {
    expect(decide({ mode: 'enforce', cleared: false, verdict: null })).toEqual({ action: 'allow-shadow-nojudge', block: false });
  });

  it('shadow NEVER blocks even when conditional', () => {
    expect(decide({ mode: 'shadow', cleared: false, verdict: COND }).block).toBe(false);
  });
});
