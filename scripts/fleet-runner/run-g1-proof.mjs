#!/usr/bin/env node
// Run real G1 checks and four deliberately broken variants in disposable worktrees.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, process.argv[2] ?? '.handoff/fleet-runner-g0-g2/evidence/g1');
const pnpm = process.env.FLEET_PNPM ?? 'pnpm';
function run(command, args, cwd = root) {
  return spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: 'true', NO_COLOR: '1' },
  });
}
function git(args) {
  const result = run('git', args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function sha(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
function artifact(file) {
  return { path: relative(output, file), sha256: sha(file) };
}
function report(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function assertions(data) {
  return data.testResults.flatMap((suite) => suite.assertionResults);
}
assert.equal(process.versions.node, '24.22.2', 'qualify with the pinned Node version');
const manager = run(pnpm, ['--version']);
assert.equal(manager.status, 0, manager.stderr);
assert.equal(manager.stdout.trim(), '9.15.4', 'qualify with the pinned pnpm version');
const proofInputs = [
  'packages/fleet-runner', 'scripts/fleet-runner', 'package.json', 'pnpm-lock.yaml',
  'pnpm-workspace.yaml', 'tsconfig.base.json', 'vitest.config.ts',
];
assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...proofInputs]), '',
  'commit tested source and configuration before recording a source-bound proof');
assert.ok(!existsSync(join(output, 'g1-evidence.json')), 'choose a new evidence directory for each run');
mkdirSync(join(output, 'mutants'), { recursive: true });
const sourceCommit = git(['rev-parse', 'HEAD']);
const sourceTree = git(['rev-parse', 'HEAD^{tree}']);
const testsFile = join(output, 'g1-tests.json');
const testArgs = (path) => ['exec', 'vitest', 'run', 'packages/fleet-runner/src/__tests__',
  '--reporter=json', '--outputFile=' + path];
const baseline = run(pnpm, testArgs(testsFile));
writeFileSync(join(output, 'g1-tests.log'), baseline.stdout + baseline.stderr);
assert.equal(baseline.status, 0, 'unmutated G1 tests failed; inspect g1-tests.log');
const baselineReport = report(testsFile);
assert.equal(baselineReport.success, true);
assert.equal(baselineReport.numFailedTests, 0);
assert.equal(baselineReport.numPendingTests, 0);
const mutantDefinitions = [
  {
    id: 'owner-authorization', file: 'server.ts',
    before: '&& id !== "owner"', after: '&& false',
    expectedFailureTest: 'requires a registered signature, rejects replay, and reserves admission for owner',
    expectedFailureMessage: 'AssertionError: expected 200 to be 403',
  },
  {
    id: 'completion-fence', file: 'jobs.ts',
    before: 'complete(key: string, fence: number, worker: string, output: JobOutput | (() => JobOutput)): boolean {\n',
    after: 'complete(key: string, fence: number, worker: string, output: JobOutput | (() => JobOutput)): boolean {\n'
      + '    const current = this.get(key);\n    fence = current?.fence ?? fence;\n    worker = current?.worker ?? worker;\n',
    expectedFailureTest: 'fences uploads, validates the digest, and records an immutable accepted file',
    expectedFailureMessage: 'AssertionError: expected true to be false',
  },
  {
    id: 'output-digest', file: 'server.ts',
    before: 'requireValid(data.toString("base64") === output && digest(data) === sha256);',
    after: 'requireValid(true);',
    expectedFailureTest: 'fences uploads, validates the digest, and records an immutable accepted file',
    expectedFailureMessage: 'AssertionError: expected 200 to be 400',
  },
  {
    id: 'durable-replay', file: 'auth.ts',
    before: 'return consumeNonce({ identity: id, nonce, now, expiresAt: Number(ts) + WINDOW_MS })',
    after: 'void consumeNonce;\n    return true',
    expectedFailureTest: 'rejects a previously accepted signature after the server and store restart',
    expectedFailureMessage: 'AssertionError: expected 200 to be 401',
  },
];
const mutants = [];
for (const mutant of mutantDefinitions) {
  const temp = mkdtempSync(join(tmpdir(), 'fleet-g1-mutant-'));
  const checkout = join(temp, 'source');
  let registered = false;
  try {
    const added = run('git', ['worktree', 'add', '--detach', checkout, sourceCommit]);
    assert.equal(added.status, 0, added.stderr);
    registered = true;
    symlinkSync(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir');
    const path = join(checkout, 'packages/fleet-runner/src', mutant.file);
    const original = readFileSync(path, 'utf8');
    assert.equal(original.split(mutant.before).length - 1, 1, 'mutant anchor drift: ' + mutant.id);
    writeFileSync(path, original.replace(mutant.before, mutant.after));
    const reportFile = join(output, 'mutants', mutant.id + '.json');
    const result = run(pnpm, ['exec', 'vitest', 'run',
      'packages/fleet-runner/src/__tests__/server.test.ts',
      '--reporter=json', '--outputFile=' + reportFile], checkout);
    writeFileSync(join(output, 'mutants', mutant.id + '.log'), result.stdout + result.stderr);
    assert.ok(result.status !== 0 && result.status !== null, 'mutant survived or timed out: ' + mutant.id);
    const data = report(reportFile);
    const matching = assertions(data).filter((item) =>
      item.fullName.endsWith(mutant.expectedFailureTest) && item.status === 'failed');
    assert.equal(data.success, false, 'mutant report claimed success: ' + mutant.id);
    assert.equal(matching.length, 1, 'mutant must fail its named behavioral test once: ' + mutant.id);
    assert.ok(matching[0].failureMessages?.some((message) => message.startsWith(mutant.expectedFailureMessage)),
      'mutant failed for a different reason than the expected guard assertion: ' + mutant.id);
    mutants.push({
      id: mutant.id, report: artifact(reportFile),
      expectedFailureTest: mutant.expectedFailureTest,
      expectedFailureMessage: mutant.expectedFailureMessage,
      changedSource: 'packages/fleet-runner/src/' + mutant.file,
      mutatedSha256: sha(path),
      failedAssertions: assertions(data).filter((item) => item.status === 'failed').map((item) => item.fullName),
    });
    console.log(mutant.id + ': detected by named behavioral assertion');
  } finally {
    if (registered) {
      const removed = run('git', ['worktree', 'remove', '--force', checkout]);
      assert.equal(removed.status, 0, removed.stderr);
    }
    rmSync(temp, { recursive: true, force: true });
  }
}
const bundle = {
  format: 'fleet-runner-g1-evidence/1', sourceCommit, sourceTree,
  node: process.versions.node, pnpm: manager.stdout.trim(),
  tests: artifact(testsFile), mutants,
};
const bundleFile = join(output, 'g1-evidence.json');
writeFileSync(bundleFile, JSON.stringify(bundle, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({
  bundle: relative(root, bundleFile), sourceCommit,
  passedTests: baselineReport.numPassedTests, detectedMutants: mutants.length,
}, null, 2));
