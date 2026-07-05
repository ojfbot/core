#!/usr/bin/env node
/**
 * day-runner.mjs — Gate-0 dispatch runner for compiled roadmap slices.
 *
 * The GUPP loop, mechanized: work on the hook must run. The runner
 *   1. reads the dispatch queue READ-ONLY (agent-eligible `queue=available` beads that carry
 *      a `roadmap_ref`),
 *   2. claims each through `bead-emit.mjs queue-claim --agent` (CAS lease — losing a claim is
 *      normal, not an error),
 *   3. resolves the slice from the canonical roadmap file, prepares an ISOLATED git worktree
 *      off origin's default branch (never the shared checkout — concurrent agents move
 *      branches mid-task),
 *   4. renders a self-contained session brief (TeamBot session-brief lineage) and spawns a
 *      headless `claude -p` in the worktree,
 *   5. verifies the slice-boundary contract on exit: branch pushed · PR opened · movement
 *      PROPOSAL in the PR body · report beads + bead_events emitted (by the runner, so the
 *      record is deterministic, not model-dependent),
 *   6. runs the SHADOW verification stage (S14): the repo's check command in the worktree +
 *      the slice's success criterion, RECORDED on the pr-created bead and appended to the PR
 *      body — record-only, never blocks; promotion to a blocking gate is a later RIDM
 *      decision after ~20 shadow runs (ADR-0086).
 *
 * Gate 0 (progressive-autonomy-gates ADR): the runner NEVER merges. It leaves PRs for the
 * human merge ritual; movement is recorded at merge via record-movement.mjs — never here,
 * never by the session.
 *
 * Worktrees live OUTSIDE ~/ojfbot (in ~/.cache/day-runner/worktrees) so scratch copies of
 * .claude/northstar.md etc. never pollute registry scans (the mc-perf/mc-motion lesson).
 *
 * Usage: node day-runner.mjs [--core PATH] [--max N] [--once] [--dry-run]
 *                            [--timeout-mins N] [--permission-mode MODE]
 *   --max N              concurrent sessions (default 2)
 *   --once               run a single slice then stop
 *   --dry-run            claim nothing; print what would run
 *   --timeout-mins N     per-session wall clock (default 45)
 *   --permission-mode M  claude permission mode (default bypassPermissions — Gate-0 trust
 *                        envelope is the isolated worktree + branch-only + human merge)
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { loadAll, loadAllRoadmaps, buildSliceIndex } from './lib/northstar-fm.mjs';
import { runShadowChecks, summarizeChecks } from './lib/shadow-checks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BEAD_EMIT = path.join(HERE, 'hooks', 'bead-emit.mjs');
const DOLT_PORT = parseInt(process.env.DOLT_PORT ?? '3307', 10);
const RUNNER_HOME = path.join(os.homedir(), '.cache', 'day-runner');

function parseFlags(argv) {
  const f = {
    core: path.resolve(HERE, '..'), max: 2, once: false, dryRun: false,
    timeoutMins: 45, permissionMode: 'bypassPermissions',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--once') f.once = true;
    else if (a === '--dry-run') f.dryRun = true;
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--max') f.max = parseInt(argv[++i], 10) || 2;
    else if (a === '--timeout-mins') f.timeoutMins = parseInt(argv[++i], 10) || 45;
    else if (a === '--permission-mode') f.permissionMode = argv[++i];
  }
  return f;
}

function bead(verb, kv) {
  const argv = [BEAD_EMIT, verb, ...Object.entries(kv).map(([k, v]) => `--${k}=${v}`)];
  const out = execFileSync('node', argv, { encoding: 'utf8' });
  try { return JSON.parse(out.trim().split('\n').pop()); } catch { return {}; }
}

function git(repoDir, ...argv) {
  return execFileSync('git', ['-C', repoDir, ...argv], { encoding: 'utf8' }).trim();
}

async function loadDispatchable() {
  const pool = mysql.createPool({
    host: '127.0.0.1', port: DOLT_PORT, user: 'root', database: '.beads-dolt', connectionLimit: 1,
  });
  try {
    const [rows] = await pool.query(
      `SELECT id, title,
              JSON_UNQUOTE(JSON_EXTRACT(labels, '$.roadmap_ref')) AS ref,
              JSON_UNQUOTE(JSON_EXTRACT(labels, '$.repo')) AS repo
         FROM beads
        WHERE JSON_UNQUOTE(JSON_EXTRACT(labels, '$.queue')) = 'available'
          AND JSON_EXTRACT(labels, '$.roadmap_ref') IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.autonomy')) IN ('agent_eligible', 'either')
          AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.expires_at')) > ?
        ORDER BY created_at`,
      [new Date().toISOString()],
    );
    return rows;
  } finally {
    await pool.end();
  }
}

function renderBrief({ ref, slice, roadmap, northstar, repo, branch, worktree }) {
  const prop = (northstar.properties || []).find((p) => `ns:${northstar.slug}#${p.id}` === slice.advances);
  return `# Session Brief: ${slice.title}

You are an unattended delivery session dispatched by day-runner. This brief is self-contained;
you have no other context. Work ONLY inside this worktree: ${worktree}

| Key | Value |
|-----|-------|
| Slice | ${ref} (${slice.id} of roadmap ${roadmap.slug}) |
| Repo | ${repo} |
| Branch | ${branch} (already created and checked out) |
| Advances | ${slice.advances} — "${prop?.name ?? ''}" |
| Expected movement | ${slice.moves_from}% → ${slice.moves_to}% |
| Merge gate | ${slice.autonomy} — a human merges; you NEVER merge |

## Goal

${slice.title}.

**Deliverable:** ${slice.deliverable}

**Success (the gate a reviewer checks):** ${slice.success}

## Northstar context

Property "${prop?.name ?? slice.advances}" — target: ${prop?.target ?? '(see northstar)'}
Verification: ${prop?.verification ?? '(see northstar)'}

## Conventions (ojfbot fleet)

- pnpm ONLY, never npm/npx (\`pnpm dlx\` for one-offs). Node per .nvmrc.
- Semantic commits (feat:/fix:/docs:/test:). Match surrounding code style.
- Run the repo's tests/typecheck before opening the PR; a red PR is a failed slice.

## Slice-boundary contract (all five, in order — the runner verifies each)

1. Implement the goal inside this worktree only. Do not touch files outside it.
2. Commit as you go on ${branch}.
3. Push: \`git push -u origin ${branch}\`
4. Open the PR (do not merge it):
   \`gh pr create --base main --title "${slice.title}" --body-file <a body file you write>\`
   The PR body MUST contain these two lines verbatim (fill the evidence):
   \`Roadmap-Ref: ${ref}\`
   \`Movement proposal: ${slice.advances} ${slice.moves_from}% -> ${slice.moves_to}% — evidence: <one line pointing at tests/recording/output>\`
5. STOP. Do not merge, do not record movement, do not edit any northstar.md / roadmap.md /
   status.jsonl — movement is recorded at merge by a human. Do not add unplanned work; if
   blocked, say so plainly in your final message and leave the branch pushed as-is.

## Out of scope

Everything not named in the Goal. Other slices' files. Any write outside this worktree.
`;
}

async function runSlice(item, ctx) {
  const { flags, sliceIndex, nsBySlug, claimer, date } = ctx;
  const verdict = { ref: item.ref, bead: item.id, claimed: false, pushed: false, pr: null, proposal: false, checks: null, note: '' };

  const resolved = sliceIndex.get(item.ref);
  if (!resolved) { verdict.note = 'roadmap_ref no longer resolves on disk — bead is stale'; return verdict; }
  const { slice, roadmap } = resolved;
  const northstar = nsBySlug.get(roadmap.northstar) ?? { properties: [] };
  const repo = slice.repo || northstar.app;
  const repoDir = path.resolve(flags.core, '..', repo || '');
  if (!repo || !existsSync(path.join(repoDir, '.git'))) {
    verdict.note = `repo '${repo}' not found at ${repoDir}`; return verdict;
  }

  if (flags.dryRun) { verdict.note = `would claim and run in ${repoDir}`; return verdict; }

  // 2. Claim (CAS — losing is normal).
  const claim = bead('queue-claim', { 'bead-id': item.id, agent: 1, claimer });
  if (claim.status !== 'claimed') { verdict.note = 'claim lost (already claimed/expired)'; return verdict; }
  verdict.claimed = true;

  // 3. Isolated worktree off origin's default branch. Re-verify remote state at the last
  //    moment — concurrent agents move branches mid-task.
  const sliceKey = `${roadmap.slug}-${slice.id}`;
  const branch = `slice/${sliceKey}`;
  const worktree = path.join(RUNNER_HOME, 'worktrees', `${repo}-${slice.id}-${date}`);
  try {
    git(repoDir, 'fetch', 'origin');
    let base = 'origin/main';
    try { base = git(repoDir, 'symbolic-ref', 'refs/remotes/origin/HEAD').replace('refs/remotes/', ''); } catch { /* default main */ }
    try { git(repoDir, 'worktree', 'remove', '--force', worktree); } catch { /* none */ }
    try { git(repoDir, 'branch', '-D', branch); } catch { /* none */ }
    git(repoDir, 'worktree', 'add', '-b', branch, worktree, base);
  } catch (err) {
    verdict.note = `worktree setup failed: ${err.message}`; return verdict;
  }

  // 4. Brief + headless session, runner-owned session beads around it.
  const brief = renderBrief({ ref: item.ref, slice, roadmap, northstar, repo, branch, worktree });
  mkdirSync(path.join(RUNNER_HOME, 'logs'), { recursive: true });
  const briefPath = path.join(RUNNER_HOME, 'logs', `${date}-${sliceKey}-brief.md`);
  writeFileSync(briefPath, brief);
  const logPath = path.join(RUNNER_HOME, 'logs', `${date}-${sliceKey}.log`);
  const sessionId = `day-run-${sliceKey}-${crypto.randomBytes(3).toString('hex')}`;
  bead('session-start', { skill: 'day-run', 'session-id': sessionId });

  const exitCode = await new Promise((resolve) => {
    const log = createWriteStream(logPath);
    const child = spawn('claude', ['-p', brief, '--permission-mode', flags.permissionMode], {
      cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log); child.stderr.pipe(log);
    const timer = setTimeout(() => { verdict.note = `timeout after ${flags.timeoutMins}m; `; child.kill('SIGTERM'); },
      flags.timeoutMins * 60_000);
    child.on('close', (code) => { clearTimeout(timer); resolve(code); });
    child.on('error', (err) => { clearTimeout(timer); verdict.note = `spawn failed: ${err.message}; `; resolve(-1); });
  });

  // 5. Verify the slice-boundary contract; emit the report beads deterministically.
  try { verdict.pushed = git(repoDir, 'ls-remote', '--heads', 'origin', branch).length > 0; } catch { /* stays false */ }
  if (verdict.pushed) {
    try {
      const prJson = execFileSync('gh', ['pr', 'list', '--head', branch, '--json', 'number,url,body', '--limit', '1'],
        { cwd: worktree, encoding: 'utf8' });
      const [pr] = JSON.parse(prJson);
      if (pr) {
        verdict.pr = pr.number;
        verdict.proposal = /Movement proposal:\s*ns:/i.test(pr.body || '');

        // 6. SHADOW verification stage (S14) — record-only, never blocks the verdict.
        try {
          verdict.checks = runShadowChecks({ worktree, slice });
        } catch { /* shadow stage must never fail the run */ }
        bead('pr-created', {
          repo, pr: pr.number, 'session-id': sessionId, prefix: repo.slice(0, 4),
          ...(verdict.checks ? { checks: JSON.stringify(verdict.checks) } : {}),
        });
        if (verdict.checks) {
          try {
            const section = `\n\n## Shadow checks (day-runner S14 — record-only, human still decides)\n\n` +
              `\`${summarizeChecks(verdict.checks)}\`\n\n` +
              `Tests: **${verdict.checks.tests.result}**${verdict.checks.tests.detail ? ` (${verdict.checks.tests.detail})` : ''}${verdict.checks.tests.reason ? ` (${verdict.checks.tests.reason})` : ''}\n` +
              `Success criterion (recorded, not machine-evaluated): ${verdict.checks.success_criterion.text}\n`;
            execFileSync('gh', ['pr', 'edit', String(pr.number), '--body', (pr.body || '') + section],
              { cwd: worktree, encoding: 'utf8' });
          } catch { /* body append is best-effort; the bead carries the record */ }
        }
        bead('task-done', { title: `[${item.ref}] delivered — PR #${pr.number}`, 'session-id': sessionId, repo, prefix: repo.slice(0, 4) });
      }
    } catch { /* gh unavailable — verdict shows pushed but no PR */ }
  }
  bead('session-close', { 'session-id': sessionId });
  verdict.note += `exit=${exitCode} log=${logPath}`;
  return verdict;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const date = new Date().toISOString().slice(0, 10);
  const claimer = `day-runner-${date}`;
  mkdirSync(path.join(RUNNER_HOME, 'worktrees'), { recursive: true });

  const { northstars } = loadAll(flags.core);
  const nsBySlug = new Map(northstars.filter((n) => !n._missing).map((n) => [n.slug, n]));
  const { roadmaps } = loadAllRoadmaps(flags.core);
  const sliceIndex = buildSliceIndex(roadmaps.filter((r) => !r._missing));
  const ctx = { flags, sliceIndex, nsBySlug, claimer, date };

  let queue = await loadDispatchable();
  if (flags.once) queue = queue.slice(0, 1);
  if (!queue.length) { console.log('day-runner: nothing dispatchable on the queue.'); return; }
  console.log(`day-runner: ${queue.length} dispatchable slice(s), max ${flags.max} concurrent${flags.dryRun ? ' (dry-run)' : ''}`);

  // Simple pool: GUPP over the queue snapshot, flags.max at a time.
  const verdicts = [];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      console.log(`▶ ${item.ref} (${item.id})`);
      const v = await runSlice(item, ctx);
      verdicts.push(v);
      console.log(`■ ${v.ref}: claimed=${v.claimed} pushed=${v.pushed} pr=${v.pr ?? '-'} proposal=${v.proposal} ${v.note}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(flags.max, queue.length) }, worker));

  console.log('\n# day-runner verdicts');
  for (const v of verdicts) {
    const ok = v.claimed && v.pushed && v.pr && v.proposal; // shadow checks deliberately NOT in ok — record-only until RIDM promotion
    console.log(`- ${ok ? '✓' : '✗'} ${v.ref} · bead=${v.bead} · pushed=${v.pushed} · PR=${v.pr ?? '—'} · movement-proposal=${v.proposal} · ${summarizeChecks(v.checks)} · ${v.note}`);
  }
  console.log('\nGate 0: PRs await your merge. Record movement at merge: node scripts/record-movement.mjs --help');
}

main().catch((err) => { console.error('day-runner error:', err.message); process.exit(1); });
