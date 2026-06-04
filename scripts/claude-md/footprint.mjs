#!/usr/bin/env node
// footprint.mjs — measure the ALWAYS-LOADED instruction footprint of a repo's CLAUDE.md layer.
//
// Implements metric M1 from ADR-0081. The point of the ADR is that line count is the wrong
// metric: what matters is how much instruction context loads into EVERY session. This script
// computes that "always-loaded footprint" and, critically, EXCLUDES content that loads
// conditionally (path-scoped rules/ and nested subtree CLAUDE.md), so a future decomposition
// that routes conditional content out shows up as a real drop here — while an @import that just
// relocates always-loaded text does NOT (imports load at startup, so they still count).
//
// Always-loaded for a session opened at <repo> root:
//   - <repo>/CLAUDE.md                          (root, always)
//   - files pulled by @path imports from it      (recursive; imports load at startup)
//   - <repo>/.claude/rules/*.md WITHOUT `paths:`  (unconditional rules)
// Conditional (reported, NOT counted toward always-loaded):
//   - <repo>/.claude/rules/*.md WITH `paths:`     (load only on matching edit path)
//   - any nested <subtree>/CLAUDE.md              (load on-demand when editing that subtree)
//
// User-global ~/.claude/CLAUDE.md is always-loaded too but is not a per-repo cost, so it is
// out of scope here (measure the repo's own contribution).
//
// Tokens are approximated as ceil(chars / 4) — labeled approximate; we want a stable relative
// metric across before/after, not an exact tokenizer count.
//
// Usage:
//   node footprint.mjs <repo-path> [<repo-path> ...]   # one or more repos
//   node footprint.mjs --json <repo-path> ...          # JSON only (for telemetry)
// Exit 0 always (measurement, never a gate).

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const approxTokens = (chars) => Math.ceil(chars / 4);

export function measureFile(path) {
  const text = readFileSync(path, 'utf8');
  return { lines: text.split('\n').length, chars: text.length, tokens: approxTokens(text.length), text };
}

// Find @path imports in a CLAUDE.md body. Conservative: an @token at line-start or after
// whitespace, resolving to an existing FILE relative to the importing file's dir (or ~ for home),
// and not inside a fenced code block. Returns absolute paths.
export function findImports(text, fromDir) {
  const out = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(/(?:^|\s)@([~./][^\s)`'"]+)/g)) {
      let p = m[1];
      if (p.startsWith('~')) p = join(homedir(), p.slice(1));
      const abs = resolve(fromDir, p);
      if (existsSync(abs) && statSync(abs).isFile()) out.push(abs);
    }
  }
  return out;
}

// Does a rules/ file have a `paths:` frontmatter key (→ conditional)?
export function rulesIsConditional(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return false; // no frontmatter → unconditional, always-loaded
  return /^\s*paths\s*:/m.test(fm[1]);
}

// Walk for nested CLAUDE.md below the repo root (excluding the root itself and noise dirs).
export function findNestedClaudeMd(repoRoot) {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.serena', '.claude']);
  const found = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (skip.has(e.name)) continue;
        walk(join(dir, e.name));
      } else if (e.name === 'CLAUDE.md' && dir !== repoRoot) {
        found.push(join(dir, e.name));
      }
    }
  };
  walk(repoRoot);
  return found;
}

export function analyzeRepo(repoPath) {
  const root = resolve(repoPath);
  const name = basename(root);
  const always = [];
  const conditional = [];

  // 1. root CLAUDE.md + its recursive @imports
  const rootClaude = join(root, 'CLAUDE.md');
  if (existsSync(rootClaude)) {
    const seen = new Set();
    const queue = [rootClaude];
    while (queue.length) {
      const f = queue.shift();
      if (seen.has(f)) continue;
      seen.add(f);
      const m = measureFile(f);
      always.push({ path: relative(root, f) || basename(f), lines: m.lines, chars: m.chars, tokens: m.tokens,
        kind: f === rootClaude ? 'root CLAUDE.md' : '@import' });
      for (const imp of findImports(m.text, dirname(f))) if (!seen.has(imp)) queue.push(imp);
    }
  } else {
    always.push({ path: 'CLAUDE.md', lines: 0, chars: 0, tokens: 0, kind: 'MISSING root CLAUDE.md' });
  }

  // 2. .claude/rules/*.md — split by paths: frontmatter
  const rulesDir = join(root, '.claude', 'rules');
  if (existsSync(rulesDir)) {
    for (const e of readdirSync(rulesDir)) {
      if (!e.endsWith('.md')) continue;
      const f = join(rulesDir, e);
      const m = measureFile(f);
      const entry = { path: relative(root, f), lines: m.lines, chars: m.chars, tokens: m.tokens };
      if (rulesIsConditional(m.text)) conditional.push({ ...entry, kind: 'rule (path-scoped)' });
      else always.push({ ...entry, kind: 'rule (unconditional)' });
    }
  }

  // 3. nested CLAUDE.md → conditional
  for (const f of findNestedClaudeMd(root)) {
    const m = measureFile(f);
    conditional.push({ path: relative(root, f), lines: m.lines, chars: m.chars, tokens: m.tokens, kind: 'nested CLAUDE.md' });
  }

  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  return {
    repo: name,
    alwaysLoaded: { lines: sum(always, 'lines'), chars: sum(always, 'chars'), tokens: sum(always, 'tokens'), files: always },
    conditional: { lines: sum(conditional, 'lines'), chars: sum(conditional, 'chars'), tokens: sum(conditional, 'tokens'), files: conditional },
  };
}

// --- main (only when run directly, not when imported by tests) ---
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const repos = args.filter((a) => a !== '--json');
if (repos.length === 0) {
  console.error('usage: node footprint.mjs [--json] <repo-path> [<repo-path> ...]');
  process.exit(0);
}

const results = repos.map(analyzeRepo);

if (jsonOnly) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log('\nALWAYS-LOADED FOOTPRINT (M1, ADR-0081) — tokens ≈ chars/4, approximate\n');
  console.log(pad('repo', 22) + padL('always-lines', 14) + padL('always-tokens', 15) + padL('cond-tokens', 14));
  console.log('-'.repeat(65));
  for (const r of results) {
    console.log(pad(r.repo, 22) + padL(r.alwaysLoaded.lines, 14) + padL('~' + r.alwaysLoaded.tokens, 15) + padL('~' + r.conditional.tokens, 14));
  }
  console.log('-'.repeat(65));
  const tot = results.reduce((a, r) => ({ l: a.l + r.alwaysLoaded.lines, t: a.t + r.alwaysLoaded.tokens }), { l: 0, t: 0 });
  console.log(pad('TOTAL', 22) + padL(tot.l, 14) + padL('~' + tot.t, 15) + '\n');
  console.log('cond-tokens = content that loads conditionally (path-scoped rules + nested CLAUDE.md) — the target homes for routed content.');
  console.log('Success (ADR-0081) is zero conditional blocks left in the always-loaded layer, NOT a % drop — track always-tokens before→after.\n');
}
}
