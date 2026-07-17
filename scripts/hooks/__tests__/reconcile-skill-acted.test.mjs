// reconcile-skill-acted.test.mjs — the independent per-session disposition recorder
// (OPAV-S1). Pure-function coverage of the projection + persistence; library deps
// (classifyDisposition / validateSkillActed / expectedArtifactFor) are imported from
// dist exactly as the hook loads them at runtime — same contract, no src/dist drift.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  artifactWrittenInSession,
  classifyOne,
  projectDispositions,
  suggestionRecords,
  persistDispositions,
} from '../reconcile-skill-acted.mjs';
import { classifyDisposition } from '../../../packages/workflows/dist/tracking/skill-acted-rate.js';
import { validateSkillActed } from '../../../packages/workflows/dist/tracking/skill-acted-validator.js';
import { expectedArtifactFor } from '../../../packages/workflows/dist/tracking/expected-artifact.js';

// Inject resolvePath:true so artifact resolution is deterministic (no real fs).
const DEPS = { classifyDisposition, validateSkillActed, expectedArtifactFor, resolvePath: () => true };

const SESS = 'sess-1';
const SINCE = '2026-06-18T00:00:00Z';
const NOW = Date.parse('2026-06-18T01:00:00Z'); // 1h after — inside the default 24h window

const sugg = (suggestionId, skill, ts = SINCE) => ({ suggestionId, skill, sessionId: SESS, ts });
const read = (skill, ts = '2026-06-18T00:30:00Z') => ({
  tool_name: 'Read',
  file_path: `/Users/x/ojfbot/core/.claude/skills/${skill}/SKILL.md`,
  session_id: SESS,
  ts,
});
const write = (path, ts = '2026-06-18T00:40:00Z') => ({ tool_name: 'Write', file_path: path, session_id: SESS, ts });
const actedEvt = (suggestionId, skill, ref) => ({
  event_type: 'skill:acted',
  op_id: `${suggestionId}#acted`,
  correlation_id: suggestionId,
  ts: '2026-06-18T00:45:00Z',
  actor: 'agent',
  to_state: 'acted',
  evidence_ref: { scheme: 'path', ref },
  payload: { skill, mode: 'shadow', expected_artifact: 'x' },
});

const ctx = (over = {}) => ({ toolTelemetry: [], actedEvents: [], nowMs: NOW, windowMs: 24 * 3600 * 1000, ...over });

describe('classifyOne — one suggestion → one terminal disposition', () => {
  it('ignored: no engagement, no action', () => {
    const r = classifyOne(sugg('s', 'adr'), ctx(), DEPS);
    expect(r.disposition).toBe('ignored');
  });

  it('engaged_no_act: engaged-only skill (act_expected:false) that was read', () => {
    const r = classifyOne(sugg('s', 'recon'), ctx({ toolTelemetry: [read('recon')] }), DEPS);
    expect(r.engaged).toBe(true);
    expect(r.disposition).toBe('engaged_no_act');
  });

  it('acted: engaged + a C2-valid skill:acted whose artifact resolves', () => {
    const r = classifyOne(
      sugg('s', 'adr'),
      ctx({ toolTelemetry: [read('adr')], actedEvents: [actedEvt('s', 'adr', 'decisions/adr/0097-x.md')] }),
      DEPS,
    );
    expect(r.acted).toBe(true);
    expect(r.disposition).toBe('acted');
  });

  it('capture_miss: engaged, NO skill:acted, but a matching artifact was written in-session (the real C1 failure)', () => {
    const r = classifyOne(
      sugg('s', 'adr'),
      ctx({ toolTelemetry: [read('adr'), write('/repo/decisions/adr/0098-y.md')] }),
      DEPS,
    );
    expect(r.acted).toBe(false);
    expect(r.artifactExists).toBe(true);
    expect(r.disposition).toBe('capture_miss');
  });

  it('pending: engaged, act_expected, no artifact yet, inside the window', () => {
    const r = classifyOne(sugg('s', 'adr'), ctx({ toolTelemetry: [read('adr')] }), DEPS);
    expect(r.disposition).toBe('pending');
  });

  it('engaged_no_act: engaged, act_expected, no artifact, window passed (honest non-completion)', () => {
    const r = classifyOne(sugg('s', 'adr'), ctx({ toolTelemetry: [read('adr')], windowMs: 1 }), DEPS);
    expect(r.disposition).toBe('engaged_no_act');
  });

  it('an unbacked skill:acted (artifact does not resolve) is NOT counted as acted', () => {
    const r = classifyOne(
      sugg('s', 'adr'),
      ctx({ toolTelemetry: [read('adr')], actedEvents: [actedEvt('s', 'adr', 'decisions/adr/0099-z.md')] }),
      { ...DEPS, resolvePath: () => false },
    );
    expect(r.acted).toBe(false);
    expect(r.disposition).toBe('pending'); // engaged, no valid acted, no artifact, in window
  });
});

describe('artifactWrittenInSession — independent artifact-existence proxy', () => {
  const spec = expectedArtifactFor('adr');
  it('true for a Write matching the pathPattern in-session at/after the suggestion', () => {
    expect(artifactWrittenInSession({ spec, sessionId: SESS, sinceIso: SINCE, toolTelemetry: [write('/r/decisions/adr/0100-a.md')] })).toBe(true);
  });
  it('false for a write to a non-matching path', () => {
    expect(artifactWrittenInSession({ spec, sessionId: SESS, sinceIso: SINCE, toolTelemetry: [write('/r/README.md')] })).toBe(false);
  });
  it('false for a write before the suggestion ts', () => {
    expect(artifactWrittenInSession({ spec, sessionId: SESS, sinceIso: SINCE, toolTelemetry: [write('/r/decisions/adr/0100-a.md', '2026-06-17T00:00:00Z')] })).toBe(false);
  });
  it('false for a skill with no pathPattern (loose SHADOW-window skill)', () => {
    expect(artifactWrittenInSession({ spec: expectedArtifactFor('plan-feature'), sessionId: SESS, sinceIso: SINCE, toolTelemetry: [write('/r/anything.md')] })).toBe(false);
  });
});

describe('suggestionRecords — dedup + filter the join root (both populations, S3)', () => {
  const events = [
    { event: 'skill:suggested-uninstalled', skill: 'adr', suggestion_id: 'A', session_id: SESS, suggested_at: SINCE },
    { event: 'skill:suggested-uninstalled', skill: 'adr', suggestion_id: 'A', session_id: SESS, suggested_at: '2026-06-18T05:00:00Z' }, // dup, later
    { event: 'skill:suggestion-ignored', skill: 'tdd', suggestion_id: 'B', session_id: SESS, suggested_at: SINCE }, // wrong event
    { event: 'skill:suggested-uninstalled', skill: 'sweep', suggestion_id: 'C', session_id: 'other', suggested_at: SINCE }, // other session
    { event: 'skill:suggested', skill: 'tdd', suggestion_id: 'D', session_id: SESS, suggested_at: SINCE }, // installed (S3)
  ];
  it('keeps one record per suggestion_id (earliest ts), scoring BOTH suggested and suggested-uninstalled', () => {
    const recs = suggestionRecords(events);
    expect(recs.map((r) => r.suggestionId).sort()).toEqual(['A', 'C', 'D']);
    expect(recs.find((r) => r.suggestionId === 'A').ts).toBe(SINCE);
  });
  it('tags each record with its population', () => {
    const recs = suggestionRecords(events);
    expect(recs.find((r) => r.suggestionId === 'A').population).toBe('uninstalled');
    expect(recs.find((r) => r.suggestionId === 'D').population).toBe('installed');
  });
  it('still excludes non-denominator events (suggestion-ignored)', () => {
    expect(suggestionRecords(events).map((r) => r.suggestionId)).not.toContain('B');
  });
  it('filters to a session when given', () => {
    expect(suggestionRecords(events, { sessionId: SESS }).map((r) => r.suggestionId).sort()).toEqual(['A', 'D']);
  });
});

describe('persistDispositions — idempotent, terminal-only', () => {
  const rows = [
    { suggestion: { ...sugg('A', 'adr'), population: 'installed' }, disposition: 'acted', engaged: true, acted: true, artifactExists: true },
    { suggestion: sugg('B', 'adr'), disposition: 'pending', engaged: true, acted: false, artifactExists: false },
  ];
  it('writes terminal dispositions, skips pending, and is idempotent on re-run', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'disp-')), 'skill-dispositions.jsonl');
    const w1 = persistDispositions(rows, out, '2026-06-18T01:00:00Z');
    expect(w1.map((r) => r.suggestion.suggestionId)).toEqual(['A']); // B (pending) skipped
    expect(existsSync(out)).toBe(true);
    const w2 = persistDispositions(rows, out, '2026-06-18T02:00:00Z');
    expect(w2).toEqual([]); // A already recorded → idempotent
    const lines = readFileSync(out, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      suggestion_id: 'A',
      disposition: 'acted',
      event: 'skill:disposition',
      population: 'installed', // era marker (S3): legacy rows lack this field
    });
  });
});

describe('projectDispositions — batch', () => {
  it('maps each suggestion to a row', () => {
    const rows = projectDispositions([sugg('A', 'adr'), sugg('B', 'recon')], ctx({ toolTelemetry: [read('recon')] }), DEPS);
    expect(rows).toHaveLength(2);
    expect(rows[1].disposition).toBe('engaged_no_act');
  });
});
