import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SettingsError, loadSettings, parseEnvFile, loadEnv,
} from '../../templates/package-settings/settings.ts';

const SECRET = 'tok-' + 'S'.repeat(32);

describe('package settings template (adr:package-env-files)', () => {
  let dir, envFile, tokenFile;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'pkg-settings-'));
    envFile = path.join(dir, '.env');
    tokenFile = path.join(dir, 'token');
    writeFileSync(tokenFile, SECRET + '\n');
    chmodSync(tokenFile, 0o600);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const writeEnv = (text, mode = 0o600) => { writeFileSync(envFile, text); chmodSync(envFile, mode); };

  it('resolves named constants from the package .env, with real environment variables winning', () => {
    writeEnv(`# comment\nEXAMPLE_ENDPOINT="https://a.invalid"\nEXAMPLE_TOKEN_FILE=${tokenFile}\nEXAMPLE_WORKERS=4\n`);
    const settings = loadSettings({ EXAMPLE_WORKERS: '8' }, envFile);
    expect(settings).toEqual({ endpoint: 'https://a.invalid', token: SECRET, workers: 8 });
    expect(Object.isFrozen(settings)).toBe(true);
  });

  it('works with no .env at all when the environment supplies everything', () => {
    const settings = loadSettings({ EXAMPLE_ENDPOINT: 'e', EXAMPLE_TOKEN_FILE: tokenFile }, envFile);
    expect(settings.workers).toBe(2);
  });

  it('refuses a .env or a secret file that other users can read', () => {
    writeEnv(`EXAMPLE_ENDPOINT=e\nEXAMPLE_TOKEN_FILE=${tokenFile}\n`, 0o644);
    expect(() => loadSettings({}, envFile)).toThrow(/must be private/);
    writeEnv(`EXAMPLE_ENDPOINT=e\nEXAMPLE_TOKEN_FILE=${tokenFile}\n`);
    chmodSync(tokenFile, 0o640);
    expect(() => loadSettings({}, envFile)).toThrow('the file named by EXAMPLE_TOKEN_FILE must be private (chmod 600)');
  });

  it('names the key, never the value, in every error', () => {
    writeEnv(`EXAMPLE_ENDPOINT=e\nEXAMPLE_TOKEN_FILE=${tokenFile}\nEXAMPLE_WORKERS=${SECRET}\n`);
    let caught;
    try { loadSettings({}, envFile); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(SettingsError);
    expect(caught.message).toBe('EXAMPLE_WORKERS must be a whole number from 1 to 32');
    expect(caught.message).not.toContain(SECRET);
    expect(() => loadSettings({ EXAMPLE_TOKEN_FILE: tokenFile }, path.join(dir, 'none'))).toThrow('missing setting: EXAMPLE_ENDPOINT');
  });

  it('rejects a malformed .env line by number', () => {
    expect(() => parseEnvFile('OK=1\nexport BAD=2\n')).toThrow('.env line 2 is not KEY=VALUE');
  });

  it('ignores undefined environment entries when merging', () => {
    writeEnv('A=from-file\n');
    expect(loadEnv(envFile, { A: undefined }).A).toBe('from-file');
  });
});
