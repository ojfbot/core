import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRootOf, loadNorthstar, loadRoadmap } from '../northstar-fm.mjs';
import { lint as roadmapLint } from '../../roadmap-lint.mjs';
import { lint as northstarLint } from '../../northstar-lint.mjs';

// S16 vantage scoping: a registered file whose repo checkout is absent from this vantage
// (CI checks out core alone) is a shadow WARN; a repo that is present but missing the
// registered file stays an ERROR. Fixture: a fake core with one in-tree northstar, one
// sibling whose repo dir is absent (unreachable), one sibling whose repo dir exists but
// lacks the file (missing).

let root; // temp dir holding fake-core + siblings
let core;

const README = `---
registry:
  - slug: l3-shared
    tier: L3
    path: decisions/northstar/l3-shared.md
  - slug: l1-gone
    tier: L1
    path: ../gone-app/.claude/northstar.md
  - slug: l1-hollow
    tier: L1
    path: ../hollow-app/.claude/northstar.md
roadmaps:
  - slug: rm-gone
    northstar: l1-gone
    path: ../gone-app/.claude/roadmap.md
---
# fixture registry
`;

const L3 = `---
slug: l3-shared
tier: L3
type: northstar
status: active
properties:
  - id: P1
    name: apex
    target: everything
    current: 10
    verification: manual
---
`;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'vantage-'));
  core = path.join(root, 'core');
  mkdirSync(path.join(core, 'decisions', 'northstar'), { recursive: true });
  writeFileSync(path.join(core, 'decisions', 'northstar', 'README.md'), README);
  writeFileSync(path.join(core, 'decisions', 'northstar', 'l3-shared.md'), L3);
  // hollow-app exists as a repo but has no northstar file; gone-app does not exist at all.
  mkdirSync(path.join(root, 'hollow-app', '.claude'), { recursive: true });
});

afterAll(() => { rmSync(root, { recursive: true, force: true }); });

describe('repoRootOf', () => {
  it('sibling ../<app>/… paths root at the sibling checkout', () => {
    expect(repoRootOf('../gone-app/.claude/northstar.md', core)).toBe(path.join(root, 'gone-app'));
  });
  it('in-tree paths root at core (always visible)', () => {
    expect(repoRootOf('decisions/northstar/l3-shared.md', core)).toBe(core);
  });
});

describe('loadNorthstar / loadRoadmap vantage markers', () => {
  it('absent repo → _missing + _unreachable', () => {
    const ns = loadNorthstar({ slug: 'l1-gone', tier: 'L1', path: '../gone-app/.claude/northstar.md' }, core);
    expect(ns._missing).toBe(true);
    expect(ns._unreachable).toBe(true);
  });
  it('present repo, absent file → _missing only (a real registry lie)', () => {
    const ns = loadNorthstar({ slug: 'l1-hollow', tier: 'L1', path: '../hollow-app/.claude/northstar.md' }, core);
    expect(ns._missing).toBe(true);
    expect(ns._unreachable).toBeUndefined();
  });
  it('roadmap markers behave the same', () => {
    const rm = loadRoadmap({ slug: 'rm-gone', northstar: 'l1-gone', path: '../gone-app/.claude/roadmap.md' }, core);
    expect(rm._missing).toBe(true);
    expect(rm._unreachable).toBe(true);
  });
});

describe('northstar-lint vantage scoping', () => {
  it('unreachable entry → WARN; hollow entry → ERROR', () => {
    const r = northstarLint(core, 30);
    expect(r.errors.some((e) => e.includes('l1-hollow'))).toBe(true);
    expect(r.errors.some((e) => e.includes('l1-gone'))).toBe(false);
    expect(r.warns.some((w) => w.includes('l1-gone') && w.includes('vantage'))).toBe(true);
    expect(r.counts.unreachable).toBe(1);
  });
});

describe('roadmap-lint vantage scoping', () => {
  it('unreachable roadmap → WARN, not ERROR', () => {
    const r = roadmapLint(core);
    expect(r.errors.some((e) => e.includes('rm-gone'))).toBe(false);
    expect(r.warns.some((w) => w.includes('rm-gone') && w.includes('vantage'))).toBe(true);
    expect(r.counts.unreachable).toBe(1);
  });
});
