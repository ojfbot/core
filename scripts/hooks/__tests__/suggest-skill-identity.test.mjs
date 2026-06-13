/**
 * suggest-skill.sh SUGGESTION_ID minting (Slice 0 / C0).
 *
 * Every newly-emitted suggestion must carry a durable, unique suggestion_id —
 * the single join key the rest of the OPAV loop threads through. Drives the real
 * hook via a redirected HOME and a prompt that deterministically matches /tdd.
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/suggest-skill-identity.test.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, '..', 'suggest-skill.sh');
// Matches /tdd via the 'red green refactor' trigger (verified against suggest-skills.mjs).
const MATCH_PROMPT = 'red green refactor write the failing test first';

let home;
let sessionId;
let dedupFile;

function suggestionEvents() {
  const f = join(home, '.claude', 'suggestion-telemetry.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function runHook(sid) {
  const input = JSON.stringify({
    prompt: MATCH_PROMPT,
    session_id: sid,
    cwd: join(home, 'repo'),
    hook_event_name: 'UserPromptSubmit',
  });
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [HOOK], { env: { ...process.env, HOME: home, CLAUDE_PROJECT_DIR: '' } });
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
    child.stdin.write(input);
    child.stdin.end();
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'opav-s0id-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, 'repo'), { recursive: true });
  sessionId = `idtest-${home.slice(-8)}`;
  dedupFile = join('/tmp', `claude-skill-suggest-${sessionId}`);
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(dedupFile, { force: true });
});

describe('suggest-skill.sh — SUGGESTION_ID minting (C0)', () => {
  it('stamps a non-empty suggestion_id on the emitted suggestion event', async () => {
    await runHook(sessionId);
    const suggested = suggestionEvents().filter(
      (e) => e.event === 'skill:suggested' || e.event === 'skill:suggested-uninstalled',
    );
    expect(suggested.length).toBe(1);
    expect(suggested[0].suggestion_id).toBeTruthy();
    expect(suggested[0].suggestion_id.length).toBeGreaterThanOrEqual(8);
  });

  it('writes the suggestion_id as the 3rd line of the dedup file', async () => {
    await runHook(sessionId);
    expect(existsSync(dedupFile)).toBe(true);
    const lines = readFileSync(dedupFile, 'utf8').split('\n');
    const emittedId = suggestionEvents().find((e) => e.suggestion_id)?.suggestion_id;
    expect(lines[2]).toBe(emittedId);
  });

  it('mints a different suggestion_id for a different session', async () => {
    await runHook(sessionId);
    const id1 = suggestionEvents().find((e) => e.suggestion_id)?.suggestion_id;
    // fresh home wipes telemetry; reuse home but a new session + new dedup path
    const sid2 = `${sessionId}-b`;
    const dedup2 = join('/tmp', `claude-skill-suggest-${sid2}`);
    await runHook(sid2);
    const ids = suggestionEvents().filter((e) => e.suggestion_id).map((e) => e.suggestion_id);
    rmSync(dedup2, { force: true });
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(id1).toBe(ids[0]);
  });
});
