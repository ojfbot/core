import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lint } from '../../loops-lint.mjs';

/** Build a minimal cluster on disk: <tmp>/cluster/core + a fake home. */
function scaffold() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'loops-lint-'));
  const core = path.join(tmp, 'cluster', 'core');
  const home = path.join(tmp, 'home');
  mkdirSync(path.join(core, 'decisions', 'loops'), { recursive: true });
  mkdirSync(path.join(core, 'scripts'), { recursive: true });
  mkdirSync(home, { recursive: true });
  return { tmp, core, home };
}

function writeRegistry(core, entries) {
  const lines = ['---', 'type: loops-registry', 'version: 1', 'loops:'];
  for (const e of entries) {
    const keys = Object.keys(e);
    lines.push(`  - ${keys[0]}: ${e[keys[0]]}`);
    for (const k of keys.slice(1)) lines.push(`    ${k}: "${e[k]}"`);
  }
  lines.push('---', '', '# Loops registry (fixture)');
  writeFileSync(path.join(core, 'decisions', 'loops', 'loops.md'), lines.join('\n'));
}

const BASE = {
  slug: 'good-loop',
  purpose: 'a well-declared launchd loop',
  trigger: 'launchd',
  trigger_ref: 'scripts/good-loop-launchd.plist',
  cadence: 'daily',
  status: 'live',
  repo: 'core',
};

let ctx;
beforeEach(() => { ctx = scaffold(); });
afterEach(() => { rmSync(ctx.tmp, { recursive: true, force: true }); });

describe('loops-lint', () => {
  it('passes a clean registry whose declared artifact exists', () => {
    writeFileSync(path.join(ctx.core, 'scripts', 'good-loop-launchd.plist'), '<plist/>');
    writeRegistry(ctx.core, [BASE]);
    const r = lint(ctx.core, ctx.home);
    expect(r.errors).toEqual([]);
    expect(r.warns).toEqual([]);
    expect(r.counts.loops).toBe(1);
  });

  it('ERRORs when the registry file is missing or declares no loops', () => {
    expect(lint(ctx.core, ctx.home).errors.join()).toMatch(/loops registry not found/);
    writeRegistry(ctx.core, []);
    expect(lint(ctx.core, ctx.home).errors.join()).toMatch(/declares no loops/);
  });

  it('ERRORs on a declared trigger_ref absent from a reachable root', () => {
    writeRegistry(ctx.core, [BASE]); // plist never written
    const r = lint(ctx.core, ctx.home);
    expect(r.errors.join()).toMatch(/good-loop: trigger_ref 'scripts\/good-loop-launchd\.plist' does not exist/);
  });

  it('downgrades to a vantage WARN when the ref root itself is unreachable', () => {
    writeFileSync(path.join(ctx.core, 'scripts', 'good-loop-launchd.plist'), '<plist/>');
    writeRegistry(ctx.core, [
      BASE,
      { ...BASE, slug: 'sibling-loop', trigger: 'gh-actions', trigger_ref: '../not-checked-out/.github/workflows/x.yml' },
    ]);
    const r = lint(ctx.core, ctx.home);
    expect(r.errors).toEqual([]);
    expect(r.warns.join()).toMatch(/vantage: sibling-loop trigger_ref .* unreachable/);
  });

  it('ERRORs on duplicate slug, invalid enums, missing required fields, and refless live loops', () => {
    writeFileSync(path.join(ctx.core, 'scripts', 'good-loop-launchd.plist'), '<plist/>');
    writeRegistry(ctx.core, [
      BASE,
      { ...BASE }, // duplicate slug
      { slug: 'bad-enums', purpose: 'p', trigger: 'cron', cadence: 'hourly', status: 'zombie', repo: 'core' },
      { slug: 'no-purpose', trigger: 'manual', cadence: 'manual', status: 'live', repo: 'core' },
      { slug: 'refless', purpose: 'live hook with no ref', trigger: 'hook', cadence: 'event', status: 'live', repo: 'core' },
    ]);
    const j = lint(ctx.core, ctx.home).errors.join('\n');
    expect(j).toMatch(/duplicate loop slug 'good-loop'/);
    expect(j).toMatch(/bad-enums: invalid trigger 'cron'/);
    expect(j).toMatch(/bad-enums: invalid cadence 'hourly'/);
    expect(j).toMatch(/bad-enums: invalid status 'zombie'/);
    expect(j).toMatch(/no-purpose: missing 'purpose'/);
    expect(j).toMatch(/refless: live 'hook' loop with no trigger_ref/);
  });

  it('WARNs on discovered-but-undeclared artifacts: plist, LaunchAgent, workflow cron, hook script', () => {
    writeFileSync(path.join(ctx.core, 'scripts', 'good-loop-launchd.plist'), '<plist/>');
    writeRegistry(ctx.core, [BASE]);
    // Undeclared plist source in scripts/.
    writeFileSync(path.join(ctx.core, 'scripts', 'rogue-launchd.plist'), '<plist/>');
    // Undeclared installed ojfbot LaunchAgent (a .disabled one still counts).
    mkdirSync(path.join(ctx.home, 'Library', 'LaunchAgents'), { recursive: true });
    writeFileSync(path.join(ctx.home, 'Library', 'LaunchAgents', 'com.ojfbot.rogue.plist.disabled'), '<plist/>');
    // Undeclared sibling workflow with a cron schedule.
    const wf = path.join(ctx.tmp, 'cluster', 'sib', '.github', 'workflows');
    mkdirSync(wf, { recursive: true });
    writeFileSync(path.join(wf, 'nightly.yml'), 'on:\n  schedule:\n    - cron: "0 4 * * *"\n');
    // Undeclared hook script registered in user settings.
    const hookScript = path.join(ctx.tmp, 'cluster', 'core', 'scripts', 'rogue-hook.sh');
    writeFileSync(hookScript, '#!/bin/bash\n');
    mkdirSync(path.join(ctx.home, '.claude'), { recursive: true });
    writeFileSync(
      path.join(ctx.home, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: hookScript }] }] } }),
    );
    const r = lint(ctx.core, ctx.home);
    expect(r.errors).toEqual([]);
    const j = r.warns.join('\n');
    expect(j).toMatch(/undeclared plist: .*rogue-launchd\.plist/);
    expect(j).toMatch(/undeclared launch-agent: .*com\.ojfbot\.rogue\.plist\.disabled/);
    expect(j).toMatch(/undeclared workflow-cron: .*nightly\.yml/);
    expect(j).toMatch(/undeclared hook: .*rogue-hook\.sh/);
    expect(r.undeclared).toBe(4);
  });

  it('does not WARN for declared artifacts or event-only workflows without cron', () => {
    writeFileSync(path.join(ctx.core, 'scripts', 'good-loop-launchd.plist'), '<plist/>');
    const wf = path.join(ctx.tmp, 'cluster', 'sib', '.github', 'workflows');
    mkdirSync(wf, { recursive: true });
    writeFileSync(path.join(wf, 'ci.yml'), 'on:\n  pull_request:\n    types: [opened]\n');
    writeRegistry(ctx.core, [BASE]);
    const r = lint(ctx.core, ctx.home);
    expect(r.warns).toEqual([]);
  });
});
