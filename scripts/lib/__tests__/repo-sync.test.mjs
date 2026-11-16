import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { driftReport, redact, renderMarkdown, runRepoSync, syncMain } from '../repo-sync.mjs';

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

  it('leaves a checked-out main with uncommitted tracked edits alone', () => {
    commit(upstream, 'a.txt', 'two\n', 'c2');
    writeFileSync(path.join(clone, 'a.txt'), 'mine\n');
    const before = sha(clone, 'main');
    const r = syncMain(clone);
    expect(r.action).toBe('skipped-dirty-worktree');
    expect(sha(clone, 'main')).toBe(before);
    expect(readFileSync(path.join(clone, 'a.txt'), 'utf8')).toBe('mine\n');
  });

  it('reports ff-refused and keeps an untracked file the incoming commit would overwrite', () => {
    commit(upstream, 'new.txt', 'theirs\n', 'c2 adds new.txt');
    writeFileSync(path.join(clone, 'new.txt'), 'mine\n');
    const before = sha(clone, 'main');
    const r = syncMain(clone);
    expect(r.action).toBe('ff-refused');
    expect(sha(clone, 'main')).toBe(before);
    expect(readFileSync(path.join(clone, 'new.txt'), 'utf8')).toBe('mine\n');
  });

  it('does not move main while another worktree is rebasing it (detached HEAD)', () => {
    commit(upstream, 'a.txt', 'two\n', 'c2');
    g(clone, 'fetch', '-q', 'origin');
    commit(clone, 'b.txt', 'b1\n', 'local b1');
    g(clone, 'switch', '-q', '-c', 'other', 'HEAD~1');
    commit(clone, 'b.txt', 'b-other\n', 'conflicting b');
    g(clone, 'switch', '-q', 'main');
    try { g(clone, 'rebase', '-q', 'other'); } catch { /* conflict leaves the rebase in progress */ }
    expect(existsSync(path.join(g(clone, 'rev-parse', '--absolute-git-dir'), 'rebase-merge'))).toBe(true);
    g(clone, 'update-ref', 'refs/heads/main', sha(clone, 'origin/main~1'));
    const before = sha(clone, 'main');
    const r = syncMain(clone, { fetch: false });
    expect(r.action).toBe('skipped-branch-in-rebase-or-bisect');
    expect(sha(clone, 'main')).toBe(before);
  });

  it('refuses to overwrite an ignored file that an incoming commit starts tracking', () => {
    writeFileSync(path.join(clone, '.git', 'info', 'exclude'), 'secret.env\n');
    writeFileSync(path.join(clone, 'secret.env'), 'local secret\n');
    commit(upstream, 'secret.env', 'theirs\n', 'c2 tracks secret.env');
    const r = syncMain(clone);
    expect(r.action).toBe('ff-refused');
    expect(readFileSync(path.join(clone, 'secret.env'), 'utf8')).toBe('local secret\n');
  });

  it('never lets a configured fetch refspec overwrite a diverged local main', () => {
    g(clone, 'config', '--add', 'remote.origin.fetch', '+refs/heads/main:refs/heads/main');
    g(clone, 'switch', '-q', '-c', 'feature');
    g(clone, 'switch', '-q', 'main');
    commit(clone, 'local.txt', 'l\n', 'local only');
    g(clone, 'switch', '-q', 'feature');
    commit(upstream, 'a.txt', 'two\n', 'c2');
    const before = sha(clone, 'main');
    const r = syncMain(clone);
    expect(r.action).toBe('diverged');
    expect(sha(clone, 'main')).toBe(before);
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

  it('treats an unreadable rebase marker as busy, never as absent', () => {
    commit(upstream, 'a.txt', 'two\n', 'c2');
    g(clone, 'fetch', '-q', 'origin');
    g(clone, 'switch', '-q', '-c', 'feature');
    const wt = path.join(tmp, 'wt-x');
    g(clone, 'worktree', 'add', '-q', '--detach', wt);
    const gd = g(wt, 'rev-parse', '--absolute-git-dir');
    mkdirSync(path.join(gd, 'rebase-merge'));
    const head = path.join(gd, 'rebase-merge', 'head-name');
    writeFileSync(head, 'refs/heads/main\n');
    chmodSync(head, 0o000);
    try {
      const before = sha(clone, 'main');
      const r = syncMain(clone, { fetch: false });
      expect(r.action).toBe('skipped-branch-in-rebase-or-bisect');
      expect(sha(clone, 'main')).toBe(before);
    } finally {
      chmodSync(head, 0o600);
    }
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

describe('repo-sync CLI', () => {
  const CLI = path.resolve(__dirname, '..', '..', 'repo-sync.mjs');
  const run = (state) => spawnSync(process.execPath, [CLI, '--repo', clone, '--state-dir', state, '--no-fetch'],
    { env: ENV, encoding: 'utf8' });

  it('writes latest.json, latest.md and runs.jsonl and releases its lock', () => {
    const state = path.join(tmp, 'state');
    const r = run(state);
    expect(r.status).toBe(0);
    for (const f of ['latest.json', 'latest.md', 'runs.jsonl']) expect(existsSync(path.join(state, f))).toBe(true);
    expect(existsSync(path.join(clone, '.git', 'repo-sync.lock'))).toBe(false);
  });

  it('skips with exit 3 while a live run holds the repository lock, and leaves that lock in place', () => {
    const state = path.join(tmp, 'state');
    const lock = path.join(clone, '.git', 'repo-sync.lock');
    mkdirSync(lock);
    writeFileSync(path.join(lock, 'owner'), `${process.pid} someone-else`);
    const r = run(state);
    expect(r.status).toBe(3);
    expect(readFileSync(path.join(lock, 'owner'), 'utf8')).toBe(`${process.pid} someone-else`);
  });

  it('skips with exit 3 while a live run holds the state lock', () => {
    const state = path.join(tmp, 'state');
    mkdirSync(path.join(state, 'run.lock'), { recursive: true });
    writeFileSync(path.join(state, 'run.lock', 'owner'), `${process.pid} other`);
    expect(run(state).status).toBe(3);
    expect(existsSync(path.join(state, 'latest.json'))).toBe(false);
  });

  it('reclaims a stale lock whose owner process is gone', () => {
    const state = path.join(tmp, 'state');
    const lock = path.join(clone, '.git', 'repo-sync.lock');
    mkdirSync(lock);
    writeFileSync(path.join(lock, 'owner'), '999999 crashed-run');
    const old = new Date(Date.now() - 60 * 60 * 1000);
    utimesSync(lock, old, old);
    expect(run(state).status).toBe(0);
    expect(existsSync(lock)).toBe(false);
    expect(existsSync(`${lock}.reclaim`)).toBe(false);
  });

  it('does not reclaim while another reclaimer holds the reclaim mutex', () => {
    const state = path.join(tmp, 'state');
    const lock = path.join(clone, '.git', 'repo-sync.lock');
    mkdirSync(lock);
    writeFileSync(path.join(lock, 'owner'), '999999 crashed-run');
    const old = new Date(Date.now() - 60 * 60 * 1000);
    utimesSync(lock, old, old);
    mkdirSync(`${lock}.reclaim`);
    expect(run(state).status).toBe(3);
    expect(readFileSync(path.join(lock, 'owner'), 'utf8')).toBe('999999 crashed-run');
  });

  it('writes reports owner-only (0600) in a 0700 state dir', () => {
    const state = path.join(tmp, 'state');
    expect(run(state).status).toBe(0);
    expect(statSync(state).mode & 0o777).toBe(0o700);
    for (const f of ['latest.json', 'latest.md', 'runs.jsonl']) {
      expect(statSync(path.join(state, f)).mode & 0o777).toBe(0o600);
    }
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

describe('redact', () => {
  it('strips URL userinfo, query credentials, bearer tokens and GitHub tokens, one line', () => {
    const t = redact('fatal: https://u:pw@host/x?token=SECRET&a=1 Authorization: Bearer abcdefgh12345678 ghp_' + 'a'.repeat(30) + '\nsecond line');
    expect(t).not.toMatch(/pw@|SECRET|abcdefgh12345678|ghp_a/);
    expect(t).not.toContain('second line');
  });
});
