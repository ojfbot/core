#!/usr/bin/env node
/**
 * check-test-wiring.mjs — fail when a test file is not run by any CI step (core#724).
 *
 * Every tracked `*.test.*` and `test_*.py` file must match either the root vitest include
 * globs (read from vitest.config.ts, i.e. `pnpm test`) or one of the RUNNERS below, each of
 * which names the CI step that runs it. A file that is deliberately not run in CI goes in
 * EXCLUDED with a reason. Adding a test file that nothing runs makes this check fail.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Test files run by a CI step other than `pnpm test`. Globs use path.matchesGlob syntax.
// Each runner must run EVERYTHING its glob matches, so a new file runs without anyone editing
// CI. `evidence` names the file and text that prove it; the check fails if that text is gone.
export const RUNNERS = [
  { glob: 'scripts/__tests__/test_*.py', file: '.github/workflows/ci.yml',
    text: "unittest discover -s scripts/__tests__ -p 'test_*.py'" },
  { glob: 'scripts/launcher/tests/*.test.mjs', file: 'scripts/launcher/tests/package.json',
    text: 'for f in *.test.mjs;' },
  { glob: 'packages/fleet-runner/scripts/g6-*.test.mjs', file: 'packages/fleet-runner/package.json',
    text: 'scripts/g6-*.test.mjs' },
  { glob: 'scripts/fleet-runner/__tests__/**/*.test.mjs', file: 'vitest.g0.config.ts',
    text: 'scripts/fleet-runner/__tests__/**/*.test.mjs' },
  { glob: '.claude/skills/bead/scripts/test_*.py', file: '.github/workflows/ci.yml',
    text: "unittest discover -s .claude/skills/bead/scripts -p 'test_*.py'" },
  { glob: '.claude/skills/vault/scripts/test_*.py', file: '.github/workflows/ci.yml',
    text: "unittest discover -s .claude/skills/vault/scripts -p 'test_*.py'" },
  // The FleetRunner promote's kill sweeps and its tests that sit through real waits: run by their
  // own config, in a CI step that is conditional (see PROMOTE_SWEEP_STEP below).
  { glob: 'packages/fleet-runner/src/__tests__/*.sweep_test.ts', file: 'vitest.promote-sweeps.config.ts',
    text: '"packages/fleet-runner/src/__tests__/*.sweep_test.ts"' },
  { glob: 'packages/fleet-runner/src/__tests__/*.slow_test.ts', file: 'vitest.promote-sweeps.config.ts',
    text: '"packages/fleet-runner/src/__tests__/*.slow_test.ts"' },
];

// The promote sweeps' step with its condition, as ONE text: the run line directly under the one
// condition that may guard it. Deleting the step, or replacing its condition (with `if: false`,
// say), removes this text and fails the check. What the text cannot show is whether the decision
// itself is right: scripts/lib/__tests__/promote-sweeps-decision.test.mjs tests the script that
// makes it. Nothing here notices a step made harmless some other way (continue-on-error, a
// condition on the whole job).
export const PROMOTE_SWEEP_STEP = "if: steps.promote_sweeps.outputs.run != 'false'\n"
  + '        run: pnpm exec vitest run --config vitest.promote-sweeps.config.ts\n';

// Other things a wired test depends on. Same evidence rule.
export const PREREQUISITES = [
  { file: '.github/workflows/ci.yml', text: 'pnpm --filter @core/fleet-runner --fail-if-no-match g6:test' },
  { file: '.github/workflows/ci.yml', text: 'pnpm --filter @core/fleet-runner --fail-if-no-match proof:local:test' },
  { file: '.github/workflows/ci.yml', text: 'pnpm --filter @core/launcher-tests --fail-if-no-match test' },
  { file: '.github/workflows/ci.yml', text: 'run: pnpm test\n' },
  { file: '.github/workflows/ci.yml', text: 'sudo apt-get update' },
  { file: '.github/workflows/ci.yml', text: 'vitest.g0.config.ts' },
  { file: '.github/workflows/ci.yml', text: PROMOTE_SWEEP_STEP },
  { file: '.github/workflows/ci.yml', text: 'id: promote_sweeps\n' },
  { file: '.github/workflows/ci.yml', text: 'run: bash scripts/fleet-runner/promote-sweeps-decision.sh\n' },
  { file: '.github/workflows/ci.yml', text: 'python3-yaml' },
  { file: 'scripts/verify-runner/Dockerfile', text: 'python3-yaml' },
];

// Test files that CI deliberately does not run, with the reason.
export const EXCLUDED = [
  {
    glob: 'packages/fleet-runner/scripts/g6-interruption-campaign.test.ts',
    reason: 'a manual interruption campaign driven by g6-interruption-run.mjs with its own vitest config',
  },
];

export function isTestFile(file) {
  const base = path.posix.basename(file);
  return /\.(test|spec)\.[^/]+$/.test(base) || /_test\.(mjs|cjs|js|ts)$/.test(base)
    || /^test_.*\.py$/.test(base) || /_test\.py$/.test(base);
}

export function vitestIncludes(configText) {
  const block = /include:\s*\[([\s\S]*?)\]/.exec(configText);
  if (!block) throw new Error('could not find test.include in vitest.config.ts');
  return [...block[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

export function unwired(files, includes) {
  const globs = [...includes, ...RUNNERS.map((r) => r.glob), ...EXCLUDED.map((e) => e.glob)];
  return files.filter(isTestFile).filter((f) => !globs.some((g) => path.posix.matchesGlob(f, g)));
}

/** Evidence checks: every runner and prerequisite still contains the text that makes it run all matches. */
export function evidenceProblems(read) {
  const problems = [];
  for (const { file, text, glob } of [...RUNNERS, ...PREREQUISITES]) {
    let body = '';
    try { body = read(file); } catch { /* missing file is a problem below */ }
    if (!body.includes(text)) problems.push(`${file} no longer contains \`${text}\`${glob ? ` (runs ${glob})` : ''}`);
  }
  return problems;
}

/**
 * Every `pnpm --filter` line in CI must carry --fail-if-no-match: a renamed package otherwise
 * prints "No projects matched" and exits 0, running nothing.
 */
export function filterProblems(ciText) {
  return ciText.split('\n')
    .filter((l) => /pnpm\s+(--filter|-F)\b/.test(l) && !l.includes('--fail-if-no-match'))
    .map((l) => `ci.yml runs \`${l.trim()}\` without --fail-if-no-match`);
}

/**
 * Python tests are run by `unittest discover`, which skips a file whose name is not an importable
 * module name and finds nothing in a file with no unittest.TestCase subclass.
 */
export function pythonProblems(files, read) {
  const problems = [];
  for (const f of files) {
    const base = path.posix.basename(f);
    if (!/^test_.*\.py$/.test(base) && !/_test\.py$/.test(base)) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(base)) {
      problems.push(`${f}: not a valid Python module name, so unittest discover skips it`);
    } else if (!/^class\s+\w+\s*\([^)]*\bTestCase\b[^)]*\)\s*:/m.test(read(f))) {
      problems.push(`${f}: defines no unittest.TestCase subclass, so unittest discover runs nothing from it`);
    }
  }
  return problems;
}

function main() {
  const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const includes = vitestIncludes(readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf8'));
  const missing = unwired(files, includes);
  if (missing.length) {
    process.stderr.write(`${missing.length} test file(s) are not run by any CI step:\n`);
    missing.forEach((f) => process.stderr.write(`  ${f}\n`));
    process.stderr.write('Add them to vitest.config.ts include, or to RUNNERS/EXCLUDED in scripts/check-test-wiring.mjs.\n');
    return 1;
  }
  const broken = evidenceProblems((f) => readFileSync(path.join(ROOT, f), 'utf8'));
  if (broken.length) {
    broken.forEach((b) => process.stderr.write(`${b}\n`));
    return 1;
  }
  const bad = [
    ...filterProblems(readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')),
    ...pythonProblems(files, (f) => readFileSync(path.join(ROOT, f), 'utf8')),
  ];
  if (bad.length) {
    bad.forEach((b) => process.stderr.write(`${b}\n`));
    return 1;
  }
  const n = files.filter(isTestFile).length;
  process.stdout.write(`check-test-wiring: all ${n} test files are wired into CI\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main();
}
