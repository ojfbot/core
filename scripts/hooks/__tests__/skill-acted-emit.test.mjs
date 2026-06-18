// skill-acted-emit.test.mjs — the agent-emitted skill:acted write path (OPAV-S1).
// Integration: spawns the CLI so the real dist import + eventEmit + honesty contract
// run end-to-end. The key invariant is that a missing/unresolvable evidence_ref is
// REJECTED (non-zero exit), never silently written — skill:acted is evidence-mandatory.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '../../skill-acted-emit.mjs');

function run(args, root) {
  return spawnSync('node', [SCRIPT, `--ledger-root=${root}`, '--program=test-prog', ...args], { encoding: 'utf8' });
}

describe('skill-acted-emit — agent self-report write path', () => {
  it('emits a skill:acted line when evidence resolves on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acted-'));
    const artifact = join(dir, 'CONTEXT.md');
    writeFileSync(artifact, '# ctx\n');
    const r = run(['--suggestion-id=ABC123', '--skill=grill-with-docs', `--evidence=path:${artifact}`], dir);
    expect(r.status).toBe(0);
    const ledger = join(dir, 'test-prog.jsonl');
    expect(existsSync(ledger)).toBe(true);
    const ev = JSON.parse(readFileSync(ledger, 'utf8').trim());
    expect(ev).toMatchObject({ event_type: 'skill:acted', correlation_id: 'ABC123', to_state: 'acted' });
    expect(ev.payload.skill).toBe('grill-with-docs');
    expect(ev.evidence_ref).toEqual({ scheme: 'path', ref: artifact });
  });

  it('REJECTS (exit 1, no write) when a path evidence_ref does not resolve', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acted-'));
    const r = run(['--suggestion-id=ABC123', '--skill=adr', `--evidence=path:${join(dir, 'nope.md')}`], dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/REJECTED/);
    expect(existsSync(join(dir, 'test-prog.jsonl'))).toBe(false);
  });

  it('is idempotent on op_id — emitting the same action twice writes one line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acted-'));
    const artifact = join(dir, 'decisions', 'adr', '0097-x.md');
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(artifact, '# adr\n');
    const args = ['--suggestion-id=DUP1', '--skill=adr', `--evidence=path:${artifact}`];
    expect(run(args, dir).status).toBe(0);
    expect(run(args, dir).status).toBe(0);
    const lines = readFileSync(join(dir, 'test-prog.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  it('exits 2 on missing required flags', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acted-'));
    expect(run(['--skill=adr'], dir).status).toBe(2);
  });
});
