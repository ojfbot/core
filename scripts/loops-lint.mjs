#!/usr/bin/env node
/**
 * loops-lint.mjs — health check for the loops registry (decisions/loops/loops.md).
 *
 * Audit cycle 5 §2c (rm-l2-ojfbot#S29): every loop in the cluster is declared as a
 * first-class resource; this lint cross-checks declarations against the trigger
 * artifacts actually on disk, both directions. SHADOW — not wired into CI gates;
 * `--check` exits 1 on ERRORs for callers that want a gate.
 *
 * Checks:
 *   ERROR — registry missing/empty; duplicate slug; missing required field
 *           (slug/purpose/trigger/cadence/status/repo); invalid trigger/cadence/status
 *           enum; live non-manual loop with no trigger_ref; declared trigger_ref or
 *           installed_ref absent from disk (when its root is reachable).
 *   WARN  — declared ref whose repo/home root is unreachable from this vantage
 *           (northstar-lint precedent: the gate only blocks on breakage it can see);
 *           discovered-but-undeclared trigger artifact: a *.plist under scripts/, an
 *           ojfbot-labeled plist in ~/Library/LaunchAgents, a sibling-repo workflow
 *           with a cron schedule, or a hook script registered in project/user
 *           .claude/settings.json that resolves under the ojfbot cluster.
 *
 * Usage: node loops-lint.mjs [--core PATH] [--home PATH] [--format=summary] [--check]
 *   --home overrides the home directory scanned for LaunchAgents/user settings
 *   (used by tests; defaults to os.homedir()).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { loadLoopsRegistry, resolvePath, repoRootOf } from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const TRIGGERS = new Set(['launchd', 'gh-actions', 'hook', 'watchpath', 'manual']);
const CADENCES = new Set(['always-on', 'daily', 'weekly', 'event', 'manual']);
const STATUSES = new Set(['live', 'disabled']);
const REQUIRED = ['slug', 'purpose', 'trigger', 'cadence', 'status', 'repo'];

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), home: os.homedir(), format: 'report', check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') f.check = true;
    else if (a === '--format=summary') f.format = 'summary';
    else if (a === '--core') f.core = argv[++i];
    else if (a === '--home') f.home = argv[++i];
  }
  return f;
}

/** resolvePath/repoRootOf with an overridable home (northstar-fm hardcodes os.homedir()). */
function resolveRef(p, core, home) {
  if (p && p.startsWith('~')) return path.join(home, p.slice(1).replace(/^\//, ''));
  return resolvePath(p, core);
}
function rootOfRef(p, core, home) {
  if (p && p.startsWith('~')) {
    const seg = p.slice(1).replace(/^\//, '').split('/')[0];
    return seg ? path.join(home, seg) : home;
  }
  return repoRootOf(p, core);
}

/** Hook script paths registered in a .claude settings file that live under the cluster/home. */
function hookScriptPaths(settingsFile, core, home) {
  if (!existsSync(settingsFile)) return [];
  let cfg;
  try { cfg = JSON.parse(readFileSync(settingsFile, 'utf8')); } catch { return []; }
  const out = new Set();
  const cluster = path.resolve(core, '..');
  for (const items of Object.values(cfg.hooks || {})) {
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      for (const h of it.hooks || []) {
        const cmd = String(h.command || '');
        // Extract script-file paths; inline shell (no path token) is skipped from discovery.
        for (const m of cmd.matchAll(/(?:"?\$CLAUDE_PROJECT_DIR"?|~|\/[\w./-]+?)?[\w./~-]*\.(?:sh|mjs)\b/g)) {
          let p = m[0].replace(/^"?\$CLAUDE_PROJECT_DIR"?\/?/, '');
          if (p.startsWith('~')) p = path.join(home, p.slice(1).replace(/^\//, ''));
          const abs = path.isAbsolute(p) ? p : path.resolve(core, p);
          if ((abs.startsWith(cluster + path.sep) || abs.startsWith(home + path.sep)) && existsSync(abs)) {
            out.add(abs);
          }
        }
      }
    }
  }
  return [...out];
}

/** Discover trigger artifacts on disk that the registry ought to declare. */
function discoverArtifacts(core, home) {
  const found = []; // { kind, abs, display }
  const cluster = path.resolve(core, '..');

  // launchd plist sources committed in core/scripts.
  const scriptsDir = path.join(core, 'scripts');
  if (existsSync(scriptsDir)) {
    for (const f of readdirSync(scriptsDir)) {
      if (f.endsWith('.plist')) found.push({ kind: 'plist', abs: path.join(scriptsDir, f) });
    }
  }
  // Installed ojfbot-labeled LaunchAgents (including deliberately .disabled ones).
  const la = path.join(home, 'Library', 'LaunchAgents');
  if (existsSync(la)) {
    for (const f of readdirSync(la)) {
      if (/^(com|dev)\.ojfbot\..*\.plist(\.disabled)?$/.test(f)) {
        found.push({ kind: 'launch-agent', abs: path.join(la, f) });
      }
    }
  }
  // Sibling-repo (and core) workflows with a cron schedule.
  if (existsSync(cluster)) {
    for (const repo of readdirSync(cluster)) {
      const wf = path.join(cluster, repo, '.github', 'workflows');
      if (!existsSync(wf)) continue;
      for (const f of readdirSync(wf)) {
        if (!/\.ya?ml$/.test(f)) continue;
        const abs = path.join(wf, f);
        try {
          if (/^\s*-?\s*cron:/m.test(readFileSync(abs, 'utf8'))) found.push({ kind: 'workflow-cron', abs });
        } catch { /* unreadable — skip */ }
      }
    }
  }
  // Hook scripts registered in project + user settings.
  for (const sf of [path.join(core, '.claude', 'settings.json'), path.join(home, '.claude', 'settings.json')]) {
    for (const abs of hookScriptPaths(sf, core, home)) found.push({ kind: 'hook', abs });
  }
  return found;
}

export function lint(core, home = os.homedir()) {
  const errors = [];
  const warns = [];
  const { error: regErr, loops, _abs } = loadLoopsRegistry(core);
  if (regErr) errors.push(regErr);
  if (!regErr && !loops.length) errors.push(`loops registry at ${_abs} declares no loops`);

  const declaredRefs = new Set(); // absolute paths every entry claims (trigger_ref + installed_ref)
  const seen = new Set();
  for (const l of loops) {
    const where = l.slug || '(unnamed)';
    for (const req of REQUIRED) {
      if (l[req] == null || l[req] === '') errors.push(`${where}: missing '${req}'`);
    }
    if (l.slug) {
      if (seen.has(l.slug)) errors.push(`duplicate loop slug '${l.slug}'`);
      seen.add(l.slug);
    }
    if (l.trigger && !TRIGGERS.has(l.trigger)) errors.push(`${where}: invalid trigger '${l.trigger}'`);
    if (l.cadence && !CADENCES.has(l.cadence)) errors.push(`${where}: invalid cadence '${l.cadence}'`);
    if (l.status && !STATUSES.has(l.status)) errors.push(`${where}: invalid status '${l.status}'`);
    if (l.status === 'live' && l.trigger && l.trigger !== 'manual' && !l.trigger_ref) {
      errors.push(`${where}: live '${l.trigger}' loop with no trigger_ref — undiscoverable, the exact failure this registry exists to prevent`);
    }
    for (const key of ['trigger_ref', 'installed_ref']) {
      const ref = l[key];
      if (!ref) continue;
      const abs = resolveRef(ref, core, home);
      declaredRefs.add(abs);
      if (existsSync(abs)) continue;
      const root = rootOfRef(ref, core, home);
      if (!existsSync(root)) {
        warns.push(`vantage: ${where} ${key} '${ref}' unreachable from this checkout (root ${root} absent)`);
      } else {
        errors.push(`${where}: ${key} '${ref}' does not exist on disk`);
      }
    }
  }

  // Reverse direction: artifacts on disk nobody declared.
  let undeclared = 0;
  for (const a of discoverArtifacts(core, home)) {
    if (declaredRefs.has(a.abs)) continue;
    undeclared++;
    warns.push(`undeclared ${a.kind}: ${a.abs} — no registry entry claims it (declare it or park it deliberately)`);
  }

  return { errors, warns, undeclared, counts: { loops: loops.length } };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const r = lint(flags.core, flags.home);

  if (flags.format === 'summary') {
    process.stdout.write(`loops: ${r.counts.loops} declared · ${r.errors.length} errors · ${r.warns.length} warnings · ${r.undeclared} undeclared\n`);
    return flags.check && r.errors.length ? 1 : 0;
  }

  const L = [`# loops-lint — ${flags.core}`, ''];
  L.push(`${r.counts.loops} loops declared · ${r.errors.length} errors · ${r.warns.length} warnings`);
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
