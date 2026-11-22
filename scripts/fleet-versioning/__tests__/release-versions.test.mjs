// A dry run of release-please against this repository's real config and manifest, offline: the
// release-please library runs with a stand-in for the GitHub API that serves the repository's own
// files and one synthetic commit per package. It checks RULES, not pinned numbers, so it keeps
// passing as packages are released (including in a release PR itself): every package's next version
// is derived from its current manifest version and the pre-1.0 rules, and must go up.
// release-please is pinned in the root package.json to the version this was written against; the
// release-please-action the workflow uses bundles its own copy, so bump both together.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Manifest, setLogger } from 'release-please';
import { compareSemver } from '../check-versions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const realConfig = JSON.parse(read('release-please-config.json'));
const realManifest = JSON.parse(read('.release-please-manifest.json'));

async function* none() {}

// release-please narrates every step; this test only wants the versions.
setLogger({ error() {}, warn() {}, info() {}, debug() {}, trace() {} });

/** { component: nextVersion } for the release PRs the given commits would open. */
async function dryRun(commitFor, { config = realConfig, manifest = realManifest } = {}) {
  const json = { 'release-please-config.json': config, '.release-please-manifest.json': manifest };
  const commits = Object.keys(config.packages).map((dir, i) => ({
    sha: String(i + 1).padStart(40, '0'),
    message: commitFor(dir),
    // the root package is everything outside the workspace packages
    files: [dir === '.' ? 'docs/note.md' : `${dir}/note.md`],
  }));
  const github = {
    repository: { owner: 'o', repo: 'r', defaultBranch: 'main' },
    getFileJson: async (p) => json[p],
    getFileContentsOnBranch: async (p) => {
      const text = read(p);
      return { sha: 'f', mode: '100644', content: Buffer.from(text).toString('base64'), parsedContent: text };
    },
    findFilesByGlobAndRef: async () => [],
    findFilesByFilenameAndRef: async () => [],
    mergeCommitIterator: async function* () {
      for (const c of commits) yield c;
    },
    releaseIterator: none,
    tagIterator: none,
    pullRequestIterator: none,
  };
  const m = await Manifest.fromManifest(github, 'main', 'release-please-config.json', '.release-please-manifest.json');
  const prs = await m.buildPullRequests([], []);
  return Object.fromEntries(prs.map((pr) => [pr.headRefName.split('components--')[1], pr.version.toString()]));
}

const subject = (type) => (dir) => {
  const breaking = type.endsWith('!') ? '!' : '';
  const scope = dir === '.' ? '' : `(${dir.split('/').pop()})`;
  return `${type.replace('!', '')}${scope}${breaking}: a change`;
};

/** The pre-1.0 rules this repository configures, written out independently of release-please. */
function bump(version, type) {
  const m = /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(version);
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const tail = m[4] ?? '';
  if (version === '0.0.0') return '0.1.0'; // unreleased: initial-version, never 1.0.0
  if (type === 'feat!') {
    if (major === 0) return `0.${minor + 1}.0${tail}`; // bump-minor-pre-major
    return `${major + 1}.0.0${tail}`;
  }
  if (type === 'feat') return `${major}.${minor + 1}.0${tail}`;
  return `${major}.${minor}.${patch + 1}${tail}`; // fix, perf, revert
}

/** A package whose next release is forced by release-as, until the manifest reaches that version. */
const forcedNext = (dir, manifest = realManifest, config = realConfig) => {
  const forced = config.packages[dir]['release-as'];
  if (forced === undefined) return undefined;
  return compareSemver(forced, manifest[dir]) > 0 ? forced : 'released';
};

const releasing = ['fix', 'perf', 'revert', 'feat', 'feat!'];
const componentOf = (dir) => realConfig.packages[dir].component;

describe('the repository as committed', () => {
  it('has a manifest entry equal to package.json for every package', () => {
    for (const dir of Object.keys(realConfig.packages)) {
      const file = dir === '.' ? 'package.json' : `${dir}/package.json`;
      expect(JSON.parse(read(file)).version, file).toBe(realManifest[dir]);
    }
    expect(Object.keys(realManifest).sort()).toEqual(Object.keys(realConfig.packages).sort());
  });

  it('uses release-as only until the manifest reaches that version (a release PR is the first state past it)', () => {
    for (const [dir, entry] of Object.entries(realConfig.packages)) {
      if (entry['release-as'] === undefined) continue;
      expect(compareSemver(entry['release-as'], realManifest[dir]), `${dir} release-as vs manifest`).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(releasing)('a %s commit in each package gives a next version above the current one, by the pre-1.0 rules', async (type) => {
    const next = await dryRun(subject(type));
    for (const dir of Object.keys(realConfig.packages)) {
      const component = componentOf(dir);
      const forced = forcedNext(dir);
      if (forced === 'released') {
        continue; // the release PR for this package is open or merged; the key is cleaned up after
      }
      const expected = forced ?? bump(realManifest[dir], type);
      expect(next[component], `${component} (${realManifest[dir]})`).toBe(expected);
      expect(compareSemver(next[component], realManifest[dir]), component).toBeGreaterThan(0);
    }
  });

  it.each(['docs', 'chore', 'ci', 'test', 'build', 'style', 'refactor'])('a %s commit releases nothing', async (type) => {
    expect(await dryRun(subject(type))).toEqual({});
  });
});

describe('the rules, on synthetic manifests (independent of how far packages have been released)', () => {
  const config = (extra = {}) => ({
    ...realConfig,
    packages: { ...realConfig.packages, ...extra },
  });
  const unforced = () => {
    const packages = JSON.parse(JSON.stringify(realConfig.packages));
    for (const entry of Object.values(packages)) delete entry['release-as'];
    return { ...realConfig, packages };
  };

  it('a package at 0.0.0 first-releases at 0.1.0, never 1.0.0 (initial-version)', async () => {
    expect(realConfig['initial-version']).toBe('0.1.0');
    const manifest = { ...realManifest, 'packages/workflows': '0.0.0' };
    for (const type of ['fix', 'feat', 'feat!']) {
      expect((await dryRun(subject(type), { config: unforced(), manifest }))['workflows']).toBe('0.1.0');
    }
  });

  it('below 1.0 a breaking change bumps the minor; from 1.0 on it bumps the major', async () => {
    const manifest = { ...realManifest, 'packages/workflows': '0.4.2', 'packages/commitlint-config': '1.2.3' };
    const opts = { config: unforced(), manifest };
    expect((await dryRun(subject('feat!'), opts))['workflows']).toBe('0.5.0');
    expect((await dryRun(subject('feat'), opts))['workflows']).toBe('0.5.0');
    expect((await dryRun(subject('fix'), opts))['workflows']).toBe('0.4.3');
    expect((await dryRun(subject('feat!'), opts))['commitlint-config']).toBe('2.0.0');
    expect((await dryRun(subject('feat'), opts))['commitlint-config']).toBe('1.3.0');
    expect((await dryRun(subject('fix'), opts))['commitlint-config']).toBe('1.2.4');
  });

  it('release-as forces the plain version out of a pre-release suffix, and only until it is reached', async () => {
    const cfg = unforced();
    cfg.packages['packages/fleet-runner']['release-as'] = '0.3.0';
    const manifest = { ...realManifest, 'packages/fleet-runner': '0.2.5-bookcase.2' };
    for (const type of ['fix', 'feat', 'feat!']) {
      expect((await dryRun(subject(type), { config: cfg, manifest }))['fleet-runner']).toBe('0.3.0');
    }
    // without the key release-please keeps the suffix, which is why the key exists
    expect((await dryRun(subject('fix'), { config: unforced(), manifest }))['fleet-runner']).toBe('0.2.6-bookcase.2');
  });

  it('is the dry run this repository relies on: perf and revert release a patch, docs-like types nothing', async () => {
    const manifest = { ...realManifest, 'packages/workflows': '0.4.2' };
    for (const type of ['perf', 'revert']) {
      expect((await dryRun(subject(type), { config: unforced(), manifest }))['workflows']).toBe('0.4.3');
    }
  });
});
