#!/usr/bin/env node
// Lints a pull request's commits and its title with the fleet's shared commitlint rules
// (adr:deterministic-fleet-versioning). This one script is what the reusable CI workflow runs AND
// what `pnpm verify` runs locally, so the two cannot drift: same rules file, same pinned CLI.
// The rules file is always the one in the same checkout as this script (packages/commitlint-config),
// so in CI it is the Core commit the calling repo pinned, and in Core it is Core's own.
//
// Environment:
//   BASE_SHA, HEAD_SHA   the commit range to lint (git log BASE_SHA..HEAD_SHA); required
//   PR_TITLE             the pull request title, or PR_TITLE_B64 (the same, base64, for callers that
//                        cannot pass arbitrary text safely); neither set means the title is reported
//                        SKIPPED with PR_TITLE_SKIP_REASON and not checked
//   COMMITLINT_RUNNER    "dlx" (default: fetch the pinned CLI, nothing needs installing) or "exec"
//                        (use the repository's installed commitlint; for tests)
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The CLI version both CI and the local hook use; a test keeps it equal to the root devDependency. */
export const COMMITLINT_VERSION = '21.2.4';
/** The one rules file, relative to the root of the Core checkout this script lives in. */
export const CONFIG_RELATIVE = 'packages/commitlint-config/index.mjs';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const configPath = join(coreRoot, CONFIG_RELATIVE);

function commitlintCommand(runner) {
  return runner === 'exec'
    ? ['pnpm', ['exec', 'commitlint']]
    : ['pnpm', ['dlx', `@commitlint/cli@${COMMITLINT_VERSION}`]];
}

/** Runs commitlint; returns { ok, output }. `input` is piped to stdin for a single message. */
export function runCommitlint({ args, input, runner, cwd }) {
  const [bin, base] = commitlintCommand(runner);
  const result = spawnSync(bin, [...base, '--config', configPath, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const launch = result.error ? `could not run ${bin}: ${result.error.message}\n` : '';
  return { ok: result.status === 0, output: `${launch}${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export function main(env = process.env, cwd = process.cwd()) {
  const { BASE_SHA: base, HEAD_SHA: head } = env;
  if (!base || !head) {
    console.error('BASE_SHA and HEAD_SHA are required');
    return 2;
  }
  const runner = env.COMMITLINT_RUNNER === 'exec' ? 'exec' : 'dlx';
  console.log(`commitlint ${COMMITLINT_VERSION} with ${CONFIG_RELATIVE}`);
  let failed = false;
  const problems = [];
  const collect = (output, label) => {
    for (const line of output.split('\n')) {
      if (line.includes('✖') || line.startsWith('could not run')) problems.push(`${label}: ${line.trim()}`);
    }
  };

  const range = runCommitlint({ args: ['--from', base, '--to', head, '--verbose'], runner, cwd });
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
    const result = runCommitlint({ args: [], input: `${title}\n`, runner, cwd });
    console.log(result.output);
    console.log(`pull request title ${JSON.stringify(title)}: ${result.ok ? 'PASS' : 'FAIL'}`);
    failed ||= !result.ok;
    collect(result.output, 'title');
  }
  if (problems.length > 0) console.log(`\nproblems:\n${problems.join('\n')}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
