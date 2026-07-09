import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { liveness } from '../../loops-liveness.mjs';

function scaffold() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'loops-liveness-'));
  const core = path.join(tmp, 'cluster', 'core');
  const home = path.join(tmp, 'home');
  mkdirSync(path.join(core, 'decisions', 'loops'), { recursive: true });
  mkdirSync(home, { recursive: true });
  return { tmp, core, home };
}

function writeRegistry(core, entries) {
  const lines = ['---', 'type: loops-registry', 'version: 1', 'loops:'];
  for (const e of entries) {
    const keys = Object.keys(e);
    lines.push(`  - ${keys[0]}: ${e[keys[0]]}`);
    for (const k of keys.slice(1)) lines.push(`    ${k}: "${e[k]}"`);
  }
  lines.push('---');
  writeFileSync(path.join(core, 'decisions', 'loops', 'loops.md'), lines.join('\n'));
}

const NOW = Date.parse('2026-07-09T12:00:00Z');
const loop = (over) => ({
  slug: 'l', purpose: 'p', trigger: 'launchd', cadence: 'daily', status: 'live', repo: 'core', ...over,
});

let ctx;
beforeEach(() => { ctx = scaffold(); });
afterEach(() => { rmSync(ctx.tmp, { recursive: true, force: true }); });

describe('loops-liveness', () => {
  it('errors mechanically when the registry is missing', async () => {
    const r = await liveness(ctx.core, ctx.home, NOW);
    expect(r.error).toMatch(/loops registry not found/);
  });

  it('flags a simulated dead loop: daily cadence, stale file evidence, with the breach stated', async () => {
    const ev = path.join(ctx.core, 'dead.log');
    writeFileSync(ev, 'x');
    const old = new Date(NOW - 3 * 86400000); // 3d old vs 36h allowance
    utimesSync(ev, old, old);
    writeRegistry(ctx.core, [loop({ slug: 'dead-loop', evidence_ref: 'file:dead.log' })]);
    const { results } = await liveness(ctx.core, ctx.home, NOW);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('STALE');
    expect(results[0].detail).toMatch(/3\.0d ago — daily allows 1\.5d/);
  });

  it('passes a fresh daily loop and a fresh weekly loop', async () => {
    const fresh = path.join(ctx.core, 'fresh.log');
    writeFileSync(fresh, 'x');
    utimesSync(fresh, new Date(NOW - 3600000), new Date(NOW - 3600000)); // 1h old
    const weekly = path.join(ctx.core, 'weekly.log');
    writeFileSync(weekly, 'x');
    utimesSync(weekly, new Date(NOW - 6 * 86400000), new Date(NOW - 6 * 86400000)); // 6d < 8.5d
    writeRegistry(ctx.core, [
      loop({ slug: 'fresh-daily', evidence_ref: 'file:fresh.log' }),
      loop({ slug: 'fresh-weekly', cadence: 'weekly', evidence_ref: 'file:weekly.log' }),
    ]);
    const { results } = await liveness(ctx.core, ctx.home, NOW);
    expect(results.map((r) => r.verdict)).toEqual(['OK', 'OK']);
  });

  it('excludes event/manual cadences and disabled loops, stating why', async () => {
    writeRegistry(ctx.core, [
      loop({ slug: 'a-hook', trigger: 'hook', cadence: 'event' }),
      loop({ slug: 'a-ritual', trigger: 'manual', cadence: 'manual' }),
      loop({ slug: 'parked', status: 'disabled', evidence_ref: 'file:nope.log' }),
    ]);
    const { results } = await liveness(ctx.core, ctx.home, NOW);
    expect(results.every((r) => r.verdict === 'EXCLUDED')).toBe(true);
    expect(results.map((r) => r.detail).join()).toMatch(/nothing to breach.*nothing to breach.*deliberate park/s);
  });

  it('marks unreadable evidence UNVERIFIABLE with the reason — never silently OK', async () => {
    writeRegistry(ctx.core, [
      loop({ slug: 'no-evidence', evidence_ref: 'none' }),
      loop({ slug: 'gone-file', evidence_ref: 'file:missing.log' }),
    ]);
    const { results } = await liveness(ctx.core, ctx.home, NOW);
    expect(results.map((r) => r.verdict)).toEqual(['UNVERIFIABLE', 'UNVERIFIABLE']);
    expect(results[0].detail).toMatch(/declared none/);
    expect(results[1].detail).toMatch(/evidence file absent/);
  });

  it('has zero side effects — no files created or modified by a run', async () => {
    const ev = path.join(ctx.core, 'fresh.log');
    writeFileSync(ev, 'x');
    utimesSync(ev, new Date(NOW - 3600000), new Date(NOW - 3600000));
    writeRegistry(ctx.core, [loop({ slug: 'fresh', evidence_ref: 'file:fresh.log' })]);
    const before = readdirSync(ctx.tmp, { recursive: true }).sort();
    const mtime = statMtimes(ctx.tmp);
    await liveness(ctx.core, ctx.home, NOW);
    expect(readdirSync(ctx.tmp, { recursive: true }).sort()).toEqual(before);
    expect(statMtimes(ctx.tmp)).toEqual(mtime);
  });
});

function statMtimes(root) {
  const out = {};
  for (const f of readdirSync(root, { recursive: true }).sort()) {
    const p = path.join(root, String(f));
    try { out[String(f)] = statSync(p).mtimeMs; } catch { /* dir race */ }
  }
  return out;
}
