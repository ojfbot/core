#!/usr/bin/env node
/**
 * read-northstar.mjs — load the active northstar(s) for /frame-standup Step 4.6.
 *
 * Returns the L2 ojfbot northstar (always — the default frame for the day), plus the L1
 * northstar for any app passed via --focus (the apps surfaced in today's plan). Each
 * property carries its current % and last recorded movement, so Step 5 can frame each
 * priority as "· advances ns:<slug>#P<n> (NN%)".
 *
 * Best-effort and additive: prints `{available:false}` rather than failing if the
 * northstar substrate is absent, so the standup is never blocked.
 *
 * Usage: node read-northstar.mjs [--focus app[,app2]] [--core PATH] [--human]
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAll } from '../../../../scripts/lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..', '..', '..', '..'), focus: [], human: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--human') f.human = true;
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--focus') f.focus = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return f;
}

function lastMovements(core) {
  const p = path.join(core, 'decisions', 'northstar', 'status.jsonl');
  const map = new Map();
  if (!existsSync(p)) return map;
  for (const ln of readFileSync(p, 'utf8').split('\n').filter(Boolean)) {
    try { const m = JSON.parse(ln); map.set(`ns:${m.northstar}#${m.property}`, m.date); } catch { /* skip */ }
  }
  return map;
}

function shape(ns, moves) {
  return {
    slug: ns.slug,
    tier: ns.tier,
    app: ns.app ?? null,
    ladders_up_to: ns.ladders_up_to ?? null,
    properties: (ns.properties || []).map((p) => ({
      ref: `ns:${ns.slug}#${p.id}`,
      id: p.id,
      name: p.name,
      current: p.current,
      ladders_up_to: p.ladders_up_to ?? null,
      last_movement: moves.get(`ns:${ns.slug}#${p.id}`) ?? null,
    })),
  };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { error, northstars } = loadAll(flags.core);
  const present = northstars.filter((n) => !n._missing);
  if (error || !present.length) {
    const out = { available: false, reason: error || 'no northstars found' };
    process.stdout.write(JSON.stringify(out) + '\n');
    return 0;
  }
  const moves = lastMovements(flags.core);

  const ojfbot = present.find((n) => n.slug === 'l2-ojfbot');
  const focused = present.filter((n) => n.tier === 'L1' && flags.focus.includes(n.app));

  const result = {
    available: true,
    default: ojfbot ? shape(ojfbot, moves) : null,
    focus: focused.map((n) => shape(n, moves)),
  };

  if (flags.human) {
    const L = [];
    const render = (n) => {
      L.push(`${n.slug} (${n.tier})${n.app ? ` — ${n.app}` : ''}`);
      for (const p of n.properties) {
        L.push(`  ${p.ref}  ${String(p.current).padStart(3)}%  ${p.name}${p.last_movement ? `  (moved ${p.last_movement})` : ''}`);
      }
    };
    if (result.default) render(result.default);
    result.focus.forEach(render);
    process.stdout.write(L.join('\n') + '\n');
    return 0;
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return 0;
}

process.exitCode = main();
