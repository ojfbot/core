import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

it('passes the create-only Sync capture fault and conflict proofs', () => {
  const test = fileURLToPath(new URL('./capture-sync.test.py', import.meta.url));
  const result = spawnSync('python3', [test], { encoding: 'utf8', timeout: 10000 });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 15000);
