/**
 * northstar-fm.mjs — shared loaders for the three-tier northstar system.
 *
 * Self-contained: parses the constrained northstar/registry frontmatter with no YAML
 * dependency, so the consuming scripts (northstar-lint.mjs, frame-standup's
 * read-northstar.mjs, a future northstar-rollup.mjs) run in any repo with just `node`.
 *
 * The frontmatter schema is regular (top-level scalars + one list-of-maps under
 * `properties:` or `registry:`), which is what makes the dependency-free parse safe.
 */
import { readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIST_KEYS = new Set(['properties', 'registry', 'roadmaps', 'phases', 'slices']);

function scalar(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

/** Parse a `---`-delimited frontmatter block into an object. Returns null if absent. */
export function parseFM(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const root = {};
  let list = null;   // the array currently being filled
  let cur = null;    // the current item map within that array
  for (const rawLine of m[1].split('\n')) {
    if (!rawLine.trim() || /^\s*#/.test(rawLine)) continue; // blank or comment
    const indent = (rawLine.match(/^\s*/) || [''])[0].length;
    const line = rawLine.trim();
    const itemMatch = /^-\s*(.*)$/.exec(line);
    if (indent === 0) {
      list = null; cur = null;
      const kv = /^([\w-]+):\s*(.*)$/.exec(line);
      if (!kv) continue;
      const [, k, v] = kv;
      if (v === '' && LIST_KEYS.has(k)) { root[k] = []; list = root[k]; }
      else root[k] = scalar(v);
    } else if (itemMatch && list) {
      cur = {};
      list.push(cur);
      const kv = /^([\w-]+):\s*(.*)$/.exec(itemMatch[1]);
      if (kv) cur[kv[1]] = scalar(kv[2]);
    } else if (cur) {
      const kv = /^([\w-]+):\s*(.*)$/.exec(line);
      if (kv) cur[kv[1]] = scalar(kv[2]);
    }
  }
  return root;
}

/** Resolve a registry path (core-root-relative, ~-prefixed, or absolute) to an absolute path. */
export function resolvePath(p, coreRoot) {
  if (!p) return null;
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1).replace(/^\//, ''));
  if (path.isAbsolute(p)) return p;
  return path.resolve(coreRoot, p);
}

/** Read the registry from <coreRoot>/decisions/northstar/README.md. */
export function loadRegistry(coreRoot) {
  const readme = path.join(coreRoot, 'decisions', 'northstar', 'README.md');
  if (!existsSync(readme)) return { error: `registry not found at ${readme}`, entries: [] };
  const fm = parseFM(readFileSync(readme, 'utf8'));
  return { entries: (fm && fm.registry) || [] };
}

/** Load one northstar file; returns the parsed object with _path/_abs, or a _missing marker. */
export function loadNorthstar(entry, coreRoot) {
  const abs = resolvePath(entry.path, coreRoot);
  if (!abs || !existsSync(abs)) {
    return { slug: entry.slug, tier: entry.tier, _path: entry.path, _abs: abs, _missing: true };
  }
  const fm = parseFM(readFileSync(abs, 'utf8')) || {};
  return { ...fm, _path: entry.path, _abs: abs };
}

/** Load every northstar named in the registry. */
export function loadAll(coreRoot) {
  const { entries, error } = loadRegistry(coreRoot);
  return { error, entries, northstars: entries.map((e) => loadNorthstar(e, coreRoot)) };
}

/** Build an index of "ns:<slug>#P<id>" → { property, northstar } across all loaded northstars. */
export function buildPropertyIndex(northstars) {
  const idx = new Map();
  for (const ns of northstars) {
    if (ns._missing || !Array.isArray(ns.properties)) continue;
    for (const p of ns.properties) {
      idx.set(`ns:${ns.slug}#${p.id}`, { property: p, northstar: ns });
    }
  }
  return idx;
}

// ── Roadmaps (roadmap-schema.md) ────────────────────────────────────────────
// Same constrained-frontmatter regime as northstars; the registry is the
// `roadmaps:` list in the SAME README.md frontmatter block as `registry:`.

/** Read the roadmap registry from <coreRoot>/decisions/northstar/README.md. */
export function loadRoadmapRegistry(coreRoot) {
  const readme = path.join(coreRoot, 'decisions', 'northstar', 'README.md');
  if (!existsSync(readme)) return { error: `registry not found at ${readme}`, entries: [] };
  const fm = parseFM(readFileSync(readme, 'utf8'));
  return { entries: (fm && fm.roadmaps) || [] };
}

/** Load one roadmap file; returns the parsed object with _path/_abs, or a _missing marker. */
export function loadRoadmap(entry, coreRoot) {
  const abs = resolvePath(entry.path, coreRoot);
  if (!abs || !existsSync(abs)) {
    return { slug: entry.slug, northstar: entry.northstar, _path: entry.path, _abs: abs, _missing: true };
  }
  const fm = parseFM(readFileSync(abs, 'utf8')) || {};
  return { ...fm, _path: entry.path, _abs: abs };
}

/** Load every roadmap named in the registry. */
export function loadAllRoadmaps(coreRoot) {
  const { entries, error } = loadRoadmapRegistry(coreRoot);
  return { error, entries, roadmaps: entries.map((e) => loadRoadmap(e, coreRoot)) };
}

/** Build an index of "rm:<slug>#S<id>" → { slice, roadmap } across all loaded roadmaps. */
export function buildSliceIndex(roadmaps) {
  const idx = new Map();
  for (const rm of roadmaps) {
    if (rm._missing || !Array.isArray(rm.slices)) continue;
    for (const s of rm.slices) {
      idx.set(`rm:${rm.slug}#${s.id}`, { slice: s, roadmap: rm });
    }
  }
  return idx;
}
