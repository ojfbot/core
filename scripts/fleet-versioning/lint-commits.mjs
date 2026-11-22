#!/usr/bin/env node
// Lints a pull request's commits and its title with the fleet's shared commitlint rules
// (adr:deterministic-fleet-versioning). This one script is what the reusable CI workflow runs AND
// what `pnpm verify` runs locally, so the two cannot drift: same rules file, same locked CLI.
// The rules file is always the one in the same checkout as this script (packages/commitlint-config),
// so in CI it is the Core commit the calling repo pinned, and in Core it is Core's own.
//
// Environment:
//   BASE_SHA, HEAD_SHA   the commit range to lint (git log BASE_SHA..HEAD_SHA); required
//   PR_TITLE             the pull request title, or PR_TITLE_B64 (the same, base64, for callers that
//                        cannot pass arbitrary text safely); neither set means the title is reported
//                        SKIPPED with PR_TITLE_SKIP_REASON and not checked
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The CLI version both CI and the local hook use; a test keeps it equal to the root devDependency. */
export const COMMITLINT_VERSION = '21.2.4';
/** The one rules file, relative to the root of the Core checkout this script lives in. */
export const CONFIG_RELATIVE = 'packages/commitlint-config/index.mjs';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const configPath = join(coreRoot, CONFIG_RELATIVE);
/** The package that owns the CLI and its own lockfile, so CI installs exactly what is locked. */
export const toolDir = join(coreRoot, 'packages', 'commitlint-config');
const bin = join(toolDir, 'node_modules', '.bin', 'commitlint');
const installedVersion = () => {
  try {
    return JSON.parse(readFileSync(join(toolDir, 'node_modules', '@commitlint', 'cli', 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
};

/**
 * Makes sure the locked CLI is installed: `pnpm install --frozen-lockfile` in the tool package,
 * against its own lockfile, so every dependency is the locked one and a caret range can never pull
 * something newer in CI. Already installed at the right version (a workspace install) means nothing
 * to do. Returns an error text, or null.
 */
export function ensureCli() {
  if (existsSync(bin) && installedVersion() === COMMITLINT_VERSION) return null;
  const r = spawnSync('pnpm', ['install', '--frozen-lockfile', '--ignore-workspace', '--ignore-scripts'], {
    cwd: toolDir,
    encoding: 'utf8',
  });
  if (r.status !== 0 || !existsSync(bin)) {
    return `could not install the locked commitlint ${COMMITLINT_VERSION} in ${toolDir}: ${r.error?.message ?? ''}${r.stdout ?? ''}${r.stderr ?? ''}`;
  }
  return null;
}

/**
 * Runs commitlint; returns { ok, output }. `input` is piped to stdin for a single message. A run
 * that fails without naming a single broken rule (the CLI could not be installed or started, for
 * example two installs racing for the same store) is tried once more; a real lint failure is never
 * retried, so a bad commit cannot be turned into a pass.
 */
export function runCommitlint(options) {
  const first = runOnce(options);
  if (first.ok || first.output.includes('✖')) return first;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  const second = runOnce(options);
  return second.ok ? second : { ok: false, output: `${first.output}\n(retried once)\n${second.output}` };
}

function runOnce({ args, input, cwd }) {
  const missing = ensureCli();
  if (missing) return { ok: false, output: `${missing}\n` };
  const result = spawnSync(bin, ['--config', configPath, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const launch = result.error ? `could not run commitlint: ${result.error.message}\n` : '';
  return { ok: result.status === 0, output: `${launch}${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export function main(env = process.env, cwd = process.cwd()) {
  const { BASE_SHA: base, HEAD_SHA: head } = env;
  if (!base || !head) {
    console.error('BASE_SHA and HEAD_SHA are required');
    return 2;
  }
  console.log(`commitlint ${COMMITLINT_VERSION} with ${CONFIG_RELATIVE}`);
  let failed = false;
  const problems = [];
  const collect = (output, label) => {
    for (const line of output.split('\n')) {
      if (line.includes('✖') || line.startsWith('could not run')) problems.push(`${label}: ${line.trim()}`);
    }
  };

  const range = runCommitlint({ args: ['--from', base, '--to', head, '--verbose'], cwd });
  console.log(range.output);
  console.log(`commits ${base.slice(0, 7)}..${head.slice(0, 7)}: ${range.ok ? 'PASS' : 'FAIL'}`);
  failed ||= !range.ok;
  collect(range.output, 'commits');

  let title = env.PR_TITLE;
  if (title === undefined && env.PR_TITLE_B64 !== undefined) {
    title = Buffer.from(env.PR_TITLE_B64, 'base64').toString('utf8');
  }
  if (title === undefined) {
    console.log(`pull request title: SKIPPED (${env.PR_TITLE_SKIP_REASON || 'no title was given'})`);
  } else {
    const result = runCommitlint({ args: [], input: `${title}\n`, cwd });
    console.log(result.output);
    console.log(`pull request title ${JSON.stringify(title)}: ${result.ok ? 'PASS' : 'FAIL'}`);
    failed ||= !result.ok;
    collect(result.output, 'title');
  }
  if (problems.length > 0) console.log(`\nproblems:\n${problems.join('\n')}`);
  return failed ? 1 : 0;
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
  process.exit(main());
}
