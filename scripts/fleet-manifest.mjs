#!/usr/bin/env node
/**
 * fleet-manifest.mjs — one fleet, one source, generated caches (TD-007, decomposition S1).
 *
 * The northstar registry frontmatter (decisions/northstar/README.md) is the fleet's one
 * authoritative enumeration; every other list of repos is a hand-maintained cache of it
 * (surface matrix: .claude/skills/fleet-onboard/knowledge/surface-matrix.md). This script
 * (a) emits fleet.json — the generated view the caches should eventually be derived from —
 * and (b) reconciles every machine-readable surface against the registry, reporting drift.
 *
 * SHADOW MODE: reporting only. Exit 0 regardless of drift unless --check is passed.
 * Promotion of --check into CI is a RIDM decision gated on clean shadow runs (ADR-0086),
 * not a default. Surfaces in sibling repos degrade to `unreachable` when the checkout is
 * absent from this vantage (same posture as northstar-lint).
 *
 * Usage:
 *   node scripts/fleet-manifest.mjs                 # human-readable reconcile report
 *   node scripts/fleet-manifest.mjs --json          # machine-readable report + manifest
 *   node scripts/fleet-manifest.mjs --out fleet.json  # also write the manifest
 *   node scripts/fleet-manifest.mjs --check         # exit 1 on drift (NOT wired in CI yet)
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/northstar-fm.mjs';

/**
 * Where sibling repos live. From the installed core that is simply `..`, but from an
 * isolated worktree the parent is a scratch dir — so prefer the fleet convention
 * (~/ojfbot, same as sync-repos.js and day-runner) and fall back to the parent.
 * OJFBOT_ROOT overrides for tests and unusual layouts.
 */
export function siblingBase(coreRoot) {
  if (process.env.OJFBOT_ROOT) return process.env.OJFBOT_ROOT;
  const home = path.join(os.homedir(), 'ojfbot');
  if (existsSync(path.join(home, 'core'))) return home;
  return path.resolve(coreRoot, '..');
}

/** Lowercased comparison key; surfaces disagree on casing (BlogEngine vs blogengine). */
export function normName(name) {
  return String(name).trim().toLowerCase();
}

/** Registry-derived fleet: every entry with an `app:` field (the L1 set). */
export function registryFleet(coreRoot) {
  const { entries, error } = loadRegistry(coreRoot);
  const apps = entries.filter((e) => e.app);
  return { error, apps, set: new Set(apps.map((e) => normName(e.app))) };
}

/** Repo names from the `## Ecosystem` markdown table in CLAUDE.md (first column). */
export function parseEcosystemTable(text) {
  const section = /## Ecosystem\n([\s\S]*?)(?:\n## |$)/.exec(text);
  if (!section) return [];
  const names = [];
  for (const line of section[1].split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|/.exec(line);
    if (!m) continue;
    const cell = m[1];
    if (cell === 'Repo' || /^-+$/.test(cell)) continue;
    names.push(cell);
  }
  return names;
}

/** Strip `//` line comments so apostrophes in prose can't open phantom string literals. */
function stripLineComments(block) {
  return block.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

/** Single-line string literals in a comment-stripped block. */
function stringLiterals(block) {
  return [...stripLineComments(block).matchAll(/['"]([^'"\n]+)['"]/g)].map((x) => x[1]);
}

/** String literals inside `const <varName> = [ ... ]` — bracket-depth scan after comment
 *  stripping, so it survives both semicolon and no-semicolon styles. */
export function parseJsArray(text, varName) {
  const clean = stripLineComments(text);
  const start = new RegExp(`const\\s+${varName}\\s*=\\s*\\[`).exec(clean);
  if (!start) return [];
  const from = start.index + start[0].length;
  let depth = 1;
  let i = from;
  while (i < clean.length && depth > 0) {
    if (clean[i] === '[') depth++;
    else if (clean[i] === ']') depth--;
    i++;
  }
  return stringLiterals(clean.slice(from, i - 1));
}

/** String literals inside `<varName> = new Set([ ... ])`. */
export function parseJsSet(text, varName) {
  const m = new RegExp(`${varName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(text);
  return m ? stringLiterals(m[1]) : [];
}

/** `name:` values inside the `REPO_META = [ ... ];` block (the `RepoMeta[]` type annotation
 *  also contains `[]`, so anchor on `= [`). */
export function parseRepoMeta(text) {
  const m = /REPO_META[^=]*=\s*\[([\s\S]*?)\]\s*;/.exec(text);
  if (!m) return [];
  return [...stripLineComments(m[1]).matchAll(/name:\s*['"]([^'"\n]+)['"]/g)].map((x) => x[1]);
}

/** Case labels of the per-repo architecture-doc switch in install-agents.sh. */
export function parseInstallCaseSwitch(text) {
  const m = /case\s+"\$REPO_NAME"\s+in\n([\s\S]*?)\nesac/.exec(text);
  if (!m) return [];
  const names = [];
  for (const line of m[1].split('\n')) {
    const c = /^\s*([\w][\w.-]*)\)/.exec(line);
    if (c && c[1] !== '*') names.push(c[1]);
  }
  return names;
}

/**
 * Surface descriptors. `expectation`:
 *   'complete' — every registered app should appear here (absences are drift)
 *   'subset'   — legitimately partial (launcher, standup extensions); only extras reported
 *   'manual'   — prose, not machine-diffable yet; reported as such, never silently skipped
 *   'auto'     — self-healing per the surface matrix; listed for the count, no diff
 */
export const SURFACES = [
  { id: 'core-claude-md', label: 'core CLAUDE.md ecosystem table', file: 'CLAUDE.md', repo: '.', expectation: 'complete', extract: (t) => parseEcosystemTable(t) },
  { id: 'install-agents-archdocs', label: 'install-agents.sh arch-doc case-switch', file: 'scripts/install-agents.sh', repo: '.', expectation: 'subset', extract: (t) => parseInstallCaseSwitch(t) },
  { id: 'frame-standup-sync', label: 'frame-standup sync-repos.js REPOS', file: '.claude/skills/frame-standup/scripts/sync-repos.js', repo: '.', expectation: 'complete', extract: (t) => parseJsArray(t, 'REPOS') },
  { id: 'frame-standup-extensions', label: 'frame-standup read-app-standup.js REPOS', file: '.claude/skills/frame-standup/scripts/read-app-standup.js', repo: '.', expectation: 'subset', extract: (t) => parseJsArray(t, 'REPOS') },
  { id: 'launcher-registrations', label: 'launcher registrations/', file: 'scripts/launcher/registrations', repo: '.', expectation: 'subset', extract: null },
  { id: 'dl-collect', label: 'daily-logger collect-context.ts REPOS', file: 'src/collect-context.ts', repo: '../daily-logger', expectation: 'complete', extract: (t) => parseJsArray(t, 'REPOS') },
  { id: 'dl-api', label: 'daily-logger build-api.ts KNOWN_REPOS', file: 'src/build-api.ts', repo: '../daily-logger', expectation: 'complete', extract: (t) => parseJsSet(t, 'KNOWN_REPOS') },
  { id: 'dl-article', label: 'daily-logger generate-article.ts prose', file: 'src/generate-article.ts', repo: '../daily-logger', expectation: 'manual', extract: null },
  { id: 'cockpit-fleet-config', label: 'morning-cockpit fleet-config.ts REPO_META', file: 'packages/server/src/fleet-config.ts', repo: '../morning-cockpit', expectation: 'subset', extract: (t) => parseRepoMeta(t) },
  { id: 'frame-os-context', label: 'frame-os-context.md MF inventory', file: 'domain-knowledge/frame-os-context.md', repo: '.', expectation: 'manual', extract: null },
  { id: 'selfco-entities', label: '~/selfco wiki entities', file: null, repo: null, expectation: 'auto', extract: null },
  { id: 'cockpit-read-model', label: 'cockpit read-model listKnownRepos()', file: null, repo: null, expectation: 'auto', extract: null },
  { id: 'day-runner', label: 'day-runner / bead-emit (parametric)', file: null, repo: null, expectation: 'auto', extract: null },
];

function surfaceNames(surface, coreRoot) {
  if (surface.id === 'launcher-registrations') {
    const dir = path.resolve(coreRoot, surface.file);
    if (!existsSync(dir)) return null;
    return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  }
  const repoRoot = surface.repo === '.'
    ? coreRoot
    : path.join(siblingBase(coreRoot), surface.repo.replace(/^\.\.\//, ''));
  const abs = path.resolve(repoRoot, surface.file);
  if (!existsSync(repoRoot) || !existsSync(abs)) return null;
  return surface.extract(readFileSync(abs, 'utf8'));
}

/** Diff every surface against the registry set. Pure report; no verdicts beyond drift/extras. */
export function reconcile(coreRoot) {
  const fleet = registryFleet(coreRoot);
  const base = siblingBase(coreRoot);
  const results = [];
  for (const surface of SURFACES) {
    const row = { id: surface.id, label: surface.label, expectation: surface.expectation };
    if (surface.expectation === 'auto' || surface.expectation === 'manual') {
      row.status = surface.expectation;
      results.push(row);
      continue;
    }
    const names = surfaceNames(surface, coreRoot);
    if (names === null) {
      row.status = 'unreachable';
      results.push(row);
      continue;
    }
    if (names.length === 0) {
      // The file exists but the extractor found nothing — a format change, not an empty fleet.
      row.status = 'unparsed';
      results.push(row);
      continue;
    }
    const onSurface = new Set(names.map(normName));
    row.count = names.length;
    const extras = names.filter((n) => !fleet.set.has(normName(n)));
    // A name with no sibling directory is a stale spelling (rename/removal missed) — that is
    // drift. A name whose directory exists is merely not northstar-registered yet; the registry
    // does not enumerate the whole fleet today, which is TD-007's gap, not this surface's fault.
    const dirCheckable = existsSync(base);
    row.stale = dirCheckable ? extras.filter((n) => !existsSync(path.join(base, n))) : [];
    row.unregistered = dirCheckable ? extras.filter((n) => existsSync(path.join(base, n))) : extras;
    row.absent = surface.expectation === 'complete'
      ? fleet.apps.map((a) => a.app).filter((a) => !onSurface.has(normName(a)))
      : [];
    row.status = row.stale.length || row.absent.length ? 'drift' : 'ok';
    results.push(row);
  }
  return { fleet, results };
}

/** The generated view: registered repos + which surfaces enumerate them, extras alongside. */
export function buildManifest(coreRoot) {
  const { fleet, results } = reconcile(coreRoot);
  const bySurface = new Map();
  for (const r of results) {
    if (r.count === undefined) continue;
    bySurface.set(r.id, new Set());
  }
  for (const surface of SURFACES) {
    if (!bySurface.has(surface.id)) continue;
    const names = surfaceNames(surface, coreRoot) || [];
    for (const n of names) bySurface.get(surface.id).add(normName(n));
  }
  const unregistered = new Map();
  for (const r of results) {
    for (const extra of [...(r.unregistered || []), ...(r.stale || [])]) {
      const key = normName(extra);
      if (!unregistered.has(key)) {
        unregistered.set(key, { name: extra, stale: (r.stale || []).includes(extra), surfaces: [] });
      }
      unregistered.get(key).surfaces.push(r.id);
    }
  }
  return {
    generated_from: 'decisions/northstar/README.md frontmatter (registry:)',
    generator: 'scripts/fleet-manifest.mjs',
    note: 'Generated view — edit the registry, not this file. Shadow (S1): caches not yet derived from it.',
    repos: fleet.apps.map((a) => ({
      app: a.app,
      slug: a.slug,
      tier: a.tier,
      surfaces: [...bySurface.entries()].filter(([, set]) => set.has(normName(a.app))).map(([id]) => id),
    })),
    unregistered: [...unregistered.values()],
  };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const check = args.includes('--check');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  const { fleet, results } = reconcile(coreRoot);
  const drift = results.filter((r) => r.status === 'drift');

  if (outPath) writeFileSync(outPath, JSON.stringify(buildManifest(coreRoot), null, 2) + '\n');

  if (asJson) {
    console.log(JSON.stringify({ registered: fleet.apps.length, results }, null, 2));
  } else {
    console.log(`fleet-manifest (shadow): ${fleet.apps.length} registered apps; ${results.length} surfaces`);
    for (const r of results) {
      const bits = [];
      if (r.count !== undefined) bits.push(`${r.count} names`);
      if (r.stale?.length) bits.push(`STALE (no such dir): ${r.stale.join(', ')}`);
      if (r.absent?.length) bits.push(`registered-but-absent: ${r.absent.join(', ')}`);
      if (r.unregistered?.length) bits.push(`unregistered (info): ${r.unregistered.length}`);
      console.log(`  [${r.status.toUpperCase().padEnd(11)}] ${r.label}${bits.length ? ' — ' + bits.join(' | ') : ''}`);
    }
    console.log(drift.length ? `DRIFT on ${drift.length} surface(s) — shadow mode, exit 0` : 'no drift');
  }
  if (check && drift.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
