// `pnpm verify` runs the commitlint and version checks for real, never SKIPPED, and reports PASS or
// FAIL like any other job (adr:deterministic-fleet-versioning). Each case builds a throwaway repo
// with this repository's verify, workflows and checkers, adds commits on a branch, and runs
// `node scripts/verify.mjs --native --job <job>` in it. Needs network once per run (pnpm dlx fetches
// the pinned commitlint CLI, exactly as the CI job does).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let work;
let origin;
let shim;

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const git = (...args) => sh(work, ...args);
const commit = (message, files = {}) => {
  writeFileSync(join(work, `note-${Math.random()}.txt`), message);
  for (const [path, content] of Object.entries(files)) writeFileSync(join(work, path), content);
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message, '--no-gpg-sign');
};

function copy(path) {
  mkdirSync(dirname(join(work, path)), { recursive: true });
  cpSync(join(root, path), join(work, path), { recursive: true, filter: (src) => !src.split('/').includes('node_modules') });
}

const verify = (job) => {
  const r = spawnSync('node', ['scripts/verify.mjs', '--native', '--job', job], {
    cwd: work,
    encoding: 'utf8',
    env: { PATH: `${shim}:${process.env.PATH}`, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR },
    timeout: 180_000,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

beforeAll(() => {
  // verify drops PATH entries ending in node_modules/.bin (CI has none), and on a GitHub runner pnpm
  // itself lives in one; a shim outside such a folder keeps `pnpm` reachable for the job.
  const real = execFileSync('sh', ['-c', 'command -v pnpm'], { encoding: 'utf8' }).trim();
  shim = mkdtempSync(join(tmpdir(), 'verify-commitlint-shim-'));
  writeFileSync(join(shim, 'pnpm'), `#!/bin/sh\nexec "${real}" "$@"\n`);
  chmodSync(join(shim, 'pnpm'), 0o755);
  work = mkdtempSync(join(tmpdir(), 'verify-commitlint-'));
  origin = mkdtempSync(join(tmpdir(), 'verify-commitlint-origin-'));
  sh(origin, 'init', '-q', '--bare', '-b', 'main');
  git('init', '-q', '-b', 'main');
  for (const path of [
    'package.json',
    'pnpm-workspace.yaml',
    'commitlint.config.mjs',
    'release-please-config.json',
    '.release-please-manifest.json',
    '.github/workflows',
    'scripts/verify.mjs',
    'scripts/lib/verify-ci.mjs',
    'scripts/fleet-versioning/check-versions.mjs',
    'scripts/fleet-versioning/lint-commits.mjs',
    'packages/commitlint-config',
    'packages/fleet-runner/package.json',
    'packages/native-dispatch/package.json',
    'packages/read-model-contract/package.json',
    'packages/workflows/package.json',
    'scripts/launcher/tests/package.json',
  ]) {
    copy(path);
  }
  writeFileSync(join(work, '.gitignore'), 'node_modules\n');
  symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'));
  // reuse the already installed (locked) CLI; lint-commits.test.mjs proves the from-scratch install
  symlinkSync(join(root, 'packages', 'commitlint-config', 'node_modules'), join(work, 'packages', 'commitlint-config', 'node_modules'));
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'chore: baseline', '--no-gpg-sign');
  git('remote', 'add', 'origin', origin);
  git('push', '-q', 'origin', 'main');
  git('fetch', '-q', 'origin');
});
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
  rmSync(origin, { recursive: true, force: true });
  rmSync(shim, { recursive: true, force: true });
});

const T = 240_000;

describe('pnpm verify: versioning/commitlint', () => {
  it('PASSes a branch of conforming commits, and the job is not SKIPPED', { timeout: T }, () => {
    git('checkout', '-q', '-B', 'topic', 'origin/main');
    commit('feat(fleet-runner): add a thing');
    commit('fix: repair another');
    const r = verify('versioning/commitlint');
    expect(r.out).toMatch(/PASS\s+versioning\/commitlint/);
    // The job's own status line is never SKIPPED (only the PR-title part may be, when gh knows no PR).
    expect(r.out).not.toMatch(/^SKIPPED\s+versioning/m);
    expect(r.status).toBe(0);
  });

  const bad = [
    ['wrong type', 'wip: add a thing', /type-enum/],
    ['missing colon', 'feat add a thing', /type-empty/],
    ['bad scope', 'feat(Fleet Runner): add a thing', /scope-case|fleet-scope-shape/],
    ['oversized header', `feat: ${'x'.repeat(120)}`, /header-max-length/],
    ['fixup', 'fixup! feat: a conforming commit', /type-empty/],
    ['bare version number', '1.2.3', /type-empty/],
    ['loose revert', 'Revert whatever I like', /type-empty/],
    ['Azure-style merge', 'Merged PR 5: whatever', /type-empty/],
    ['merge line in the body of a bad header', 'feat add thing no colon\n\nMerge branch foo', /type-empty/],
  ];
  it.each(bad)('FAILs a branch with a %s commit, for that reason', { timeout: T }, (_label, message, rule) => {
    git('checkout', '-q', '-B', 'topic', 'origin/main');
    commit('feat: a conforming commit');
    commit(message);
    const r = verify('versioning/commitlint');
    expect(r.out).toMatch(/FAIL\s+versioning\/commitlint/);
    expect(r.out).toMatch(rule); // the lint ran and named the rule; not some other failure
    expect(r.status).not.toBe(0);
  });

  it("PASSes a branch that merged main in with GitHub's own merge header", { timeout: T }, () => {
    git('checkout', '-q', '-B', 'topic', 'origin/main');
    commit('feat: topic work');
    git('checkout', '-q', '-B', 'moved', 'origin/main');
    commit('chore: main moved on');
    git('push', '-q', '-f', 'origin', 'moved:main');
    git('fetch', '-q', 'origin');
    git('checkout', '-q', 'topic');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'merge', '-q', '--no-ff', 'origin/main', '-m', "Merge branch 'main' into topic", '--no-gpg-sign');
    const r = verify('versioning/commitlint');
    expect(r.out).toMatch(/PASS\s+versioning\/commitlint/);
    expect(r.status).toBe(0);
  });

  it('reports the pull request title SKIPPED with its reason when gh knows no pull request', { timeout: T }, () => {
    git('checkout', '-q', '-B', 'topic', 'origin/main');
    commit('feat: a conforming commit');
    const r = verify('versioning/commitlint');
    expect(r.out).toMatch(/pull request title: SKIPPED \((gh found no pull request for this branch|the gh CLI is not available here)\)/);
  });
});

describe('pnpm verify: versioning/versions', () => {
  it('PASSes when no version was touched', { timeout: T }, () => {
    git('checkout', '-q', '-B', 'topic', 'origin/main');
    commit('docs: describe it');
    const r = verify('versioning/versions');
    expect(r.out).toMatch(/PASS\s+versioning\/versions/);
    expect(r.status).toBe(0);
  });

  it('FAILs a hand-edited package.json version', { timeout: T }, () => {
    git('checkout', '-q', '-B', 'topic', 'origin/main');
    const path = 'packages/commitlint-config/package.json';
    const pkg = JSON.parse(readFileSync(join(work, path), 'utf8'));
    pkg.version = '9.9.9';
    commit('fix: bump by hand', { [path]: `${JSON.stringify(pkg, null, 2)}\n` });
    const r = verify('versioning/versions');
    expect(r.out).toMatch(/FAIL\s+versioning\/versions/);
    expect(r.out).toMatch(/version changed 0\.1\.0 -> 9\.9\.9/);
    expect(r.status).not.toBe(0);
  });
});
