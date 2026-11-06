import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import {
  REQUIRED_BEHAVIOR_TESTS,
  validateG1Evidence,
} from '../../fleet-runner/check-g1-evidence.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const bundlePath = 'g1-evidence.json';
const mutants = [
  {
    id: 'owner-authorization',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'requires a registered signature, rejects replay, and reserves admission for owner',
  },
  {
    id: 'completion-fence',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'fences uploads, validates the digest, and records an immutable accepted file',
  },
  {
    id: 'output-digest',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'fences uploads, validates the digest, and records an immutable accepted file',
  },
  {
    id: 'durable-replay',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'rejects a previously accepted signature after the server and store restart',
  },
];
const mutantFailureMessages = {
  'owner-authorization': 'AssertionError: expected 200 to be 403',
  'completion-fence': 'AssertionError: expected true to be false',
  'output-digest': 'AssertionError: expected 200 to be 400',
  'durable-replay': 'AssertionError: expected 200 to be 401',
};

let temporaryRoot;

afterEach(() => {
  if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = undefined;
});

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeJson(root, path, value) {
  const fullPath = join(root, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(value));
  writeFileSync(fullPath, bytes);
  return { path, sha256: hash(bytes) };
}

function addAssertion(suites, sourcePath, fullName, status = 'passed') {
  const suiteName = resolve(repoRoot, sourcePath);
  let suite = suites.get(suiteName);
  if (!suite) {
    suite = { name: suiteName, assertionResults: [] };
    suites.set(suiteName, suite);
  }
  suite.assertionResults.push({ fullName, title: fullName, status, failureMessages: status === 'failed' ? ['expected assertion failure'] : [] });
}

function testReport(suites) {
  const testResults = [...suites.values()];
  const assertions = testResults.flatMap(({ assertionResults }) => assertionResults);
  const counts = {
    numTotalTests: assertions.length,
    numPassedTests: assertions.filter(({ status }) => status === 'passed').length,
    numFailedTests: assertions.filter(({ status }) => status === 'failed').length,
    numPendingTests: assertions.filter(({ status }) => status === 'pending' || status === 'skipped').length,
    numTodoTests: assertions.filter(({ status }) => status === 'todo').length,
  };
  return { success: counts.numFailedTests === 0, ...counts, testResults };
}

function seedFullName(seed) {
  return `independent one-job queue model campaign matches seeded 64-step reference model (seed ${seed})`;
}

function fixture() {
  temporaryRoot = mkdtempSync(join(tmpdir(), 'fleet-runner-g1-evidence-'));
  const suites = new Map();
  for (const test of REQUIRED_BEHAVIOR_TESTS) addAssertion(suites, test.path, test.title);
  for (let seed = 1; seed <= 1_000; seed += 1) {
    addAssertion(suites, 'packages/fleet-runner/src/__tests__/model-campaign.test.ts', seedFullName(seed));
  }
  const tests = testReport(suites);
  const testsArtifact = writeJson(temporaryRoot, 'reports/tests.json', tests);
  const mutantEvidence = mutants.map(({ id, path, title }, index) => {
    const report = {
      success: false,
      numTotalTests: 1,
      numPassedTests: 0,
      numFailedTests: 1,
      numPendingTests: 0,
      numTodoTests: 0,
      mutantId: id,
      testResults: [
        {
          name: resolve(repoRoot, path),
          assertionResults: [{ fullName: title, title, status: 'failed', failureMessages: [mutantFailureMessages[id]] }],
        },
      ],
    };
    return {
      id,
      report: writeJson(temporaryRoot, `reports/mutant-${index}.json`, report),
      expectedFailureTest: title,
    };
  });
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const bundle = {
    format: 'fleet-runner-g1-evidence/1',
    sourceCommit,
    sourceTree,
    node: '24.22.2',
    pnpm: '9.15.4',
    tests: testsArtifact,
    mutants: mutantEvidence,
  };
  const fullBundlePath = join(temporaryRoot, bundlePath);
  writeFileSync(fullBundlePath, JSON.stringify(bundle));
  return { bundle, bundlePath: fullBundlePath, tests, testsArtifact };
}

function refreshArtifact(root, artifact, value) {
  const bytes = Buffer.from(JSON.stringify(value));
  writeFileSync(join(root, artifact.path), bytes);
  artifact.sha256 = hash(bytes);
}

function refreshBundle(root, bundle) {
  const fullPath = join(root, bundlePath);
  writeFileSync(fullPath, JSON.stringify(bundle));
  return fullPath;
}

it('accepts hashed Vitest reports only when source cases and all 1,000 named seeds pass', () => {
  const { bundlePath: path } = fixture();

  const result = validateG1Evidence(path, { repoRoot });

  expect(result).toMatchObject({
    valid: true,
    counts: {
      requiredBehaviorTests: REQUIRED_BEHAVIOR_TESTS.length,
      passedBehaviorTests: REQUIRED_BEHAVIOR_TESTS.length,
      requiredSeedAssertions: 1_000,
      passedSeedAssertions: 1_000,
      requiredMutants: 4,
      provenMutants: 4,
    },
    errors: [],
  });
});

it('rejects missing and duplicate named seeds even when report counters remain all-green', () => {
  const { bundle, bundlePath: path, tests } = fixture();
  const modelSuite = tests.testResults.find(({ name }) => name.endsWith('/model-campaign.test.ts'));
  modelSuite.assertionResults = modelSuite.assertionResults.filter(({ fullName }) => !fullName.endsWith('(seed 1000)'));
  modelSuite.assertionResults.push({
    ...modelSuite.assertionResults.find(({ fullName }) => fullName.endsWith('(seed 999)')),
  });
  tests.numPassedTests += 1;
  refreshArtifact(temporaryRoot, bundle.tests, tests);
  const updatedPath = refreshBundle(temporaryRoot, bundle);

  const result = validateG1Evidence(updatedPath, { repoRoot });

  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toMatch(/missing seed assertions:.*1000/);
  expect(result.errors.join('\n')).toMatch(/duplicates seed assertions:.*999/);
  expect(result.errors.join('\n')).toMatch(/passed count disagrees/);
});

it('rejects skipped or failed required assertions and counters that claim green', () => {
  const skipped = fixture();
  const ownerSuite = skipped.tests.testResults.find(({ name }) => name.endsWith('/server.test.ts'));
  ownerSuite.assertionResults[0].status = 'skipped';
  refreshArtifact(temporaryRoot, skipped.bundle.tests, skipped.tests);
  const skippedPath = refreshBundle(temporaryRoot, skipped.bundle);

  const skippedResult = validateG1Evidence(skippedPath, { repoRoot });
  expect(skippedResult.valid).toBe(false);
  expect(skippedResult.errors.join('\n')).toMatch(/required test owner-authorization is skipped/);

  const failed = fixture();
  const requiredSuite = failed.tests.testResults.find(({ name }) => name.endsWith('/server.test.ts'));
  requiredSuite.assertionResults[0].status = 'failed';
  refreshArtifact(temporaryRoot, failed.bundle.tests, failed.tests);
  const failedPath = refreshBundle(temporaryRoot, failed.bundle);

  const failedResult = validateG1Evidence(failedPath, { repoRoot });
  expect(failedResult.valid).toBe(false);
  expect(failedResult.errors.join('\n')).toMatch(/success=true and a failed assertion/);
  expect(failedResult.errors.join('\n')).toMatch(/passed count disagrees/);
});

it('rejects compile-only mutant failures, successful mutants, and wrong target categories', () => {
  const compileFailure = fixture();
  const owner = compileFailure.bundle.mutants.find(({ id }) => id === 'owner-authorization');
  const report = {
    success: false,
    numTotalTests: 0,
    numPassedTests: 0,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [{ name: resolve(repoRoot, 'packages/fleet-runner/src/__tests__/server.test.ts'), assertionResults: [] }],
  };
  refreshArtifact(temporaryRoot, owner.report, report);
  const compilePath = refreshBundle(temporaryRoot, compileFailure.bundle);

  const compileResult = validateG1Evidence(compilePath, { repoRoot });
  expect(compileResult.valid).toBe(false);
  expect(compileResult.errors.join('\n')).toMatch(/no failing behavioral assertion/);
  expect(compileResult.errors.join('\n')).toMatch(/did not fail its named behavioral assertion/);

  const success = fixture();
  const durable = success.bundle.mutants.find(({ id }) => id === 'durable-replay');
  durable.expectedFailureTest = mutants[0].title;
  const durableReport = JSON.parse(readFileSync(join(temporaryRoot, durable.report.path), 'utf8'));
  durableReport.success = true;
  refreshArtifact(temporaryRoot, durable.report, durableReport);
  const successPath = refreshBundle(temporaryRoot, success.bundle);

  const successResult = validateG1Evidence(successPath, { repoRoot });
  expect(successResult.valid).toBe(false);
  expect(successResult.errors.join('\n')).toMatch(/success=false/);
  expect(successResult.errors.join('\n')).toMatch(/outside its allowed behavioral test/);
});

it('rejects a mutant target failure caused by an unrelated assertion', () => {
  const { bundle, bundlePath: path } = fixture();
  const owner = bundle.mutants.find(({ id }) => id === 'owner-authorization');
  const report = JSON.parse(readFileSync(join(temporaryRoot, owner.report.path), 'utf8'));
  report.testResults[0].assertionResults[0].failureMessages = ['TypeError: cannot read properties of undefined'];
  refreshArtifact(temporaryRoot, owner.report, report);
  const updatedPath = refreshBundle(temporaryRoot, bundle);

  const result = validateG1Evidence(updatedPath, { repoRoot });

  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toMatch(/owner-authorization did not fail its named behavioral assertion with the expected comparison/);
});

it('rejects missing report hashes, bundle path traversal, and duplicate mutant report files', () => {
  const { bundle, bundlePath: path } = fixture();
  bundle.tests.sha256 = '0'.repeat(64);
  bundle.mutants[1].report = { ...bundle.mutants[0].report };
  const outside = join(temporaryRoot, 'outside.json');
  writeFileSync(outside, '{}');
  bundle.mutants[3].report = { path: '../outside.json', sha256: hash(readFileSync(outside)) };
  const updatedPath = refreshBundle(temporaryRoot, bundle);

  const result = validateG1Evidence(updatedPath, { repoRoot });

  expect(path).toBe(updatedPath);
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toMatch(/does not match the report file/);
  expect(result.errors.join('\n')).toMatch(/stay inside the evidence bundle/);
  expect(result.errors.join('\n')).toMatch(/reuse report path/);
});
