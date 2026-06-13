/**
 * replay-ignored-correction.mjs unit tests
 *
 * The historical replay that PROVES the denominator repair: how far does the
 * `skill:suggestion-ignored` count drop once inline follows are corroborated?
 * Composes isCorroboratedFollow over fixture telemetry.
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/replay-ignored-correction.test.mjs
 */

import { describe, it, expect } from 'vitest';
import { replayIgnoredCorrection } from '../replay-ignored-correction.mjs';

const SID = 'sess-1';

function ignored({ skill, sid = SID, suggested_at }) {
  return { event: 'skill:suggestion-ignored', skill, session_id: sid, suggested_at };
}
function skillRead({ skill, sid = SID, ts }) {
  return { event: 'tool:used', tool_name: 'Read', file_path: `/x/.claude/skills/${skill}/SKILL.md`, session_id: sid, ts };
}

describe('replayIgnoredCorrection', () => {
  it('reclassifies only ignored events that have a corroborating inline follow', () => {
    const suggestionTelemetry = [
      ignored({ skill: 'tdd', suggested_at: '2026-06-13T10:00:00Z' }), // corroborated below
      ignored({ skill: 'deepen', suggested_at: '2026-06-13T11:00:00Z' }), // no read → stays ignored
      ignored({ skill: 'triage', sid: 'sess-2', suggested_at: '2026-06-13T12:00:00Z' }), // read is in other session → stays
    ];
    const toolTelemetry = [
      skillRead({ skill: 'tdd', ts: '2026-06-13T10:03:00Z' }),
      skillRead({ skill: 'triage', sid: 'sess-1', ts: '2026-06-13T12:03:00Z' }), // wrong session for that ignored
    ];

    const r = replayIgnoredCorrection({ suggestionTelemetry, toolTelemetry });
    expect(r.ignored_before).toBe(3);
    expect(r.corroborated_follow_count).toBe(1);
    expect(r.ignored_after).toBe(2);
    expect(r.regressions).toBe(0);
  });

  it('drops nothing when no ignored event has a follow', () => {
    const suggestionTelemetry = [ignored({ skill: 'tdd', suggested_at: '2026-06-13T10:00:00Z' })];
    const r = replayIgnoredCorrection({ suggestionTelemetry, toolTelemetry: [] });
    expect(r.ignored_before).toBe(1);
    expect(r.corroborated_follow_count).toBe(0);
    expect(r.ignored_after).toBe(1);
    expect(r.regressions).toBe(0);
  });
});
