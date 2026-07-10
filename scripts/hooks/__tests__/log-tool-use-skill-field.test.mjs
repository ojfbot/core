/**
 * log-tool-use.sh skill-field derivation (rm-l2-ojfbot#S22 capture preamble).
 *
 * Post-ADR-0092, inline skill use is a Read of .../skills/<name>/SKILL.md —
 * the hook must stamp `.skill` from the path so downstream joins (pr-skill-audit,
 * OPAV) can see inline use. Skill-tool calls keep their explicit skill field;
 * non-skill Reads stay unstamped.
 *
 * Run: pnpm vitest run scripts/hooks/__tests__/log-tool-use-skill-field.test.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, '..', 'log-tool-use.sh');

let home;

function toolEvents() {
  const f = join(home, '.claude', 'tool-telemetry.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function runHook(toolName, toolInput) {
  const input = JSON.stringify({
    tool_name: toolName,
    tool_input: toolInput,
    session_id: 'sess-test',
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
  home = mkdtempSync(join(tmpdir(), 'log-tool-use-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(home, 'repo'), { recursive: true });
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe('log-tool-use.sh skill field', () => {
  it('derives the skill name from an inline SKILL.md Read', async () => {
    await runHook('Read', { file_path: '/x/core/.claude/skills/investigate/SKILL.md' });
    const [ev] = toolEvents();
    expect(ev.tool_name).toBe('Read');
    expect(ev.skill).toBe('investigate');
  });

  it('keeps the explicit skill field for Skill-tool calls', async () => {
    await runHook('Skill', { skill: 'tdd', args: '' });
    const [ev] = toolEvents();
    expect(ev.skill).toBe('tdd');
  });

  it('leaves non-skill Reads unstamped', async () => {
    await runHook('Read', { file_path: '/x/core/scripts/day-runner.mjs' });
    const [ev] = toolEvents();
    expect(ev.skill).toBe('');
  });

  it('does not stamp Edits of a SKILL.md (maintenance, not use)', async () => {
    await runHook('Edit', { file_path: '/x/core/.claude/skills/investigate/SKILL.md' });
    const [ev] = toolEvents();
    expect(ev.skill).toBe('');
  });
});
