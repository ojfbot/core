// The installer must wire commitlint in without silently switching off hooks already in use.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let dir;
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const hooksPath = () => {
  const r = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: dir, encoding: 'utf8' });
  return r.stdout.trim();
};
const install = (cwd = dir) => {
  const r = spawnSync('sh', [join(root, 'scripts', 'install-git-hooks.sh')], { cwd, encoding: 'utf8' });
  return { status: r.status, err: r.stderr };
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hooks-'));
  git('init', '-q');
  cpSync(join(root, '.githooks'), join(dir, '.githooks'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('scripts/install-git-hooks.sh', () => {
  it('points a clean clone at .githooks, and again without changing anything', () => {
    expect(install().status).toBe(0);
    expect(hooksPath()).toBe('.githooks');
    expect(install().status).toBe(0);
    expect(hooksPath()).toBe('.githooks');
  });

  it('does nothing outside a git checkout or without .githooks', () => {
    const plain = mkdtempSync(join(tmpdir(), 'plain-'));
    try {
      expect(install(plain).status).toBe(0);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
    rmSync(join(dir, '.githooks'), { recursive: true, force: true });
    expect(install().status).toBe(0);
    expect(hooksPath()).toBe('');
  });

  it('refuses to replace another core.hooksPath, and leaves it alone', () => {
    git('config', 'core.hooksPath', 'tools/hooks');
    const r = install();
    expect(r.status).toBe(1);
    expect(r.err).toMatch(/core\.hooksPath is already "tools\/hooks"/);
    expect(hooksPath()).toBe('tools/hooks');
  });

  it('refuses to switch off an active hook in .git/hooks', () => {
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(dir, '.git', 'hooks', 'pre-commit'), 0o755);
    const r = install();
    expect(r.status).toBe(1);
    expect(r.err).toMatch(/active hook/);
    expect(hooksPath()).toBe('');
  });

  it('ignores the .sample hooks git ships', () => {
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit.sample'), '#!/bin/sh\n');
    chmodSync(join(dir, '.git', 'hooks', 'pre-commit.sample'), 0o755);
    expect(install().status).toBe(0);
  });

  describe('a Husky repo', () => {
    beforeEach(() => {
      rmSync(join(dir, '.githooks'), { recursive: true, force: true });
      mkdirSync(join(dir, '.husky'));
      git('config', 'core.hooksPath', '.husky/_');
    });

    it('fails loudly while .husky/commit-msg does not run commitlint', () => {
      writeFileSync(join(dir, '.husky', 'pre-commit'), 'pnpm run secret-scan\n');
      const r = install();
      expect(r.status).toBe(1);
      expect(r.err).toMatch(/uses Husky/);
      expect(hooksPath()).toBe('.husky/_');
    });

    it('is satisfied by a Husky commit-msg hook that runs commitlint, and leaves Husky in charge', () => {
      writeFileSync(join(dir, '.husky', 'commit-msg'), 'pnpm exec commitlint --edit "$1"\n');
      expect(install().status).toBe(0);
      expect(hooksPath()).toBe('.husky/_');
    });
  });
});
