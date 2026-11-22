#!/usr/bin/env node
// Two deterministic checks that keep versions in the hands of release-please
// (adr:deterministic-fleet-versioning). Node builtins and the git CLI only: the reusable workflow
// runs this from a pinned checkout of Core against the calling repo, with nothing installed.
//
//   coverage  every package.json in the repo has an entry in release-please-config.json and in
//             the manifest, and the config has the settings the convention depends on.
//   edits     between the merge base and the head of a pull request, no package.json `version`
//             and no existing manifest entry changed, except in release-please's own PR.
//
// Usage: node check-versions.mjs [coverage|edits|all]   (default: all)
// Environment for `edits`: BASE_SHA, HEAD_SHA, and optionally HEAD_REF, HEAD_REPO, BASE_REPO.
// Optional: RELEASE_PLEASE_CONFIG, RELEASE_PLEASE_MANIFEST (paths relative to the repo root).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const RELEASE_BRANCH = /^release-please--branches--[A-Za-z0-9._/-]+$/;

function git(cwd, args, opts = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', opts.allowFail ? 'ignore' : 'inherit'],
  });
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args, { allowFail: true });
  } catch {
    return null;
  }
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

function readAt(cwd, rev, path) {
  return tryGit(cwd, ['show', `${rev}:${path}`]);
}

function versionOf(text, label) {
  if (text === null) return undefined;
  const parsed = parseJson(text, label);
  return typeof parsed.version === 'string' ? parsed.version : undefined;
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

export function checkEdits({ cwd, configPath, manifestPath, baseSha, headSha, headRef, headRepo, baseRepo }) {
  const problems = [];
  const base = git(cwd, ['merge-base', baseSha, headSha]).trim();

  const fromReleasePlease =
    typeof headRef === 'string' &&
    RELEASE_BRANCH.test(headRef) &&
    !!headRepo &&
    !!baseRepo &&
    headRepo === baseRepo;

  const changed = git(cwd, ['diff', '--name-only', '-z', '--no-renames', base, headSha])
    .split('\0')
    .filter(Boolean);
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
    if (fromReleasePlease) continue;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
