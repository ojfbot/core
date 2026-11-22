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
  it('fails when .githooks has no executable commit-msg that runs commitlint', () => {
    writeFileSync(join(dir, '.githooks', 'commit-msg'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(dir, '.githooks', 'commit-msg'), 0o755);
    expect(install().status).toBe(1);
    writeFileSync(join(dir, '.githooks', 'commit-msg'), '#!/bin/sh\nexec pnpm exec commitlint --edit "$1"\n');
    chmodSync(join(dir, '.githooks', 'commit-msg'), 0o644);
    expect(install().err).toMatch(/missing or not executable/);
  });

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

    const husky = () => {
      // what `husky` leaves behind: core.hooksPath at .husky/_ and an executable shim there
      mkdirSync(join(dir, '.husky', '_'), { recursive: true });
      writeFileSync(join(dir, '.husky', '_', 'commit-msg'), '#!/bin/sh\n. "$(dirname "$0")/h"\n');
      chmodSync(join(dir, '.husky', '_', 'commit-msg'), 0o755);
      git('config', 'core.hooksPath', '.husky/_');
    };

    it('is satisfied by a Husky commit-msg hook that runs commitlint once Husky has run, and leaves Husky in charge', () => {
      writeFileSync(join(dir, '.husky', 'commit-msg'), 'pnpm exec commitlint --edit "$1"\n');
      husky();
      expect(install().status).toBe(0);
      expect(hooksPath()).toBe('.husky/_');
    });

    it('fails when Husky has not run: the source hook exists but nothing is active', () => {
      writeFileSync(join(dir, '.husky', 'commit-msg'), 'pnpm exec commitlint --edit "$1"\n');
      git('config', '--unset', 'core.hooksPath');
      const r = install();
      expect(r.status).toBe(1);
      expect(r.err).toMatch(/core\.hooksPath is not set, so no commit-msg hook is active/);
      expect(r.err).toMatch(/husky && sh scripts\/install-git-hooks\.sh/);
    });

    it('fails when the generated shim is missing or Husky\'s hook does not run commitlint', () => {
      writeFileSync(join(dir, '.husky', 'commit-msg'), 'pnpm exec commitlint --edit "$1"\n');
      expect(install().err).toMatch(/is missing or not executable/); // hooksPath set, .husky/_ not generated
      husky();
      writeFileSync(join(dir, '.husky', 'commit-msg'), 'echo hello\n');
      expect(install().status).toBe(1); // no commitlint in .husky/commit-msg at all
    });

    it('a fresh clone of a Husky repo fails the install until Husky has run, then passes', () => {
      writeFileSync(join(dir, '.husky', 'commit-msg'), 'pnpm exec commitlint --edit "$1"\n');
      git('config', '--unset', 'core.hooksPath');
      git('add', '-A');
      git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'chore: husky repo', '--no-gpg-sign');
      const clone = `${dir}-clone`;
      execFileSync('git', ['clone', '-q', dir, clone]);
      try {
        const first = install(clone);
        expect(first.status).toBe(1); // a fresh clone: no core.hooksPath, no .husky/_
        mkdirSync(join(clone, '.husky', '_'), { recursive: true });
        writeFileSync(join(clone, '.husky', '_', 'commit-msg'), '#!/bin/sh\n. "$(dirname "$0")/h"\n');
        chmodSync(join(clone, '.husky', '_', 'commit-msg'), 0o755);
        execFileSync('git', ['config', 'core.hooksPath', '.husky/_'], { cwd: clone });
        expect(install(clone).status).toBe(0);
      } finally {
        rmSync(clone, { recursive: true, force: true });
      }
    });
  });
});
