#!/usr/bin/env node
// deposit.mjs — the teach corpus deposit step (adr:teach-corpus-deposit-architecture, R2/R4/R5/R6).
//
// A worktree is disposable BY DEFINITION. If the deposit doesn't fire, the lesson dies with
// the worktree and the corpus never accumulates. That is the TD-006 shape, and it is why this
// is a script that emits evidence rather than a paragraph in a SKILL.md asking nicely.
//
// The measured case for that (2026-08-03): /diagram's deposit is a prose principle, and
// ~/selfco/diagrams/ holds 2 files, untracked, with 0 ledger rows — against 540/194/90/60 rows
// in the four hook-emitted channels. Convention-deposit does not accumulate.
//
// THREE ACTS, ONE STEP — they ship together or the deposit did not happen (R2, R5):
//   1. copy the workspace's durable artifacts into ~/selfco/teach/<topic-slug>/
//   2. append `harness:lesson-deposited` to ~/selfco/tracking/teach-sessions.jsonl
//   3. append the entry to ~/selfco/teach/index.md
//
// Index freshness rides the SAME evidence the reconciler checks, deliberately: one mechanism
// to keep honest instead of two drifting apart.
//
// NOT this script's job: `harness:lesson-served` (#384 R4) — depositing is not serving, and
// collapsing them would let corpus growth read as teaching delivered.
//
// Usage:
//   node deposit.mjs --workspace=PATH --topic=<slug> [--repo=NAME] [--session=ID] [--bead=ID]
//                    [--refs=a,b] [--dry-run] [--json]

import { existsSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const expand = (p) => (p?.startsWith('~') ? p.replace('~', homedir()) : p);

export const VAULT_ROOT = expand('~/selfco');
export const CORPUS_ROOT = join(VAULT_ROOT, 'teach');
export const LEDGER = join(VAULT_ROOT, 'tracking', 'teach-sessions.jsonl');
export const INDEX = join(CORPUS_ROOT, 'index.md');

/**
 * Topic slugs are the corpus's identity (R6, per adr:adr-slug-identity) — successive lessons
 * on one topic accumulate in ONE folder, which is what D21's supersession-over-deletion needs.
 * So the slug must be stable and filesystem-safe. PURE.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSlug(raw) {
  const s = String(raw ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) throw new Error('deposit: --topic produced an empty slug');
  return s;
}

/**
 * Next ordinal for a numbered artifact in a corpus folder (`0001-slug.html`, D23/D21).
 * Lessons and records number independently. PURE over a supplied listing.
 *
 * @param {string[]} existing  filenames already in the folder
 * @returns {string} zero-padded 4-digit ordinal
 */
export function nextOrdinal(existing) {
  const used = existing
    .map((f) => /^(\d{4})-/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return String(next).padStart(4, '0');
}

/**
 * Classify what a workspace holds. Lessons are `*.html`, records are
 * `learning-records/*.md`, references are `reference/*.html`. Everything else is authoring
 * scratch and stays in the worktree — the branch is pushed-never-merged (R3), so scratch is
 * recoverable without polluting the corpus. PURE over a supplied listing.
 *
 * @param {{lessons?:string[], records?:string[], references?:string[]}} listing
 * @returns {{lessons:string[], records:string[], references:string[], total:number}}
 */
export function classifyArtifacts(listing) {
  const lessons = (listing.lessons ?? []).filter((f) => f.endsWith('.html')).sort();
  const records = (listing.records ?? []).filter((f) => f.endsWith('.md')).sort();
  const references = (listing.references ?? []).filter((f) => f.endsWith('.html')).sort();
  return { lessons, records, references, total: lessons.length + records.length + references.length };
}

/**
 * The evidence row. A deposit that does not emit did not happen (R2).
 *
 * `artifacts` carries the deposited filenames so the reconciler can tell a real deposit from
 * an empty one — an emitted row with zero artifacts is itself an orphan.
 *
 * @returns {object}
 */
export function buildLedgerRow({ topic, repo, sessionId, bead, refs, artifacts, branch, ts }) {
  return {
    ts: ts ?? new Date().toISOString(),
    event: 'harness:lesson-deposited',
    harness: 'teach',
    topic,
    repo: repo ?? null,
    branch: branch ?? null,
    session_id: sessionId ?? null,
    bead: bead ?? null,
    refs: refs ?? [],
    artifacts: {
      lessons: artifacts.lessons.length,
      records: artifacts.records.length,
      references: artifacts.references.length,
      files: [...artifacts.lessons, ...artifacts.records, ...artifacts.references],
    },
  };
}

/**
 * One index line per deposit. Obsidian will NOT render a standalone .html as a page (R5) —
 * a lesson is an attachment opened in a browser — so this markdown index is what makes the
 * corpus browsable in-app, mirroring the wiki/index.md hub pattern. PURE.
 *
 * @returns {string}
 */
export function buildIndexEntry({ topic, ts, artifacts, repo, branch }) {
  const date = (ts ?? new Date().toISOString()).slice(0, 10);
  const counts = [
    `${artifacts.lessons.length} lesson${artifacts.lessons.length === 1 ? '' : 's'}`,
    artifacts.records.length ? `${artifacts.records.length} record${artifacts.records.length === 1 ? '' : 's'}` : null,
    artifacts.references.length ? `${artifacts.references.length} reference${artifacts.references.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(', ');
  const origin = repo ? ` — from \`${repo}\`${branch ? ` (\`${branch}\`)` : ''}` : '';
  return `- ${date} — [[teach/${topic}/|${topic}]] — ${counts}${origin}`;
}

const INDEX_HEADER = `# Teach corpus

The fleet's lesson corpus. An **artifact sink, not a work-item surface** — nothing here is ever
open, assigned, or closed (adr:teach-corpus-deposit-architecture R1, ADR-0097 row D6).

Obsidian will not render a standalone \`.html\` as a page: click through to the topic folder and
open the lesson in a browser. This index is appended by \`/teach\`'s deposit step, which also
emits \`harness:lesson-deposited\` to \`tracking/teach-sessions.jsonl\` — if an entry is missing
here, \`reconcile-teach-deposits.mjs\` is the thing that notices.

## Deposits
`;

/** Create the index with its header if absent, then append. */
export function appendIndex(entry, indexPath = INDEX) {
  if (!existsSync(indexPath)) {
    mkdirSync(join(indexPath, '..'), { recursive: true });
    writeFileSync(indexPath, INDEX_HEADER);
  }
  appendFileSync(indexPath, `${entry}\n`);
}

function listDir(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()) : [];
}

function gitBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
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

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const asJson = !!args.json;
  const dry = !!args['dry-run'];

  if (!args.topic) {
    console.error('[teach:deposit] --topic=<slug> is required (the corpus is topic-keyed, R6)');
    process.exitCode = 1;
    return;
  }
  const workspace = expand(args.workspace ?? process.cwd());
  if (!existsSync(workspace)) {
    console.error(`[teach:deposit] workspace not found: ${workspace}`);
    process.exitCode = 1;
    return;
  }

  const topic = normalizeSlug(args.topic);
  const listing = classifyArtifacts({
    lessons: listDir(workspace),
    records: listDir(join(workspace, 'learning-records')),
    references: listDir(join(workspace, 'reference')),
  });

  if (listing.total === 0) {
    // An empty deposit is a real failure, not a no-op: it means authoring produced nothing
    // durable. Emitting a row for it would launder the failure into evidence of success.
    console.error(`[teach:deposit] nothing to deposit from ${workspace} — no lessons, records, or references. Not emitting.`);
    process.exitCode = 1;
    return;
  }

  const dest = join(CORPUS_ROOT, topic);
  const branch = gitBranch(workspace);
  const refs = args.refs ? String(args.refs).split(',').map((s) => s.trim()).filter(Boolean) : [];

  const row = buildLedgerRow({
    topic,
    repo: args.repo ?? (branch ? basename(workspace) : null),
    sessionId: args.session ?? null,
    bead: args.bead ?? null,
    refs,
    artifacts: listing,
    branch,
  });
  const entry = buildIndexEntry({ topic, ts: row.ts, artifacts: listing, repo: row.repo, branch });

  if (dry) {
    const report = { dryRun: true, dest, row, indexEntry: entry };
    console.log(asJson ? JSON.stringify(report, null, 2) : `[teach:deposit] DRY RUN\n  dest: ${dest}\n  ${entry}`);
    return report;
  }

  // Act 1 — copy artifacts.
  mkdirSync(dest, { recursive: true });
  for (const f of listing.lessons) copyFileSync(join(workspace, f), join(dest, f));
  if (listing.records.length) {
    mkdirSync(join(dest, 'learning-records'), { recursive: true });
    for (const f of listing.records) copyFileSync(join(workspace, 'learning-records', f), join(dest, 'learning-records', f));
  }
  if (listing.references.length) {
    mkdirSync(join(dest, 'reference'), { recursive: true });
    for (const f of listing.references) copyFileSync(join(workspace, 'reference', f), join(dest, 'reference', f));
  }

  // Act 2 — emit the evidence. Without this row the deposit did not happen.
  mkdirSync(join(LEDGER, '..'), { recursive: true });
  appendFileSync(LEDGER, `${JSON.stringify(row)}\n`);

  // Act 3 — make it browsable.
  appendIndex(entry);

  const msg = `[teach:deposit] ${topic}: ${listing.lessons.length} lesson(s), ${listing.records.length} record(s), ${listing.references.length} reference(s) → ${dest}`;
  console.log(asJson ? JSON.stringify({ dest, row, indexEntry: entry }, null, 2) : msg);
  return { dest, row, indexEntry: entry };
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('deposit.mjs');
if (invokedDirectly) main();
