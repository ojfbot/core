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
 * Locking: one lock per state dir (serializes runs and report publication) plus one per
 * repository (in its git common dir, so runs with different --state-dir values cannot overlap
 * on one repository). Exit 0 unless arguments are invalid (2) or the state lock or every
 * requested repository was held by another run (3):
 * a sync report never blocks anything.
 */
import { appendFileSync, chmodSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, renderMarkdown, runRepoSync } from './lib/repo-sync.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK_STALE_MS = 25 * 60 * 1000; // under the 30-min StartInterval, well over a normal ~2 s run

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

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/**
 * mkdir lock at `lock` holding "<pid> <token>". A stale lock (older than LOCK_STALE_MS AND its
 * pid gone) is reclaimed only by whoever holds the exclusive `<lock>.reclaim` mutex, which
 * re-checks staleness inside the mutex, so two reclaimers can never both win. Release renames
 * the lock aside only while it still holds this run's token.
 */
function acquireLock(lock) {
  const owner = path.join(lock, 'owner');
  const token = `${process.pid} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const take = () => { mkdirSync(lock); writeFileSync(owner, token, { mode: 0o600 }); };
  const isStale = () => {
    let age = 0;
    let held = '';
    try { age = Date.now() - statSync(lock).mtimeMs; } catch { return false; }
    try { held = readFileSync(owner, 'utf8'); } catch { /* half-written owner: judge by age + no pid */ }
    return age >= LOCK_STALE_MS && !pidAlive(Number.parseInt(held.split(' ')[0], 10));
  };
  try {
    take();
  } catch {
    if (!isStale()) return null;
    const reclaim = `${lock}.reclaim`;
    try { mkdirSync(reclaim); } catch { return null; } // another reclaimer is mid-flight
    try {
      if (!isStale()) return null; // someone reclaimed it before we got the mutex
      const aside = `${lock}.stale-${process.pid}`;
      renameSync(lock, aside);
      rmSync(aside, { recursive: true, force: true });
      take();
    } catch {
      return null;
    } finally {
      rmSync(reclaim, { recursive: true, force: true });
    }
  }
  return () => {
    let held = '';
    try { held = readFileSync(owner, 'utf8'); } catch { return; }
    if (held !== token) return;
    const aside = `${lock}.done-${process.pid}`;
    try { renameSync(lock, aside); } catch { return; }
    rmSync(aside, { recursive: true, force: true });
  };
}

function repoLockPath(repo) {
  const common = git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return common.ok ? path.join(common.out, 'repo-sync.lock') : null;
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

// The state-dir lock serializes the whole run, report publication included, so latest.json,
// latest.md and runs.jsonl always describe one run. Repository locks additionally keep runs
// with different --state-dir values off the same repository.
const releaseState = acquireLock(path.join(args.stateDir, 'run.lock'));
if (!releaseState) { console.error('repo-sync: another run holds the state lock; skipping'); process.exit(3); }
let locked = 0;
try {
  const results = [];
  for (const repo of repos) {
    const lockPath = repoLockPath(repo);
    const release = lockPath && acquireLock(lockPath);
    if (!release) { locked++; console.error(`repo-sync: ${repo} is locked or unreadable; skipping`); continue; }
    try { results.push(runRepoSync(repo, { fetch: args.fetch })); } finally { release(); }
  }
  if (results.length) {
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
  }
} finally {
  releaseState();
}
process.exit(locked === repos.length ? 3 : 0);
