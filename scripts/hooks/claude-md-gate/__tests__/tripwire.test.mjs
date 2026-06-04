/**
 * tripwire.mjs tests — ADR-0081 Slice 2, checkpoint C1.
 * Success criteria: trips ONLY on always-loaded + oversized + growing; never on the
 * conditional layers (nested CLAUDE.md, path-scoped rules) that are the correct destinations.
 *
 * Run: pnpm vitest run scripts/hooks/claude-md-gate/__tests__/tripwire.test.mjs
 */
import { describe, it, expect } from 'vitest';
import { sep } from 'node:path';
import {
  classifyLayer,
  isGovernedFile,
  evaluateTripwire,
  findRepoRoot,
  DEFAULT_THRESHOLD,
} from '../tripwire.mjs';

const ROOT = `${sep}repo`;
const big = (tokens) => 'x'.repeat(tokens * 4 + 4); // > tokens after ceil(chars/4)
const OVERSIZED = big(DEFAULT_THRESHOLD + 100);

describe('classifyLayer', () => {
  it('repo-root CLAUDE.md → always', () => {
    expect(classifyLayer({ filePath: `${ROOT}/CLAUDE.md`, repoRoot: ROOT })).toBe('always');
  });
  it('nested CLAUDE.md → conditional', () => {
    expect(classifyLayer({ filePath: `${ROOT}/packages/x/CLAUDE.md`, repoRoot: ROOT })).toBe('conditional');
  });
  it('rule without paths: → always', () => {
    expect(classifyLayer({ filePath: `${ROOT}/.claude/rules/x.md`, proposedContent: '---\ntitle: x\n---\nbody', repoRoot: ROOT })).toBe('always');
  });
  it('rule with paths: → conditional', () => {
    expect(classifyLayer({ filePath: `${ROOT}/.claude/rules/x.md`, proposedContent: '---\npaths:\n  - "src/**"\n---\nbody', repoRoot: ROOT })).toBe('conditional');
  });
});

describe('isGovernedFile', () => {
  it('CLAUDE.md and rules/*.md are governed; other files are not', () => {
    expect(isGovernedFile(`${ROOT}/CLAUDE.md`)).toBe(true);
    expect(isGovernedFile(`${ROOT}/.claude/rules/a.md`)).toBe(true);
    expect(isGovernedFile(`${ROOT}/src/index.ts`)).toBe(false);
    expect(isGovernedFile(`${ROOT}/README.md`)).toBe(false);
  });
});

describe('evaluateTripwire', () => {
  it('TRIPS: root CLAUDE.md, oversized, growing', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/CLAUDE.md`, proposedContent: OVERSIZED, currentContent: big(DEFAULT_THRESHOLD - 100), repoRoot: ROOT });
    expect(r.tripped).toBe(true);
    expect(r.reason).toBe('always-loaded-oversized-growing');
    expect(r.delta).toBeGreaterThan(0);
  });

  it('does NOT trip: nested CLAUDE.md (conditional destination), even if huge', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/packages/x/CLAUDE.md`, proposedContent: OVERSIZED, currentContent: '', repoRoot: ROOT });
    expect(r.tripped).toBe(false);
    expect(r.reason).toBe('conditional-layer');
  });

  it('does NOT trip: path-scoped rule (conditional destination), even if huge', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/.claude/rules/x.md`, proposedContent: `---\npaths:\n  - "src/**"\n---\n${OVERSIZED}`, repoRoot: ROOT });
    expect(r.tripped).toBe(false);
    expect(r.reason).toBe('conditional-layer');
  });

  it('does NOT trip: always-loaded but within threshold', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/CLAUDE.md`, proposedContent: big(500), currentContent: big(400), repoRoot: ROOT });
    expect(r.tripped).toBe(false);
    expect(r.reason).toBe('within-threshold');
  });

  it('does NOT trip: oversized but NOT growing (shrinking edit — the good case)', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/CLAUDE.md`, proposedContent: big(DEFAULT_THRESHOLD + 50), currentContent: big(DEFAULT_THRESHOLD + 200), repoRoot: ROOT });
    expect(r.tripped).toBe(false);
    expect(r.reason).toBe('not-growing');
  });

  it('TRIPS: unconditional rule (no paths:), oversized, growing', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/.claude/rules/big.md`, proposedContent: `---\ntitle: x\n---\n${OVERSIZED}`, currentContent: '', repoRoot: ROOT });
    expect(r.tripped).toBe(true);
  });

  it('respects a custom threshold', () => {
    const r = evaluateTripwire({ filePath: `${ROOT}/CLAUDE.md`, proposedContent: big(600), currentContent: big(100), repoRoot: ROOT, threshold: 500 });
    expect(r.tripped).toBe(true);
  });
});

describe('findRepoRoot', () => {
  it('walks up to the dir containing .git', () => {
    const existing = new Set([`${ROOT}/.git`]);
    const existsSync = (p) => existing.has(p);
    expect(findRepoRoot(`${ROOT}/packages/x`, { existsSync })).toBe(ROOT);
    expect(findRepoRoot(`${ROOT}`, { existsSync })).toBe(ROOT);
  });
  it('returns null when no .git is found', () => {
    expect(findRepoRoot(`${ROOT}/x`, { existsSync: () => false })).toBe(null);
  });
});
