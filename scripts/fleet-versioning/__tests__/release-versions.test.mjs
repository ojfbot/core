// A dry run of release-please against this repository's real config and manifest, offline: the
// release-please library runs with a stand-in for the GitHub API that serves the repository's own
// files and one synthetic commit per package. It shows, for every package, the version the next
// release PR would carry, so the pre-1.0 rules (and the 0.0.0 trap) are tested, not assumed.
// release-please is pinned in the root package.json to the version this was written against; the
// release-please-action the workflow uses bundles its own copy, so bump both together.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Manifest, setLogger } from 'release-please';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const config = JSON.parse(read('release-please-config.json'));
const manifest = JSON.parse(read('.release-please-manifest.json'));

async function* none() {}

// release-please narrates every step; this test only wants the versions.
const silent = { error() {}, warn() {}, info() {}, debug() {}, trace() {} };
setLogger(silent);

/** { component: nextVersion } for the release PRs the given commits would open. */
async function dryRun(commitFor, manifestOverride = manifest) {
  const json = { 'release-please-config.json': config, '.release-please-manifest.json': manifestOverride };
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

// What the next release of each package is, per kind of commit, from the manifest as committed.
const expected = {
  fix: { core: '0.1.1', 'commitlint-config': '0.1.1', 'fleet-runner': '0.3.0', 'native-dispatch': '0.4.6', 'read-model-contract': '0.1.1', workflows: '0.1.1', 'launcher-tests': '0.1.0' },
  perf: { core: '0.1.1', 'commitlint-config': '0.1.1', 'fleet-runner': '0.3.0', 'native-dispatch': '0.4.6', 'read-model-contract': '0.1.1', workflows: '0.1.1', 'launcher-tests': '0.1.0' },
  revert: { core: '0.1.1', 'commitlint-config': '0.1.1', 'fleet-runner': '0.3.0', 'native-dispatch': '0.4.6', 'read-model-contract': '0.1.1', workflows: '0.1.1', 'launcher-tests': '0.1.0' },
  feat: { core: '0.2.0', 'commitlint-config': '0.2.0', 'fleet-runner': '0.3.0', 'native-dispatch': '0.5.0', 'read-model-contract': '0.2.0', workflows: '0.2.0', 'launcher-tests': '0.1.0' },
  // below 1.0 a breaking change bumps the minor (bump-minor-pre-major)
  'feat!': { core: '0.2.0', 'commitlint-config': '0.2.0', 'fleet-runner': '0.3.0', 'native-dispatch': '0.5.0', 'read-model-contract': '0.2.0', workflows: '0.2.0', 'launcher-tests': '0.1.0' },
};

describe('release-please dry run over every package', () => {
  it('covers every package in the config', () => {
    expect(Object.keys(expected.fix).sort()).toEqual(Object.values(config.packages).map((p) => p.component).sort());
  });

  it.each(Object.keys(expected))('a %s commit in each package gives these next versions', async (type) => {
    expect(await dryRun(subject(type))).toEqual(expected[type]);
  });

  it.each(['docs', 'chore', 'ci', 'test', 'build', 'style', 'refactor'])('a %s commit releases nothing', async (type) => {
    expect(await dryRun(subject(type))).toEqual({});
  });

  it("FleetRunner's first release is the plain 0.3.0 (owner decision: drop the bookcase tail), forced once", async () => {
    expect(manifest['packages/fleet-runner']).toBe('0.2.5-bookcase.2');
    expect(config.packages['packages/fleet-runner']['release-as']).toBe('0.3.0');
    const forced = Object.entries(config.packages).filter(([, p]) => p['release-as'] !== undefined);
    expect(forced.map(([dir]) => dir)).toEqual(['packages/fleet-runner']);
    for (const type of ['fix', 'feat', 'feat!']) {
      expect((await dryRun(subject(type)))['fleet-runner']).toBe('0.3.0');
    }
  });

  it('a package at 0.0.0 starts at 0.1.0, never 1.0.0 (initial-version)', async () => {
    expect(manifest['scripts/launcher/tests']).toBe('0.0.0');
    expect(config['initial-version']).toBe('0.1.0');
    for (const type of ['fix', 'feat', 'feat!']) {
      expect((await dryRun(subject(type)))['launcher-tests']).toBe('0.1.0');
    }
  });

  it('from 1.0 on, a breaking change bumps the major', async () => {
    const stable = { ...manifest, 'packages/commitlint-config': '1.2.3' };
    const next = await dryRun(subject('feat!'), stable);
    expect(next['commitlint-config']).toBe('2.0.0');
    expect((await dryRun(subject('feat'), stable))['commitlint-config']).toBe('1.3.0');
    expect((await dryRun(subject('fix'), stable))['commitlint-config']).toBe('1.2.4');
  });
});
