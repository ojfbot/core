#!/usr/bin/env node
// Two deterministic checks that keep versions in the hands of release-please
// (adr:deterministic-fleet-versioning). Node builtins and the git CLI only: the reusable workflow
// runs this from a pinned checkout of Core against the calling repo, with nothing installed.
//
//   coverage  every package.json in the repo has an entry in release-please-config.json and in
//             the manifest, and the config has the settings the convention depends on.
//   edits     between the merge base and the head of a pull request, no package.json `version`
//             and no existing manifest entry changed, except in release-please's own PR. That PR is
//             recognised by who it really is, never by its branch name alone: the pull request's
//             author is a configured release-please actor, every commit on it is authored by one,
//             the changed files are only what release-please writes (version-only package.json
//             edits, the manifest, CHANGELOG.md), and every version goes up.
//
// Any git error fails the check. For a push to the default branch set EVENT_NAME=push: there is no
// pull request, so release-please's own merge is recognised by its commits and files alone.
//
// Usage: node check-versions.mjs [coverage|edits|all]   (default: all)
// Environment for `edits`: BASE_SHA, HEAD_SHA, and optionally HEAD_REF, HEAD_REPO, BASE_REPO,
// PR_AUTHOR (the pull request author's login), RELEASE_ACTORS (comma-separated logins allowed to
// open release PRs; default github-actions[bot]) and RELEASE_EXTRA_FILES (comma-separated paths,
// `*` allowed, that release-please also writes in this repo, for example pyproject.toml).
// Optional: RELEASE_PLEASE_CONFIG, RELEASE_PLEASE_MANIFEST (paths relative to the repo root).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_BRANCH = /^release-please--branches--[A-Za-z0-9._/-]+$/;

function git(cwd, args, opts = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', opts.allowFail ? 'ignore' : 'inherit'],
  });
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

// "." is the repo root; every other key is a package directory without a trailing slash.
function dirOf(packageJsonPath) {
  const dir = posix.dirname(packageJsonPath);
  return dir === '.' ? '.' : dir;
}

/**
 * The file's text at `rev`, or null when the file is not in that commit. Absence is decided by the
 * tree (`ls-tree`), never by a failed read: any git error, such as a blob a partial clone cannot
 * fetch, throws and fails the check instead of reading as "file absent".
 */
function readAt(cwd, rev, path) {
  if (git(cwd, ['ls-tree', '--name-only', rev, '--', path]).trim() === '') return null;
  return git(cwd, ['show', `${rev}:${path}`]);
}

function versionOf(text, label) {
  if (text === null) return undefined;
  const parsed = parseJson(text, label);
  return typeof parsed.version === 'string' ? parsed.version : undefined;
}


const DEFAULT_ACTORS = ['github-actions[bot]'];

/** `[major, minor, patch, prerelease]` or null. */
function parseSemver(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(version));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ?? null] : null;
}

/** Negative, zero or positive like a comparator; null when either is not a version. */
export function compareSemver(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  if (x[3] === y[3]) return 0;
  if (x[3] === null) return 1;
  if (y[3] === null) return -1;
  const pa = x[3].split('.');
  const pb = y[3].split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = /^\d+$/.test(pa[i]);
    const nb = /^\d+$/.test(pb[i]);
    if (na && nb && Number(pa[i]) !== Number(pb[i])) return Number(pa[i]) - Number(pb[i]);
    if (na !== nb) return na ? -1 : 1;
    if (!na && pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

const stable = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

function globToRegExp(glob) {
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
}

/** The login a GitHub noreply address stands for, or null (`123+name[bot]@users.noreply.github.com`). */
function noreplyLogin(email) {
  const m = /^(?:\d+\+)?(.+)@users\.noreply\.github\.com$/.exec(String(email).trim());
  return m ? m[1] : null;
}

/**
 * Whether this really is release-please's change, as a list of reasons it is not (empty means it
 * is). A branch name proves nothing: anyone who can push can pick one. What a collaborator cannot
 * do is open a pull request as the release-please actor, so the author is the anchor for a pull
 * request; the commit authors and the file set then limit what anyone can add to a real release
 * PR's branch. For a push (no pull request) only the commits and files can be checked. Commit
 * author emails are NOT proof of identity (anyone can set them), and the shared Actions bot is a
 * shared identity; this guards against mistakes and imitation, not against a writer who can edit
 * workflows or push to the branch. Required status checks, branch protection and CODEOWNERS on
 * .github/ carry that (see versioning-convention.md, "Threat model"). It also cannot prove a version
 * is the number release-please computed: reviewing the release PR does.
 *
 * Exactly one package may change: the one named by the branch (`...--components--<component>`), or
 * for a push the only package directory the change touches. Only that package's version-only
 * package.json, its CHANGELOG.md, the manifest entry for it and any named extra files may differ.
 */
export function releasePrProblems({ cwd, base, headSha, changed, headRef, headRepo, baseRepo, prAuthor, actors, extraFiles, manifestPath, configPath, push = false }) {
  const why = [];
  const allowed = new Set(actors);
  let dir;
  if (!push) {
    if (!(typeof headRef === 'string' && RELEASE_BRANCH.test(headRef))) return ['the branch is not named like a release-please branch'];
    if (!headRepo || !baseRepo || headRepo !== baseRepo) why.push('the branch is not in this repository (a fork)');
    if (!prAuthor || !allowed.has(prAuthor)) {
      why.push(`the pull request was opened by "${prAuthor || '(unknown)'}", not a release-please actor (${[...allowed].join(', ')})`);
    }
    const component = /--components--(.+)$/.exec(headRef)?.[1];
    if (!component) {
      why.push('the branch names no component, but this repo releases one package per pull request');
    } else {
      const configText = readAt(cwd, base, configPath);
      const packages = configText ? parseJson(configText, `${configPath} at base`).packages ?? {} : {};
      dir = Object.keys(packages).find((d) => packages[d].component === component);
      if (dir === undefined) why.push(`the branch names component "${component}", which ${configPath} does not define`);
    }
  } else {
    const dirs = new Set(changed.filter((f) => f !== manifestPath).map((f) => (posix.dirname(f) === '.' ? '.' : posix.dirname(f))));
    if (dirs.size !== 1) why.push(`a release changes exactly one package, but this touches ${dirs.size === 0 ? 'none' : [...dirs].join(', ')}`);
    else dir = [...dirs][0];
  }

  const log = git(cwd, ['log', '--format=%H%x1f%ae%x1f%ce', `${base}..${headSha}`]).split('\n').filter(Boolean);
  if (log.length === 0) why.push('it has no commits');
  for (const line of log) {
    const [sha, authorEmail, committerEmail] = line.split('\x1f');
    if (!allowed.has(noreplyLogin(authorEmail))) why.push(`commit ${sha.slice(0, 7)} is authored by ${authorEmail}, not a release-please actor`);
    // On a push the committer is whoever merged: a rebase merge rewrites it to the person who clicked
    // the button, while the author stays release-please. Only a pull request branch constrains it.
    const committer = noreplyLogin(committerEmail);
    if (!push && !(allowed.has(committer) || committerEmail === 'noreply@github.com')) why.push(`commit ${sha.slice(0, 7)} is committed by ${committerEmail}, not a release-please actor or GitHub`);
  }

  const under = (file) => dir === undefined || dir === '.' || file === dir || file.startsWith(`${dir}/`);
  const own = (name) => (dir === undefined || dir === '.' ? name : `${dir}/${name}`);
  const extra = extraFiles.map(globToRegExp);
  for (const file of changed) {
    if (file === manifestPath || file === own('CHANGELOG.md')) continue;
    if (dir !== undefined && extra.some((re) => re.test(file)) && under(file)) continue;
    if (file === own('package.json')) {
      const oldText = readAt(cwd, base, file);
      const newText = readAt(cwd, headSha, file);
      if (oldText === null || newText === null) {
        why.push(`${file} is ${oldText === null ? 'added' : 'deleted'}; release-please only edits existing package.json files`);
        continue;
      }
      const { version: ov, ...oRest } = parseJson(oldText, `${file} at base`);
      const { version: nv, ...nRest } = parseJson(newText, `${file} at head`);
      if (stable(oRest) !== stable(nRest)) why.push(`${file} changes more than "version"`);
      if (ov !== nv) {
        const order = compareSemver(nv, ov);
        if (order === null || order <= 0) why.push(`${file}: version ${ov} -> ${nv} does not go up`);
      }
      continue;
    }
    why.push(`${file} is not a file this release may change (only ${own('package.json')} (version only), ${own('CHANGELOG.md')}, ${manifestPath}${extraFiles.length ? `, ${extraFiles.join(', ')}` : ''})`);
  }

  // The manifest may change one entry, the package being released.
  const mb = readAt(cwd, base, manifestPath);
  const ma = readAt(cwd, headSha, manifestPath);
  const before = mb ? parseJson(mb, `${manifestPath} at base`) : {};
  const after = ma ? parseJson(ma, `${manifestPath} at head`) : {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key] && key !== dir) why.push(`${manifestPath} changes "${key}", but this release is for ${dir === undefined ? 'an unknown package' : `"${dir}"`}`);
  }
  return why;
}

export function checkCoverage({ cwd, configPath, manifestPath }) {
  const problems = [];
  if (!existsSync(posix.join(cwd, configPath))) {
    return [`${configPath} is missing: every package needs release-please (adr:deterministic-fleet-versioning)`];
  }
  if (!existsSync(posix.join(cwd, manifestPath))) {
    return [`${manifestPath} is missing: it records each package's last released version`];
  }
  const config = parseJson(readFileSync(posix.join(cwd, configPath), 'utf8'), configPath);
  const manifest = parseJson(readFileSync(posix.join(cwd, manifestPath), 'utf8'), manifestPath);
  const packages = config.packages ?? {};

  if (config['separate-pull-requests'] !== true) {
    problems.push(`${configPath}: "separate-pull-requests" must be true (one release PR per package)`);
  }
  if (config['include-component-in-tag'] === false) {
    problems.push(`${configPath}: "include-component-in-tag" must not be false (tags are <package>-vX.Y.Z)`);
  }
  if (config['tag-separator'] !== undefined && config['tag-separator'] !== '-') {
    problems.push(`${configPath}: "tag-separator" must be "-" (tags are <package>-vX.Y.Z)`);
  }
  if (config['include-v-in-tag'] === false) {
    problems.push(`${configPath}: "include-v-in-tag" must not be false (tags are <package>-vX.Y.Z)`);
  }

  const files = git(cwd, ['ls-files', '-z', '--', ':(glob)**/package.json'])
    .split('\0')
    .filter(Boolean)
    .filter((f) => !f.split('/').includes('node_modules'));
  const dirs = new Set(files.map(dirOf));

  for (const dir of [...dirs].sort()) {
    if (!(dir in packages)) {
      problems.push(`${dir}/package.json is not in ${configPath} "packages": every package uses release-please`);
    } else if (!(dir in manifest)) {
      problems.push(`${dir} has no entry in ${manifestPath}: start it at its current version`);
    }
  }
  for (const dir of Object.keys(packages)) {
    if (!dirs.has(dir)) problems.push(`${configPath} lists "${dir}" but it has no tracked package.json`);
    if (!(dir in manifest)) problems.push(`${dir} is in ${configPath} but has no ${manifestPath} entry`);
    if (!packages[dir].component) {
      problems.push(`${configPath}: "${dir}" needs a "component" (the tag becomes <component>-vX.Y.Z)`);
    }
  }
  for (const dir of Object.keys(manifest)) {
    if (!(dir in packages)) problems.push(`${manifestPath} lists "${dir}" but ${configPath} does not`);
  }
  // `release-as` forces one version for the next release only. Once that release's tag exists it
  // must go, or every later release would be forced to the same number.
  const tags = new Set(git(cwd, ['tag', '--list']).split('\n').map((t) => t.trim()).filter(Boolean));
  for (const [dir, entry] of Object.entries(packages)) {
    const forced = entry['release-as'] ?? config['release-as'];
    if (forced !== undefined && entry.component && tags.has(`${entry.component}-v${forced}`)) {
      problems.push(`${configPath}: "release-as" ${forced} is still set for "${dir}" but ${entry.component}-v${forced} is already released; remove it so later releases are computed again`);
    }
  }
  const components = Object.values(packages).map((p) => p.component).filter(Boolean);
  const dup = components.find((c, i) => components.indexOf(c) !== i);
  if (dup) problems.push(`${configPath}: component "${dup}" is used by two packages, so their tags would collide`);

  // The tracked version must equal the manifest only where nobody has released since: both files
  // are written together by release-please, so a mismatch means a hand edit or a missed bump.
  for (const file of files) {
    const dir = dirOf(file);
    if (!(dir in manifest)) continue;
    const have = versionOf(readFileSync(posix.join(cwd, file), 'utf8'), file);
    if (have !== undefined && have !== manifest[dir]) {
      problems.push(`${file} says version ${have} but ${manifestPath} says ${manifest[dir]} for "${dir}"`);
    }
  }
  return problems;
}

/** Whether any package.json version or manifest entry differs between the two commits. */
function versionEdited(cwd, base, headSha, changed) {
  return changed.some((f) => {
    if (!(f === 'package.json' || f.endsWith('/package.json'))) return false;
    return versionOf(readAt(cwd, base, f), f) !== versionOf(readAt(cwd, headSha, f), f);
  });
}

export function checkEdits({ cwd, configPath, manifestPath, baseSha, headSha, headRef, headRepo, baseRepo, prAuthor, actors = DEFAULT_ACTORS, extraFiles = [], push = false }) {
  const problems = [];
  const base = git(cwd, ['merge-base', baseSha, headSha]).trim();

  const changed = git(cwd, ['diff', '--name-only', '-z', '--no-renames', base, headSha])
    .split('\0')
    .filter(Boolean);
  // A pull request claims to be release-please's by its branch name; a push has no branch to claim
  // with, so it is judged on its commits and files alone.
  const claimsRelease = push || (typeof headRef === 'string' && RELEASE_BRANCH.test(headRef));
  const notRelease = claimsRelease
    ? releasePrProblems({ cwd, base, headSha, changed, headRef, headRepo, baseRepo, prAuthor, actors, extraFiles, manifestPath, configPath, push })
    : [];
  const fromReleasePlease = claimsRelease && notRelease.length === 0;
  if (claimsRelease && !fromReleasePlease && !push) {
    problems.push(
      `the branch "${headRef}" is named like a release-please branch but this is not release-please's pull request, so it gets no exemption: ${notRelease.join('; ')}`,
    );
  } else if (push && !fromReleasePlease && changed.length > 0 && (versionEdited(cwd, base, headSha, changed))) {
    problems.push(`this push changes versions but is not release-please's merge, so it gets no exemption: ${notRelease.join('; ')}`);
  }
  const manifestBefore = readAt(cwd, base, manifestPath);
  const manifestAfter = readAt(cwd, headSha, manifestPath);
  const before = manifestBefore ? parseJson(manifestBefore, `${manifestPath} at base`) : {};
  const after = manifestAfter ? parseJson(manifestAfter, `${manifestPath} at head`) : {};

  for (const file of changed.filter((f) => f === 'package.json' || f.endsWith('/package.json'))) {
    if (file.split('/').includes('node_modules')) continue;
    const dir = dirOf(file);
    const oldText = readAt(cwd, base, file);
    const newText = readAt(cwd, headSha, file);
    const oldVersion = versionOf(oldText, `${file} at base`);
    const newVersion = versionOf(newText, `${file} at head`);
    if (oldVersion === newVersion) continue;

    const created = oldText === null;
    if (created) {
      // A new package declares its starting version in its manifest entry; the two must agree.
      if (newVersion !== undefined && after[dir] !== newVersion) {
        problems.push(`${file} is new with version ${newVersion}, but ${manifestPath} has ${after[dir] ?? 'no entry'} for "${dir}"`);
      }
      continue;
    }
    if (newText === null) continue; // deleted package
    if (fromReleasePlease && newVersion !== undefined && after[dir] === newVersion) continue;
    problems.push(
      `${file}: version changed ${oldVersion ?? '(none)'} -> ${newVersion ?? '(removed)'}. ` +
        'Versions are computed by release-please from commit types; merge its release PR instead of editing this field.',
    );
  }

  for (const [dir, version] of Object.entries(before)) {
    if (!(dir in after)) continue; // package removed
    if (after[dir] === version) continue;
    if (fromReleasePlease) {
      const order = compareSemver(after[dir], version);
      if (order === null || order <= 0) problems.push(`${manifestPath}: "${dir}" ${version} -> ${after[dir]} does not go up`);
      continue;
    }
    problems.push(
      `${manifestPath}: "${dir}" changed ${version} -> ${after[dir]}. Only release-please's release PR may change an existing entry.`,
    );
  }
  return problems;
}

function main() {
  const mode = process.argv[2] ?? 'all';
  if (!['coverage', 'edits', 'all'].includes(mode)) {
    console.error('usage: check-versions.mjs [coverage|edits|all]');
    process.exit(2);
  }
  const cwd = process.cwd();
  const configPath = process.env.RELEASE_PLEASE_CONFIG || 'release-please-config.json';
  const manifestPath = process.env.RELEASE_PLEASE_MANIFEST || '.release-please-manifest.json';
  const problems = [];
  if (mode === 'coverage' || mode === 'all') {
    problems.push(...checkCoverage({ cwd, configPath, manifestPath }));
  }
  if (mode === 'edits' || mode === 'all') {
    const { BASE_SHA: baseSha, HEAD_SHA: headSha } = process.env;
    if (!baseSha || !headSha) {
      console.error('BASE_SHA and HEAD_SHA are required for the edits check');
      process.exit(2);
    }
    problems.push(
      ...checkEdits({
        cwd,
        configPath,
        manifestPath,
        baseSha,
        headSha,
        headRef: process.env.HEAD_REF,
        headRepo: process.env.HEAD_REPO,
        baseRepo: process.env.BASE_REPO,
        push: process.env.EVENT_NAME === 'push',
        prAuthor: process.env.PR_AUTHOR,
        actors: (process.env.RELEASE_ACTORS || DEFAULT_ACTORS.join(',')).split(',').map((a) => a.trim()).filter(Boolean),
        extraFiles: (process.env.RELEASE_EXTRA_FILES || '').split(',').map((a) => a.trim()).filter(Boolean),
      }),
    );
  }
  if (problems.length === 0) {
    console.log(`version checks (${mode}): ok`);
    return;
  }
  for (const p of problems) console.error(`::error::${p}`);
  console.error(`\n${problems.length} problem(s). See adr:deterministic-fleet-versioning.`);
  process.exit(1);
}

/**
 * Whether this file is the program being run. Paths are compared after resolving symlinks (macOS's
 * temp folders and CI workspaces can be reached through one); comparing the raw URL would make a
 * script run from such a path do nothing and exit 0, which for a check is a silent pass.
 */
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  try {
    main();
  } catch (error) {
    // Any failure to read the repository is a failed check, never a pass.
    console.error(`::error::version check could not complete: ${error.message}`);
    process.exit(1);
  }
}
