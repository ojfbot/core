/**
 * fleet-map-d5.mjs — regenerate D5 ("the constellation at altitude") from the northstar registry.
 *
 * D5 was hand-authored on 2026-08-08 into the standing vault file `~/selfco/diagrams/fleet-map.md`.
 * Hand-authored altitude diagrams go stale the moment a northstar is registered, so D5 becomes
 * generated: `registry -> mermaid source -> dark-native render`. D6-D8 stay authored (they model
 * process and bonds, not the registry's contents).
 *
 * Three things this module deliberately does NOT do:
 *
 * 1. **It does not invent a cluster tier.** `ns:cluster-<name>` is DESIGNED-NOT-BUILT (RFQ-004,
 *    blocking wayfinder #341). The groupings below are *presentation* clusters: a legibility
 *    device for the diagram only, with no schema, no ladder semantics, and no authority over the
 *    registry. When the cluster tier lands, this constant is deleted and the grouping is read
 *    from the registry instead.
 * 2. **It does not silently drop registry entries.** Any registered L1 not named in a cluster
 *    lands in an explicit `Unclustered` node and is reported in `warnings`. A newly registered
 *    northstar shows up as a visible gap, never as an absence.
 * 3. **It does not render light.** The fence carries `config.theme: dark` so every renderer
 *    (Obsidian, GitHub, Artifacts, the cockpit's Canon pane) draws it dark-native. Shipping a
 *    light render into a dark surface was a named defect of the navigator prototype (vol.3).
 *
 * Conventions: `domain-knowledge/diagram-conventions.md` (embedded title, prose caption before
 * the fence, <=15 nodes, plain-text labels, `<br/>` the one permitted tag, append-don't-rewrite).
 */
import { loadRegistry } from './northstar-fm.mjs';

/** Max nodes per diagram — the comprehension budget from diagram-conventions.md. */
export const NODE_BUDGET = 15;

/**
 * Presentation clusters. Order is render order (masonry left-to-right in the cockpit's Tiers
 * mode, top-to-bottom here). `key` matches the cockpit's cluster hue keys so the two surfaces
 * name the same groups. A cluster with no registered members is simply not drawn — e.g. the
 * cockpit's `corpus` hue (bldgblog-corpus) has no northstar yet, so it has no node here.
 */
export const PRESENTATION_CLUSTERS = [
  { key: 'spine', label: 'Platform spine', members: ['l1-core', 'l1-shell', 'l1-morning-cockpit', 'l1-switchboard'] },
  { key: 'frame', label: 'Frame apps', members: ['l1-cv-builder', 'l1-blogengine'] },
  { key: 'f1', label: 'F1 stack', members: ['l1-f1-substrate', 'l1-f1-pit-wall', 'l1-f1-press-room', 'l1-f1-doctrine'] },
  { key: 'golf', label: 'Golf-geo cluster', members: ['l1-mirrorworld', 'l1-fairway', 'l1-capture-agent'] },
  { key: 'dive', label: 'Dive pair', members: ['buddy-check', 'l1-dive-briefing'] },
  { key: 'story', label: 'Story worlds', members: ['l1-silicon-empires', 'l1-virtuallight'] },
  { key: 'client', label: 'Client fieldwork', members: ['l1-fieldwork-1'] },
];

/**
 * Nodes that are real but are NOT registry entries, drawn dashed and disclosed in the caption.
 * `l2-selfco` is declared-but-deferred: it is owned by the vault (`~/selfco/tracking/`) and
 * referenced by core, so it never appears in `decisions/northstar/README.md`. Drawing it solid
 * would claim a registration that does not exist; omitting it would hide the fleet's second L2.
 */
export const DEFERRED_NODES = [
  { id: 'L2SELFCO', label: 'l2-selfco<br/>deferred - lives in vault tracking/', laddersUpTo: 'l3-shared' },
];

/** Mermaid node ids must be identifier-safe; slugs carry hyphens. */
function nodeId(slug) {
  return String(slug).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Strip the `l1-`/`l2-`/`l3-` tier prefix for terse in-node labels. */
function shortName(slug) {
  return String(slug).replace(/^l[123]-/, '');
}

/**
 * Build D5 from the registry.
 *
 * @param {string} coreRoot - repo root containing `decisions/`.
 * @param {object} [opts]
 * @param {string} [opts.today] - ISO date stamped into the title (injected so output is testable).
 * @param {Array}  [opts.clusters] - override the presentation clusters (tests).
 * @param {Array}  [opts.deferred] - override the deferred non-registry nodes (tests).
 * @returns {{mermaid: string, caption: string, stats: object, warnings: string[]}}
 */
export function buildD5(coreRoot, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const clusters = opts.clusters || PRESENTATION_CLUSTERS;
  const deferred = opts.deferred || DEFERRED_NODES;

  const { entries, error } = loadRegistry(coreRoot);
  const warnings = [];
  if (error) warnings.push(error);

  // A slug carrying a `#` means the registry line had a trailing comment: the frontmatter parser
  // cannot strip those (values legitimately contain `#`, e.g. `ns:l2-ojfbot#P2`), so the comment
  // is glued to the value. Report it rather than sanitizing — the fix belongs in the registry.
  for (const e of entries) {
    if (typeof e.slug === 'string' && e.slug.includes('#')) {
      warnings.push(`registry entry has a trailing comment glued to its slug: ${JSON.stringify(e.slug)}`);
    }
    if (typeof e.tier === 'string' && e.tier.includes('#')) {
      warnings.push(`registry entry has a trailing comment glued to its tier: ${JSON.stringify(e.tier)}`);
    }
  }

  const l3 = entries.filter((e) => e.tier === 'L3');
  const l2 = entries.filter((e) => e.tier === 'L2');
  const l1 = entries.filter((e) => e.tier === 'L1');
  const bySlug = new Map(l1.map((e) => [e.slug, e]));

  const drawn = [];
  const claimed = new Set();
  for (const c of clusters) {
    const present = c.members.filter((m) => bySlug.has(m));
    if (present.length === 0) continue;
    present.forEach((m) => claimed.add(m));
    const parents = [...new Set(present.map((m) => bySlug.get(m).ladders_up_to).filter(Boolean))];
    if (parents.length > 1) {
      warnings.push(`cluster '${c.key}' spans more than one parent (${parents.join(', ')}); drawn to '${parents[0]}'`);
    }
    drawn.push({ id: nodeId(c.key), label: c.label, members: present, parent: parents[0] || null });
  }

  const unclustered = l1.filter((e) => !claimed.has(e.slug));
  if (unclustered.length > 0) {
    warnings.push(
      `${unclustered.length} registered L1 not in any presentation cluster: ${unclustered.map((e) => e.slug).join(', ')}`,
    );
    const parents = [...new Set(unclustered.map((e) => e.ladders_up_to).filter(Boolean))];
    drawn.push({
      id: 'UNCLUSTERED',
      label: 'Unclustered',
      members: unclustered.map((e) => e.slug),
      parent: parents[0] || null,
    });
  }

  const nodeCount = l3.length + l2.length + drawn.length + deferred.length;
  if (nodeCount > NODE_BUDGET) {
    warnings.push(`node budget exceeded: ${nodeCount} nodes (budget ${NODE_BUDGET}) — split the diagram`);
  }

  const lines = [];
  lines.push('---');
  lines.push(`title: The constellation at altitude (registry read ${today})`);
  lines.push('config:');
  lines.push('  theme: dark');
  lines.push('---');
  lines.push('flowchart BT');

  for (const e of l3) {
    lines.push(`  ${nodeId(e.slug)}["L3 apex<br/>${e.slug}"]`);
  }
  for (const e of l2) {
    const kids = l1.filter((x) => x.ladders_up_to === e.slug).length;
    lines.push(`  ${nodeId(e.slug)}["${e.slug}<br/>${kids} L1 ladder here"]`);
  }
  for (const d of deferred) {
    lines.push(`  ${d.id}["${d.label}"]`);
  }
  for (const c of drawn) {
    lines.push(`  ${c.id}["${c.label}<br/>${c.members.map(shortName).join(' / ')}"]`);
  }
  for (const c of drawn) {
    if (c.parent) lines.push(`  ${c.id} -- "ladders up to" --> ${nodeId(c.parent)}`);
  }
  for (const e of l2) {
    if (e.ladders_up_to) lines.push(`  ${nodeId(e.slug)} -- "ladders up to" --> ${nodeId(e.ladders_up_to)}`);
  }
  for (const d of deferred) {
    if (d.laddersUpTo) lines.push(`  ${d.id} -.-> ${nodeId(d.laddersUpTo)}`);
  }

  const stats = {
    today,
    northstars: entries.length,
    l1: l1.length,
    clusters: drawn.length,
    unclustered: unclustered.map((e) => e.slug),
    deferred: deferred.map((d) => d.id),
    nodes: nodeCount,
  };

  const caption =
    `**Caption (D5):** Generated from \`decisions/northstar/README.md\` on ${today} — ` +
    `${stats.l1} L1 northstars in ${drawn.length} presentation clusters ladder into their L2, then the ` +
    `L3 apex. Presentation clusters are a legibility device with no schema behind them; the registry's ` +
    `unit is the individual northstar, and the cluster *tier* is still designed-not-built (RFQ-004, ` +
    `wayfinder #341). Dashed \`l2-selfco\` is declared-but-deferred and is not a registry entry — it is ` +
    `owned by the vault (\`tracking/\`) and referenced by core.` +
    (unclustered.length > 0
      ? ` **${unclustered.length} registered L1 fall outside every cluster** (${unclustered
          .map((e) => e.slug)
          .join(', ')}) and are drawn as \`Unclustered\` — a registration the diagram has not been taught yet.`
      : '');

  return { mermaid: lines.join('\n'), caption, stats, warnings };
}

/**
 * Render the appendable markdown section. The standing file's update discipline is APPEND —
 * new diagrams are added with a dated heading; corrections edit in place with a dated note.
 */
export function renderSection(built) {
  const { mermaid, caption, stats } = built;
  return [
    `## ${stats.today} · D5 regenerated from the registry`,
    '',
    `Generated by \`core/scripts/fleet-map-d5.mjs\` from \`decisions/northstar/README.md\` ` +
      `(${stats.northstars} registry entries, ${stats.l1} L1). Supersedes any earlier D5 in this file; ` +
      `D6–D8 stay authored. D5 is now the one generated diagram here — re-run the generator rather ` +
      `than editing the fence by hand.`,
    '',
    caption,
    '',
    '```mermaid',
    mermaid,
    '```',
    '',
  ].join('\n');
}
