/**
 * repo-sync.mjs — the repo-sync loop's logic (decisions/loops/loops.md slug: repo-sync).
 *
 * Two jobs, nothing else:
 *   1. Sync main: fetch origin, then fast-forward the local `main` ref to `origin/main`.
 *      - main not checked out anywhere → compare-and-swap `update-ref` after an ancestry check.
 *      - main checked out in a worktree → `merge --ff-only` there (git refuses rather than
 *        overwrite uncommitted edits); skipped while a merge/rebase/cherry-pick/revert runs.
 *      - local main has commits origin/main lacks → report `diverged`, change nothing.
 *   2. Report drift: every local branch (ahead/behind origin/main and its upstream) and every
 *      worktree (branch, uncommitted-change count, in-progress op, prunable).
 *
 * Never rebases, stashes, resets, pushes, deletes or prunes. Read-only git calls use
 * --no-optional-locks so status checks never take the index lock in someone else's worktree.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };

export function git(cwd, args, { timeoutMs = 60_000, readOnly = true } = {}) {
  const full = readOnly ? ['--no-optional-locks', ...args] : args;
  const r = spawnSync('git', full, { cwd, env: GIT_ENV, encoding: 'utf8', timeout: timeoutMs || undefined });
  return {
    ok: r.status === 0,
    code: r.status,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim() || (r.error ? String(r.error.message) : ''),
  };
}

function revParse(repo, ref) {
  const r = git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return r.ok ? r.out : null;
}

function aheadBehind(repo, base, ref) {
  const r = git(repo, ['rev-list', '--left-right', '--count', `${base}...${ref}`]);
  if (!r.ok) return null;
  const [behind, ahead] = r.out.split(/\s+/).map(Number);
  return { ahead, behind };
}

/** Parse `git worktree list --porcelain`. */
export function listWorktrees(repo) {
  const r = git(repo, ['worktree', 'list', '--porcelain']);
  if (!r.ok) return [];
  const out = [];
  let cur = null;
  for (const line of r.out.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: line.slice(9), branch: null, detached: false, bare: false, prunable: false, locked: false };
      out.push(cur);
    } else if (!cur) continue;
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (line === 'detached') cur.detached = true;
    else if (line === 'bare') cur.bare = true;
    else if (line.startsWith('prunable')) cur.prunable = true;
    else if (line.startsWith('locked')) cur.locked = true;
  }
  return out;
}

/** Name of a merge/rebase/cherry-pick/revert in progress in this worktree, or null. */
export function inProgressOp(worktreePath) {
  const r = git(worktreePath, ['rev-parse', '--absolute-git-dir']);
  if (!r.ok) return null;
  const markers = [
    ['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'], ['MERGE_HEAD', 'merge'],
    ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert'],
  ];
  for (const [file, name] of markers) if (existsSync(path.join(r.out, file))) return name;
  return null;
}

function dirtyCount(worktreePath, { untracked = true } = {}) {
  const args = ['status', '--porcelain'];
  if (!untracked) args.push('--untracked-files=no');
  const r = git(worktreePath, args);
  return r.ok ? r.out.split('\n').filter(Boolean).length : null;
}

/**
 * Worktree path whose rebase or bisect is operating on refs/heads/<branch>, or null.
 * During a rebase the worktree shows as detached, so `worktree list` alone misses it;
 * moving the ref underneath would make the rebase fail to finish.
 */
export function branchBusyElsewhere(worktrees, branch) {
  const full = `refs/heads/${branch}`;
  for (const w of worktrees) {
    if (w.bare || w.prunable || !existsSync(w.path)) continue;
    const r = git(w.path, ['rev-parse', '--absolute-git-dir']);
    if (!r.ok) continue;
    for (const dir of ['rebase-merge', 'rebase-apply']) {
      const f = path.join(r.out, dir, 'head-name');
      if (existsSync(f) && readFileSync(f, 'utf8').trim() === full) return w.path;
    }
    const bisect = path.join(r.out, 'BISECT_START');
    if (existsSync(bisect)) {
      const orig = readFileSync(bisect, 'utf8').trim();
      if (orig === branch || orig === full) return w.path;
    }
  }
  return null;
}

/** Step 1: fetch + fast-forward local main. Returns a result object; never throws on git failure. */
export function syncMain(repo, { remote = 'origin', branch = 'main', fetch = true } = {}) {
  const res = { remote, branch, fetched: false, action: null, before: null, after: null, detail: '' };
  if (fetch) {
    // No auto-gc/maintenance: gc runs `worktree prune`, which this loop must never do.
    const f = git(repo, ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false',
      'fetch', '--quiet', '--no-prune', remote], { readOnly: false });
    if (!f.ok) return { ...res, action: 'fetch-failed', detail: f.err };
    res.fetched = true;
  }
  const remoteRef = `refs/remotes/${remote}/${branch}`;
  const target = revParse(repo, remoteRef);
  if (!target) return { ...res, action: 'no-remote-branch', detail: remoteRef };
  const local = revParse(repo, `refs/heads/${branch}`);
  res.before = local;
  if (!local) return { ...res, action: 'no-local-branch', after: null };
  if (local === target) return { ...res, action: 'up-to-date', after: local };

  const isAnc = git(repo, ['merge-base', '--is-ancestor', local, target]);
  if (!isAnc.ok) {
    const localAhead = git(repo, ['merge-base', '--is-ancestor', target, local]).ok;
    const ab = aheadBehind(repo, remoteRef, `refs/heads/${branch}`);
    return { ...res, action: localAhead ? 'local-ahead' : 'diverged', after: local, ...ab };
  }

  const worktrees = listWorktrees(repo);
  const busy = branchBusyElsewhere(worktrees, branch);
  if (busy) return { ...res, action: 'skipped-branch-in-rebase-or-bisect', after: local, worktree: busy };

  const holder = worktrees.find((w) => w.branch === branch);
  if (!holder) {
    // Compare-and-swap: fails if anything moved the ref since we read it. Local ref writes get no
    // timeout — killing git mid-write is worse than a slow run.
    const u = git(repo, ['update-ref', '-m', `repo-sync: fast-forward ${branch} to ${remote}/${branch}`,
      `refs/heads/${branch}`, target, local], { readOnly: false, timeoutMs: 0 });
    if (!u.ok) return { ...res, action: 'update-ref-failed', after: local, detail: u.err };
    return { ...res, action: 'fast-forwarded', after: target };
  }

  res.worktree = holder.path;
  if (holder.prunable || !existsSync(holder.path)) {
    return { ...res, action: 'skipped-worktree-missing', after: local };
  }
  const op = inProgressOp(holder.path);
  if (op) return { ...res, action: `skipped-${op}-in-progress`, after: local };
  // Only touch a worktree whose tracked files are clean: a session editing files there could
  // otherwise race the checkout. Untracked files are still protected by git's own refusal.
  const dirty = dirtyCount(holder.path, { untracked: false });
  if (dirty !== 0) return { ...res, action: 'skipped-dirty-worktree', after: local, dirty };
  const m = git(holder.path, ['merge', '--ff-only', '--quiet', target], { readOnly: false, timeoutMs: 0 });
  if (!m.ok) return { ...res, action: 'ff-refused', after: local, detail: m.err };
  return { ...res, action: 'fast-forwarded', after: target };
}

/** Step 2: drift report for every local branch and worktree. Read-only. */
export function driftReport(repo, { remote = 'origin', branch = 'main' } = {}) {
  const base = `refs/remotes/${remote}/${branch}`;
  const haveBase = Boolean(revParse(repo, base));
  const worktrees = listWorktrees(repo);
  const byBranch = new Map(worktrees.filter((w) => w.branch).map((w) => [w.branch, w.path]));

  const fmt = '%(refname:short)%00%(upstream:short)%00%(upstream:track)';
  const r = git(repo, ['for-each-ref', `--format=${fmt}`, 'refs/heads']);
  const branches = (r.ok ? r.out.split('\n').filter(Boolean) : []).map((line) => {
    const [name, upstream, track] = line.split('\0');
    const vsMain = haveBase ? aheadBehind(repo, base, `refs/heads/${name}`) : null;
    const vsUpstream = upstream ? aheadBehind(repo, upstream, `refs/heads/${name}`) : null;
    return {
      name,
      upstream: upstream || null,
      upstreamGone: track === '[gone]',
      vsMain,
      vsUpstream,
      worktree: byBranch.get(name) || null,
    };
  });

  const wts = worktrees.filter((w) => !w.bare).map((w) => {
    const present = existsSync(w.path) && !w.prunable;
    return {
      path: w.path,
      branch: w.branch,
      detached: w.detached,
      prunable: w.prunable,
      locked: w.locked,
      present,
      dirty: present ? dirtyCount(w.path) : null,
      inProgress: present ? inProgressOp(w.path) : null,
    };
  });

  return { base: haveBase ? base : null, branches, worktrees: wts };
}

export function runRepoSync(repo, opts = {}) {
  const startedAt = (opts.now || (() => new Date()))().toISOString();
  const main = syncMain(repo, opts);
  const drift = driftReport(repo, opts);
  return { schema: 'repo-sync/v1', repo, startedAt, main, drift };
}

/** Human-readable summary for sessions and the owner. */
export function renderMarkdown(results) {
  const lines = ['# repo-sync — latest run', ''];
  for (const r of results) {
    const m = r.main;
    lines.push(`## ${r.repo}`, '', `Run: ${r.startedAt}`, '');
    let mainLine = `- **main:** ${m.action}`;
    if (m.action === 'fast-forwarded') mainLine += ` ${short(m.before)} → ${short(m.after)}`;
    if (m.ahead != null) mainLine += ` (ahead ${m.ahead}, behind ${m.behind})`;
    if (m.detail) mainLine += ` — ${m.detail.split('\n')[0]}`;
    lines.push(mainLine);
    const d = r.drift;
    const dirty = d.worktrees.filter((w) => w.dirty);
    const prunable = d.worktrees.filter((w) => w.prunable);
    lines.push(`- **worktrees:** ${d.worktrees.length} (${dirty.length} with uncommitted changes, ${prunable.length} prunable — repo-sync never prunes)`, '');
    lines.push('| branch | vs main (ahead/behind) | vs upstream | worktree | uncommitted |', '|---|---|---|---|---|');
    for (const b of d.branches) {
      const wt = d.worktrees.find((w) => w.branch === b.name);
      const up = b.upstreamGone ? 'gone' : b.vsUpstream ? `${b.vsUpstream.ahead}/${b.vsUpstream.behind}` : '—';
      const vm = b.vsMain ? `${b.vsMain.ahead}/${b.vsMain.behind}` : '—';
      const dc = wt ? (wt.dirty == null ? 'n/a' : String(wt.dirty)) : '—';
      const op = wt && wt.inProgress ? ` (${wt.inProgress} in progress)` : '';
      lines.push(`| ${b.name} | ${vm} | ${up} | ${wt ? wt.path : '—'} | ${dc}${op} |`);
    }
    const detached = d.worktrees.filter((w) => w.detached);
    for (const w of detached) lines.push(`| (detached) | — | — | ${w.path} | ${w.dirty ?? 'n/a'} |`);
    lines.push('');
  }
  lines.push('Rebasing a branch onto main is an explicit step for the session that picks the branch up; repo-sync never rebases.', '');
  return lines.join('\n');
}

function short(sha) { return sha ? sha.slice(0, 8) : '∅'; }
