#!/usr/bin/env node
/**
 * loops-liveness.mjs — dead-loop detection from the loops registry.
 *
 * Audit cycle 5 §2d (rm-l2-ojfbot#S30): a loop that dies silently is the exact failure
 * loop engineering exists to prevent — T4 named it for Dolt, the A2 issue-close gotcha
 * named it for Actions crons. This reads decisions/loops/loops.md, checks each cadenced
 * loop's last-run evidence against what its cadence allows, and reports.
 *
 * REPORT-ONLY, SHADOW (ADR-0086): it does not page (that is F3's escalation rail — this
 * becomes an F3 emitter when F3 lands) and does not restart anything (auto-restart is an
 * automated control requiring its own shadow stage). It has zero side effects.
 *
 * Scope: loops with status:live and cadence always-on/daily/weekly. `event` and `manual`
 * cadences have nothing to breach; `disabled` loops are deliberate parks. Every exclusion
 * and unreadable evidence scheme is listed in the report — no silent denominators.
 *
 * Evidence schemes (`evidence_ref:`):
 *   file:<path>          — recency = file mtime (~ ok, core-relative ok)
 *   git-branch:<name>    — recency = last commit date of origin/<name> (local ref fallback)
 *   gh:<repo>:<workflow> — recency = last workflow run (needs `gh`; UNVERIFIABLE offline)
 *   dolt:<table>         — aliveness probe: TCP connect to 127.0.0.1:3307 (always-on rails)
 *   script:<path>|none   — no reader yet / declared none → UNVERIFIABLE with the reason
 *
 * Verdicts: OK · STALE (evidence older than cadence allows) · DOWN (always-on probe
 * failed) · UNVERIFIABLE (no readable evidence) · EXCLUDED (event/manual/disabled).
 *
 * Exit code: 0 unless the *mechanics* fail (registry missing/empty) — a STALE finding is
 * a report line, not a gate (promotion to gating is a future RIDM, per the slice).
 * `--check` additionally exits 1 on mechanical failure; it still never gates on findings.
 *
 * Usage: node loops-liveness.mjs [--core PATH] [--home PATH] [--json] [--check]
 *        [--now ISO] (tests: freeze the clock)
 */
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { loadLoopsRegistry } from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Cadence allowance: declared period + slack for jitter/timezones.
const MAX_AGE_MS = {
  daily: 36 * 3600 * 1000,        // 1d + 12h slack
  weekly: 8.5 * 24 * 3600 * 1000, // 7d + 1.5d slack
};

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), home: os.homedir(), json: false, check: false, now: Date.now() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') f.check = true;
    else if (a === '--json') f.json = true;
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--home') f.home = argv[++i];
    else if (a === '--now') f.now = Date.parse(argv[++i]) || Date.now();
  }
  return f;
}

function resolveRef(p, core, home) {
  if (p.startsWith('~')) return path.join(home, p.slice(1).replace(/^\//, ''));
  return path.isAbsolute(p) ? p : path.resolve(core, p);
}

/** Last-evidence timestamp (ms) for a loop, or { reason } when unreadable. */
function readEvidence(loop, core, home) {
  const ref = String(loop.evidence_ref || 'none');
  const [scheme, ...rest] = ref.split(':');
  const arg = rest.join(':');

  if (scheme === 'file') {
    const abs = resolveRef(arg, core, home);
    if (!existsSync(abs)) return { reason: `evidence file absent: ${abs}` };
    return { ts: statSync(abs).mtimeMs };
  }
  if (scheme === 'git-branch') {
    for (const ref2 of [`origin/${arg}`, arg]) {
      try {
        const out = execFileSync('git', ['log', '-1', '--format=%cI', ref2], { cwd: core, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (out) return { ts: Date.parse(out) };
      } catch { /* try next ref */ }
    }
    return { reason: `git branch '${arg}' unreadable from ${core}` };
  }
  if (scheme === 'gh') {
    const [repo, workflow] = arg.split(':');
    try {
      const out = execFileSync('gh', ['run', 'list', '-R', `ojfbot/${repo}`, '--workflow', workflow, '--limit', '1', '--json', 'updatedAt', '-q', '.[0].updatedAt'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).toString().trim();
      if (out) return { ts: Date.parse(out) };
      return { reason: `no runs found for ${repo}:${workflow}` };
    } catch {
      return { reason: `gh unavailable/offline for ${repo}:${workflow}` };
    }
  }
  if (scheme === 'dolt') {
    return { probe: true }; // handled async by probeAlive
  }
  if (scheme === 'none' || !ref.trim()) {
    return { reason: 'evidence_ref declared none — loop runs with no readable run artifact' };
  }
  return { reason: `no evidence reader for scheme '${scheme}'` };
}

function probeAlive(port = 3307, host = '127.0.0.1', timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.setTimeout(timeoutMs, () => done(false));
  });
}

export async function liveness(core, home = os.homedir(), now = Date.now()) {
  const { error, loops } = loadLoopsRegistry(core);
  if (error) return { error, results: [] };
  if (!loops.length) return { error: 'loops registry declares no loops', results: [] };

  const results = [];
  for (const l of loops) {
    const base = { slug: l.slug, cadence: l.cadence, trigger: l.trigger, repo: l.repo };
    if (l.status !== 'live') { results.push({ ...base, verdict: 'EXCLUDED', detail: `status: ${l.status} (deliberate park)` }); continue; }
    if (l.cadence === 'event' || l.cadence === 'manual') { results.push({ ...base, verdict: 'EXCLUDED', detail: `cadence: ${l.cadence} — nothing to breach` }); continue; }

    if (l.cadence === 'always-on') {
      const ev = readEvidence(l, core, home);
      if (ev.probe) {
        const up = await probeAlive();
        results.push(up
          ? { ...base, verdict: 'OK', detail: 'probe: 127.0.0.1:3307 accepting connections' }
          : { ...base, verdict: 'DOWN', detail: 'probe: 127.0.0.1:3307 refused/timed out — the T4 silent-loss condition is live' });
      } else if (ev.ts != null) {
        results.push({ ...base, verdict: 'OK', detail: `evidence at ${new Date(ev.ts).toISOString()}` });
      } else {
        results.push({ ...base, verdict: 'UNVERIFIABLE', detail: ev.reason });
      }
      continue;
    }

    // daily / weekly
    const ev = readEvidence(l, core, home);
    if (ev.ts == null) { results.push({ ...base, verdict: 'UNVERIFIABLE', detail: ev.reason }); continue; }
    const age = now - ev.ts;
    const max = MAX_AGE_MS[l.cadence];
    results.push(age > max
      ? { ...base, verdict: 'STALE', detail: `last evidence ${(age / 86400000).toFixed(1)}d ago — ${l.cadence} allows ${(max / 86400000).toFixed(1)}d` }
      : { ...base, verdict: 'OK', detail: `last evidence ${(age / 3600000).toFixed(1)}h ago` });
  }
  return { results };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { error, results } = await liveness(flags.core, flags.home, flags.now);
  if (error) {
    process.stderr.write(`loops-liveness: ${error}\n`);
    return flags.check ? 1 : 0;
  }
  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;

  if (flags.json) {
    process.stdout.write(JSON.stringify({ at: new Date(flags.now).toISOString(), counts, results }, null, 2) + '\n');
    return 0;
  }
  const L = [`# loops-liveness — ${new Date(flags.now).toISOString()}`, ''];
  L.push(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · '));
  L.push('');
  for (const v of ['DOWN', 'STALE', 'UNVERIFIABLE', 'OK', 'EXCLUDED']) {
    const rows = results.filter((r) => r.verdict === v);
    if (!rows.length) continue;
    L.push(`## ${v}`);
    rows.forEach((r) => L.push(`- ${r.slug} (${r.cadence}, ${r.repo}): ${r.detail}`));
    L.push('');
  }
  L.push('_report-only: paging is F3\'s rail; nothing here restarts anything._');
  process.stdout.write(L.join('\n') + '\n');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then((code) => { process.exitCode = code; });
}
