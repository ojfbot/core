/**
 * suggest-skill.sh gap (c) tests (rm:rm-l1-core#S17): with NO session identity the
 * hook must FAIL OPEN — no shared `/tmp/claude-skill-suggest-default` file, no
 * ignored-detection (a suggestion-ignored joined to another session's SUGGESTION_ID
 * is data corruption), while suggestion matching itself still works.
 *
 * Drives the real bash hook via child_process with a redirected HOME (same
 * conventions as suggest-skill-ignored.test.mjs).
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/suggest-skill-no-session.test.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, '..', 'suggest-skill.sh');
const REPO_ROOT = join(__dirname, '..', '..', '..');
const DEFAULT_DEDUP = '/tmp/claude-skill-suggest-default';

let home;

function readSuggestionEvents() {
  const f = join(home, '.claude', 'suggestion-telemetry.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function runHook(prompt) {
  const input = JSON.stringify({
    prompt,
    // session_id deliberately ABSENT — the gap (c) scenario
    cwd: join(home, 'repo'),
    hook_event_name: 'UserPromptSubmit',
  });
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [HOOK], { env: { ...process.env, HOME: home, CLAUDE_PROJECT_DIR: REPO_ROOT } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.write(input);
    child.stdin.end();
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'opav-s17c-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, 'repo'), { recursive: true });
  rmSync(DEFAULT_DEDUP, { force: true });
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(DEFAULT_DEDUP, { force: true });
});

describe('suggest-skill.sh with no session identity (gap c)', () => {
  it('never creates the shared default dedup file, and emits no ignored event', async () => {
    // Seed the poison: a "default" dedup file left by another identity-less session,
    // carrying that session's SUGGESTION_ID. Pre-fix, this cross-wired the
    // ignored-detector; post-fix the file must be ignored entirely.
    writeFileSync(DEFAULT_DEDUP, 'vault\n1748000000\nSUG-FROM-ANOTHER-SESSION\n');

    const { code } = await runHook('zzzqqq wibble frobnicate xyzzy');
    expect(code).toBe(0);
    const events = readSuggestionEvents();
    expect(events.filter((e) => e.event === 'skill:suggestion-ignored')).toHaveLength(0);
    // fail-open: with no session identity we also can't claim "first prompt" → no /init path
    expect(events.filter((e) => e.event === 'skill:suggested-init')).toHaveLength(0);
  });

  it('still suggests on a matching prompt (fail-open ≠ fail-closed) without writing dedup state', async () => {
    const { code, stdout } = await runHook('please write the failing test first, tdd style');
    expect(code).toBe(0);
    expect(stdout).toContain('[Skill suggestion]');
    const suggested = readSuggestionEvents().filter((e) => (e.event === 'skill:suggested' || e.event === 'skill:suggested-uninstalled'));
    expect(suggested).toHaveLength(1);
    expect(suggested[0].suggestion_id).toBeTruthy(); // join key still minted
    expect(existsSync(DEFAULT_DEDUP)).toBe(false); // the poison file is never created
  });
});
