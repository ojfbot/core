#!/usr/bin/env node
/**
 * roadmap-compile.mjs — compile roadmap slices into the dispatch queue.
 *
 * The roadmap file is CANONICAL; queue beads are a PROJECTION (roadmap-schema.md). This
 * compiler is deterministic and idempotent: a slice is posted at most once, keyed by its
 * `labels.roadmap_ref` (`rm:<slug>#S<n>`). Re-running posts nothing new.
 *
 * Eligibility: slice.status === 'ready' AND (no depends_on, or the depended-on slice is
 * 'merged'). Entrance criteria are prose — a human asserts them by flipping queued → ready;
 * the compiler never adjudicates prose.
 *
 * Verifiability-sorted dispatch (schema v1.1, S15): a slice is queued as agent-claimable only
 * when it carries a machine-runnable `check:` command (the S14 shadow stage runs it at the
 * slice boundary). agent_eligible/either slices WITHOUT one are demoted to human_only at
 * compile time — logged, never silent.
 *
 * Writes go through `bead-emit.mjs queue-post` (the sanctioned verb) — this script opens
 * Dolt READ-ONLY, only to check which refs are already projected. (Same posture as the
 * cockpit's ADR-0010: shell to the core verb, never write the store directly.)
 *
 * Usage: node roadmap-compile.mjs [--core PATH] [--roadmap <slug>] [--dry-run] [--reconcile]
 *   --dry-run    print what would be posted, post nothing
 *   --reconcile  also report file-status vs queue-state drift (suggested edits, never applied)
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {
  loadAll, loadAllRoadmaps, buildSliceIndex,
} from './lib/northstar-fm.mjs';
import { effectiveClaimable } from './lib/autonomy-fit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BEAD_EMIT = path.join(HERE, 'hooks', 'bead-emit.mjs');
const DOLT_PORT = parseInt(process.env.DOLT_PORT ?? '3307', 10);

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), roadmap: null, dryRun: false, reconcile: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') f.dryRun = true;
    else if (a === '--reconcile') f.reconcile = true;
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--roadmap') f.roadmap = argv[++i];
  }
  return f;
}

/** Read-only: map roadmap_ref → { id, queue } for every bead already projected. */
async function loadProjected() {
  const pool = mysql.createPool({
    host: '127.0.0.1', port: DOLT_PORT, user: 'root', database: '.beads-dolt', connectionLimit: 1,
  });
  try {
    const [rows] = await pool.query(
      `SELECT id, JSON_UNQUOTE(JSON_EXTRACT(labels, '$.roadmap_ref')) AS ref,
              JSON_UNQUOTE(JSON_EXTRACT(labels, '$.queue')) AS queue
         FROM beads
        WHERE JSON_EXTRACT(labels, '$.roadmap_ref') IS NOT NULL`,
    );
    return new Map(rows.map((r) => [r.ref, { id: r.id, queue: r.queue }]));
  } finally {
    await pool.end();
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { northstars } = loadAll(flags.core);
  const nsBySlug = new Map(northstars.filter((n) => !n._missing).map((n) => [n.slug, n]));
  const { roadmaps } = loadAllRoadmaps(flags.core);
  const present = roadmaps.filter((r) => !r._missing && (!flags.roadmap || r.slug === flags.roadmap));
  const sliceIndex = buildSliceIndex(roadmaps.filter((r) => !r._missing));

  let projected;
  try {
    projected = await loadProjected();
  } catch (err) {
    console.error(`roadmap-compile: cannot read the bead store (${err.message}) — is Dolt on :${DOLT_PORT}?`);
    process.exit(1);
  }

  const posted = [];
  const skipped = [];
  const drift = [];

  for (const rm of present) {
    if (rm.status !== 'active') { skipped.push({ ref: rm.slug, reason: `roadmap ${rm.status}` }); continue; }
    const app = nsBySlug.get(rm.northstar)?.app ?? '';
    for (const s of rm.slices || []) {
      const ref = `rm:${rm.slug}#${s.id}`;
      const already = projected.get(ref);

      if (flags.reconcile && already) {
        // File says X, queue says Y — report, never edit the canonical file.
        if (s.status === 'ready' && already.queue === 'claimed') {
          drift.push(`${ref}: file says 'ready' but bead ${already.id} is claimed — set status: dispatched`);
        } else if ((s.status === 'ready' || s.status === 'dispatched') && already.queue === 'expired') {
          drift.push(`${ref}: bead ${already.id} expired on the queue — repost (queue-post --bead-id) or revisit the slice`);
        }
      }

      if (s.status !== 'ready') { skipped.push({ ref, reason: `status ${s.status}` }); continue; }
      if (already) { skipped.push({ ref, reason: `already projected as ${already.id} (queue=${already.queue})` }); continue; }
      if (s.depends_on) {
        const dep = sliceIndex.get(s.depends_on);
        if (!dep) { skipped.push({ ref, reason: `depends_on ${s.depends_on} unresolved (run roadmap-lint)` }); continue; }
        if (dep.slice.status !== 'merged') { skipped.push({ ref, reason: `depends_on ${s.depends_on} is ${dep.slice.status}` }); continue; }
      }

      const fit = effectiveClaimable(s);
      const post = {
        ref,
        title: `[${ref}] ${s.title}`,
        repo: s.repo || app,
        kind: s.kind || 'm',
        claimable: fit.claimable,
        demoted: fit.demoted,
        gate: s.autonomy,
        advances: s.advances,
        why: s.deliverable,
      };
      if (flags.dryRun) { posted.push({ ...post, id: '(dry-run)' }); continue; }

      const out = execFileSync('node', [
        BEAD_EMIT, 'queue-post',
        `--title=${post.title}`,
        `--repo=${post.repo}`,
        `--kind=${post.kind}`,
        `--autonomy=${post.claimable}`,
        `--roadmap-ref=${post.ref}`,
        `--advances=${post.advances}`,
        `--autonomy-gate=${post.gate}`,
        `--why=${post.why}`,
      ], { encoding: 'utf8' });
      let id = '?';
      try { id = JSON.parse(out.trim().split('\n').pop()).id; } catch { /* leave '?' */ }
      posted.push({ ...post, id });
    }
  }

  const L = [`# roadmap-compile${flags.dryRun ? ' (dry-run)' : ''} — ${present.length} roadmap(s)`, ''];
  if (posted.length) {
    L.push(`## Posted (${posted.length})`);
    posted.forEach((p) => L.push(`- ${p.ref} → ${p.id} · repo=${p.repo} · ${p.gate} · claimable=${p.claimable}${p.demoted ? ' (DEMOTED from ' + '`claimable_by`' + ': no check: — not machine-verifiable)' : ''}`));
    L.push('');
  }
  L.push(`## Skipped (${skipped.length})`);
  skipped.forEach((s) => L.push(`- ${s.ref}: ${s.reason}`));
  if (flags.reconcile) {
    L.push('');
    L.push(`## Reconcile (${drift.length}) — suggested file edits, not applied`);
    drift.forEach((d) => L.push(`- ${d}`));
  }
  console.log(L.join('\n'));
}

main().catch((err) => { console.error('roadmap-compile error:', err.message); process.exit(1); });
