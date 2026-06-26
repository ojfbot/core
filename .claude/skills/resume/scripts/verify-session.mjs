#!/usr/bin/env node
/**
 * verify-session.mjs — the git-backfill verify pass for /resume --verify.
 *
 * TeamBot's integration agent never trusts a session's claim that it "finished"; at
 * close-out it reconstructs reality from git and, for any session that did NOT
 * self-report, writes the report itself, tagged `(backfilled by integration)` as a
 * visible process-failure signal. This is the ojfbot version.
 *
 * What it does:
 *   1. Reconstruct ground truth via reconstruct-state.mjs --json (git + PR + beads).
 *   2. Find MERGED PRs in the window that NO .handoff bead references — work that
 *      shipped with no self-report. Each is a backfill candidate.
 *   3. Surface CONFLICT rows (a bead claims done, but the PR is open / missing) — these
 *      are never auto-resolved; they're flagged for a human.
 *   4. For each backfill candidate, emit a `report` bead reconstructed from [PR]/[git]
 *      ground truth, tagged backfilled. Append-only — never overwrites an existing bead,
 *      never overwrites a verified self-report.
 *
 * Shadow-first (ADR-0086): this is an action-taking control, so it DEFAULTS to dry-run
 * (prints what it would backfill, writes nothing). Pass --write to actually create the
 * append-only beads in <repo>/.handoff/.
 *
 * Read-only by default. Correlates the two bead worlds ONLY by commit-SHA + repo +
 * time-window, never by id.
 *
 * Usage:
 *   node verify-session.mjs [--repo PATH] [--days N] [--write] [--json]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECONSTRUCT = path.join(HERE, 'reconstruct-state.mjs');

function parseFlags(argv) {
  const f = { repo: process.cwd(), days: 14, write: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') f.write = true;
    else if (a === '--json') f.json = true;
    else if (a === '--repo') f.repo = argv[++i];
    else if (a === '--days') f.days = parseInt(argv[++i], 10) || 14;
  }
  return f;
}

function reconstruct(repo, days) {
  const out = execFileSync('node', [RECONSTRUCT, '--repo', repo, '--days', String(days), '--json'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

// github.com/owner/repo/pull/123 → { owner, repo, number }
function parsePrUrl(url) {
  const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url || '');
  return m ? { ownerRepo: `${m[1]}/${m[2]}`, number: Number(m[3]) } : null;
}

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d) {
  return {
    iso: d.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    day: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`,
    hm: `${pad(d.getHours())}${pad(d.getMinutes())}`,
  };
}

function backfillBead(pr, repo) {
  const meta = parsePrUrl(pr.url) || { ownerRepo: path.basename(repo), number: pr.number };
  const now = new Date();
  const s = stamp(now);
  const id = `${s.day}-${s.hm}-report-backfill-pr-${pr.number}`;
  const refs = [`github:${meta.ownerRepo}#${pr.number}`];
  if (pr.url) refs.push(`url:${pr.url}`);
  const author = (pr.author && (pr.author.login || pr.author.name)) || 'unknown';
  const body = `---
id: ${id}
type: report
title: "(backfilled) ${pr.title.replace(/"/g, "'")}"
actor: verify-session
session_id: ${s.iso}
responding_to: null
refs:
${refs.map((r) => `  - ${r}`).join('\n')}
hook: null
status: closed
created_at: ${s.iso}
labels:
  backfilled: "true"
  source: verify-session
  pr: "${pr.number}"
---
## What got done

**(backfilled by integration — reconstructed from [PR]/[git] ground truth; no session
self-report existed for this work.)**

- PR #${pr.number} — *${pr.title}*
- state: ${pr.state}${pr.mergedAt ? `, merged ${pr.mergedAt}` : ''}
- branch: \`${pr.headRefName}\` · author: \`${author}\`
- url: ${pr.url || '(n/a)'}

## What's open

- **Provenance gap:** this shipped without a session self-report. The bead ledger could
  not corroborate who/which session did it — attribute it if the implementing session is
  known. The existence of this backfilled bead is itself a signal that the session-close
  discipline was skipped.
`;
  return { id, filename: `${id}.md`, body, prNumber: pr.number };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const state = reconstruct(flags.repo, flags.days);

  const handoff = path.join(flags.repo, '.handoff');
  const existing = existsSync(handoff) ? new Set(readdirSync(handoff)) : new Set();

  const conflicts = (state.ledger || []).filter((r) => r.verdict === 'CONFLICT');

  let candidates = [];
  if (state.tiers?.pr?.prs) {
    const referenced = new Set(state.tiers.pr.referenced || []);
    const cutoff = Date.now() - flags.days * 86400 * 1000;
    candidates = state.tiers.pr.prs.filter((p) =>
      p.state === 'MERGED' &&
      p.mergedAt && Date.parse(p.mergedAt) >= cutoff &&
      !referenced.has(p.number));
  }

  const beads = candidates.map((p) => backfillBead(p, flags.repo));

  if (flags.json) {
    process.stdout.write(JSON.stringify({
      repo: flags.repo, mode: flags.write ? 'write' : 'shadow',
      conflicts, backfillCount: beads.length,
      backfill: beads.map((b) => ({ id: b.id, pr: b.prNumber })),
    }, null, 2) + '\n');
    return 0;
  }

  console.log(`# Verify-session (${flags.write ? 'WRITE' : 'SHADOW / dry-run'}) — ${flags.repo}`);
  console.log('');
  if (!state.tiers?.pr?.prs) {
    console.log('[PR] tier unavailable — cannot backfill from remote ground truth. Aborting (no-op).');
    return 0;
  }

  if (conflicts.length) {
    console.log(`## ${conflicts.length} CONFLICT(s) — surface, never auto-resolve`);
    for (const c of conflicts) console.log(`- ${c.claim}\n    ↳ ${c.evidence}  ·  \`${c.source}\``);
    console.log('');
  }

  console.log(`## ${beads.length} backfill candidate(s) — merged PRs with no .handoff bead`);
  if (!beads.length) {
    console.log('- none — every merged PR in window is accounted for. ✓');
  }
  for (const b of beads) {
    const collision = existing.has(b.filename);
    console.log(`- PR #${b.prNumber} → \`${b.filename}\`${collision ? '  (EXISTS — skipping, append-only)' : ''}`);
  }
  console.log('');

  if (!flags.write) {
    console.log(`${beads.length ? 'Shadow mode' : 'Nothing to do'}. Re-run with --write to create the backfilled report beads.`);
    return 0;
  }

  // --write: create append-only beads, never overwriting an existing file.
  if (!existsSync(handoff)) {
    console.log(`No .handoff/ at ${handoff}; nothing written.`);
    return 0;
  }
  let written = 0;
  for (const b of beads) {
    if (existing.has(b.filename)) continue; // append-only: never overwrite
    writeFileSync(path.join(handoff, b.filename), b.body, { encoding: 'utf8', flag: 'wx' });
    written++;
  }
  console.log(`Wrote ${written} backfilled report bead(s) to ${handoff}.`);
  return 0;
}

// NB: set exitCode, don't process.exit() — stdout is async on a pipe and exit() truncates it.
process.exitCode = main();
