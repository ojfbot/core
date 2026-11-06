#!/usr/bin/env node
// Check a hashed Vitest evidence bundle against the current committed FleetRunner source.
// Usage: node scripts/fleet-runner/check-g1-evidence.mjs <bundle-json> [--repo-root <path>]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const INVENTORY_PATH = 'decisions/fleet-runner/release-one-proof-inventory.json';
const EXPECTED_MUTANTS = [
  'owner-authorization',
  'completion-fence',
  'output-digest',
  'durable-replay',
];
const SEED_COUNT = 1_000;
const SEED_PATTERN = /(?:^| )matches seeded 64-step reference model \(seed ([0-9]+)\)$/;

export const REQUIRED_BEHAVIOR_TESTS = [
  {
    id: 'owner-authorization',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'requires a registered signature, rejects replay, and reserves admission for owner',
  },
  {
    id: 'immutable-fenced-output-digest',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'fences uploads, validates the digest, and records an immutable accepted file',
  },
  {
    id: 'restart-replay',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'rejects a previously accepted signature after the server and store restart',
  },
  {
    id: 'nonce-contention',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'serializes one signed nonce across server instances sharing the store',
  },
  {
    id: 'invalid-signature-ordering',
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'does not consume a nonce when its signature is invalid',
  },
  {
    id: 'v2-migration',
    path: 'packages/fleet-runner/src/__tests__/jobs.test.ts',
    title: 'adds the replay nonce ledger to a v2 store and preserves jobs and events',
  },
  {
    id: 'lost-response-retry',
    path: 'packages/fleet-runner/src/__tests__/fault-contract.test.ts',
    title: 'retries a completion after its response is lost following commit',
  },
  {
    id: 'racing-claims',
    path: 'packages/fleet-runner/src/__tests__/fault-contract.test.ts',
    title: 'serializes two concurrent signed claims for one queued job',
  },
  {
    id: 'crash-window-reopen',
    path: 'packages/fleet-runner/src/__tests__/fault-contract.test.ts',
    title: 'reopens safely after an artifact write rolls back before the job commit',
  },
  {
    id: 'malformed-oversized',
    path: 'packages/fleet-runner/src/__tests__/fault-contract.test.ts',
    title: 'rejects malformed and oversized signed bodies',
  },
  {
    id: 'reference-digest-pin',
    path: 'packages/fleet-runner/src/__tests__/model-campaign.test.ts',
    title: 'pins the precomputed reference campaign digest',
  },
];

const MUTANT_TARGETS = {
  'owner-authorization': {
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'requires a registered signature, rejects replay, and reserves admission for owner',
    failureMessage: 'AssertionError: expected 200 to be 403',
  },
  'completion-fence': {
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'fences uploads, validates the digest, and records an immutable accepted file',
    failureMessage: 'AssertionError: expected true to be false',
  },
  'output-digest': {
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'fences uploads, validates the digest, and records an immutable accepted file',
    failureMessage: 'AssertionError: expected 200 to be 400',
  },
  'durable-replay': {
    path: 'packages/fleet-runner/src/__tests__/server.test.ts',
    title: 'rejects a previously accepted signature after the server and store restart',
    failureMessage: 'AssertionError: expected 200 to be 401',
  },
};

const SOURCE_PATHS = [
  ...new Set([
    ...REQUIRED_BEHAVIOR_TESTS.map(({ path }) => path),
    'packages/fleet-runner/src/__tests__/jobs.test.ts',
  ]),
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function within(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function committedText(repoRoot, path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: repoRoot, encoding: 'utf8' });
}

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function readArtifact(bundleRoot, artifact, label, errors) {
  if (!isRecord(artifact)) {
    errors.push(`${label} must include path and sha256`);
    return undefined;
  }
  if (typeof artifact.path !== 'string' || artifact.path.length === 0 || artifact.path.includes('\0')) {
    errors.push(`${label}.path must be a non-empty relative path`);
    return undefined;
  }
  if (isAbsolute(artifact.path) || win32.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes('..')) {
    errors.push(`${label}.path must stay inside the evidence bundle`);
    return undefined;
  }
  if (!validSha(artifact.sha256)) {
    errors.push(`${label}.sha256 must be a lowercase SHA-256 digest`);
    return undefined;
  }

  try {
    const candidate = resolve(bundleRoot, artifact.path);
    if (!within(bundleRoot, candidate)) {
      errors.push(`${label}.path resolves outside the evidence bundle`);
      return undefined;
    }
    const actual = realpathSync(candidate);
    if (!within(bundleRoot, actual) || !statSync(actual).isFile()) {
      errors.push(`${label}.path must resolve to a file inside the evidence bundle`);
      return undefined;
    }
    const bytes = readFileSync(actual);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== artifact.sha256) {
      errors.push(`${label}.sha256 does not match the report file`);
      return undefined;
    }
    return { bytes, digest, realPath: actual };
  } catch (error) {
    errors.push(`${label} cannot be read: ${error.message}`);
    return undefined;
  }
}

function parseReport(artifactFile, label, errors) {
  if (!artifactFile) return undefined;
  try {
    const report = JSON.parse(artifactFile.bytes.toString('utf8'));
    if (!isRecord(report)) throw new Error('report root must be an object');
    return report;
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function inspectVitestReport(report, label, errors) {
  if (!isRecord(report)) return { assertions: [], counts: { total: 0, passed: 0, failed: 0, pending: 0, todo: 0 } };
  if (typeof report.success !== 'boolean') errors.push(`${label}.success must be boolean`);
  if (!Array.isArray(report.testResults)) {
    errors.push(`${label}.testResults must be an array from the Vitest JSON reporter`);
    return { assertions: [], counts: { total: 0, passed: 0, failed: 0, pending: 0, todo: 0 } };
  }

  const assertions = [];
  for (const suite of report.testResults) {
    if (!isRecord(suite) || typeof suite.name !== 'string' || !Array.isArray(suite.assertionResults)) {
      // Vitest can emit a failed suite with no discovered assertions. That is never behavioral proof.
      continue;
    }
    for (const assertion of suite.assertionResults) {
      if (!isRecord(assertion) || typeof assertion.fullName !== 'string') {
        errors.push(`${label} contains an assertion without fullName`);
        continue;
      }
      if (!['passed', 'failed', 'pending', 'skipped', 'todo'].includes(assertion.status)) {
        errors.push(`${label} contains an unknown assertion status for ${assertion.fullName}`);
        continue;
      }
      assertions.push({
        suiteName: suite.name.replaceAll('\\', '/'),
        fullName: assertion.fullName,
        status: assertion.status,
        failureMessages: Array.isArray(assertion.failureMessages)
          ? assertion.failureMessages.filter((message) => typeof message === 'string')
          : [],
      });
    }
  }

  const counts = {
    total: assertions.length,
    passed: assertions.filter(({ status }) => status === 'passed').length,
    failed: assertions.filter(({ status }) => status === 'failed').length,
    pending: assertions.filter(({ status }) => status === 'pending' || status === 'skipped').length,
    todo: assertions.filter(({ status }) => status === 'todo').length,
  };
  const reported = {
    total: report.numTotalTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    pending: report.numPendingTests,
    todo: report.numTodoTests,
  };
  for (const [kind, actual] of Object.entries(counts)) {
    if (!Number.isInteger(reported[kind]) || reported[kind] !== actual) {
      errors.push(`${label} ${kind} count disagrees with its assertion results`);
    }
  }
  return { assertions, counts };
}

function matchingAssertions(assertions, sourcePath, title) {
  const pathSuffix = `/${sourcePath}`;
  return assertions.filter(
    (assertion) =>
      assertion.suiteName.endsWith(pathSuffix) &&
      (assertion.fullName === title || assertion.fullName.endsWith(` ${title}`)),
  );
}

function checkSource(repoRoot, errors) {
  const source = new Map();
  for (const path of SOURCE_PATHS) {
    try {
      source.set(path, committedText(repoRoot, path));
    } catch (error) {
      errors.push(`cannot read committed source ${path}: ${error.message}`);
    }
  }
  for (const test of REQUIRED_BEHAVIOR_TESTS) {
    if (!source.get(test.path)?.includes(`"${test.title}"`)) {
      errors.push(`committed source is missing required assertion ${test.id}`);
    }
  }

  const model = source.get('packages/fleet-runner/src/__tests__/model-campaign.test.ts') ?? '';
  if (!/const SEEDS\s*=\s*1_000\s*;/.test(model)) errors.push('committed model test must declare 1,000 seeds');
  if (!/const STEPS\s*=\s*64\s*;/.test(model)) errors.push('committed model test must declare 64 steps');
  if (!/it\.each\(Array\.from\(\{\s*length:\s*SEEDS\s*\},\s*\(_,\s*index\)\s*=>\s*index\s*\+\s*1\s*\)\)\s*\(\s*"matches seeded 64-step reference model \(seed %i\)"/.test(model)) {
    errors.push('committed model test must name the one-based 64-step seed campaign');
  }

  try {
    const inventory = JSON.parse(committedText(repoRoot, INVENTORY_PATH));
    if (
      inventory.format !== 'fleet-runner-release-one-inventory/1' ||
      !Array.isArray(inventory.requiredG1Mutants) ||
      JSON.stringify(inventory.requiredG1Mutants) !== JSON.stringify(EXPECTED_MUTANTS)
    ) {
      errors.push('committed inventory does not contain the required G1 mutant IDs');
    }
  } catch (error) {
    errors.push(`cannot read committed G1 mutant inventory: ${error.message}`);
  }
  return source;
}

function checkSeedAssertions(assertions, errors) {
  const rows = assertions.filter(({ suiteName, fullName }) =>
    suiteName.endsWith('/packages/fleet-runner/src/__tests__/model-campaign.test.ts') &&
    SEED_PATTERN.test(fullName),
  );
  const seen = new Map();
  for (const row of rows) {
    const match = SEED_PATTERN.exec(row.fullName);
    if (!match) continue;
    const seed = Number(match[1]);
    seen.set(seed, (seen.get(seed) ?? 0) + 1);
    if (seed < 1 || seed > SEED_COUNT) errors.push(`model report contains out-of-range seed ${seed}`);
    if (row.status !== 'passed') errors.push(`model seed ${seed} is ${row.status}, not passed`);
  }
  const missing = [];
  const duplicates = [];
  for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
    const count = seen.get(seed) ?? 0;
    if (count === 0) missing.push(seed);
    if (count > 1) duplicates.push(seed);
  }
  if (missing.length > 0) errors.push(`model report is missing seed assertions: ${missing.slice(0, 12).join(', ')}`);
  if (duplicates.length > 0) errors.push(`model report duplicates seed assertions: ${duplicates.slice(0, 12).join(', ')}`);
  if (rows.length !== SEED_COUNT) errors.push(`model report has ${rows.length} named seed assertions; expected ${SEED_COUNT}`);
  return rows.filter(({ status }) => status === 'passed').length;
}

function checkRequiredBehaviorAssertions(assertions, errors) {
  let passed = 0;
  for (const test of REQUIRED_BEHAVIOR_TESTS) {
    const matches = matchingAssertions(assertions, test.path, test.title);
    if (matches.length !== 1) {
      errors.push(`test report contains ${matches.length} copies of required test ${test.id}; expected one`);
      continue;
    }
    if (matches[0].status !== 'passed') {
      errors.push(`required test ${test.id} is ${matches[0].status}, not passed`);
      continue;
    }
    passed += 1;
  }
  return passed;
}

function expectedTestName(value, title) {
  return typeof value === 'string' && (value === title || value.endsWith(` ${title}`));
}

function checkMutants(bundleRoot, mutants, errors) {
  const seenIds = new Set();
  const seenPaths = new Set();
  const seenHashes = new Set();
  let proven = 0;
  if (!Array.isArray(mutants)) {
    errors.push('mutants must be an array');
    return proven;
  }

  for (const mutant of mutants) {
    if (!isRecord(mutant) || typeof mutant.id !== 'string') {
      errors.push('each mutant must have an id, report, and expectedFailureTest');
      continue;
    }
    if (seenIds.has(mutant.id)) errors.push(`duplicate mutant ${mutant.id}`);
    seenIds.add(mutant.id);
    const target = MUTANT_TARGETS[mutant.id];
    if (!target) {
      errors.push(`unexpected required mutant ${mutant.id}`);
      continue;
    }
    if (!expectedTestName(mutant.expectedFailureTest, target.title)) {
      errors.push(`mutant ${mutant.id} names a failure outside its allowed behavioral test`);
    }

    const artifact = readArtifact(bundleRoot, mutant.report, `mutant ${mutant.id} report`, errors);
    if (artifact) {
      if (seenPaths.has(artifact.realPath)) errors.push(`mutants reuse report path for ${mutant.id}`);
      if (seenHashes.has(artifact.digest)) errors.push(`mutants reuse report hash for ${mutant.id}`);
      seenPaths.add(artifact.realPath);
      seenHashes.add(artifact.digest);
    }
    const report = parseReport(artifact, `mutant ${mutant.id} report`, errors);
    if (!report) continue;
    if (report.success !== false) errors.push(`mutant ${mutant.id} report must have success=false`);
    const inspected = inspectVitestReport(report, `mutant ${mutant.id} report`, errors);
    if (inspected.counts.failed === 0) errors.push(`mutant ${mutant.id} has no failing behavioral assertion`);
    const targetFailures = matchingAssertions(inspected.assertions, target.path, target.title).filter(
      ({ fullName, status }) =>
        status === 'failed' &&
        (fullName === mutant.expectedFailureTest || fullName.endsWith(` ${mutant.expectedFailureTest}`)) &&
        inspected.assertions.some(
          (assertion) =>
            assertion.fullName === fullName &&
            assertion.failureMessages.some((message) => message.includes(target.failureMessage)),
        ),
    );
    if (targetFailures.length !== 1) {
      errors.push(`mutant ${mutant.id} did not fail its named behavioral assertion with the expected comparison exactly once`);
      continue;
    }
    proven += 1;
  }

  for (const id of EXPECTED_MUTANTS) if (!seenIds.has(id)) errors.push(`missing required mutant ${id}`);
  return proven;
}

export function validateG1Evidence(bundleFile, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const errors = [];
  const counts = {
    requiredBehaviorTests: REQUIRED_BEHAVIOR_TESTS.length,
    passedBehaviorTests: 0,
    requiredSeedAssertions: SEED_COUNT,
    passedSeedAssertions: 0,
    requiredMutants: EXPECTED_MUTANTS.length,
    provenMutants: 0,
    testAssertions: 0,
  };
  let actualCommit = '';
  let actualTree = '';
  let bundleRoot;
  let resolvedBundleFile;
  try {
    resolvedBundleFile = realpathSync(resolve(bundleFile));
    if (!statSync(resolvedBundleFile).isFile()) throw new Error('bundle path is not a file');
    bundleRoot = realpathSync(dirname(resolvedBundleFile));
  } catch (error) {
    errors.push(`cannot read evidence bundle directory: ${error.message}`);
  }

  try {
    actualCommit = git(repoRoot, ['rev-parse', 'HEAD']);
    actualTree = git(repoRoot, ['rev-parse', 'HEAD^{tree}']);
    if (!/^([a-f0-9]{40})$/.test(actualCommit) || !/^([a-f0-9]{40})$/.test(actualTree)) {
      errors.push('repository HEAD or tree is not a full Git SHA');
    }
    const changed = git(repoRoot, ['diff', '--name-only', 'HEAD', '--', 'packages/fleet-runner/src']);
    if (changed) errors.push(`tracked FleetRunner source drift: ${changed.split('\n').join(', ')}`);
  } catch (error) {
    errors.push(`cannot inspect repository source revision: ${error.message}`);
  }

  let sourceCommit;
  let sourceTree;
  let tests;
  let mutants;
  if (bundleRoot) {
    try {
      const bundle = JSON.parse(readFileSync(resolvedBundleFile, 'utf8'));
      if (!isRecord(bundle)) throw new Error('bundle root must be an object');
      if (bundle.format !== 'fleet-runner-g1-evidence/1') errors.push('unsupported evidence bundle format');
      const requiredKeys = ['format', 'sourceCommit', 'sourceTree', 'tests', 'mutants'];
      const allowedKeys = [...requiredKeys, 'node', 'pnpm'];
      const actualKeys = Object.keys(bundle);
      if (requiredKeys.some((key) => !Object.hasOwn(bundle, key))) errors.push('bundle is missing required fields');
      if (actualKeys.some((key) => !allowedKeys.includes(key))) errors.push('bundle has unexpected fields');
      if (bundle.node !== undefined && typeof bundle.node !== 'string') errors.push('bundle.node must be a string');
      if (bundle.pnpm !== undefined && typeof bundle.pnpm !== 'string') errors.push('bundle.pnpm must be a string');
      try {
        const inventory = JSON.parse(committedText(repoRoot, INVENTORY_PATH));
        if (bundle.node !== undefined && bundle.node !== inventory.qualificationTools?.node) {
          errors.push('bundle.node does not match the committed qualification tool pin');
        }
        if (bundle.pnpm !== undefined && bundle.pnpm !== inventory.qualificationTools?.pnpm) {
          errors.push('bundle.pnpm does not match the committed qualification tool pin');
        }
      } catch (error) {
        errors.push(`cannot validate bundle tool versions: ${error.message}`);
      }
      sourceCommit = bundle.sourceCommit;
      sourceTree = bundle.sourceTree;
      tests = bundle.tests;
      mutants = bundle.mutants;
    } catch (error) {
      errors.push(`cannot read bundle JSON: ${error.message}`);
    }
  }

  if (!/^([a-f0-9]{40})$/.test(sourceCommit ?? '') || sourceCommit !== actualCommit) {
    errors.push('bundle sourceCommit does not match repository HEAD');
  }
  if (!/^([a-f0-9]{40})$/.test(sourceTree ?? '') || sourceTree !== actualTree) {
    errors.push('bundle sourceTree does not match repository HEAD tree');
  }

  checkSource(repoRoot, errors);

  if (bundleRoot) {
    const testsArtifact = readArtifact(bundleRoot, tests, 'tests report', errors);
    const testsReport = parseReport(testsArtifact, 'tests report', errors);
    if (testsReport) {
      if (testsReport.success !== true) errors.push('tests report must have success=true');
      const inspected = inspectVitestReport(testsReport, 'tests report', errors);
      counts.testAssertions = inspected.counts.total;
      if (inspected.counts.failed > 0) errors.push('tests report contains failed assertions');
      if (testsReport.success === true && inspected.counts.failed > 0) {
        errors.push('tests report has success=true and a failed assertion');
      }
      counts.passedBehaviorTests = checkRequiredBehaviorAssertions(inspected.assertions, errors);
      counts.passedSeedAssertions = checkSeedAssertions(inspected.assertions, errors);
    }
    counts.provenMutants = checkMutants(bundleRoot, mutants, errors);
  }

  return {
    format: 'fleet-runner-g1-evidence-check/1',
    valid: errors.length === 0,
    sourceCommit: actualCommit,
    sourceTree: actualTree,
    counts,
    errors,
  };
}

function usageResult(error) {
  return {
    format: 'fleet-runner-g1-evidence-check/1',
    valid: false,
    sourceCommit: '',
    sourceTree: '',
    counts: {
      requiredBehaviorTests: REQUIRED_BEHAVIOR_TESTS.length,
      passedBehaviorTests: 0,
      requiredSeedAssertions: SEED_COUNT,
      passedSeedAssertions: 0,
      requiredMutants: EXPECTED_MUTANTS.length,
      provenMutants: 0,
      testAssertions: 0,
    },
    errors: [error],
  };
}

function parseArgs(args) {
  let bundleDirectory;
  let repoRoot = DEFAULT_REPO_ROOT;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--repo-root' && args[index + 1]) {
      repoRoot = resolve(args[index + 1]);
      index += 1;
    } else if (arg.startsWith('--')) {
      return { error: `unknown option ${arg}` };
    } else if (!bundleDirectory) {
      bundleDirectory = arg;
    } else {
      return { error: 'expected one evidence bundle directory' };
    }
  }
  if (!bundleDirectory) return { error: 'usage: check-g1-evidence.mjs <bundle-json> [--repo-root <path>]' };
  return { bundleFile: bundleDirectory, repoRoot };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  let result;
  if (args.error) {
    result = usageResult(args.error);
  } else {
    try {
      result = validateG1Evidence(args.bundleFile, { repoRoot: args.repoRoot });
    } catch (error) {
      result = usageResult(`evidence check failed: ${error.message}`);
    }
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}
