import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildD5, renderSection, NODE_BUDGET } from '../fleet-map-d5.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, 'fixtures', 'fleet-map-d5.golden.md');

/** A tiny core on disk with just the registry the generator reads. */
function scaffold() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'fleet-map-d5-'));
  mkdirSync(path.join(tmp, 'decisions', 'northstar'), { recursive: true });
  return tmp;
}

function writeRegistry(core, entries) {
  const lines = ['---', 'registry:'];
  for (const e of entries) {
    lines.push(`  - slug: ${e.slug}`);
    lines.push(`    tier: ${e.tier}`);
    if (e.app) lines.push(`    app: ${e.app}`);
    lines.push(`    path: ${e.path || 'decisions/northstar/x.md'}`);
    lines.push(`    ladders_up_to: ${e.ladders_up_to ?? 'null'}`);
  }
  lines.push('---', '', '# Northstar registry (fixture)');
  writeFileSync(path.join(core, 'decisions', 'northstar', 'README.md'), lines.join('\n'));
}

/** The fixture fleet: two clusters fully populated, one partially, one absent entirely. */
const FIXTURE = [
  { slug: 'l3-shared', tier: 'L3', ladders_up_to: null },
  { slug: 'l2-ojfbot', tier: 'L2', ladders_up_to: 'l3-shared' },
  { slug: 'l1-core', tier: 'L1', app: 'core', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-shell', tier: 'L1', app: 'shell', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-morning-cockpit', tier: 'L1', app: 'morning-cockpit', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-switchboard', tier: 'L1', app: 'switchboard', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-cv-builder', tier: 'L1', app: 'cv-builder', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-blogengine', tier: 'L1', app: 'blogengine', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-f1-substrate', tier: 'L1', app: 'f1-substrate', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-f1-pit-wall', tier: 'L1', app: 'f1-pit-wall', ladders_up_to: 'l2-ojfbot' },
  { slug: 'buddy-check', tier: 'L1', app: 'buddy-check', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-dive-briefing', tier: 'L1', app: 'dive-briefing', ladders_up_to: 'l2-ojfbot' },
  { slug: 'l1-fieldwork-1', tier: 'L1', app: 'fieldwork-1', ladders_up_to: 'l2-ojfbot' },
];

let core;
beforeEach(() => {
  core = scaffold();
});
afterEach(() => {
  rmSync(core, { recursive: true, force: true });
});

describe('buildD5', () => {
  it('renders the golden section from a registry fixture', () => {
    writeRegistry(core, FIXTURE);
    const built = buildD5(core, { today: '2026-01-01' });
    expect(built.warnings).toEqual([]);
    expect(renderSection(built)).toBe(readFileSync(GOLDEN, 'utf8'));
  });

  it('draws every registered L1 exactly once — clusters partition the registry', () => {
    writeRegistry(core, FIXTURE);
    const { mermaid, stats } = buildD5(core, { today: '2026-01-01' });
    const l1s = FIXTURE.filter((e) => e.tier === 'L1').map((e) => e.slug.replace(/^l1-/, ''));
    for (const name of l1s) {
      expect(mermaid.split(name).length - 1, `${name} drawn once`).toBe(1);
    }
    expect(stats.l1).toBe(l1s.length);
  });

  it('renders dark-native and self-titled per diagram-conventions', () => {
    writeRegistry(core, FIXTURE);
    const { mermaid } = buildD5(core, { today: '2026-01-01' });
    expect(mermaid).toMatch(/^---\ntitle: .+\nconfig:\n {2}theme: dark\n---\nflowchart BT\n/);
    // Plain-text labels only; <br/> is the one permitted tag.
    expect(mermaid.replace(/<br\/>/g, '')).not.toMatch(/<[a-z]/i);
  });

  it('surfaces an unclustered registration instead of dropping it', () => {
    writeRegistry(core, [...FIXTURE, { slug: 'l1-brand-new', tier: 'L1', app: 'brand-new', ladders_up_to: 'l2-ojfbot' }]);
    const { mermaid, stats, warnings, caption } = buildD5(core, { today: '2026-01-01' });
    expect(stats.unclustered).toEqual(['l1-brand-new']);
    expect(mermaid).toContain('UNCLUSTERED["Unclustered<br/>brand-new"]');
    expect(mermaid).toContain('UNCLUSTERED -- "ladders up to" --> L2OJFBOT');
    expect(warnings.join('\n')).toContain('l1-brand-new');
    expect(caption).toContain('l1-brand-new');
  });

  it('draws l2-selfco dashed and names it as a non-registry node', () => {
    writeRegistry(core, FIXTURE);
    const { mermaid, caption } = buildD5(core, { today: '2026-01-01' });
    expect(mermaid).toContain('L2SELFCO -.-> L3SHARED');
    expect(caption).toContain('not a registry entry');
  });

  it('warns when a trailing registry comment corrupts a slug rather than sanitizing it', () => {
    const core2 = scaffold();
    writeFileSync(
      path.join(core2, 'decisions', 'northstar', 'README.md'),
      ['---', 'registry:', '  - slug: l1-core   # NB: a trailing comment', '    tier: L1', '---'].join('\n'),
    );
    const { warnings } = buildD5(core2, { today: '2026-01-01' });
    expect(warnings.join('\n')).toContain('trailing comment glued to its slug');
    rmSync(core2, { recursive: true, force: true });
  });

  it('warns when the diagram exceeds the comprehension budget', () => {
    writeRegistry(core, FIXTURE);
    const clusters = Array.from({ length: NODE_BUDGET }, (_, i) => ({
      key: `c${i}`,
      label: `Cluster ${i}`,
      members: ['l1-core'],
    }));
    const { warnings } = buildD5(core, { today: '2026-01-01', clusters });
    expect(warnings.join('\n')).toContain('node budget exceeded');
  });
});
