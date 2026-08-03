import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { scanRepo, openHooks, trackedBeadFiles } from '../../bead-lint.mjs';

/** Build a repo root with a .handoff/ directory; optionally a git checkout. */
function scaffold({ git = true } = {}) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'bead-lint-'));
  const repo = path.join(tmp, 'repo');
  mkdirSync(path.join(repo, '.handoff'), { recursive: true });
  if (git) {
    execFileSync('git', ['-C', repo, 'init', '--quiet']);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@test']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 'test']);
  }
  return { tmp, repo };
}

function writeBead(repo, stem, over = {}) {
  const fm = {
    id: stem, type: 'brief', title: '"a bead"', actor: 'code-claude',
    status: 'live', created_at: '2026-08-02T12:00:00-0500', ...over,
  };
  const lines = ['---', ...Object.entries(fm).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`), '---', '', '# body', ''];
  writeFileSync(path.join(repo, '.handoff', `${stem}.md`), lines.join('\n'));
}

function track(repo, stem) {
  execFileSync('git', ['-C', repo, 'add', `.handoff/${stem}.md`]);
}

describe('bead-lint git vantage', () => {
  let env;
  afterEach(() => rmSync(env.tmp, { recursive: true, force: true }));

  describe('in a git checkout', () => {
    beforeEach(() => { env = scaffold(); });

    it('counts tracked beads and schema-checks them', () => {
      writeBead(env.repo, '20260802-1200-brief-tracked');
      track(env.repo, '20260802-1200-brief-tracked');
      const { beads, errors, warns } = scanRepo(env.repo, 'repo');
      expect(beads).toHaveLength(1);
      expect(errors).toEqual([]);
      expect(warns.filter((w) => w.includes('untracked'))).toEqual([]);
    });

    it('WARNs on a present-but-untracked bead and excludes it from counts — the CI-vantage rule', () => {
      writeBead(env.repo, '20260802-1200-brief-tracked');
      track(env.repo, '20260802-1200-brief-tracked');
      // untracked, and schema-broken: its errors must NOT surface (CI cannot see it)
      writeBead(env.repo, '20260802-1300-brief-untracked', { status: 'done', id: 'mismatched' });
      const { beads, errors, warns } = scanRepo(env.repo, 'repo');
      expect(beads).toHaveLength(1);
      expect(errors).toEqual([]);
      expect(warns.join()).toMatch(/20260802-1300-brief-untracked.*present but untracked.*invisible from CI/);
    });

    it('keeps open hooks in agreement with the CI vantage', () => {
      writeBead(env.repo, '20260802-1200-brief-tracked');
      track(env.repo, '20260802-1200-brief-tracked');
      writeBead(env.repo, '20260802-1300-brief-untracked');
      const { beads } = scanRepo(env.repo, 'repo');
      expect(openHooks(beads)).toHaveLength(1); // the untracked live brief is not an enforced hook
    });

    it('staged-but-uncommitted counts as tracked (git ls-files reads the index)', () => {
      writeBead(env.repo, '20260802-1200-brief-staged');
      track(env.repo, '20260802-1200-brief-staged');
      expect([...trackedBeadFiles(env.repo)]).toEqual(['20260802-1200-brief-staged.md']);
    });
  });

  describe('outside a git checkout', () => {
    beforeEach(() => { env = scaffold({ git: false }); });

    it('falls back to disk enumeration with a vantage warn, never dropping beads', () => {
      writeBead(env.repo, '20260802-1200-brief-diskonly');
      const { beads, warns } = scanRepo(env.repo, 'repo');
      expect(beads).toHaveLength(1);
      expect(warns.join()).toMatch(/not a git checkout — enumerating from disk/);
    });
  });
});
