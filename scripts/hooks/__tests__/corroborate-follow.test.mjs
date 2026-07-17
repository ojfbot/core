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
import { isCorroboratedFollow } from '../corroborate-follow.mjs';

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

/** A tool:used Skill-invocation event as log-tool-use.sh emits it. */
function skillInvocation({ skill, sid = SID, ts }) {
  return {
    event: 'tool:used',
    tool_name: 'Skill',
    file_path: '',
    skill,
    session_id: sid,
    ts,
  };
}

describe('isCorroboratedFollow — Skill-tool invocation (rm:rm-l1-core#S2)', () => {
  const base = { skill: 'tdd', sessionId: SID, sinceIso: SUGGESTED_AT };

  it('returns true when the suggested skill is invoked via the Skill tool after the suggestion', () => {
    const toolTelemetry = [skillInvocation({ skill: 'tdd', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ ...base, toolTelemetry })).toBe(true);
  });

  it('normalizes repo-scoped names: core:adr matches a suggestion for adr', () => {
    const toolTelemetry = [skillInvocation({ skill: 'core:adr', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ ...base, skill: 'adr', toolTelemetry })).toBe(true);
  });

  it('normalizes knowledge-file loads: resume-audit:knowledge:x matches resume-audit', () => {
    const toolTelemetry = [
      skillInvocation({ skill: 'resume-audit:knowledge:requirement-taxonomy', ts: '2026-06-13T10:02:00Z' }),
    ];
    expect(isCorroboratedFollow({ ...base, skill: 'resume-audit', toolTelemetry })).toBe(true);
  });

  it('does not match a different skill, even with shared prefix text', () => {
    const toolTelemetry = [skillInvocation({ skill: 'tdd-extra', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ ...base, toolTelemetry })).toBe(false);
  });

  it('ignores an invocation from a different session', () => {
    const toolTelemetry = [skillInvocation({ skill: 'tdd', sid: 'other-session', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ ...base, toolTelemetry })).toBe(false);
  });

  it('ignores an invocation that predates the suggestion', () => {
    const toolTelemetry = [skillInvocation({ skill: 'tdd', ts: '2026-06-13T09:59:00Z' })];
    expect(isCorroboratedFollow({ ...base, toolTelemetry })).toBe(false);
  });

  it('ignores Skill rows with an empty or missing skill field', () => {
    const toolTelemetry = [skillInvocation({ skill: '', ts: '2026-06-13T10:02:00Z' })];
    expect(isCorroboratedFollow({ ...base, toolTelemetry })).toBe(false);
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
