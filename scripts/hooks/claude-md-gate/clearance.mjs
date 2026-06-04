// clearance.mjs — C5, per-session clearance for the loading-discipline gate (ADR-0081 §Slice 2).
//
// Once an author resolves a block (via /grill-with-docs), the session is marked cleared so
// subsequent CLAUDE.md edits in that session pass — otherwise the gate would re-block the very
// edit the author just decided to make (infinite loop). Inert in shadow mode (nothing blocks).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function clearanceDir() {
  return process.env.CLAUDE_MD_GATE_CLEARANCE_DIR || join(homedir(), '.claude', 'claude-md-gate-clearance');
}

const sanitize = (id) => String(id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');

export function isCleared(sessionId, { dir = clearanceDir() } = {}) {
  if (!sessionId) return false;
  return existsSync(join(dir, sanitize(sessionId)));
}

export function markCleared(sessionId, { dir = clearanceDir(), now } = {}) {
  if (!sessionId) return false;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, sanitize(sessionId)), (now ? now() : new Date().toISOString()) + '\n');
    return true;
  } catch {
    return false;
  }
}
