/**
 * log-skill.sh funnel-close threading (Slice 0 / C0).
 *
 * When a Skill-tool invocation closes the suggestion funnel, the emitted
 * skill:suggestion-followed must carry the suggestion_id of the matching
 * skill:suggested event so the follow joins back to its suggestion.
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/log-skill-followed.test.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, '..', 'log-skill.sh');

const SKILL = 'tdd';
const SUGGESTION_ID = 'sug-fixed-test-0001';
let home;
let sessionId;

function skillEvents() {
  const f = join(home, '.claude', 'skill-telemetry.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function runHook(invokedSkill = SKILL) {
  const input = JSON.stringify({
    tool_name: 'Skill',
    tool_input: { skill: invokedSkill, args: '' },
    session_id: sessionId,
    cwd: join(home, 'repo'),
    hook_event_name: 'PostToolUse',
  });
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [HOOK], { env: { ...process.env, HOME: home } });
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
    child.stdin.write(input);
    child.stdin.end();
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'opav-s0fl-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, 'repo'), { recursive: true });
  sessionId = `fltest-${home.slice(-8)}`;
  // Seed a prior matching suggestion carrying the SUGGESTION_ID.
  const suggested = {
    ts: '2026-06-13T10:00:00Z',
    event: 'skill:suggested',
    skill: SKILL,
    session_id: sessionId,
    suggestion_id: SUGGESTION_ID,
  };
  writeFileSync(join(home, '.claude', 'suggestion-telemetry.jsonl'), JSON.stringify(suggested) + '\n');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('log-skill.sh — funnel-close carries suggestion_id (C0)', () => {
  it('stamps the matching suggestion_id on skill:suggestion-followed', async () => {
    await runHook();
    const followed = skillEvents().filter((e) => e.event === 'skill:suggestion-followed');
    expect(followed.length).toBe(1);
    expect(followed[0].suggestion_id).toBe(SUGGESTION_ID);
  });
});

describe('log-skill.sh — S5 funnel-close widening (rm:rm-l1-core#S5)', () => {
  it('closes a skill:suggested-uninstalled suggestion too (both populations)', async () => {
    const suggested = {
      ts: '2026-06-13T10:00:00Z',
      event: 'skill:suggested-uninstalled',
      skill: SKILL,
      session_id: sessionId,
      suggestion_id: 'sug-uninst-0002',
    };
    writeFileSync(join(home, '.claude', 'suggestion-telemetry.jsonl'), JSON.stringify(suggested) + '\n');
    await runHook();
    const followed = skillEvents().filter((e) => e.event === 'skill:suggestion-followed');
    expect(followed.length).toBe(1);
    expect(followed[0].suggestion_id).toBe('sug-uninst-0002');
  });

  it('normalizes scoped invocations: invoking core:tdd closes a suggestion for tdd', async () => {
    await runHook('core:tdd');
    const followed = skillEvents().filter((e) => e.event === 'skill:suggestion-followed');
    expect(followed.length).toBe(1);
    expect(followed[0].suggestion_id).toBe(SUGGESTION_ID);
  });

  it('does not close on an unrelated skill, scoped or not', async () => {
    await runHook('core:deepen');
    const followed = skillEvents().filter((e) => e.event === 'skill:suggestion-followed');
    expect(followed.length).toBe(0);
  });

  it('never emits skill:acted (acted stays evidence-mandatory, ADR-0095)', async () => {
    await runHook();
    expect(skillEvents().filter((e) => e.event === 'skill:acted').length).toBe(0);
  });
});
