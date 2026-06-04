// tripwire.mjs — C1, the cheap deterministic stage of the loading-discipline gate (ADR-0081 §Slice 2).
//
// Trips ONLY when an edit grows an already-oversized ALWAYS-LOADED CLAUDE.md layer. Nested
// CLAUDE.md and path-scoped rules are conditional by construction — they are the *correct*
// destinations, so they never trip. No LLM here; this is what keeps the Haiku judge off the
// common path (see SPEC.md). Pure functions, injectable fs for testing.

import { existsSync as fsExists, statSync as fsStat } from 'node:fs';
import { dirname, basename, join, sep } from 'node:path';
import { approxTokens, rulesIsConditional } from '../../claude-md/footprint.mjs';

export const DEFAULT_THRESHOLD = 3000; // always-loaded tokens; CLAUDE_MD_GATE_THRESHOLD overrides

// Walk up from a directory looking for a repo root (a dir containing .git).
export function findRepoRoot(startDir, { existsSync = fsExists } = {}) {
  let dir = startDir;
  while (dir && dir !== dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return dir;
    dir = dirname(dir);
  }
  return null;
}

// Is this file part of the always-loaded layer for a session opened at repoRoot?
//   - repo-root CLAUDE.md            → always
//   - nested <subtree>/CLAUDE.md     → conditional (loads on-demand)
//   - .claude/rules/*.md w/o paths:  → always
//   - .claude/rules/*.md with paths: → conditional
//   - anything else                  → not governed (treated as conditional → won't trip)
export function classifyLayer({ filePath, proposedContent = '', repoRoot }) {
  const base = basename(filePath);
  if (base === 'CLAUDE.md') {
    return repoRoot && dirname(filePath) === repoRoot ? 'always' : 'conditional';
  }
  if (filePath.includes(`${sep}.claude${sep}rules${sep}`) && filePath.endsWith('.md')) {
    return rulesIsConditional(proposedContent) ? 'conditional' : 'always';
  }
  return 'conditional';
}

export function isGovernedFile(filePath) {
  return basename(filePath) === 'CLAUDE.md' ||
    (filePath.includes(`${sep}.claude${sep}rules${sep}`) && filePath.endsWith('.md'));
}

// The tripwire. proposedContent = the file contents AFTER the edit; currentContent = before (or
// null/'' if the file is new). Returns the full decision so the event log can record before/after.
export function evaluateTripwire({
  filePath,
  proposedContent,
  currentContent = '',
  repoRoot,
  threshold = DEFAULT_THRESHOLD,
}) {
  const layer = classifyLayer({ filePath, proposedContent, repoRoot });
  const before = currentContent ? approxTokens(currentContent.length) : 0;
  const after = approxTokens((proposedContent ?? '').length);
  const alwaysLoaded = layer === 'always';
  const oversized = after > threshold;
  const growing = after > before;
  const tripped = alwaysLoaded && oversized && growing;

  let reason = 'not-tripped';
  if (!alwaysLoaded) reason = 'conditional-layer'; // nested/path-scoped — the good destination
  else if (!oversized) reason = 'within-threshold';
  else if (!growing) reason = 'not-growing';
  else reason = 'always-loaded-oversized-growing';

  return { tripped, reason, layer, before, after, threshold, delta: after - before };
}

// Helper for the orchestrator: resolve the repo root for a file path on disk.
export function repoRootForFile(filePath, { existsSync = fsExists, statSync = fsStat } = {}) {
  const dir = (() => {
    try { return statSync(filePath).isDirectory() ? filePath : dirname(filePath); }
    catch { return dirname(filePath); }
  })();
  return findRepoRoot(dir, { existsSync });
}
