#!/usr/bin/env node
/**
 * northstar-lint.mjs — health check for the three-tier northstar system.
 *
 * Ships SHADOW-ONLY in Slice 1 (ADR-0089 discipline): it reports, it never blocks. The
 * standup surfaces its one-line summary (`--format=summary`); a future slice promotes the
 * structural checks to a CI gate (`--check`) once the rollup model is authoritative.
 *
 * Checks:
 *   ERROR  — registry entry with no file; broken ladder (ns:slug#Pn doesn't resolve, or
 *            resolves outside the declared parent northstar); malformed property
 *            (missing id/name/target/verification, current out of [0,100], dup P-id);
 *            ladder-completeness (L1/L2 must declare a parent, L3 must not).
 *   WARN   — rollup drift (parent % vs mean of its children); stale % (no movement in N days).
 *
 * Usage: node northstar-lint.mjs [--core PATH] [--format=summary] [--check] [--stale-days N]
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAll, buildPropertyIndex } from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), format: 'report', check: false, staleDays: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') f.check = true;
    else if (a === '--format=summary') f.format = 'summary';
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--stale-days') f.staleDays = parseInt(argv[++i], 10) || 30;
  }
  return f;
}

const ROLLUP_TOLERANCE = 5; // pp drift before we flag it (shadow)
const TIERS = new Set(['L1', 'L2', 'L3']);

function lint(core, staleDays) {
  const errors = [];
  const warns = [];
  const { error: regErr, entries, northstars } = loadAll(core);
  if (regErr) errors.push(regErr);

  // Missing files.
  for (const ns of northstars) {
    if (ns._missing) errors.push(`missing northstar file for '${ns.slug}' (${ns.tier}) at ${ns._path}`);
  }
  const present = northstars.filter((n) => !n._missing);
  const bySlug = new Map(present.map((n) => [n.slug, n]));
  const index = buildPropertyIndex(present);

  for (const ns of present) {
    // Tier validity + completeness.
    if (!TIERS.has(ns.tier)) errors.push(`${ns.slug}: invalid tier '${ns.tier}'`);
    if (ns.tier === 'L3' && ns.ladders_up_to) errors.push(`${ns.slug}: L3 must not ladder up (has ladders_up_to=${ns.ladders_up_to})`);
    if ((ns.tier === 'L1' || ns.tier === 'L2') && !ns.ladders_up_to) {
      errors.push(`${ns.slug}: ${ns.tier} must declare a parent northstar (ladders_up_to)`);
    }
    if (ns.ladders_up_to && !bySlug.has(ns.ladders_up_to)) {
      errors.push(`${ns.slug}: parent northstar '${ns.ladders_up_to}' not in registry/on disk`);
    }

    const seen = new Set();
    for (const p of ns.properties || []) {
      const where = `${ns.slug}#${p.id}`;
      for (const req of ['id', 'name', 'target', 'verification']) {
        if (p[req] == null || p[req] === '') errors.push(`${where}: missing '${req}'`);
      }
      if (seen.has(p.id)) errors.push(`${ns.slug}: duplicate property id '${p.id}'`);
      seen.add(p.id);
      if (typeof p.current !== 'number' || p.current < 0 || p.current > 100) {
        errors.push(`${where}: current '${p.current}' not in [0,100]`);
      }
      // Ladder resolution for non-root properties.
      if (ns.tier !== 'L3') {
        if (!p.ladders_up_to) {
          errors.push(`${where}: property must ladder up (ladders_up_to)`);
        } else if (!index.has(p.ladders_up_to)) {
          errors.push(`${where}: ladder '${p.ladders_up_to}' does not resolve to a property on disk`);
        } else {
          // The target property must live inside this northstar's declared parent.
          const target = index.get(p.ladders_up_to);
          if (ns.ladders_up_to && target.northstar.slug !== ns.ladders_up_to) {
            errors.push(`${where}: ladders to '${p.ladders_up_to}' (in ${target.northstar.slug}) but parent is '${ns.ladders_up_to}'`);
          }
        }
      } else if (p.ladders_up_to) {
        errors.push(`${where}: L3 property must not ladder up`);
      }
    }
  }

  // Rollup drift (shadow): for each parent property, compare its % to the mean of children.
  const childrenByTarget = new Map();
  for (const ns of present) {
    for (const p of ns.properties || []) {
      if (!p.ladders_up_to) continue;
      if (!childrenByTarget.has(p.ladders_up_to)) childrenByTarget.set(p.ladders_up_to, []);
      childrenByTarget.get(p.ladders_up_to).push(p);
    }
  }
  let driftCount = 0;
  for (const [target, kids] of childrenByTarget) {
    if (!index.has(target)) continue;
    const parent = index.get(target).property;
    const computed = Math.round(kids.reduce((s, k) => s + (k.current || 0), 0) / kids.length);
    if (Math.abs(computed - (parent.current || 0)) > ROLLUP_TOLERANCE) {
      driftCount++;
      warns.push(`rollup drift: ${target} asserts ${parent.current}% but children mean ${computed}% (n=${kids.length})`);
    }
  }

  // Stale % (shadow): needs status.jsonl. If absent, note once (not an error).
  let staleCount = 0;
  const statusPath = path.join(core, 'decisions', 'northstar', 'status.jsonl');
  if (existsSync(statusPath)) {
    const lines = readFileSync(statusPath, 'utf8').split('\n').filter(Boolean);
    const lastMove = new Map();
    for (const ln of lines) {
      try { const m = JSON.parse(ln); lastMove.set(`ns:${m.northstar}#${m.property}`, m.date); } catch { /* skip */ }
    }
    const cutoff = Date.now() - staleDays * 86400 * 1000;
    for (const key of index.keys()) {
      const d = lastMove.get(key);
      if (!d || Date.parse(d) < cutoff) { staleCount++; }
    }
  }

  return { errors, warns, driftCount, staleCount, hasStatus: existsSync(statusPath),
    counts: { northstars: present.length, registered: entries.length } };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const r = lint(flags.core, flags.staleDays);

  if (flags.format === 'summary') {
    const staleStr = r.hasStatus ? `${r.staleCount}` : 'n/a';
    process.stdout.write(`northstar: ${r.errors.length} errors · ${r.warns.length} warnings · drift ${r.driftCount} · stale ${staleStr} (${r.counts.northstars}/${r.counts.registered} files)\n`);
    return flags.check && r.errors.length ? 1 : 0;
  }

  const L = [`# northstar-lint — ${flags.core}`, ''];
  L.push(`${r.counts.northstars}/${r.counts.registered} registered northstars present · ${r.errors.length} errors · ${r.warns.length} warnings`);
  L.push('');
  if (r.errors.length) { L.push('## Errors'); r.errors.forEach((e) => L.push(`- ✗ ${e}`)); L.push(''); }
  if (r.warns.length) { L.push('## Warnings (shadow)'); r.warns.forEach((w) => L.push(`- ! ${w}`)); L.push(''); }
  if (!r.hasStatus) L.push('_no status.jsonl yet — staleness unchecked (created on first recorded movement)._');
  if (!r.errors.length && !r.warns.length) L.push('✓ clean.');
  process.stdout.write(L.join('\n') + '\n');
  return flags.check && r.errors.length ? 1 : 0;
}

process.exitCode = main();
