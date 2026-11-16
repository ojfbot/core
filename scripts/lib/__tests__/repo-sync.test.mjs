import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { driftReport, renderMarkdown, runRepoSync, syncMain } from '../repo-sync.mjs';

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
};
const g = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' }).trim();
const sha = (cwd, ref) => g(cwd, 'rev-parse', ref);

function commit(cwd, file, body, msg) {
  writeFileSync(path.join(cwd, file), body);
  g(cwd, 'add', file);
  g(cwd, 'commit', '-q', '-m', msg);
}

let tmp, upstream, clone;

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'repo-sync-')));
  upstream = path.join(tmp, 'upstream');
  g(tmp, 'init', '-q', '-b', 'main', upstream);
  commit(upstream, 'a.txt', 'one\n', 'c1');
  clone = path.join(tmp, 'clone');
  g(tmp, 'clone', '-q', upstream, clone);
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('syncMain', () => {
  it('fast-forwards main when it is not checked out, without touching the checkout', () => {
    g(clone, 'switch', '-q', '-c', 'feature');
    commit(clone, 'f.txt', 'f\n', 'feature work');
    writeFileSync(path.join(clone, 'f.txt'), 'uncommitted\n');
    const featureBefore = sha(clone, 'feature');
    commit(upstream, 'a.txt', 'two\n', 'c2');

    const r = syncMain(clone);
    expect(r.action).toBe('fast-forwarded');
    expect(sha(clone, 'main')).toBe(sha(upstream, 'main'));
    expect(sha(clone, 'feature')).toBe(featureBefore); // never rebased
    expect(g(clone, 'symbolic-ref', '--short', 'HEAD')).toBe('feature');
    expect(readFileSync(path.join(clone, 'f.txt'), 'utf8')).toBe('uncommitted\n');
  });

  it('fast-forwards main in the worktree that has it checked out', () => {
    commit(upstream, 'a.txt', 'two\n', 'c2');
    const r = syncMain(clone);
    expect(r.action).toBe('fast-forwarded');
    expect(readFileSync(path.join(clone, 'a.txt'), 'utf8')).toBe('two\n');
  });

  it('keeps uncommitted edits and reports ff-refused when incoming commits touch them', () => {
    commit(upstream, 'a.txt', 'two\n', 'c2');
    writeFileSync(path.join(clone, 'a.txt'), 'mine\n');
    const before = sha(clone, 'main');
    const r = syncMain(clone);
    expect(r.action).toBe('ff-refused');
    expect(sha(clone, 'main')).toBe(before);
    expect(readFileSync(path.join(clone, 'a.txt'), 'utf8')).toBe('mine\n');
  });

  it('reports divergence and leaves main alone', () => {
    commit(clone, 'local.txt', 'l\n', 'local only');
    commit(upstream, 'a.txt', 'two\n', 'c2');
    const before = sha(clone, 'main');
    const r = syncMain(clone);
    expect(r.action).toBe('diverged');
    expect(r).toMatchObject({ ahead: 1, behind: 1 });
    expect(sha(clone, 'main')).toBe(before);
  });

  it('reports local-ahead without moving anything', () => {
    commit(clone, 'local.txt', 'l\n', 'local only');
    const r = syncMain(clone);
    expect(r.action).toBe('local-ahead');
  });

  it('skips the checked-out main while a merge is in progress', () => {
    commit(upstream, 'a.txt', 'two\n', 'c2');
    g(clone, 'fetch', '-q', 'origin');
    writeFileSync(path.join(g(clone, 'rev-parse', '--absolute-git-dir'), 'MERGE_HEAD'), `${sha(clone, 'origin/main')}\n`);
    const r = syncMain(clone, { fetch: false });
    expect(r.action).toBe('skipped-merge-in-progress');
  });

  it('reports fetch failure without throwing', () => {
    g(clone, 'remote', 'set-url', 'origin', path.join(tmp, 'missing'));
    expect(syncMain(clone).action).toBe('fetch-failed');
  });
});

describe('driftReport', () => {
  it('reports branches and worktrees with ahead/behind and uncommitted counts', () => {
    const wt = path.join(tmp, 'wt-feature');
    g(clone, 'worktree', 'add', '-q', '-b', 'feature', wt);
    commit(wt, 'f.txt', 'f\n', 'feature work');
    writeFileSync(path.join(wt, 'dirty.txt'), 'x\n');
    commit(upstream, 'a.txt', 'two\n', 'c2');
    g(clone, 'fetch', '-q', 'origin');

    const d = driftReport(clone);
    const feature = d.branches.find((b) => b.name === 'feature');
    expect(feature.vsMain).toEqual({ ahead: 1, behind: 1 });
    expect(feature.worktree).toBe(wt);
    const w = d.worktrees.find((x) => x.branch === 'feature');
    expect(w.dirty).toBe(1);
    expect(w.prunable).toBe(false);
  });

  it('flags a worktree whose directory is gone as prunable and never prunes it', () => {
    const wt = path.join(tmp, 'wt-gone');
    g(clone, 'worktree', 'add', '-q', '-b', 'gone', wt);
    rmSync(wt, { recursive: true, force: true });
    const r = runRepoSync(clone, { fetch: false });
    const w = r.drift.worktrees.find((x) => x.branch === 'gone');
    expect(w.prunable).toBe(true);
    expect(w.present).toBe(false);
    expect(g(clone, 'worktree', 'list', '--porcelain')).toContain('wt-gone');
    expect(existsSync(wt)).toBe(false);
    expect(renderMarkdown([r])).toContain('1 prunable');
  });
});
