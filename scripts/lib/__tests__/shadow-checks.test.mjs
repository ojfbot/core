import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectCheckCommand, runShadowChecks, summarizeChecks } from '../shadow-checks.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'shadow-checks-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('detectCheckCommand', () => {
  it('prefers an explicit slice check field over package.json', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    const d = detectCheckCommand(dir, { check: 'pnpm typecheck' });
    expect(d.source).toBe('slice-check-field');
    expect(d.args).toEqual(['-lc', 'pnpm typecheck']);
  });

  it('falls back to pnpm test when package.json declares a test script', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    const d = detectCheckCommand(dir, {});
    expect(d).toEqual({ cmd: 'pnpm', args: ['test'], source: 'package-json-test-script' });
  });

  it('skips with a stated reason when there is no package.json', () => {
    expect(detectCheckCommand(dir, {})).toEqual({ skipped: 'no-package-json' });
  });

  it('skips with a stated reason when package.json has no test script', () => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
    expect(detectCheckCommand(dir, {})).toEqual({ skipped: 'no-test-script' });
  });

  it('skips on unparseable package.json instead of throwing', () => {
    writeFileSync(path.join(dir, 'package.json'), '{not json');
    expect(detectCheckCommand(dir, {})).toEqual({ skipped: 'unparseable-package-json' });
  });

  it('ignores a blank check field', () => {
    expect(detectCheckCommand(dir, { check: '   ' })).toEqual({ skipped: 'no-package-json' });
  });
});

describe('runShadowChecks', () => {
  it('records pass when the check command exits 0', () => {
    const r = runShadowChecks({ worktree: dir, slice: { check: 'true', success: 'it works' } });
    expect(r.tests).toEqual({ result: 'pass', source: 'slice-check-field' });
    expect(r.success_criterion).toEqual({ text: 'it works', evaluated: false });
  });

  it('records fail with exit detail when the check command exits non-zero — and does not throw', () => {
    const r = runShadowChecks({ worktree: dir, slice: { check: 'exit 3' } });
    expect(r.tests.result).toBe('fail');
    expect(r.tests.detail).toBe('exit=3');
  });

  it('records skipped when nothing is detectable', () => {
    const r = runShadowChecks({ worktree: dir, slice: {} });
    expect(r.tests).toEqual({ result: 'skipped', reason: 'no-package-json' });
  });

  it('always marks the success criterion unevaluated (no calibrated judge yet)', () => {
    const r = runShadowChecks({ worktree: dir, slice: { check: 'true', success: 'gate text' } });
    expect(r.success_criterion.evaluated).toBe(false);
  });
});

describe('summarizeChecks', () => {
  it('renders pass, fail-with-detail, and skipped one-liners', () => {
    expect(summarizeChecks({ tests: { result: 'pass', source: 's' }, success_criterion: { evaluated: false } }))
      .toBe('tests=pass success_criterion=unevaluated');
    expect(summarizeChecks({ tests: { result: 'fail', detail: 'exit=1' }, success_criterion: { evaluated: false } }))
      .toBe('tests=fail(exit=1) success_criterion=unevaluated');
    expect(summarizeChecks({ tests: { result: 'skipped', reason: 'no-test-script' }, success_criterion: { evaluated: false } }))
      .toBe('tests=skipped(no-test-script) success_criterion=unevaluated');
    expect(summarizeChecks(null)).toBe('checks=none');
  });
});
