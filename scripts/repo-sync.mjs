#!/usr/bin/env node
/**
 * repo-sync.mjs — CLI for the repo-sync loop (decisions/loops/loops.md slug: repo-sync).
 *
 * Fetches origin, fast-forwards local `main` (fast-forward only; divergence is reported and
 * skipped), and writes a drift report for every local branch and worktree. Never rebases,
 * stashes, resets, pushes or prunes. Logic lives in scripts/lib/repo-sync.mjs.
 *
 * Usage: node scripts/repo-sync.mjs [--repo PATH]... [--state-dir PATH] [--no-fetch] [--json]
 *   --repo       repository to sync (repeatable). Default: the working tree this script runs
 *                from (any worktree of a repository reaches the shared refs and worktree list).
 *   --state-dir  where latest.json / latest.md / runs.jsonl go (0700 dir, 0600 files).
 *                Default ~/.claude/repo-sync
 *   --no-fetch   skip `git fetch` (report against the remote-tracking refs already present)
 *   --json       print the JSON result to stdout instead of the markdown summary
 *
 * Locking: kernel flock locks via /usr/bin/lockf (see runUnderLocks). Exit 0 unless arguments
 * are invalid (2) or another run holds a lock (3):
 * a sync report never blocks anything.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, renderMarkdown, runRepoSync } from './lib/repo-sync.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { repos: [], stateDir: path.join(os.homedir(), '.claude', 'repo-sync'), fetch: true, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--repo') a.repos.push(path.resolve(argv[++i] || ''));
    else if (v === '--state-dir') a.stateDir = path.resolve(argv[++i] || '');
    else if (v === '--no-fetch') a.fetch = false;
    else if (v === '--json') a.json = true;
    else { console.error(`repo-sync: unknown argument ${v}`); process.exit(2); }
  }
  return a;
}

function repoLockPath(repo) {
  const common = git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return common.ok ? path.join(common.out, 'repo-sync.flock') : null;
}

/**
 * Locks are kernel flock(2) locks taken by /usr/bin/lockf around a re-exec of this script: one
 * on <state-dir>/run.flock (serializes whole runs, report publication included) and one per
 * repository on <git-common-dir>/repo-sync.flock (keeps runs with different state dirs off the
 * same repository). The kernel releases them when the process exits or is killed, so there is
 * no stale-lock state to reclaim. lockf exits 75 when a lock is held: reported as exit 3.
 */
function runUnderLocks(lockFiles) {
  const LOCKF = '/usr/bin/lockf';
  if (!existsSync(LOCKF)) { console.error('repo-sync: /usr/bin/lockf not found (macOS only)'); process.exit(2); }
  const argv = [];
  for (const f of lockFiles) argv.push(LOCKF, '-k', '-t', '0', f);
  argv.push(process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2));
  const r = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit', env: { ...process.env, REPO_SYNC_LOCKED: '1' } });
  if (r.status === 75) { console.error('repo-sync: another run holds a lock; skipping'); process.exit(3); }
  process.exit(r.status ?? 1);
}

function writePrivate(file, body) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, body, { mode: 0o600 });
  renameSync(tmp, file);
}

const args = parseArgs(process.argv.slice(2));
let repos = args.repos;
if (!repos.length) {
  // Any working tree of the repository works as the cwd for repo-wide operations; use the one
  // this script runs from (the main checkout, under launchd) rather than inferring a path.
  const top = git(HERE, ['rev-parse', '--show-toplevel']);
  if (!top.ok) { console.error('repo-sync: cannot resolve the core repository'); process.exit(2); }
  repos = [top.out];
}
mkdirSync(args.stateDir, { recursive: true, mode: 0o700 });
chmodSync(args.stateDir, 0o700);

if (process.env.REPO_SYNC_LOCKED !== '1') {
  const locks = [path.join(args.stateDir, 'run.flock')];
  for (const repo of repos) {
    const l = repoLockPath(repo);
    if (!l) { console.error(`repo-sync: ${repo} is not a git repository`); process.exit(2); }
    locks.push(l);
  }
  runUnderLocks(locks);
}

const results = repos.map((repo) => runRepoSync(repo, { fetch: args.fetch }));
const md = renderMarkdown(results);
writePrivate(path.join(args.stateDir, 'latest.json'), `${JSON.stringify(results, null, 2)}\n`);
writePrivate(path.join(args.stateDir, 'latest.md'), md);
const runs = path.join(args.stateDir, 'runs.jsonl');
for (const r of results) {
  appendFileSync(runs, `${JSON.stringify({
    at: r.startedAt, repo: r.repo, main: r.main.action, before: r.main.before, after: r.main.after,
    branches: r.drift.branches.length, worktrees: r.drift.worktrees.length,
    dirtyWorktrees: r.drift.worktrees.filter((w) => w.dirty).length,
  })}\n`, { mode: 0o600 });
}
chmodSync(runs, 0o600);
process.stdout.write(args.json ? `${JSON.stringify(results, null, 2)}\n` : md);
