#!/usr/bin/env node
/**
 * repo-sync.mjs — CLI for the repo-sync loop (decisions/loops/loops.md slug: repo-sync).
 *
 * Fetches origin, fast-forwards local `main` (fast-forward only; divergence is reported and
 * skipped), and writes a drift report for every local branch and worktree. Never rebases,
 * stashes, resets, pushes or prunes. Logic lives in scripts/lib/repo-sync.mjs.
 *
 * Usage: node scripts/repo-sync.mjs [--repo PATH]... [--state-dir PATH] [--no-fetch] [--json]
 *   --repo       repository to sync (repeatable). Default: the main checkout of the core
 *                repo this script lives in (resolved through git-common-dir, so running it
 *                from a worktree still targets the shared repository).
 *   --state-dir  where latest.json / latest.md / runs.jsonl go. Default ~/.claude/repo-sync
 *   --no-fetch   skip `git fetch` (report against the remote-tracking refs already present)
 *   --json       print the JSON result to stdout instead of the markdown summary
 *
 * Exit 0 always unless arguments are invalid or another run holds the lock (exit 3):
 * a sync report never blocks anything.
 */
import { appendFileSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, renderMarkdown, runRepoSync } from './lib/repo-sync.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK_STALE_MS = 10 * 60 * 1000;

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

function defaultRepo() {
  const r = git(HERE, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (!r.ok) { console.error('repo-sync: cannot resolve the core repository'); process.exit(2); }
  return path.dirname(r.out);
}

function acquireLock(dir) {
  const lock = path.join(dir, 'run.lock');
  try {
    mkdirSync(lock);
  } catch {
    let age = 0;
    try { age = Date.now() - statSync(lock).mtimeMs; } catch { /* vanished */ }
    if (age < LOCK_STALE_MS) return null;
    rmSync(lock, { recursive: true, force: true });
    try { mkdirSync(lock); } catch { return null; }
  }
  return () => rmSync(lock, { recursive: true, force: true });
}

function writeAtomic(file, body) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, body);
  renameSync(tmp, file);
}

const args = parseArgs(process.argv.slice(2));
const repos = args.repos.length ? args.repos : [defaultRepo()];
mkdirSync(args.stateDir, { recursive: true });
const release = acquireLock(args.stateDir);
if (!release) { console.error('repo-sync: another run holds the lock; skipping'); process.exit(3); }
try {
  const results = repos.map((repo) => runRepoSync(repo, { fetch: args.fetch }));
  const md = renderMarkdown(results);
  writeAtomic(path.join(args.stateDir, 'latest.json'), `${JSON.stringify(results, null, 2)}\n`);
  writeAtomic(path.join(args.stateDir, 'latest.md'), md);
  for (const r of results) {
    appendFileSync(path.join(args.stateDir, 'runs.jsonl'), `${JSON.stringify({
      at: r.startedAt, repo: r.repo, main: r.main.action, before: r.main.before, after: r.main.after,
      branches: r.drift.branches.length, worktrees: r.drift.worktrees.length,
      dirtyWorktrees: r.drift.worktrees.filter((w) => w.dirty).length,
    })}\n`);
  }
  process.stdout.write(args.json ? `${JSON.stringify(results, null, 2)}\n` : md);
} finally {
  release();
}
