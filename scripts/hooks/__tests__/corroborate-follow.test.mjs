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

// ── script-exec path (rm:rm-l1-core#S17 gap (e)) ─────────────────────────────

/** A tool:used Bash event whose input_summary runs a skill's own script. */
function skillScriptExec({ skill, sid = SID, ts, script = 'run.mjs' }) {
  return {
    event: 'tool:used',
    tool_name: 'Bash',
    file_path: '',
    input_summary: `"node .claude/skills/${skill}/scripts/${script} --flag"`,
    session_id: sid,
    ts,
  };
}

describe('isCorroboratedFollow — script-exec (the third follow path)', () => {
  it('returns true for a Bash run of the skill\'s own scripts/ after the suggestion', () => {
    expect(
      isCorroboratedFollow({
        skill: 'adr',
        sessionId: SID,
        sinceIso: SUGGESTED_AT,
        toolTelemetry: [skillScriptExec({ skill: 'adr', ts: '2026-06-13T10:03:00Z' })],
      }),
    ).toBe(true);
  });

  it('normalizes segmented suggested names (core:adr ≈ adr dir)', () => {
    expect(
      isCorroboratedFollow({
        skill: 'core:adr',
        sessionId: SID,
        sinceIso: SUGGESTED_AT,
        toolTelemetry: [skillScriptExec({ skill: 'adr', ts: '2026-06-13T10:03:00Z' })],
      }),
    ).toBe(true);
  });

  it('ignores another skill\'s scripts, other sessions, and pre-suggestion runs', () => {
    const base = { skill: 'adr', sessionId: SID, sinceIso: SUGGESTED_AT };
    expect(isCorroboratedFollow({ ...base, toolTelemetry: [skillScriptExec({ skill: 'sweep', ts: '2026-06-13T10:03:00Z' })] })).toBe(false);
    expect(isCorroboratedFollow({ ...base, toolTelemetry: [skillScriptExec({ skill: 'adr', sid: 'other', ts: '2026-06-13T10:03:00Z' })] })).toBe(false);
    expect(isCorroboratedFollow({ ...base, toolTelemetry: [skillScriptExec({ skill: 'adr', ts: '2026-06-13T09:00:00Z' })] })).toBe(false);
  });

  it('a Bash command that merely mentions a non-scripts skill path does not corroborate', () => {
    const ev = {
      event: 'tool:used',
      tool_name: 'Bash',
      input_summary: '"cat .claude/skills/adr/SKILL.md"',
      session_id: SID,
      ts: '2026-06-13T10:03:00Z',
    };
    expect(isCorroboratedFollow({ skill: 'adr', sessionId: SID, sinceIso: SUGGESTED_AT, toolTelemetry: [ev] })).toBe(false);
  });
});
