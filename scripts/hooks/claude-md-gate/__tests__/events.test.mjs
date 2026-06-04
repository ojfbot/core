/**
 * events.mjs `summarize` tests — ADR-0081 Slice 2, checkpoint C3 (the TPM math).
 * Run: pnpm vitest run scripts/hooks/claude-md-gate/__tests__/events.test.mjs
 */
import { describe, it, expect } from 'vitest';
import { summarize, logGateEvent, readEvents } from '../events.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const trip = (over) => ({ tripwire: { tripped: true }, verdict: { isConditional: over }, action: over ? 'allow-shadow' : 'allow-no-violation' });

describe('summarize', () => {
  it('computes M5 would-flag rate among judged trips', () => {
    // 4 trips judged: 3 flagged conditional, 1 clean → 75%
    const s = summarize([trip(true), trip(true), trip(true), trip(false)]);
    expect(s.tripped).toBe(4);
    expect(s.judged).toBe(4);
    expect(s.wouldFlag).toBe(3);
    expect(s.m5WouldFlagRate).toBeCloseTo(0.75);
  });

  it('counts no-judge trips (judge could not run)', () => {
    const s = summarize([{ tripwire: { tripped: true }, verdict: null, action: 'allow-shadow-nojudge' }, trip(true)]);
    expect(s.tripped).toBe(2);
    expect(s.judged).toBe(1);
    expect(s.nojudge).toBe(1);
  });

  it('M3 override rate is null without enforce-mode blocks', () => {
    expect(summarize([trip(true)]).m3OverrideRate).toBe(null);
  });

  it('M3 override rate among actual blocks', () => {
    const s = summarize([
      { tripwire: { tripped: true }, verdict: { isConditional: true }, action: 'block', overridden: true },
      { tripwire: { tripped: true }, verdict: { isConditional: true }, action: 'block', overridden: false },
    ]);
    expect(s.blocked).toBe(2);
    expect(s.overridden).toBe(1);
    expect(s.m3OverrideRate).toBeCloseTo(0.5);
  });

  it('ignores non-tripped events in trip counts', () => {
    const s = summarize([{ tripwire: { tripped: false }, action: 'allow-no-trip' }, trip(true)]);
    expect(s.total).toBe(2);
    expect(s.tripped).toBe(1);
  });
});

describe('logGateEvent + readEvents round-trip', () => {
  it('appends and reads back JSONL events', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-log-'));
    const logPath = join(dir, 'sub', 'events.jsonl'); // exercises mkdir
    logGateEvent({ file: 'a/CLAUDE.md', action: 'allow-shadow', tripwire: { tripped: true } }, { logPath, now: () => '2026-01-01T00:00:00Z' });
    logGateEvent({ file: 'b/CLAUDE.md', action: 'block', tripwire: { tripped: true } }, { logPath, now: () => '2026-01-01T00:00:01Z' });
    const events = readEvents({ logPath });
    expect(events).toHaveLength(2);
    expect(events[0].ts).toBe('2026-01-01T00:00:00Z');
    expect(events[1].action).toBe('block');
    rmSync(dir, { recursive: true, force: true });
  });
});
