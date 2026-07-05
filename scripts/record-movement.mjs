#!/usr/bin/env node
/**
 * record-movement.mjs — turn the odometer: append a northstar movement to status.jsonl.
 *
 * The anti-confabulation contract (roadmap-schema.md § Movement contract): sessions PROPOSE
 * movement in the PR body; movement is RECORDED only from a MERGED PR, by the human running
 * the merge ritual (or a gate-1+ promotion). This script enforces that: with --ref/--pr it
 * reads the merged PR's `Movement proposal:` line and refuses unmerged PRs. A session must
 * never run this against its own work.
 *
 * status.jsonl line (README.md § Time-series):
 *   {"date","northstar","property","from","to","evidence","actor","source"}
 *
 * Usage:
 *   node record-movement.mjs --ref rm:<slug>#S<n> --pr <number> [--actor NAME] [--apply]
 *   node record-movement.mjs --northstar <slug> --property P<n> --from N --to M \
 *                            --evidence "..." --override-reason "why no merged PR backs this" \
 *                            [--actor NAME] [--apply]
 *
 * The manual (--northstar) path performs NO ground-truth verification — it is the side door
 * the 2026-07-04 audit flagged (finding O3). It now requires --override-reason and stamps the
 * ledger line source: "manual-unverified" + the reason, so unverified movement is always
 * legible as such. Prefer --ref/--pr whenever a merged PR exists.
 *
 *   --apply  also patch the canonical files (northstar `current:`, roadmap slice
 *            `status: merged`). Default prints the exact edits instead — file edits stay
 *            deliberate.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {
  loadAll, buildPropertyIndex, loadAllRoadmaps, buildSliceIndex,
} from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), actor: os.userInfo().username, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') f.apply = true;
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--ref') f.ref = argv[++i];
    else if (a === '--pr') f.pr = argv[++i];
    else if (a === '--northstar') f.northstar = argv[++i];
    else if (a === '--property') f.property = argv[++i];
    else if (a === '--from') f.from = parseInt(argv[++i], 10);
    else if (a === '--to') f.to = parseInt(argv[++i], 10);
    else if (a === '--evidence') f.evidence = argv[++i];
    else if (a === '--source') f.source = argv[++i];
    else if (a === '--override-reason') f.overrideReason = argv[++i];
    else if (a === '--actor') f.actor = argv[++i];
    else if (a === '--help' || a === '-h') f.help = true;
  }
  return f;
}

const PROPOSAL_RE = /Movement proposal:\s*(ns:[\w-]+#P\d+)\s+(\d+)%?\s*(?:->|→)\s*(\d+)%?\s*(?:[—-]+\s*)?evidence:\s*(.+)/i;

function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help || (!flags.ref && !flags.northstar)) {
    console.log('record-movement: --ref rm:<slug>#S<n> --pr <number> [--apply] | --northstar <slug> --property P<n> --from N --to M --evidence "..." [--apply]');
    return 0;
  }

  const { northstars } = loadAll(flags.core);
  const propIndex = buildPropertyIndex(northstars.filter((n) => !n._missing));
  const { roadmaps } = loadAllRoadmaps(flags.core);
  const sliceIndex = buildSliceIndex(roadmaps.filter((r) => !r._missing));

  let line;
  let sliceHit = null;

  if (flags.ref) {
    if (!flags.pr) { console.error('--pr required with --ref (movement is recorded from the merged PR)'); return 1; }
    sliceHit = sliceIndex.get(flags.ref);
    if (!sliceHit) { console.error(`ref '${flags.ref}' does not resolve to a slice on disk`); return 1; }
    const { slice, roadmap } = sliceHit;
    const ns = northstars.find((n) => n.slug === roadmap.northstar);
    const repo = slice.repo || ns?.app;
    const repoDir = path.resolve(flags.core, '..', repo || '');

    let pr;
    try {
      pr = JSON.parse(execFileSync('gh', ['pr', 'view', String(flags.pr), '--json', 'state,url,body,mergedAt'],
        { cwd: repoDir, encoding: 'utf8' }));
    } catch (err) {
      console.error(`cannot read PR #${flags.pr} in ${repoDir}: ${err.message}`); return 1;
    }
    if (pr.state !== 'MERGED') {
      console.error(`PR #${flags.pr} is ${pr.state}, not MERGED — movement is recorded at merge, not before.`);
      return 1;
    }
    const m = PROPOSAL_RE.exec(pr.body || '');
    if (!m) {
      console.error(`PR #${flags.pr} body has no 'Movement proposal: ns:...#Pn N% -> M% — evidence: ...' line.`);
      return 1;
    }
    const [, advances, from, to, evidence] = m;
    if (advances !== slice.advances) {
      console.error(`PR proposes '${advances}' but slice ${flags.ref} advances '${slice.advances}' — refusing mismatched movement.`);
      return 1;
    }
    line = {
      date: new Date().toISOString().slice(0, 10),
      northstar: roadmap.northstar,
      property: advances.split('#')[1],
      from: parseInt(from, 10),
      to: parseInt(to, 10),
      evidence: `${pr.url} — ${evidence.trim()}`,
      actor: flags.actor,
      source: flags.ref,
    };
  } else {
    for (const req of ['property', 'evidence']) {
      if (!flags[req]) { console.error(`--${req} required`); return 1; }
    }
    if (!Number.isInteger(flags.from) || !Number.isInteger(flags.to)) { console.error('--from/--to required integers'); return 1; }
    // Audit finding O3: the manual path is unverified by construction. It stays available
    // (bootstrap movements, non-PR evidence) but never silently — a stated reason is required
    // and the line is stamped manual-unverified regardless of any --source passed.
    if (!flags.overrideReason || !flags.overrideReason.trim()) {
      console.error('--override-reason required on the manual path: this movement is not backed by a merged PR, and the ledger must say why that is acceptable. Prefer --ref/--pr when a merged PR exists.');
      return 1;
    }
    const key = `ns:${flags.northstar}#${flags.property}`;
    if (!propIndex.has(key)) { console.error(`'${key}' does not resolve to a property on disk`); return 1; }
    line = {
      date: new Date().toISOString().slice(0, 10),
      northstar: flags.northstar, property: flags.property,
      from: flags.from, to: flags.to,
      evidence: flags.evidence, actor: flags.actor,
      source: 'manual-unverified',
      override_reason: flags.overrideReason.trim(),
    };
  }

  const statusPath = path.join(flags.core, 'decisions', 'northstar', 'status.jsonl');
  appendFileSync(statusPath, JSON.stringify(line) + '\n');
  console.log(`recorded → ${statusPath}`);
  console.log(JSON.stringify(line));

  // Canonical-file follow-ups: applied only with --apply, otherwise printed.
  const target = propIndex.get(`ns:${line.northstar}#${line.property}`);
  if (target && target.northstar._abs) {
    const nsPath = target.northstar._abs;
    const text = readFileSync(nsPath, 'utf8');
    // Match this property's block: from "- id: P<n>" up to the next "- id:" — patch its current:.
    const re = new RegExp(`(-\\s*id:\\s*${line.property}\\b[\\s\\S]*?current:\\s*)(\\d+)`);
    if (flags.apply && re.test(text)) {
      writeFileSync(nsPath, text.replace(re, `$1${line.to}`));
      console.log(`applied: ${nsPath} — ${line.property} current: ${target.property.current} → ${line.to}`);
    } else {
      console.log(`next: set current: ${line.to} on ${line.property} in ${nsPath}${flags.apply ? ' (pattern not found — edit by hand)' : ' (or re-run with --apply)'}`);
    }
  }
  if (sliceHit && sliceHit.roadmap._abs) {
    const rmPath = sliceHit.roadmap._abs;
    const sid = sliceHit.slice.id;
    const text = readFileSync(rmPath, 'utf8');
    const re = new RegExp(`(-\\s*id:\\s*${sid}\\b[\\s\\S]*?status:\\s*)([\\w-]+)`);
    if (flags.apply && re.test(text)) {
      writeFileSync(rmPath, text.replace(re, '$1merged'));
      console.log(`applied: ${rmPath} — slice ${sid} status → merged`);
    } else if (sliceHit.slice.status !== 'merged') {
      console.log(`next: set status: merged on slice ${sid} in ${rmPath}${flags.apply ? ' (pattern not found — edit by hand)' : ' (or re-run with --apply)'}`);
    }
  }
  return 0;
}

process.exitCode = main();
