// reconcile-teach-deposits.test.mjs — the shadow reconciler for the teach corpus
// (adr:teach-corpus-deposit-architecture R2). Pure-function coverage of the audit: the whole
// reconciliation is deliberately filesystem-free so the TD-006 detector is itself testable.

import { describe, it, expect } from 'vitest';
import { topicFromBranch, parseLedger, reconcile } from '../reconcile-teach-deposits.mjs';

const row = (topic, files = ['0001-x.html'], ts = '2026-08-03T00:00:00Z') => ({
  ts,
  event: 'harness:lesson-deposited',
  topic,
  artifacts: { lessons: files.length, records: 0, references: 0, files },
});

describe('topicFromBranch', () => {
  it('extracts the topic slug from local and remote refs', () => {
    expect(topicFromBranch('teach/ewma-heatmaps')).toBe('ewma-heatmaps');
    expect(topicFromBranch('origin/teach/ewma-heatmaps')).toBe('ewma-heatmaps');
    expect(topicFromBranch('  origin/teach/zpd  ')).toBe('zpd');
  });

  it('rejects anything that is not a teach authoring branch', () => {
    expect(topicFromBranch('main')).toBeNull();
    expect(topicFromBranch('feat/teach-skill')).toBeNull();
    expect(topicFromBranch('teach/')).toBeNull();
    expect(topicFromBranch('teach/Nested/Slug')).toBeNull();
    expect(topicFromBranch(undefined)).toBeNull();
  });
});

describe('parseLedger', () => {
  it('keeps only lesson-deposited rows', () => {
    const text = [
      JSON.stringify(row('a')),
      JSON.stringify({ event: 'harness:lesson-served', topic: 'b' }),
      JSON.stringify({ event: 'harness:merge-observed' }),
    ].join('\n');
    expect(parseLedger(text).map((r) => r.topic)).toEqual(['a']);
  });

  it('survives a corrupt trailing line — a shadow reporter must not die on bad input', () => {
    const text = `${JSON.stringify(row('a'))}\n{"event":"harness:lesson-dep`;
    expect(parseLedger(text)).toHaveLength(1);
  });

  it('handles an absent ledger', () => {
    expect(parseLedger('')).toEqual([]);
    expect(parseLedger(undefined)).toEqual([]);
  });
});

describe('reconcile — the TD-006 detector', () => {
  it('flags a pushed branch with no deposit row as an orphan', () => {
    const r = reconcile({ branches: ['origin/teach/zpd'], rows: [] });
    expect(r.orphanBranches).toEqual(['zpd']);
    expect(r.ok).toBe(false);
  });

  it('passes when every branch has a deposit', () => {
    const r = reconcile({ branches: ['origin/teach/zpd'], rows: [row('zpd')] });
    expect(r.orphanBranches).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('flags an emitted row that deposited nothing — a laundered failure is not evidence', () => {
    const r = reconcile({ branches: ['origin/teach/zpd'], rows: [row('zpd', [])] });
    expect(r.emptyDeposits).toHaveLength(1);
    expect(r.ok).toBe(false);
  });

  it('flags a deposit whose branch is gone — R3 recoverability lost', () => {
    const r = reconcile({ branches: [], rows: [row('zpd')] });
    expect(r.orphanDeposits.map((x) => x.topic)).toEqual(['zpd']);
  });

  it('ignores non-teach branches entirely', () => {
    const r = reconcile({ branches: ['main', 'feat/x', 'origin/HEAD'], rows: [] });
    expect(r.orphanBranches).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('is ok on true cold start — nothing pushed, nothing deposited', () => {
    const r = reconcile({ branches: [], rows: [] });
    expect(r.ok).toBe(true);
    expect(r.orphanBranches).toEqual([]);
  });

  it('reports several orphans deterministically', () => {
    const r = reconcile({
      branches: ['origin/teach/zed', 'origin/teach/alpha', 'origin/teach/mid'],
      rows: [row('mid')],
    });
    expect(r.orphanBranches).toEqual(['alpha', 'zed']);
  });
});
