#!/usr/bin/env node
// reconcile-teach-deposits.mjs — SHADOW reconciler for the teach corpus
// (adr:teach-corpus-deposit-architecture R2).
//
// WHY THIS EXISTS, AND WHY EMISSION ALONE IS NOT ENOUGH.
// The deposit step emits `harness:lesson-deposited`, which makes a PERFORMED deposit visible.
// It does nothing about a SKIPPED one. That asymmetry is exactly how TD-006 ran 96 days
// unnoticed: `hook-bead-session` was declared, never implemented, and nothing was watching for
// the absence — 28 open hooks against 9 reports ever, with no alarm anywhere.
//
// So this compares the two sides:
//   left  — pushed `teach/*` branches (R3: authoring branches are pushed, never merged)
//   right — `harness:lesson-deposited` rows in ~/selfco/tracking/teach-sessions.jsonl
// A branch with no matching row is an ORPHAN: authoring that produced no corpus entry.
//
// SHADOW-FIRST per adr:control-gated-slices — reports, never blocks, always exits 0.
// Promotion to a gate happens on evidence, not on principle.
//
// Usage:
//   node scripts/hooks/reconcile-teach-deposits.mjs              # audit every tracked repo
//   node scripts/hooks/reconcile-teach-deposits.mjs --repo=PATH  # audit one repo
//   node scripts/hooks/reconcile-teach-deposits.mjs --json       # machine-readable

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const expand = (p) => (p?.startsWith('~') ? p.replace('~', homedir()) : p);
export const LEDGER = expand('~/selfco/tracking/teach-sessions.jsonl');

/**
 * A teach authoring branch is `teach/<topic-slug>`, optionally remote-qualified. PURE.
 *
 * @param {string} ref
 * @returns {string|null} the topic slug, or null if not a teach branch
 */
export function topicFromBranch(ref) {
  const m = /(?:^|\/)teach\/([a-z0-9][a-z0-9-]*)$/.exec(String(ref ?? '').trim());
  return m ? m[1] : null;
}

/**
 * Read deposit rows. Tolerates a missing or partially-written ledger — a corrupt trailing
 * line must not take down a shadow reporter. PURE over supplied text.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function parseLedger(text) {
  return String(text ?? '')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.event === 'harness:lesson-deposited');
}

/**
 * The reconciliation itself. PURE — this is the whole audit, and it is testable without a
 * filesystem or a network on purpose.
 *
 * Three findings, and they are deliberately different failures:
 *   orphan-branch  — a pushed teach branch with no deposit row (the TD-006 shape)
 *   empty-deposit  — a row that deposited zero artifacts (a laundered failure)
 *   orphan-deposit — a row whose branch no longer exists (recoverability lost, R3 broken)
 *
 * @param {{branches:string[], rows:object[]}} input
 * @returns {{orphanBranches:string[], emptyDeposits:object[], orphanDeposits:object[], ok:boolean}}
 */
export function reconcile({ branches, rows }) {
  const topics = new Set(branches.map(topicFromBranch).filter(Boolean));
  const deposited = new Set(rows.map((r) => r.topic).filter(Boolean));

  const orphanBranches = [...topics].filter((t) => !deposited.has(t)).sort();
  const emptyDeposits = rows.filter((r) => !r.artifacts || (r.artifacts.files ?? []).length === 0);
  const orphanDeposits = rows.filter((r) => r.topic && !topics.has(r.topic));

  return {
    orphanBranches,
    emptyDeposits,
    orphanDeposits,
    ok: orphanBranches.length === 0 && emptyDeposits.length === 0,
  };
}

function remoteTeachBranches(repoPath) {
  try {
    const out = execFileSync('git', ['branch', '-r', '--format=%(refname:short)'], {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((s) => s.trim()).filter((s) => topicFromBranch(s));
  } catch {
    return [];
  }
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const asJson = !!args.json;
  const repo = expand(args.repo ?? process.cwd());

  const rows = existsSync(LEDGER) ? parseLedger(readFileSync(LEDGER, 'utf8')) : [];
  const branches = remoteTeachBranches(repo);
  const result = reconcile({ branches, rows });

  if (asJson) {
    console.log(JSON.stringify({ repo, ledger: LEDGER, ...result }, null, 2));
    process.exit(0);
  }

  if (rows.length === 0 && branches.length === 0) {
    // The honest cold-start message. The corpus is empty BY CONSTRUCTION until /teach runs;
    // saying "ok" here would read as a passing audit of a system that has never run.
    console.error('[teach:reconcile] no teach branches and no deposit rows — the corpus has never been written to. Nothing to reconcile yet.');
    process.exit(0);
  }

  for (const t of result.orphanBranches) {
    console.error(`[teach:reconcile] ORPHAN BRANCH  teach/${t} — pushed, but no deposit row. The lesson exists only on the branch.`);
  }
  for (const r of result.emptyDeposits) {
    console.error(`[teach:reconcile] EMPTY DEPOSIT  ${r.topic} @ ${r.ts} — emitted a row with zero artifacts.`);
  }
  for (const r of result.orphanDeposits) {
    console.error(`[teach:reconcile] ORPHAN DEPOSIT ${r.topic} @ ${r.ts} — deposited, but branch teach/${r.topic} is gone; authoring context is unrecoverable.`);
  }
  if (result.ok && !result.orphanDeposits.length) {
    console.error(`[teach:reconcile] ok — ${rows.length} deposit(s), ${branches.length} branch(es), no orphans.`);
  }

  // SHADOW: report, never block.
  process.exit(0);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('reconcile-teach-deposits.mjs');
if (invokedDirectly) main();
