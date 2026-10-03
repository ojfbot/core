import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

  it('excludes event/manual loops ONLY when they declare a verifier; verifier-none is UNVERIFIABLE (TD-006)', async () => {
    // Policy (rm:rm-l2-ojfbot#S32): the old wholesale event/manual exclusion is exactly
    // where the lying hook-bead-session entry hid — a loop can be born dead and stay
    // green. An event loop must declare a verifier to earn EXCLUDED.
    writeRegistry(ctx.core, [
      loop({ slug: 'a-hook', trigger: 'hook', cadence: 'event', verifier: 'bead-lint measures it' }),
      loop({ slug: 'a-hook-unchecked', trigger: 'hook', cadence: 'event' }),
      loop({ slug: 'a-ritual', trigger: 'manual', cadence: 'manual', verifier: 'none' }),
      loop({ slug: 'parked', status: 'disabled', evidence_ref: 'file:nope.log' }),
    ]);
    const { results } = await liveness(ctx.core, ctx.home, NOW);
    expect(results.map((r) => r.verdict)).toEqual(['EXCLUDED', 'UNVERIFIABLE', 'UNVERIFIABLE', 'EXCLUDED']);
    expect(results[0].detail).toMatch(/verifier declared/);
    expect(results[1].detail).toMatch(/nothing independently checks/);
    expect(results[2].detail).toMatch(/nothing independently checks/);
    expect(results[3].detail).toMatch(/deliberate park/);
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

  it('projects Codex never-fired, missed, and successful receipts without Selfco output files', async () => {
    const id = 'selfco-vault-hygiene';
    const rrule = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0';
    const file = path.join(ctx.home, '.codex', 'automations', id, 'automation.toml');
    const db = path.join(ctx.home, '.codex', 'sqlite', 'codex-dev.db');
    mkdirSync(path.dirname(file), { recursive: true });
    mkdirSync(path.dirname(db), { recursive: true });
    writeFileSync(file, `id = "${id}"\nkind = "heartbeat"\nstatus = "ACTIVE"\nrrule = "${rrule}"\ntarget_thread_id = "thread-1"\n`);
    execFileSync('sqlite3', [db, `CREATE TABLE automations (id TEXT, kind TEXT, status TEXT, rrule TEXT, target_thread_id TEXT, next_run_at INTEGER, last_run_at INTEGER, created_at INTEGER); CREATE TABLE automation_runs (thread_id TEXT, automation_id TEXT, status TEXT, created_at INTEGER, updated_at INTEGER); INSERT INTO automations VALUES ('${id}', 'heartbeat', 'ACTIVE', '${rrule}', 'thread-1', ${NOW + 60000}, NULL, ${NOW - 3600000});`]);
    writeRegistry(ctx.core, [loop({ slug: id, trigger: 'codex-automation',
      trigger_ref: `~/.codex/automations/${id}/automation.toml`, automation_id: id,
      rrule, target_thread_id: 'thread-1', evidence_ref: `codex-run:${id}` })]);
    expect((await liveness(ctx.core, ctx.home, NOW)).results[0].verdict).toBe('UNVERIFIABLE');
    expect((await liveness(ctx.core, ctx.home, NOW + 2 * 3600000)).results[0].verdict).toBe('MISSED');
    execFileSync('sqlite3', [db, `INSERT INTO automation_runs VALUES ('run-1', '${id}', 'completed', ${NOW - 60000}, ${NOW - 59000});`]);
    expect((await liveness(ctx.core, ctx.home, NOW)).results[0].verdict).toBe('OK');
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
