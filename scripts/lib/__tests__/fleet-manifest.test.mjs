import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normName,
  parseEcosystemTable,
  parseJsArray,
  parseJsSet,
  parseRepoMeta,
  parseInstallCaseSwitch,
  registryFleet,
  reconcile,
  buildManifest,
} from '../../fleet-manifest.mjs';

describe('extractors', () => {
  it('parseEcosystemTable pulls first-column repo names, skipping header rows', () => {
    const md = [
      '## Ecosystem', '',
      '| Repo | Port(s) | Description |',
      '|------|---------|-------------|',
      '| shell | 4000 | MF host |',
      '| cv-builder | 3000 | resume builder |',
      '', '## Skills', '| not | a repo |',
    ].join('\n');
    expect(parseEcosystemTable(md)).toEqual(['shell', 'cv-builder']);
  });

  it('parseJsArray reads string literals and tolerates comments', () => {
    const js = `const REPOS = [\n  // comment\n  'shell',\n  'capture-agent', // renamed\n  "core",\n];`;
    expect(parseJsArray(js, 'REPOS')).toEqual(['shell', 'capture-agent', 'core']);
    expect(parseJsArray(js, 'OTHER')).toEqual([]);
  });

  it('parseJsSet reads Set literals', () => {
    const ts = `const KNOWN_REPOS = new Set(['shell', "core"]);`;
    expect(parseJsSet(ts, 'KNOWN_REPOS')).toEqual(['shell', 'core']);
  });

  it('parseRepoMeta reads name: fields from the REPO_META block', () => {
    const ts = `export const REPO_META = [\n  { name: 'shell', role: 'host', phase: 1 },\n  { name: "core", role: 'engine' },\n];`;
    expect(parseRepoMeta(ts)).toEqual(['shell', 'core']);
  });

  it('parseInstallCaseSwitch reads case labels, skipping the default arm', () => {
    const sh = [
      'case "$REPO_NAME" in',
      '  cv-builder)',
      '    ARCH="cv-builder-architecture.md" ;;',
      '  daily-logger)',
      '    ARCH="daily-logger-architecture.md" ;;',
      '  *)',
      '    ARCH="" ;;',
      'esac',
    ].join('\n');
    expect(parseInstallCaseSwitch(sh)).toEqual(['cv-builder', 'daily-logger']);
  });

  it('normName lowercases for cross-surface comparison', () => {
    expect(normName('BlogEngine')).toBe(normName('blogengine'));
  });
});

describe('reconcile against a fixture fleet', () => {
  let base; // fake ~/ojfbot
  let coreRoot;

  beforeEach(() => {
    base = mkdtempSync(path.join(os.tmpdir(), 'fleet-'));
    process.env.OJFBOT_ROOT = base; // pin sibling resolution to the fixture, not ~/ojfbot
    coreRoot = path.join(base, 'core');
    mkdirSync(path.join(coreRoot, 'decisions', 'northstar'), { recursive: true });
    mkdirSync(path.join(coreRoot, '.claude', 'skills', 'frame-standup', 'scripts'), { recursive: true });
    mkdirSync(path.join(coreRoot, 'scripts', 'launcher', 'registrations'), { recursive: true });
    mkdirSync(path.join(base, 'shell'));
    // registry: two apps — shell and ghost (ghost has no sibling dir)
    writeFileSync(
      path.join(coreRoot, 'decisions', 'northstar', 'README.md'),
      ['---', 'registry:', '  - slug: l1-shell', '    tier: L1', '    app: shell',
        '    path: ../shell/.claude/northstar.md', '  - slug: l1-ghost', '    tier: L1',
        '    app: ghost', '    path: ../ghost/.claude/northstar.md', '---', 'body'].join('\n'),
    );
    // CLAUDE.md table: shell + a stale entry whose dir does not exist
    writeFileSync(
      path.join(coreRoot, 'CLAUDE.md'),
      ['## Ecosystem', '', '| Repo | Port(s) |', '|------|---------|',
        '| shell | 4000 |', '| gcgcca | — |', '', '## Skills'].join('\n'),
    );
    writeFileSync(path.join(coreRoot, 'scripts', 'install-agents.sh'), 'case "$REPO_NAME" in\n  shell)\n    : ;;\nesac\n');
    writeFileSync(
      path.join(coreRoot, '.claude', 'skills', 'frame-standup', 'scripts', 'sync-repos.js'),
      `const REPOS = ['shell'];`,
    );
    writeFileSync(
      path.join(coreRoot, '.claude', 'skills', 'frame-standup', 'scripts', 'read-app-standup.js'),
      `const REPOS = ['shell'];`,
    );
  });

  afterEach(() => {
    delete process.env.OJFBOT_ROOT;
    rmSync(base, { recursive: true, force: true });
  });

  it('registryFleet returns app entries only', () => {
    const fleet = registryFleet(coreRoot);
    expect(fleet.apps.map((a) => a.app)).toEqual(['shell', 'ghost']);
  });

  it('reports drift: stale spelling on the table, ghost absent from complete surfaces', () => {
    const { results } = reconcile(coreRoot);
    const table = results.find((r) => r.id === 'core-claude-md');
    expect(table.status).toBe('drift');
    expect(table.stale).toEqual(['gcgcca']); // no sibling dir — stale spelling, not just unregistered
    expect(table.absent).toEqual(['ghost']);
    const sync = results.find((r) => r.id === 'frame-standup-sync');
    expect(sync.absent).toEqual(['ghost']);
  });

  it('unregistered-but-real repos are informational, not drift', () => {
    mkdirSync(path.join(base, 'sidecar'));
    writeFileSync(
      path.join(coreRoot, 'CLAUDE.md'),
      ['## Ecosystem', '', '| Repo | Port(s) |', '|------|---------|',
        '| shell | 4000 |', '| ghost | — |', '| sidecar | — |', '', '## Skills'].join('\n'),
    );
    const { results } = reconcile(coreRoot);
    const table = results.find((r) => r.id === 'core-claude-md');
    expect(table.unregistered).toEqual(['sidecar']);
    expect(table.stale).toEqual([]);
    expect(table.status).toBe('ok'); // ghost present + sidecar real → no drift
  });

  it('subset surfaces report extras but never absences', () => {
    const { results } = reconcile(coreRoot);
    const archdocs = results.find((r) => r.id === 'install-agents-archdocs');
    expect(archdocs.absent).toEqual([]);
    expect(archdocs.status).toBe('ok');
  });

  it('sibling-repo surfaces degrade to unreachable, manual/auto stay labeled', () => {
    const { results } = reconcile(coreRoot);
    expect(results.find((r) => r.id === 'dl-collect').status).toBe('unreachable');
    expect(results.find((r) => r.id === 'dl-article').status).toBe('manual');
    expect(results.find((r) => r.id === 'selfco-entities').status).toBe('auto');
  });

  it('buildManifest maps registered apps to the surfaces that enumerate them', () => {
    const manifest = buildManifest(coreRoot);
    const shell = manifest.repos.find((r) => r.app === 'shell');
    expect(shell.surfaces).toContain('core-claude-md');
    expect(shell.surfaces).toContain('frame-standup-sync');
    expect(manifest.unregistered.map((u) => u.name)).toContain('gcgcca');
  });
});
