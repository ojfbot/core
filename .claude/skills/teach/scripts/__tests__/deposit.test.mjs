// deposit.test.mjs — the teach corpus deposit step (adr:teach-corpus-deposit-architecture).
// Covers the pure half: slug identity (R6), artifact classification, the evidence row (R2),
// and the index entry (R5). The three side-effecting acts are exercised via --dry-run.

import { describe, it, expect } from 'vitest';
import {
  normalizeSlug,
  nextOrdinal,
  classifyArtifacts,
  buildLedgerRow,
  buildIndexEntry,
} from '../deposit.mjs';

describe('normalizeSlug — the corpus is topic-keyed (R6)', () => {
  it('normalizes to a stable filesystem-safe slug', () => {
    expect(normalizeSlug('EWMA Heatmaps')).toBe('ewma-heatmaps');
    expect(normalizeSlug('  Zone of Proximal Development  ')).toBe('zone-of-proximal-development');
    expect(normalizeSlug('a//b__c')).toBe('a-b-c');
  });

  it('is idempotent — re-depositing the same topic lands in the same folder', () => {
    const once = normalizeSlug('Merge Quiz & EWMA');
    expect(normalizeSlug(once)).toBe(once);
  });

  it('rejects a slug that normalizes to nothing rather than writing to teach/', () => {
    expect(() => normalizeSlug('///')).toThrow(/empty slug/);
    expect(() => normalizeSlug('')).toThrow();
  });
});

describe('nextOrdinal — lessons and records number independently (D21/D23)', () => {
  it('starts at 0001', () => {
    expect(nextOrdinal([])).toBe('0001');
  });

  it('continues from the highest existing ordinal', () => {
    expect(nextOrdinal(['0001-a.html', '0002-b.html'])).toBe('0003');
  });

  it('ignores unnumbered files and does not reuse gaps — supersession, not renumbering', () => {
    expect(nextOrdinal(['0001-a.html', 'notes.md', '0004-d.html'])).toBe('0005');
  });
});

describe('classifyArtifacts', () => {
  it('sorts each class and counts the total', () => {
    const r = classifyArtifacts({
      lessons: ['0002-b.html', '0001-a.html', 'scratch.txt'],
      records: ['0001-r.md'],
      references: ['cheatsheet.html'],
    });
    expect(r.lessons).toEqual(['0001-a.html', '0002-b.html']);
    expect(r.records).toEqual(['0001-r.md']);
    expect(r.total).toBe(4);
  });

  it('drops authoring scratch — it stays on the pushed branch (R3), out of the corpus', () => {
    const r = classifyArtifacts({ lessons: ['MISSION.md', 'notes.txt'], records: [], references: [] });
    expect(r.total).toBe(0);
  });

  it('tolerates missing classes', () => {
    expect(classifyArtifacts({}).total).toBe(0);
  });

  it('takes markdown references — the desk copy must render in the vault, not bounce to a browser', () => {
    const r = classifyArtifacts({ references: ['dynamic-workflows.md', 'cheatsheet.html', 'draft.txt'] });
    expect(r.references).toEqual(['cheatsheet.html', 'dynamic-workflows.md']);
    expect(r.total).toBe(2);
  });

  it('still refuses non-document scratch in reference/', () => {
    expect(classifyArtifacts({ references: ['notes.txt', 'diagram.png'] }).references).toEqual([]);
  });
});

describe('buildLedgerRow — a deposit that does not emit did not happen (R2)', () => {
  const artifacts = classifyArtifacts({ lessons: ['0001-a.html'], records: ['0001-r.md'], references: [] });

  it('emits the deposited event, never the served event (#384 boundary)', () => {
    const r = buildLedgerRow({ topic: 'zpd', artifacts, ts: '2026-08-03T00:00:00Z' });
    expect(r.event).toBe('harness:lesson-deposited');
    expect(r.event).not.toBe('harness:lesson-served');
    expect(r.harness).toBe('teach');
  });

  it('carries the filenames so the reconciler can tell a real deposit from an empty one', () => {
    const r = buildLedgerRow({ topic: 'zpd', artifacts });
    expect(r.artifacts.files).toEqual(['0001-a.html', '0001-r.md']);
    expect(r.artifacts.lessons).toBe(1);
    expect(r.artifacts.records).toBe(1);
  });

  it('binds the session per R6 and nulls what it was not given rather than inventing it', () => {
    const r = buildLedgerRow({ topic: 'zpd', artifacts, sessionId: 's1', bead: 'b1', refs: ['github:ojfbot/core#382'], branch: 'teach/zpd' });
    expect(r.session_id).toBe('s1');
    expect(r.bead).toBe('b1');
    expect(r.refs).toEqual(['github:ojfbot/core#382']);
    expect(buildLedgerRow({ topic: 'zpd', artifacts }).repo).toBeNull();
  });
});

describe('buildIndexEntry — Obsidian will not render a standalone .html (R5)', () => {
  const artifacts = classifyArtifacts({ lessons: ['0001-a.html'], records: ['0001-r.md'], references: [] });

  it('links the topic folder, not the lesson file', () => {
    const e = buildIndexEntry({ topic: 'zpd', ts: '2026-08-03T12:00:00Z', artifacts });
    expect(e).toContain('[[teach/zpd/|zpd]]');
    expect(e).not.toContain('.html');
  });

  it('dates the entry and pluralizes counts honestly', () => {
    const e = buildIndexEntry({ topic: 'zpd', ts: '2026-08-03T12:00:00Z', artifacts });
    expect(e.startsWith('- 2026-08-03 —')).toBe(true);
    expect(e).toContain('1 lesson,');
    expect(e).toContain('1 record');

    const many = classifyArtifacts({ lessons: ['0001-a.html', '0002-b.html'], records: [], references: [] });
    expect(buildIndexEntry({ topic: 'z', ts: '2026-08-03T00:00:00Z', artifacts: many })).toContain('2 lessons');
  });

  it('omits record/reference counts when there are none', () => {
    const only = classifyArtifacts({ lessons: ['0001-a.html'], records: [], references: [] });
    const e = buildIndexEntry({ topic: 'z', ts: '2026-08-03T00:00:00Z', artifacts: only });
    expect(e).not.toContain('record');
    expect(e).not.toContain('reference');
  });

  it('names the origin repo and branch when known', () => {
    const e = buildIndexEntry({ topic: 'z', ts: '2026-08-03T00:00:00Z', artifacts, repo: 'core', branch: 'teach/z' });
    expect(e).toContain('from `core`');
    expect(e).toContain('(`teach/z`)');
  });
});
