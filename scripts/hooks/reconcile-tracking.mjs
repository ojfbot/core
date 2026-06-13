#!/usr/bin/env node
// reconcile-tracking.mjs — SHADOW reconciler for the deliverable-tracking spine.
//
// Stop hook. Audits each tracking ledger against its projected canvas and prints
// alarms. It is the HOOK-AUDIT half of adr:deliverable-tracking-spine: the hook
// never performs the primary write (that's `gate-event` / eventEmit). It only
// observes. THREE audits, via the ONE library reconciler (no logic duplicated here):
//   1. divergence  — a canvas owned-region drifted from the ledger (hand-edit)
//   2. evidence    — a passed/delivered/acted with no resolvable evidence_ref
//   3. staleness   — a gate stuck `validating` past the SLA
//
// SHADOW-FIRST: auto-repair is an action-taking control and stays OFF. This hook
// WRITES NOTHING and always exits 0 (non-blocking) — it alarms, it does not enforce.
//
// Usage:
//   node scripts/hooks/reconcile-tracking.mjs                 # audit ~/selfco/tracking/*.jsonl
//   node scripts/hooks/reconcile-tracking.mjs --canvas=PATH --ledger=PATH
//   node scripts/hooks/reconcile-tracking.mjs --json          # machine-readable report
//   node scripts/hooks/reconcile-tracking.mjs --sla=43200000  # staleness SLA ms (default 24h)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const expand = (p) => (p?.startsWith('~') ? p.replace('~', homedir()) : p);

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const asJson = !!args.json;
const TRACKING_ROOT = expand(args['tracking-root'] ?? '~/selfco/tracking');
const DEFAULT_CANVAS = expand('~/selfco/canvas/opav-loop-roadmap.canvas');
const slaMs = args.sla ? Number(args.sla) : undefined;

// Load the ONE reconciler from the built library. If the build is absent, this is
// SHADOW — degrade to a non-blocking notice rather than failing a session.
let reconcile;
try {
  const dist = pathToFileURL(resolve(HERE, '../../packages/workflows/dist/tracking')).href;
  ({ reconcile } = await import(`${dist}/reconciler.js`));
} catch (err) {
  if (!asJson) {
    console.error('[reconcile-tracking] shadow: workflows build not found — run `pnpm --filter @core/workflows build`. Skipping (non-blocking).');
  }
  process.exit(0);
}

function readLedger(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// Resolve (ledger, canvas) pairs to audit. One explicit pair, or every ledger in the root.
const pairs = [];
if (args.ledger) {
  pairs.push({ ledger: expand(args.ledger), canvas: expand(args.canvas ?? DEFAULT_CANVAS) });
} else if (existsSync(TRACKING_ROOT)) {
  for (const f of readdirSync(TRACKING_ROOT).filter((f) => f.endsWith('.jsonl'))) {
    pairs.push({ ledger: join(TRACKING_ROOT, f), canvas: expand(args.canvas ?? DEFAULT_CANVAS) });
  }
}

const reports = [];
for (const { ledger, canvas } of pairs) {
  if (!existsSync(ledger) || !existsSync(canvas)) continue;
  const events = readLedger(ledger);
  const doc = JSON.parse(readFileSync(canvas, 'utf8'));
  const report = reconcile(events, doc, slaMs ? { slaMs } : {});
  reports.push({ program: basename(ledger, '.jsonl'), canvas, report });
}

if (asJson) {
  console.log(JSON.stringify({ autoRepair: 'OFF (shadow)', reports }, null, 2));
  process.exit(0);
}

let alarms = 0;
for (const { program, report } of reports) {
  const { divergences, evidenceViolations, stale } = report;
  const n = divergences.length + evidenceViolations.length + stale.length;
  alarms += n;
  if (n === 0) {
    console.error(`[reconcile-tracking] ${program}: ✓ canvas == ledger, evidence intact, no staleness`);
    continue;
  }
  console.error(`[reconcile-tracking] ${program}: ${n} alarm(s) — SHADOW (no repair applied)`);
  for (const d of divergences) console.error(`  ⚠ divergence: node ${d.nodeId} — ${d.reason}`);
  for (const v of evidenceViolations) console.error(`  ⚠ evidence: ${v.correlation_id} '${v.to_state}' has no resolvable evidence_ref`);
  for (const s of stale) console.error(`  ⚠ staleness: ${s.correlation_id} validating ${Math.round(s.ageMs / 3600000)}h (> SLA)`);
}
if (reports.length === 0) console.error('[reconcile-tracking] no (ledger, canvas) pairs to audit');

// SHADOW: alarms are informational. Never block the session.
process.exit(0);
