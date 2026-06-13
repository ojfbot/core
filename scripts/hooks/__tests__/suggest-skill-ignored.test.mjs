/**
 * suggest-skill.sh ignored-detector integration tests (Slice 0 / C0 + C1).
 *
 * Drives the real bash hook via child_process with a redirected HOME so all
 * telemetry writes land in a throwaway temp dir. Seeds the /tmp dedup file and
 * tool-telemetry, then asserts whether a `skill:suggestion-ignored` event is
 * emitted on the next prompt.
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/suggest-skill-ignored.test.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, '..', 'suggest-skill.sh');

// A prompt that matches no skill trigger — keeps the focus on the ignored-detector
// for the PREVIOUS suggestion (which runs before current-prompt matching).
const NO_MATCH_PROMPT = 'zzzqqq wibble frobnicate xyzzy';
const PREV_SKILL = 'vault';
const PREV_TS_EPOCH = 1_748_000_000; // fixed epoch seconds

let home;
let sessionId;
let dedupFile;

function readSuggestionEvents() {
  const f = join(home, '.claude', 'suggestion-telemetry.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function runHook() {
  const input = JSON.stringify({
    prompt: NO_MATCH_PROMPT,
    session_id: sessionId,
    cwd: join(home, 'repo'),
    hook_event_name: 'UserPromptSubmit',
  });
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [HOOK], { env: { ...process.env, HOME: home } });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
    child.stdin.write(input);
    child.stdin.end();
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'opav-s0-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, 'repo'), { recursive: true });
  sessionId = `test-${Math.floor(PREV_TS_EPOCH)}-${home.slice(-8)}`;
  // suggest-skill.sh hardcodes the dedup path under /tmp (not os.tmpdir()).
  dedupFile = join('/tmp', `claude-skill-suggest-${sessionId}`);
  // Seed a prior suggestion in the /tmp dedup file: skill + epoch ts (legacy 2-line format).
  writeFileSync(dedupFile, `${PREV_SKILL}\n${PREV_TS_EPOCH}\n`);
  // Empty skill-telemetry so the legacy followed-check has a file to read.
  writeFileSync(join(home, '.claude', 'skill-telemetry.jsonl'), '');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(dedupFile, { force: true });
});

describe('suggest-skill.sh ignored-detector', () => {
  it('emits skill:suggestion-ignored when the prior suggestion has no inline follow', async () => {
    writeFileSync(join(home, '.claude', 'tool-telemetry.jsonl'), '');
    await runHook();
    const ignored = readSuggestionEvents().filter((e) => e.event === 'skill:suggestion-ignored');
    expect(ignored.length).toBe(1);
    expect(ignored[0].skill).toBe(PREV_SKILL);
  });

  it('fails open: with NO tool-telemetry file at all, still emits ignored (preserves prior behavior)', async () => {
    // Deliberately do not create tool-telemetry.jsonl — corroborate-follow must
    // fail-open toward "not corroborated" rather than swallow the ignored event.
    await runHook();
    const ignored = readSuggestionEvents().filter((e) => e.event === 'skill:suggestion-ignored');
    expect(ignored.length).toBe(1);
  });

  it('does NOT emit skill:suggestion-ignored when an inline SKILL.md read corroborates the follow', async () => {
    const read = {
      event: 'tool:used',
      tool_name: 'Read',
      file_path: `/Users/yuri/ojfbot/core/.claude/skills/${PREV_SKILL}/SKILL.md`,
      session_id: sessionId,
      ts: new Date((PREV_TS_EPOCH + 120) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
    writeFileSync(join(home, '.claude', 'tool-telemetry.jsonl'), JSON.stringify(read) + '\n');
    await runHook();
    const ignored = readSuggestionEvents().filter((e) => e.event === 'skill:suggestion-ignored');
    expect(ignored.length).toBe(0);
  });
});
