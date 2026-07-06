#!/usr/bin/env node
/**
 * roadmap-lint.mjs — health check for roadmaps (roadmap-schema.md v1).
 *
 * ERRORs are OPERATIONAL as of the S16 RIDM promotion (2026-07-06, ADR-0086 clause 5):
 * core CI runs `--check` on PRs touching decisions/northstar/** and blocks on ERRORs.
 * WARNs stay shadow; vantage-unreachable registry entries downgrade to WARNs (see
 * northstar-lint.mjs header).
 *
 * Checks:
 *   ERROR — registry entry with no file; unknown northstar slug; slug mismatch (file vs
 *           registry); duplicate phase/slice ids; slice referencing a phase that doesn't
 *           exist; `advances` not resolving to a property on disk, or resolving outside the
 *           roadmap's declared northstar; moves_from/moves_to out of [0,100] or inverted;
 *           invalid autonomy/status/kind/claimable_by enum; `depends_on` not resolving to a
 *           slice on disk.
 *   WARN  — moves_from drift vs the property's live `current` (>5pp; the roadmap was planned
 *           against a % that has since moved); a `ready` slice whose depends_on is not merged;
 *           an agent-claimable slice with no `check:` command (v1.1 — it will be demoted to
 *           human_only at compile time; verifiability-sorted dispatch, S15).
 *
 * Usage: node roadmap-lint.mjs [--core PATH] [--format=summary] [--check]
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  loadAll, buildPropertyIndex, loadAllRoadmaps, buildSliceIndex,
} from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), format: 'report', check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') f.check = true;
    else if (a === '--format=summary') f.format = 'summary';
    else if (a === '--core') f.core = argv[++i];
  }
  return f;
}

const MOVES_DRIFT_TOLERANCE = 5; // pp between moves_from and the property's live current
const AUTONOMY = new Set(['gate-0', 'gate-1', 'gate-2']);
const STATUS = new Set(['queued', 'ready', 'dispatched', 'delivered', 'merged', 'dropped']);
const KIND = new Set(['s', 'm', 'l']);
const CLAIMABLE = new Set(['human_only', 'agent_eligible', 'either']);

export function lint(core) {
  const errors = [];
  const warns = [];

  const { error: nsErr, northstars } = loadAll(core);
  if (nsErr) errors.push(nsErr);
  const propIndex = buildPropertyIndex(northstars.filter((n) => !n._missing));
  const nsBySlug = new Map(northstars.filter((n) => !n._missing).map((n) => [n.slug, n]));
  // Registered entries whose repo checkout is absent from this vantage (e.g. a CI runner
  // with core alone on disk): refs into them downgrade to shadow WARNs — the gate only
  // blocks on breakage it can actually see (S16 promotion scoping).
  const unreachableNs = new Set(northstars.filter((n) => n._unreachable).map((n) => n.slug));

  const { error: rmErr, entries, roadmaps } = loadAllRoadmaps(core);
  if (rmErr) errors.push(rmErr);
  const unreachableRm = new Set(roadmaps.filter((r) => r._unreachable).map((r) => r.slug));

  for (const rm of roadmaps) {
    if (rm._unreachable) {
      warns.push(`vantage: repo for roadmap '${rm.slug}' not on disk at ${rm._repoRoot} — entry skipped from this checkout`);
      continue;
    }
    if (rm._missing) { errors.push(`missing roadmap file for '${rm.slug}' at ${rm._path}`); continue; }
    const where = rm.slug ?? rm._path;

    if (rm.type !== 'roadmap') errors.push(`${where}: type must be 'roadmap' (got '${rm.type}')`);
    const regEntry = entries.find((e) => e._abs === rm._abs || e.path === rm._path);
    if (regEntry && regEntry.slug !== rm.slug) {
      errors.push(`${where}: file slug '${rm.slug}' does not match registry slug '${regEntry.slug}'`);
    }
    if (!rm.northstar) errors.push(`${where}: missing 'northstar'`);
    else if (!nsBySlug.has(rm.northstar)) {
      if (unreachableNs.has(rm.northstar)) {
        warns.push(`${where}: northstar '${rm.northstar}' registered but unreachable from this vantage`);
      } else {
        errors.push(`${where}: northstar '${rm.northstar}' not in registry/on disk`);
      }
    }

    const phaseIds = new Set();
    for (const ph of rm.phases || []) {
      if (!ph.id || !/^PH\d+$/.test(String(ph.id))) errors.push(`${where}: phase id '${ph.id}' must be PH<n>`);
      if (phaseIds.has(ph.id)) errors.push(`${where}: duplicate phase id '${ph.id}'`);
      phaseIds.add(ph.id);
      if (!ph.name) errors.push(`${where}#${ph.id}: missing phase 'name'`);
    }
    if (!(rm.phases || []).length) errors.push(`${where}: at least one phase required`);
    if (!(rm.slices || []).length) errors.push(`${where}: at least one slice required`);

    const sliceIds = new Set();
    for (const s of rm.slices || []) {
      const sw = `${where}#${s.id}`;
      if (!s.id || !/^S\d+$/.test(String(s.id))) errors.push(`${where}: slice id '${s.id}' must be S<n>`);
      if (sliceIds.has(s.id)) errors.push(`${where}: duplicate slice id '${s.id}'`);
      sliceIds.add(s.id);

      for (const req of ['title', 'advances', 'deliverable', 'entrance', 'success']) {
        if (s[req] == null || s[req] === '') errors.push(`${sw}: missing '${req}'`);
      }
      if (!phaseIds.has(s.phase)) errors.push(`${sw}: phase '${s.phase}' does not resolve`);
      if (!AUTONOMY.has(s.autonomy)) errors.push(`${sw}: autonomy '${s.autonomy}' not gate-0|gate-1|gate-2`);
      if (!STATUS.has(s.status)) errors.push(`${sw}: status '${s.status}' invalid`);
      if (s.kind != null && !KIND.has(s.kind)) errors.push(`${sw}: kind '${s.kind}' not s|m|l`);
      if (s.claimable_by != null && !CLAIMABLE.has(s.claimable_by)) {
        errors.push(`${sw}: claimable_by '${s.claimable_by}' invalid`);
      }
      // v1.1 `check:` — optional machine-runnable success command (S15).
      if (s.check != null && (typeof s.check !== 'string' || !s.check.trim())) {
        errors.push(`${sw}: check must be a non-empty command string when present`);
      }
      if ((s.claimable_by === 'agent_eligible' || s.claimable_by === 'either' || s.claimable_by == null)
        && (s.check == null || (typeof s.check === 'string' && !s.check.trim()))
        && (s.status === 'ready' || s.status === 'queued')) {
        warns.push(`${sw}: agent-claimable but no check: command — compile will demote to human_only (verifiability-sorted dispatch)`);
      }

      const from = s.moves_from; const to = s.moves_to;
      if (typeof from !== 'number' || from < 0 || from > 100) errors.push(`${sw}: moves_from '${from}' not in [0,100]`);
      if (typeof to !== 'number' || to < 0 || to > 100) errors.push(`${sw}: moves_to '${to}' not in [0,100]`);
      if (typeof from === 'number' && typeof to === 'number' && to < from) {
        errors.push(`${sw}: moves_to ${to} < moves_from ${from}`);
      }

      // advances: resolve-or-fail + containment in the declared northstar.
      if (s.advances) {
        if (!propIndex.has(s.advances)) {
          const targetSlug = (/^ns:([^#]+)#/.exec(String(s.advances)) || [])[1];
          if (targetSlug && unreachableNs.has(targetSlug)) {
            warns.push(`${sw}: advances '${s.advances}' unresolvable from this vantage (repo not on disk)`);
          } else {
            errors.push(`${sw}: advances '${s.advances}' does not resolve to a property on disk`);
          }
        } else {
          const target = propIndex.get(s.advances);
          if (rm.northstar && target.northstar.slug !== rm.northstar) {
            errors.push(`${sw}: advances '${s.advances}' (in ${target.northstar.slug}) but roadmap's northstar is '${rm.northstar}'`);
          } else if (typeof from === 'number' && typeof target.property.current === 'number'
            && (s.status === 'ready' || s.status === 'dispatched')
            && Math.abs(from - target.property.current) > MOVES_DRIFT_TOLERANCE) {
            warns.push(`${sw}: moves_from ${from} drifts from ${s.advances} live current ${target.property.current}% — replan or record movement`);
          }
        }
      }
    }
  }

  // depends_on: resolve across ALL roadmaps (cross-roadmap edges allowed), then readiness check.
  const sliceIndex = buildSliceIndex(roadmaps.filter((r) => !r._missing));
  for (const rm of roadmaps) {
    if (rm._missing) continue;
    for (const s of rm.slices || []) {
      if (!s.depends_on) continue;
      const sw = `${rm.slug}#${s.id}`;
      if (!sliceIndex.has(s.depends_on)) {
        const depSlug = (/^rm:([^#]+)#/.exec(String(s.depends_on)) || [])[1];
        if (depSlug && unreachableRm.has(depSlug)) {
          warns.push(`${sw}: depends_on '${s.depends_on}' unresolvable from this vantage (repo not on disk)`);
        } else {
          errors.push(`${sw}: depends_on '${s.depends_on}' does not resolve to a slice on disk`);
        }
      } else if ((s.status === 'ready' || s.status === 'dispatched')
        && sliceIndex.get(s.depends_on).slice.status !== 'merged') {
        warns.push(`${sw}: is '${s.status}' but depends_on '${s.depends_on}' is '${sliceIndex.get(s.depends_on).slice.status}' (not merged)`);
      }
    }
  }

  const present = roadmaps.filter((r) => !r._missing);
  const sliceCount = present.reduce((n, r) => n + (r.slices || []).length, 0);
  return { errors, warns, counts: {
    roadmaps: present.length, registered: entries.length, slices: sliceCount, unreachable: unreachableRm.size,
  } };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const r = lint(flags.core);

  if (flags.format === 'summary') {
    process.stdout.write(`roadmap: ${r.errors.length} errors · ${r.warns.length} warnings (${r.counts.roadmaps}/${r.counts.registered} files · ${r.counts.slices} slices)\n`);
    return flags.check && r.errors.length ? 1 : 0;
  }

  const L = [`# roadmap-lint — ${flags.core}`, ''];
  L.push(`${r.counts.roadmaps}/${r.counts.registered} registered roadmaps present · ${r.counts.slices} slices · ${r.errors.length} errors · ${r.warns.length} warnings`);
  L.push('');
  if (r.errors.length) { L.push('## Errors'); r.errors.forEach((e) => L.push(`- ✗ ${e}`)); L.push(''); }
  if (r.warns.length) { L.push('## Warnings (shadow)'); r.warns.forEach((w) => L.push(`- ! ${w}`)); L.push(''); }
  if (!r.errors.length && !r.warns.length) L.push('✓ clean.');
  process.stdout.write(L.join('\n') + '\n');
  return flags.check && r.errors.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main();
}
