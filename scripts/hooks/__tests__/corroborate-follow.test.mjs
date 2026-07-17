/**
 * corroborate-follow.mjs unit tests
 *
 * The single source of truth for "was a skill suggestion followed inline?" —
 * shared by suggest-skill.sh (live ignored-detector) and
 * replay-ignored-correction.mjs (historical replay). Pure function over
 * in-memory event arrays; no filesystem in the unit tests.
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/corroborate-follow.test.mjs
 */

import { describe, it, expect } from 'vitest';
import { isCorroboratedFollow, skillNameMatches } from '../corroborate-follow.mjs';

const SID = 'sess-abc';
const SUGGESTED_AT = '2026-06-13T10:00:00Z';

/** A tool:used Read event for a given skill's SKILL.md. */
function skillRead({ skill, sid = SID, ts }) {
  return {
    event: 'tool:used',
    tool_name: 'Read',
    file_path: `/Users/yuri/ojfbot/core/.claude/skills/${skill}/SKILL.md`,
    session_id: sid,
    ts,
  };
}

describe('isCorroboratedFollow — inline SKILL.md read', () => {
  it('returns true when a SKILL.md Read for the skill+session occurs after the suggestion', () => {
    const toolTelemetry = [skillRead({ skill: 'tdd', ts: '2026-06-13T10:02:00Z' })];
    expect(
      isCorroboratedFollow({
        skill: 'tdd',
        sessionId: SID,
        sinceIso: SUGGESTED_AT,
        toolTelemetry,
      }),
    ).toBe(true);
  });

  it('returns false when there is no SKILL.md Read at all', () => {
    expect(
      isCorroboratedFollow({
        skill: 'tdd',
        sessionId: SID,
        sinceIso: SUGGESTED_AT,
        toolTelemetry: [],
      }),
    ).toBe(false);
  });

  it('ignores a SKILL.md Read from a different session', () => {
    const toolTelemetry = [skillRead({ skill: 'tdd', sid: 'other-session', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });

  it('ignores a SKILL.md Read that predates the suggestion', () => {
    const toolTelemetry = [skillRead({ skill: 'tdd', ts: '2026-06-13T09:59:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });

  it('ignores a SKILL.md Read for a different skill', () => {
    const toolTelemetry = [skillRead({ skill: 'deepen', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });
});

/** A tool:used Skill-tool invocation event (catch-all telemetry; file_path is ""). */
function skillInvoke({ name, sid = SID, ts }) {
  return { event: 'tool:used', tool_name: 'Skill', file_path: '', skill: name, session_id: sid, ts };
}

describe('skillNameMatches — invocation-name normalization', () => {
  it('matches the exact slug', () => expect(skillNameMatches('adr', 'adr')).toBe(true));
  it('matches a repo/plugin prefix (core:adr)', () => expect(skillNameMatches('core:adr', 'adr')).toBe(true));
  it('matches dir:skill (frame-standup:frame-standup)', () => expect(skillNameMatches('frame-standup:frame-standup', 'frame-standup')).toBe(true));
  it('matches a knowledge sub-page (adr:knowledge:adr-template)', () => expect(skillNameMatches('adr:knowledge:adr-template', 'adr')).toBe(true));
  it('does not match a different skill', () => expect(skillNameMatches('core:tdd', 'adr')).toBe(false));
  it('does not match a middle segment', () => expect(skillNameMatches('resume-audit:knowledge:requirement-taxonomy', 'knowledge')).toBe(false));
  it('is false for missing/empty names', () => {
    expect(skillNameMatches(undefined, 'adr')).toBe(false);
    expect(skillNameMatches('', 'adr')).toBe(false);
    expect(skillNameMatches('adr', '')).toBe(false);
  });
});

describe('isCorroboratedFollow — Skill-tool invocation (the dominant real path)', () => {
  it('returns true for a Skill-tool invocation of the suggested skill after the suggestion', () => {
    const toolTelemetry = [skillInvoke({ name: 'tdd', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(true);
  });

  it('returns true for a prefixed invocation name (core:tdd ≈ tdd)', () => {
    const toolTelemetry = [skillInvoke({ name: 'core:tdd', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(true);
  });

  it('ignores a Skill-tool invocation of a different skill', () => {
    const toolTelemetry = [skillInvoke({ name: 'deepen', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });

  it('does not match a different skill, even with shared prefix text (tdd-extra ≠ tdd)', () => {
    const toolTelemetry = [skillInvoke({ name: 'tdd-extra', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });

  it('ignores a Skill-tool invocation from a different session', () => {
    const toolTelemetry = [skillInvoke({ name: 'tdd', sid: 'other-session', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });

  it('ignores a Skill-tool invocation that predates the suggestion', () => {
    const toolTelemetry = [skillInvoke({ name: 'tdd', ts: '2026-06-13T09:59:00Z' })];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });

  it('ignores a Skill row with no skill name (defensive)', () => {
    const toolTelemetry = [{ event: 'tool:used', tool_name: 'Skill', file_path: '', session_id: SID, ts: '2026-06-13T10:02:00Z' }];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry })).toBe(false);
  });
});

describe('isCorroboratedFollow — forward-compat skill:acted (S1)', () => {
  it('returns true on a future skill:acted for the skill+session after the suggestion', () => {
    const skillTelemetry = [
      { event: 'skill:acted', skill: 'tdd', session_id: SID, ts: '2026-06-13T10:05:00Z' },
    ];
    expect(isCorroboratedFollow({ skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT, skillTelemetry })).toBe(true);
  });
});
