/**
 * A4 adoption tests — formula parser, molecule compiler, checkpoint + crash recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTOMLFormula, parseFormulaFromString } from '../formula-parser.js';
import { compileMoleculeToGraph, resumeMolecule, checkpointMoleculeStep } from '../molecule-compiler.js';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import type { FrameBead } from '../types/bead.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_PUBLISH_TOML = path.resolve(__dirname, '../../../../formulas/blog-publish.toml');

let tmpDir: string;
let store: FilesystemBeadStore;

function makeMoleculeBead(id: string, formulaName: string): FrameBead {
  const now = new Date().toISOString();
  return {
    id,
    type: 'molecule',
    status: 'live',
    title: `Molecule: ${formulaName}`,
    body: '',
    labels: { formula: formulaName },
    actor: 'system',
    refs: [],
    created_at: now,
    updated_at: now,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'molecule-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── parseFormulaFromString ───────────────────────────────────────────────────

describe('parseFormulaFromString', () => {
  const MINIMAL_TOML = `
formula = "test-workflow"
type = "workflow"
version = 1

[[steps]]
id = "step-a"
title = "Do A"
needs = []

[[steps]]
id = "step-b"
title = "Do B"
needs = ["step-a"]
`.trim();

  it('parses a minimal valid formula', () => {
    const f = parseFormulaFromString(MINIMAL_TOML);
    expect(f.formula).toBe('test-workflow');
    expect(f.type).toBe('workflow');
    expect(f.version).toBe(1);
    expect(f.steps).toHaveLength(2);
  });

  it('parses step dependencies', () => {
    const f = parseFormulaFromString(MINIMAL_TOML);
    expect(f.steps[0].needs).toEqual([]);
    expect(f.steps[1].needs).toEqual(['step-a']);
  });

  it('parses vars section', () => {
    const toml = `
formula = "with-vars"
type = "workflow"
version = 1

[vars.topic]
description = "The topic"
required = true

[[steps]]
id = "do-it"
title = "Do it"
needs = []
`.trim();
    const f = parseFormulaFromString(toml);
    expect(f.vars?.['topic']?.description).toBe('The topic');
    expect(f.vars?.['topic']?.required).toBe(true);
  });

  it('parses acceptance_criteria on steps', () => {
    const toml = `
formula = "with-ac"
type = "workflow"
version = 1

[[steps]]
id = "step-one"
title = "Step one"
needs = []
acceptance_criteria = ["criterion A", "criterion B"]
`.trim();
    const f = parseFormulaFromString(toml);
    expect(f.steps[0].acceptance_criteria).toEqual(['criterion A', 'criterion B']);
  });

  it('throws on missing formula field', () => {
    expect(() =>
      parseFormulaFromString('type = "workflow"\nversion = 1\n[[steps]]\nid="x"\ntitle="X"\nneeds=[]')
    ).toThrow('missing required string field "formula"');
  });

  it('throws on invalid type', () => {
    expect(() =>
      parseFormulaFromString('formula="x"\ntype="invalid"\nversion=1\n[[steps]]\nid="x"\ntitle="X"\nneeds=[]')
    ).toThrow('"type" must be one of');
  });

  it('throws on duplicate step IDs', () => {
    const toml = `
formula = "dup"
type = "workflow"
version = 1

[[steps]]
id = "a"
title = "A"
needs = []

[[steps]]
id = "a"
title = "A again"
needs = []
`.trim();
    expect(() => parseFormulaFromString(toml)).toThrow('duplicate step id "a"');
  });

  it('throws on unknown dependency', () => {
    const toml = `
formula = "bad-dep"
type = "workflow"
version = 1

[[steps]]
id = "b"
title = "B"
needs = ["nonexistent"]
`.trim();
    expect(() => parseFormulaFromString(toml)).toThrow('unknown dependency "nonexistent"');
  });
});

// ── parseTOMLFormula (disk) ──────────────────────────────────────────────────

describe('parseTOMLFormula', () => {
  it('parses the blog-publish formula from disk', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    expect(f.formula).toBe('blog-publish');
    expect(f.type).toBe('workflow');
    expect(f.steps).toHaveLength(5);
  });

  it('blog-publish has correct step IDs', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const ids = f.steps.map((s) => s.id);
    expect(ids).toEqual(['research', 'outline', 'draft', 'edit', 'publish']);
  });

  it('blog-publish has sequential dependency chain', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    expect(f.steps[0].needs).toEqual([]);            // research: no deps
    expect(f.steps[1].needs).toEqual(['research']);   // outline
    expect(f.steps[2].needs).toEqual(['outline']);    // draft
    expect(f.steps[3].needs).toEqual(['draft']);      // edit
    expect(f.steps[4].needs).toEqual(['edit']);       // publish
  });

  it('throws on a non-existent file', async () => {
    await expect(parseTOMLFormula('/no/such/file.toml')).rejects.toThrow();
  });
});

// ── compileMoleculeToGraph ───────────────────────────────────────────────────

describe('compileMoleculeToGraph', () => {
  it('entry steps are those with no dependencies', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    expect(g.entrySteps).toEqual(['research']);
  });

  it('terminal steps are those nothing else depends on', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    expect(g.terminalSteps).toEqual(['publish']);
  });

  it('edges match the needs relationships', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    expect(g.edges).toEqual([
      ['research', 'outline'],
      ['outline',  'draft'],
      ['draft',    'edit'],
      ['edit',     'publish'],
    ]);
  });

  it('unblocks is the reverse of needs', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    const research = g.nodes.find((n) => n.stepId === 'research')!;
    expect(research.unblocks).toEqual(['outline']);
    const publish = g.nodes.find((n) => n.stepId === 'publish')!;
    expect(publish.unblocks).toEqual([]);
  });

  it('parallel entry steps — formula with two independent entry nodes', () => {
    const toml = `
formula = "parallel-start"
type = "workflow"
version = 1

[[steps]]
id = "fetch-a"
title = "Fetch A"
needs = []

[[steps]]
id = "fetch-b"
title = "Fetch B"
needs = []

[[steps]]
id = "merge"
title = "Merge results"
needs = ["fetch-a", "fetch-b"]
`.trim();
    const f = parseFormulaFromString(toml);
    const g = compileMoleculeToGraph(f);
    expect(g.entrySteps.sort()).toEqual(['fetch-a', 'fetch-b']);
    expect(g.terminalSteps).toEqual(['merge']);
    expect(g.edges.sort()).toEqual([['fetch-a', 'merge'], ['fetch-b', 'merge']].sort());
  });
});

// ── resumeMolecule (crash recovery) ──────────────────────────────────────────

describe('resumeMolecule', () => {
  it('returns all entry steps when nothing is done yet', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    const next = resumeMolecule(g, []);
    expect(next).toEqual(['research']);
  });

  it('returns the next step after first step completes', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    expect(resumeMolecule(g, ['research'])).toEqual(['outline']);
    expect(resumeMolecule(g, ['research', 'outline'])).toEqual(['draft']);
    expect(resumeMolecule(g, ['research', 'outline', 'draft'])).toEqual(['edit']);
    expect(resumeMolecule(g, ['research', 'outline', 'draft', 'edit'])).toEqual(['publish']);
  });

  it('returns empty array when all steps are done', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    const all = f.steps.map((s) => s.id);
    expect(resumeMolecule(g, all)).toEqual([]);
  });

  it('crash recovery: mid-chain resume returns correct step', async () => {
    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    // Crashed after 'draft' completed — should resume at 'edit'
    const next = resumeMolecule(g, ['research', 'outline', 'draft']);
    expect(next).toEqual(['edit']);
  });

  it('parallel resume: returns multiple runnable steps', () => {
    const toml = `
formula = "parallel-start"
type = "workflow"
version = 1

[[steps]]
id = "fetch-a"
title = "Fetch A"
needs = []

[[steps]]
id = "fetch-b"
title = "Fetch B"
needs = []

[[steps]]
id = "merge"
title = "Merge"
needs = ["fetch-a", "fetch-b"]
`.trim();
    const f = parseFormulaFromString(toml);
    const g = compileMoleculeToGraph(f);
    // Nothing done: both entry steps runnable
    expect(resumeMolecule(g, []).sort()).toEqual(['fetch-a', 'fetch-b']);
    // fetch-a done but not fetch-b: only fetch-b runnable (merge still blocked)
    expect(resumeMolecule(g, ['fetch-a'])).toEqual(['fetch-b']);
    // Both done: merge unblocked
    expect(resumeMolecule(g, ['fetch-a', 'fetch-b'])).toEqual(['merge']);
  });
});

// ── checkpointMoleculeStep ────────────────────────────────────────────────────

describe('checkpointMoleculeStep', () => {
  it('writes step_<id> = done to the molecule bead', async () => {
    await store.create(makeMoleculeBead('blog-mol-001', 'blog-publish'));

    await checkpointMoleculeStep('blog-mol-001', 'research', store);

    const bead = await store.get('blog-mol-001');
    expect(bead?.labels['step_research']).toBe('done');
  });

  it('accumulates checkpoints across multiple steps', async () => {
    await store.create(makeMoleculeBead('blog-mol-002', 'blog-publish'));
    await checkpointMoleculeStep('blog-mol-002', 'research', store);
    await checkpointMoleculeStep('blog-mol-002', 'outline', store);

    const bead = await store.get('blog-mol-002');
    expect(bead?.labels['step_research']).toBe('done');
    expect(bead?.labels['step_outline']).toBe('done');
  });

  it('supports skipped and error outcomes', async () => {
    await store.create(makeMoleculeBead('blog-mol-003', 'blog-publish'));
    await checkpointMoleculeStep('blog-mol-003', 'research', store, 'skipped');
    await checkpointMoleculeStep('blog-mol-003', 'outline', store, 'error');

    const bead = await store.get('blog-mol-003');
    expect(bead?.labels['step_research']).toBe('skipped');
    expect(bead?.labels['step_outline']).toBe('error');
  });

  it('throws if molecule bead does not exist', async () => {
    await expect(
      checkpointMoleculeStep('nonexistent-mol', 'research', store)
    ).rejects.toThrow('not found');
  });

  it('NDI invariant: checkpoint + compile → correct resume after crash', async () => {
    // Simulate: blog-publish running, crashes after 'outline' completes
    await store.create(makeMoleculeBead('blog-mol-ndi', 'blog-publish'));
    await checkpointMoleculeStep('blog-mol-ndi', 'research', store);
    await checkpointMoleculeStep('blog-mol-ndi', 'outline', store);

    // On restart: read bead, find completed steps, resume
    const bead = await store.get('blog-mol-ndi');
    const completed = Object.entries(bead!.labels)
      .filter(([k, v]) => k.startsWith('step_') && v === 'done')
      .map(([k]) => k.slice('step_'.length));

    const f = await parseTOMLFormula(BLOG_PUBLISH_TOML);
    const g = compileMoleculeToGraph(f);
    const next = resumeMolecule(g, completed);

    expect(next).toEqual(['draft']); // correct resume point after crash
  });
});
