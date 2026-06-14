// skill-acted-detect.test.mjs — the INDEPENDENT engagement detector (OPAV-S1 C1).
// The two-source contract requires this signal be derived by a DIFFERENT mechanism
// than the agent's self-emitted skill:acted. So the detector reads only the catch-all
// tool-telemetry (SKILL.md Reads) and is structurally blind to skill:acted.

import { describe, it, expect } from 'vitest';
import { detectEngagement, computeOverCapture } from '../skill-acted-detect.mjs';

const read = (skill, session, ts) => ({
  tool_name: 'Read',
  file_path: `/Users/x/ojfbot/core/.claude/skills/${skill}/SKILL.md`,
  session_id: session,
  ts,
});

describe('detectEngagement — independent inline-follow signal', () => {
  it('true when a SKILL.md Read for the skill+session occurs at/after the suggestion', () => {
    const tool = [read('adr', 'sess-1', '2026-06-13T01:00:00Z')];
    expect(detectEngagement({ skill: 'adr', sessionId: 'sess-1', sinceIso: '2026-06-13T00:00:00Z', toolTelemetry: tool })).toBe(true);
  });

  it('false when there is no SKILL.md Read (genuinely not engaged)', () => {
    expect(detectEngagement({ skill: 'adr', sessionId: 'sess-1', sinceIso: '2026-06-13T00:00:00Z', toolTelemetry: [] })).toBe(false);
  });

  it('false for a Read before the suggestion ts (not caused by it)', () => {
    const tool = [read('adr', 'sess-1', '2026-06-12T23:00:00Z')];
    expect(detectEngagement({ skill: 'adr', sessionId: 'sess-1', sinceIso: '2026-06-13T00:00:00Z', toolTelemetry: tool })).toBe(false);
  });

  it('is independent: a skill:acted self-report alone does NOT count as engagement', () => {
    // Only a self-emitted skill:acted exists, no SKILL.md Read. The detector must
    // not be fooled — independence is the whole point of the two-source contract.
    const tool = [{ tool_name: 'Skill', file_path: null, session_id: 'sess-1', ts: '2026-06-13T01:00:00Z' }];
    expect(detectEngagement({ skill: 'adr', sessionId: 'sess-1', sinceIso: '2026-06-13T00:00:00Z', toolTelemetry: tool })).toBe(false);
  });
});

describe('computeOverCapture — false-emit guard (cheap-to-emit gaming)', () => {
  it('rate = acted events with NO independent engagement / total acted', () => {
    // 4 acted; 1 of them has no independent SKILL.md Read → over-capture 0.25
    const r = computeOverCapture([
      { acted: true, engaged: true },
      { acted: true, engaged: true },
      { acted: true, engaged: true },
      { acted: true, engaged: false },
    ]);
    expect(r.total).toBe(4);
    expect(r.uncorroborated).toBe(1);
    expect(r.rate).toBeCloseTo(0.25, 5);
  });

  it('rate is null when there are no acted events', () => {
    expect(computeOverCapture([{ acted: false, engaged: true }]).rate).toBeNull();
  });
});
