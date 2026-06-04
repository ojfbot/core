/**
 * footprint.mjs unit tests — ADR-0081 metric M1 (always-loaded footprint).
 *
 * Encodes the spec's acceptance criteria:
 *   - a fixture repo with ONE OF EACH layer type (root CLAUDE.md, @import, unconditional
 *     rule, path-scoped rule, nested CLAUDE.md);
 *   - the @import-THEATER property: relocating always-loaded text into an @import does NOT
 *     reduce the always-loaded footprint (imports load at startup), whereas routing it to a
 *     path-scoped rule or nested CLAUDE.md DOES. This is the whole point of the metric.
 *
 * Pure-function tests against the exported analyzeRepo/findImports/etc — no CLI subprocess.
 * Run: pnpm vitest run scripts/claude-md/__tests__/footprint.test.mjs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  approxTokens,
  findImports,
  rulesIsConditional,
  findNestedClaudeMd,
  analyzeRepo,
} from '../footprint.mjs';

// --- fixture builder -------------------------------------------------------

/** Create a temp repo dir; write the given { relpath: contents } map into it. */
function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'fp-fixture-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, contents);
  }
  return root;
}

/** Pull one file entry out of an analysis layer by its `kind`. */
const byKind = (layer, kind) => layer.files.find((f) => f.kind === kind);

// --- the canonical "one of each layer type" fixture ------------------------

describe('analyzeRepo — one of each layer type', () => {
  let root;
  let result;

  beforeAll(() => {
    root = makeRepo({
      // root CLAUDE.md — always-loaded — pulls one @import
      'CLAUDE.md': '# Root\n\nAlways-loaded root instructions.\n\n@.claude/imported.md\n',
      // @import target — always-loaded (loads at startup)
      '.claude/imported.md': 'Imported always-loaded text that travels with the root.\n',
      // unconditional rule (no paths:) — always-loaded
      '.claude/rules/always.md': '---\ntitle: Always\n---\nUnconditional rule body.\n',
      // path-scoped rule (paths:) — CONDITIONAL
      '.claude/rules/scoped.md':
        '---\npaths:\n  - "packages/agent/**"\n---\nLoads only when editing the agent subtree.\n',
      // nested CLAUDE.md — CONDITIONAL
      'packages/agent/CLAUDE.md': '# Agent subtree\n\nLoads on-demand when editing this subtree.\n',
    });
    result = analyzeRepo(root);
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('counts the root CLAUDE.md as always-loaded', () => {
    const root = byKind(result.alwaysLoaded, 'root CLAUDE.md');
    expect(root).toBeDefined();
    expect(root.tokens).toBeGreaterThan(0);
  });

  it('counts an @import as always-loaded (loads at startup)', () => {
    const imp = byKind(result.alwaysLoaded, '@import');
    expect(imp).toBeDefined();
    expect(imp.path).toContain('imported.md');
  });

  it('counts an unconditional rule (no paths:) as always-loaded', () => {
    expect(byKind(result.alwaysLoaded, 'rule (unconditional)')).toBeDefined();
  });

  it('counts a path-scoped rule (paths:) as conditional, NOT always-loaded', () => {
    expect(byKind(result.conditional, 'rule (path-scoped)')).toBeDefined();
    expect(byKind(result.alwaysLoaded, 'rule (path-scoped)')).toBeUndefined();
  });

  it('counts a nested CLAUDE.md as conditional, NOT always-loaded', () => {
    expect(byKind(result.conditional, 'nested CLAUDE.md')).toBeDefined();
    // nested file is excluded from the always-loaded total
    expect(result.alwaysLoaded.files.some((f) => f.path.includes('packages/agent'))).toBe(false);
  });

  it('the always-loaded total is the sum of root + @import + unconditional rule only', () => {
    const expected =
      byKind(result.alwaysLoaded, 'root CLAUDE.md').tokens +
      byKind(result.alwaysLoaded, '@import').tokens +
      byKind(result.alwaysLoaded, 'rule (unconditional)').tokens;
    expect(result.alwaysLoaded.tokens).toBe(expected);
  });
});

// --- the @import-theater property (the core of ADR-0081) -------------------

describe('@import is theater — relocating text into an import does not shrink the footprint', () => {
  let inlineRoot;
  let importedRoot;

  const BODY = 'X'.repeat(800); // identical payload, two placements

  beforeAll(() => {
    // (a) all text inline in the root CLAUDE.md
    inlineRoot = makeRepo({ 'CLAUDE.md': `# Repo\n\n${BODY}\n` });
    // (b) same text moved into an @import — the "decompose by @import" anti-pattern
    importedRoot = makeRepo({
      'CLAUDE.md': '# Repo\n\n@.claude/extracted.md\n',
      '.claude/extracted.md': `${BODY}\n`,
    });
  });

  afterAll(() => {
    rmSync(inlineRoot, { recursive: true, force: true });
    rmSync(importedRoot, { recursive: true, force: true });
  });

  it('moving the body into an @import keeps it always-loaded (no real reduction)', () => {
    const inline = analyzeRepo(inlineRoot).alwaysLoaded.tokens;
    const imported = analyzeRepo(importedRoot).alwaysLoaded.tokens;
    // Within a few tokens (the `@.claude/extracted.md` line vs the inline body) — NOT a real drop.
    expect(Math.abs(inline - imported)).toBeLessThan(20);
    expect(analyzeRepo(importedRoot).conditional.tokens).toBe(0);
  });

  it('routing the SAME body to a path-scoped rule DOES reduce always-loaded', () => {
    const routed = makeRepo({
      'CLAUDE.md': '# Repo\n',
      '.claude/rules/scoped.md': `---\npaths:\n  - "src/**"\n---\n${BODY}\n`,
    });
    const a = analyzeRepo(routed);
    expect(a.conditional.tokens).toBeGreaterThan(approxTokens(BODY.length) - 20);
    // always-loaded is now just the tiny root CLAUDE.md
    expect(a.alwaysLoaded.tokens).toBeLessThan(approxTokens(BODY.length));
    rmSync(routed, { recursive: true, force: true });
  });
});

// --- edge cases ------------------------------------------------------------

describe('analyzeRepo — edge cases', () => {
  it('reports a MISSING root CLAUDE.md with 0 tokens', () => {
    const root = makeRepo({ '.claude/rules/x.md': 'orphan rule\n' });
    const result = analyzeRepo(root);
    expect(byKind(result.alwaysLoaded, 'MISSING root CLAUDE.md')).toBeDefined();
    expect(byKind(result.alwaysLoaded, 'MISSING root CLAUDE.md').tokens).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('follows @imports recursively (A → B → C all always-loaded)', () => {
    const root = makeRepo({
      'CLAUDE.md': '# A\n@.claude/b.md\n',
      '.claude/b.md': 'B body\n@./c.md\n', // canonical relative form, resolved from .claude/
      '.claude/c.md': 'C body\n',
    });
    const result = analyzeRepo(root);
    const imports = result.alwaysLoaded.files.filter((f) => f.kind === '@import');
    expect(imports.map((f) => f.path).join()).toContain('b.md');
    expect(imports.map((f) => f.path).join()).toContain('c.md');
    rmSync(root, { recursive: true, force: true });
  });

  it('conservative detector: a bare @filename (no ./ ~ or / prefix) is NOT treated as an import', () => {
    // Guards against false positives on @mentions, decorators, emails in code samples.
    const root = makeRepo({
      'CLAUDE.md': '# A\n@bare.md is a mention, not an import\n',
      'bare.md': 'SHOULD NOT LOAD'.repeat(50),
    });
    const result = analyzeRepo(root);
    expect(result.alwaysLoaded.files.some((f) => f.kind === '@import')).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  it('does NOT follow an @import inside a fenced code block', () => {
    const root = makeRepo({
      'CLAUDE.md': '# A\n\n```sh\n@.claude/should-not-load.md\n```\n',
      '.claude/should-not-load.md': 'NEVER'.repeat(100),
    });
    const result = analyzeRepo(root);
    expect(result.alwaysLoaded.files.some((f) => f.kind === '@import')).toBe(false);
  });

  it('ignores nested CLAUDE.md under skipped dirs (node_modules)', () => {
    const root = makeRepo({
      'CLAUDE.md': '# A\n',
      'node_modules/pkg/CLAUDE.md': 'vendored, must be ignored\n',
    });
    expect(findNestedClaudeMd(root)).toHaveLength(0);
    rmSync(root, { recursive: true, force: true });
  });
});

// --- pure helpers ----------------------------------------------------------

describe('pure helpers', () => {
  it('approxTokens = ceil(chars / 4)', () => {
    expect(approxTokens(0)).toBe(0);
    expect(approxTokens(1)).toBe(1);
    expect(approxTokens(4)).toBe(1);
    expect(approxTokens(5)).toBe(2);
    expect(approxTokens(800)).toBe(200);
  });

  it('rulesIsConditional: true only when frontmatter has a paths: key', () => {
    expect(rulesIsConditional('---\npaths:\n  - "src/**"\n---\nbody')).toBe(true);
    expect(rulesIsConditional('---\ntitle: x\n---\nbody')).toBe(false);
    expect(rulesIsConditional('no frontmatter at all')).toBe(false);
  });

  it('findImports resolves existing files and skips missing ones', () => {
    const root = makeRepo({
      'CLAUDE.md': 'x',
      'real.md': 'y',
    });
    const found = findImports('@./real.md and @./ghost.md', root);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('real.md');
    rmSync(root, { recursive: true, force: true });
  });
});
