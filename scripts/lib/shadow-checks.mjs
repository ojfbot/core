// shadow-checks.mjs — the day-runner's SHADOW verification stage (rm-l2-ojfbot#S14, audit H4/I6).
//
// After a dispatched session pushes its branch and opens a PR, the runner runs the target
// repo's check command inside the worktree and RECORDS the outcome — on the pr-created bead,
// in the PR body, and in the runner verdict. Record-only by contract: nothing here ever
// blocks, fails, or reverts a slice. Promotion to a blocking gate is a later RIDM decision
// (ADR-0086) after ~20 shadow runs establish agreement with the human's merge decisions.
//
// The success criterion is recorded but NOT machine-evaluated (`evaluated: false`): the
// cluster has no calibrated judge yet (integration plan I5), and an uncalibrated verdict
// recorded as truth is worse than an honest "unevaluated".

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CHECK_TIMEOUT_MS = 10 * 60_000;

/**
 * Decide what check command the target repo declares, without running it.
 * Precedence: an explicit slice `check:` field (S15 forward-compat — roadmap schema v1 does
 * not carry it yet, but a slice that does gets honored) → the worktree package.json's `test`
 * script via pnpm → skipped with a stated reason.
 */
export function detectCheckCommand(worktree, slice = {}) {
  if (slice.check && String(slice.check).trim()) {
    return { cmd: 'bash', args: ['-lc', String(slice.check).trim()], source: 'slice-check-field' };
  }
  const pkgPath = path.join(worktree, 'package.json');
  if (!existsSync(pkgPath)) return { skipped: 'no-package-json' };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return { skipped: 'unparseable-package-json' };
  }
  if (!pkg.scripts || !pkg.scripts.test) return { skipped: 'no-test-script' };
  return { cmd: 'pnpm', args: ['test'], source: 'package-json-test-script' };
}

/**
 * Run the shadow checks in the worktree. Never throws; the result is always a record.
 * Shape: { tests: { result: 'pass'|'fail'|'skipped', source?|reason?, detail? },
 *          success_criterion: { text, evaluated: false } }
 */
export function runShadowChecks({ worktree, slice }) {
  const record = {
    tests: null,
    success_criterion: { text: slice?.success ?? '', evaluated: false },
  };
  const detected = detectCheckCommand(worktree, slice);
  if (detected.skipped) {
    record.tests = { result: 'skipped', reason: detected.skipped };
    return record;
  }
  try {
    execFileSync(detected.cmd, detected.args, {
      cwd: worktree, encoding: 'utf8', timeout: CHECK_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
    });
    record.tests = { result: 'pass', source: detected.source };
  } catch (err) {
    const timedOut = err.signal === 'SIGTERM' && err.status === null;
    record.tests = {
      result: 'fail',
      source: detected.source,
      detail: timedOut ? `timeout after ${CHECK_TIMEOUT_MS / 60000}m` : `exit=${err.status ?? 'signal:' + err.signal}`,
    };
  }
  return record;
}

/** One-line human summary for verdict lines and PR body sections. */
export function summarizeChecks(record) {
  if (!record) return 'checks=none';
  const t = record.tests;
  const tests = t ? `${t.result}${t.reason ? `(${t.reason})` : ''}${t.detail ? `(${t.detail})` : ''}` : 'none';
  return `tests=${tests} success_criterion=unevaluated`;
}
