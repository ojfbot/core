import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkCoverage, checkEdits } from '../check-versions.mjs';

const CONFIG = 'release-please-config.json';
const MANIFEST = '.release-please-manifest.json';

let dir;
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const put = (path, content) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
};
const pkg = (name, version) => ({ name, version, private: true });
const commit = (msg) => {
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', msg, '--no-gpg-sign');
  return git('rev-parse', 'HEAD');
};
const config = (packages) => ({
  'separate-pull-requests': true,
  'include-component-in-tag': true,
  packages,
});

function baseRepo() {
  put('package.json', pkg('root', '1.0.0'));
  put('packages/a/package.json', pkg('a', '0.2.0'));
  put(CONFIG, config({ '.': { component: 'root' }, 'packages/a': { component: 'a' } }));
  put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.2.0' });
  return commit('chore: init');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fleet-versions-'));
  git('init', '-q', '-b', 'main');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('checkCoverage', () => {
  it('passes when every package.json is configured and matches the manifest', () => {
    baseRepo();
    expect(checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST })).toEqual([]);
  });

  it('flags a package that release-please does not know about', () => {
    baseRepo();
    put('packages/b/package.json', pkg('b', '0.1.0'));
    commit('feat: add b');
    const problems = checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST });
    expect(problems.join('\n')).toMatch(/packages\/b\/package\.json is not in/);
  });

  it('ignores package.json files under node_modules', () => {
    baseRepo();
    put('node_modules/x/package.json', pkg('x', '9.9.9'));
    git('add', '-f', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'chore: vendored', '--no-gpg-sign');
    expect(checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST })).toEqual([]);
  });

  it('flags a version that disagrees with the manifest', () => {
    baseRepo();
    put('packages/a/package.json', pkg('a', '0.3.0'));
    commit('chore: x');
    const problems = checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST });
    expect(problems.join('\n')).toMatch(/says version 0\.3\.0 but .* says 0\.2\.0/);
  });

  it('requires one release PR per package, a component per package, and unique components', () => {
    baseRepo();
    put(CONFIG, { packages: { '.': { component: 'x' }, 'packages/a': { component: 'x' } } });
    commit('chore: config');
    const text = checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST }).join('\n');
    expect(text).toMatch(/separate-pull-requests/);
    expect(text).toMatch(/component "x" is used by two packages/);
  });

  it('fails when the config file is missing', () => {
    put('package.json', pkg('root', '1.0.0'));
    commit('chore: init');
    expect(checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST })[0]).toMatch(/is missing/);
  });
});

describe('checkEdits', () => {
  const run = (base, head, extra = {}) =>
    checkEdits({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST, baseSha: base, headSha: head, ...extra });

  it('allows changes that do not touch versions', () => {
    const base = baseRepo();
    put('packages/a/package.json', { ...pkg('a', '0.2.0'), description: 'edited' });
    expect(run(base, commit('docs: describe a'))).toEqual([]);
  });

  it('refuses a hand-edited package.json version', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '0.2.1'));
    const problems = run(base, commit('fix: bump by hand'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/packages\/a\/package\.json: version changed 0\.2\.0 -> 0\.2\.1/);
  });

  it('refuses removing the version field', () => {
    const base = baseRepo();
    put('packages/a/package.json', { name: 'a', private: true });
    expect(run(base, commit('chore: drop version'))[0]).toMatch(/\(removed\)/);
  });

  it('refuses a hand-edited manifest entry', () => {
    const base = baseRepo();
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.9.0' });
    expect(run(base, commit('chore: manifest'))[0]).toMatch(/Only release-please's release PR/);
  });

  it('allows release-please\'s own branch when package.json and manifest agree', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '0.3.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0' });
    const head = commit('chore(main): release a 0.3.0');
    const ctx = { headRef: 'release-please--branches--main--components--a', headRepo: 'o/r', baseRepo: 'o/r' };
    expect(run(base, head, ctx)).toEqual([]);
  });

  it('does not trust a release-please branch name from a fork', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '0.3.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0' });
    const head = commit('chore: sneaky');
    const ctx = { headRef: 'release-please--branches--main', headRepo: 'fork/r', baseRepo: 'o/r' };
    expect(run(base, head, ctx).length).toBeGreaterThan(0);
  });

  it('refuses a release-please branch whose package.json disagrees with the manifest', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '5.0.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0' });
    const head = commit('chore: mismatch');
    const ctx = { headRef: 'release-please--branches--main', headRepo: 'o/r', baseRepo: 'o/r' };
    expect(run(base, head, ctx).join('\n')).toMatch(/packages\/a\/package\.json: version changed/);
  });

  it('lets a new package declare its starting version when the manifest agrees', () => {
    const base = baseRepo();
    put('packages/b/package.json', pkg('b', '0.1.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.2.0', 'packages/b': '0.1.0' });
    expect(run(base, commit('feat: add b'))).toEqual([]);
  });

  it('refuses a new package whose version differs from its manifest entry', () => {
    const base = baseRepo();
    put('packages/b/package.json', pkg('b', '3.0.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.2.0', 'packages/b': '0.1.0' });
    expect(run(base, commit('feat: add b'))[0]).toMatch(/is new with version 3\.0\.0/);
  });

  it('compares against the merge base, not the moved tip of main', () => {
    const base = baseRepo();
    git('checkout', '-q', '-b', 'topic');
    put('x.txt', 'topic');
    const head = commit('feat: topic work');
    git('checkout', '-q', 'main');
    put('packages/a/package.json', pkg('a', '0.2.1'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.2.1' });
    const tip = commit('chore(main): release a 0.2.1');
    expect(run(tip, head)).toEqual([]);
    expect(base).not.toBe(tip);
  });
});
