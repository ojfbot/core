#!/usr/bin/env node
/**
 * resolve-anchor.mjs — deterministic substrate answers for /wayfinder.
 *
 * The SKILL mandates that a northstar anchor "resolve-or-fail" and that charting
 * degrades to lite mode off-fleet. Both are facts, not judgment, so they live here
 * (house pattern: deepen/scripts/measure-depth.mjs, adopt-stack/scripts/measure-pkg.mjs).
 *
 *   --detect                  → { mode, core_root, reason, registry_entries }
 *   --anchor=ns:<slug>#P<n>   → { ok, anchor, ... } ; exit 1 with a reason when it doesn't resolve
 *   --json                    → machine output (default is human-readable)
 *
 * Imports the registry parser rather than reimplementing it: the registry is markdown
 * frontmatter under a constrained schema, and northstar-fm.mjs's LIST_KEYS-gated parse
 * is the only safe reader of it.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadAll, buildPropertyIndex } from '../../../../scripts/lib/northstar-fm.mjs';

const REGISTRY_REL = path.join('decisions', 'northstar', 'README.md');

/**
 * Find the core checkout from a starting directory.
 *
 * Two shapes are walked at every ancestor, which covers both vantages that matter:
 *   <anc>/decisions/northstar/README.md        → cwd is core itself, or below it
 *   <anc>/core/decisions/northstar/README.md   → cwd is a sibling repo (anc = ~/ojfbot)
 *
 * Presence of the registry file is the signal — never a path prefix. A checkout moved
 * out of ~/ojfbot still charts in full mode; a scratch dir named "ojfbot" does not.
 */
export function findCoreRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, REGISTRY_REL))) return dir;
    const sibling = path.join(dir, 'core');
    if (existsSync(path.join(sibling, REGISTRY_REL))) return sibling;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Mode is decided by substrate *resolvability*, not location: a core root whose registry
 * parses and is non-empty. A registry that parses to zero entries is lite — charting
 * against an empty registry would let every anchor fail for the wrong reason.
 *
 * Registered-but-absent northstar files are deliberately NOT fatal here. northstar-lint.mjs
 * downgrades those to vantage WARNs (`_unreachable`) because a sibling checkout missing from
 * this working copy is a vantage artifact, not a registry lie. Full mode still applies; only
 * anchors that actually point into an absent file fail, and they fail individually.
 */
export function detect(cwd = process.cwd()) {
  const coreRoot = findCoreRoot(cwd);
  if (!coreRoot) {
    return { mode: 'lite', core_root: null, registry_entries: 0, reason: `no ${REGISTRY_REL} found in any ancestor of ${cwd} (or an ancestor's core/)` };
  }
  const { error, entries } = loadAll(coreRoot);
  if (error) return { mode: 'lite', core_root: coreRoot, registry_entries: 0, reason: error };
  if (!entries.length) {
    return { mode: 'lite', core_root: coreRoot, registry_entries: 0, reason: `registry at ${path.join(coreRoot, REGISTRY_REL)} parsed but is empty` };
  }
  return { mode: 'full', core_root: coreRoot, registry_entries: entries.length, reason: `registry resolves with ${entries.length} entries` };
}

const ANCHOR_RE = /^ns:([A-Za-z0-9._-]+)#(P\d+)$/;

/**
 * northstar-fm.mjs's `scalar()` does not strip YAML inline comments, so a registry entry
 * written as `slug: buddy-check   # NB: …` parses with the comment glued on (91 chars).
 * The lint never noticed because it resolves entries by `path`, not by slug — this is the
 * first slug-keyed consumer.
 *
 * Fixing it in the shared parser would need quote-aware stripping: the roadmap corpus has
 * legitimate quoted values containing " #" (roadmap-l2-ojfbot.md:301
 * `title: "Calibrate judge #1 — …"`, plus entrance/deliverable prose citing `PR #165`), and a
 * naive strip would silently truncate them and break an operational CI gate. So the repair is
 * scoped to slug comparison, where it is unambiguously safe: slugs are kebab-case identifiers
 * (ADR-0087) that can never legitimately contain " #".
 *
 * Filed as a defect rather than fixed here — see decisions/defects/.
 */
function slugOf(entry) {
  return String(entry.slug ?? '').split(/\s+#/)[0].trim();
}

/**
 * Resolve `ns:<slug>#P<n>`. Slugs are immutable identity (ADR-0087) — matched verbatim,
 * never case-folded or prefix-normalized. `buddy-check` is registered without the `l1-`
 * prefix and `l1-virtuallight` is lowercase while its directory is `virtualLight`;
 * normalizing either would resolve the wrong northstar or none at all.
 */
export function resolveAnchor(anchor, cwd = process.cwd()) {
  const m = ANCHOR_RE.exec(anchor || '');
  if (!m) return { ok: false, anchor, reason: `malformed anchor ${JSON.stringify(anchor)} — expected ns:<slug>#P<n>` };
  const [, slug, propId] = m;

  const det = detect(cwd);
  if (det.mode !== 'full') return { ok: false, anchor, reason: `no fleet substrate: ${det.reason}`, mode: det.mode };

  const { entries, northstars } = loadAll(det.core_root);
  const entry = entries.find((e) => slugOf(e) === slug);
  if (!entry) {
    return { ok: false, anchor, reason: `northstar slug ${JSON.stringify(slug)} is not in the registry`, known_slugs: entries.map(slugOf) };
  }

  const ns = northstars.find((n) => slugOf(n) === slug);
  if (ns && ns._missing) {
    const why = ns._unreachable
      ? `its repo root ${ns._repoRoot} is absent from this working copy (vantage, not a registry error)`
      : `its file ${ns._abs} is missing`;
    return { ok: false, anchor, reason: `northstar ${slug} is registered but unreadable — ${why}`, unreachable: Boolean(ns._unreachable) };
  }

  const hit = buildPropertyIndex(northstars).get(anchor);
  if (!hit) {
    const available = (ns?.properties || []).map((p) => p.id);
    return { ok: false, anchor, reason: `${slug} has no property ${propId}`, available_properties: available };
  }

  const { property, northstar } = hit;
  return {
    ok: true,
    anchor,
    slug,
    property_id: property.id,
    name: property.name ?? null,
    target: property.target ?? null,
    current: property.current ?? null,
    ladders_up_to: property.ladders_up_to ?? null,
    tier: northstar.tier ?? null,
    northstar_path: northstar._abs ?? null,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const json = args.includes('--json');
const anchorArg = args.find((a) => a.startsWith('--anchor='));

if (args.includes('--help') || (!anchorArg && !args.includes('--detect'))) {
  console.log(`resolve-anchor.mjs — substrate resolution for /wayfinder

  --detect                   report full|lite mode for the current directory
  --anchor=ns:<slug>#P<n>    resolve a northstar anchor (exit 1 if it doesn't)
  --json                     machine-readable output`);
  process.exit(args.includes('--help') ? 0 : 2);
}

if (anchorArg) {
  const res = resolveAnchor(anchorArg.slice('--anchor='.length));
  if (json) console.log(JSON.stringify(res, null, 2));
  else if (res.ok) {
    console.log(`OK  ${res.anchor} → ${res.name ?? '(unnamed)'}  [${res.tier ?? '?'}] current=${res.current ?? '?'} target=${res.target ?? '?'}`);
    if (res.ladders_up_to) console.log(`    ladders up to ${res.ladders_up_to}`);
  } else {
    console.error(`FAIL  ${res.anchor}: ${res.reason}`);
    if (res.available_properties?.length) console.error(`      available: ${res.available_properties.join(', ')}`);
  }
  process.exit(res.ok ? 0 : 1);
}

const det = detect();
if (json) console.log(JSON.stringify(det, null, 2));
else {
  console.log(`mode: ${det.mode}`);
  console.log(`core: ${det.core_root ?? '(none)'}`);
  console.log(`why:  ${det.reason}`);
}
process.exit(0);
