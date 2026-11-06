import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const homes = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'sync-boundary-'));
  homes.push(home);
  const vault = join(home, 'selfco');
  mkdirSync(join(vault, 'wiki'), { recursive: true });
  writeFileSync(join(vault, 'CLAUDE.md'), 'Sync vault schema\n');
  writeFileSync(join(vault, 'wiki/log.md'), '# preserved shared ledger\n');
  return { home, vault, env: { ...process.env, HOME: home, SELFCO_VAULT: vault } };
}
function node(script, args, env, input = '') {
  return spawnSync(process.execPath, [join(root, script), ...args], { env, input, encoding: 'utf8', timeout: 10000 });
}
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('Sync vault is outside host telemetry and legacy write paths', () => {
  it('dispatch writes its real event to local state and leaves the vault untouched', () => {
    const { home, vault, env } = fixture();
    const result = node('scripts/dispatch-emit.mjs', ['session-start', '--kind=day-run', '--ref=synthetic-proof'], env);
    expect(result.status).toBe(0);
    const ledger = join(home, '.local/state/ojfbot/tracking/dispatch-sessions.jsonl');
    expect(JSON.parse(readFileSync(ledger, 'utf8'))).toMatchObject({ event: 'dispatch:session-start', ref: 'synthetic-proof' });
    expect(existsSync(join(vault, 'tracking'))).toBe(false);
  });

  it('skill evidence emit uses local state without creating vault tracking files', () => {
    const { home, vault, env } = fixture();
    const evidence = join(home, 'proof.md');
    writeFileSync(evidence, 'controlled artifact\n');
    const result = node('scripts/skill-acted-emit.mjs', ['--suggestion-id=sync-boundary-proof', '--skill=vault', `--evidence=path:${evidence}`], env);
    expect(result.status, result.stderr).toBe(0);
    const ledger = join(home, '.local/state/ojfbot/tracking/opav-loop.jsonl');
    expect(JSON.parse(readFileSync(ledger, 'utf8'))).toMatchObject({ event_type: 'skill:acted', correlation_id: 'sync-boundary-proof' });
    expect(existsSync(join(vault, 'tracking'))).toBe(false);
  });

  it('the default EventLedger reads local state instead of the vault', () => {
    const { home, vault, env } = fixture();
    for (const [directory, marker] of [[join(home, '.local/state/ojfbot/tracking'), 'local'], [join(vault, 'tracking'), 'vault']]) {
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'proof.jsonl'), JSON.stringify({ marker }) + '\n');
    }
    const module = new URL('../../../packages/workflows/dist/tracking/ledger.js', import.meta.url);
    const code = `import { EventLedger } from ${JSON.stringify(module.href)}; console.log(JSON.stringify(await new EventLedger('proof').read()));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ marker: 'local' }]);
  });

  it('legacy quiz capture refuses an existing Sync ledger without modifying it', () => {
    const { vault, env } = fixture();
    const result = node('scripts/hooks/merge-quiz.mjs', ['--capture', '--repo=synthetic'], env, 'a learning block\n');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('shared Sync ledger capture is held');
    expect(readFileSync(join(vault, 'wiki/log.md'), 'utf8')).toBe('# preserved shared ledger\n');
  });

  it('the optional session hook leaves an existing Sync ledger unchanged', () => {
    const { vault, env } = fixture();
    const result = spawnSync('bash', [join(root, 'scripts/hooks/vault-session.sh')], { env, input: '{}', encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('shared Sync ledger writes are held');
    expect(readFileSync(join(vault, 'wiki/log.md'), 'utf8')).toBe('# preserved shared ledger\n');
  });

  it('init refuses to introduce Git or scaffold files into an existing Sync vault', () => {
    const { vault, env } = fixture();
    const result = spawnSync('python3', [join(root, '.claude/skills/vault/scripts/init-vault.py')], { env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('existing non-Git vault');
    expect(existsSync(join(vault, '.git'))).toBe(false);
    expect(existsSync(join(vault, 'raw'))).toBe(false);
    expect(readFileSync(join(vault, 'wiki/log.md'), 'utf8')).toBe('# preserved shared ledger\n');
  });
});
