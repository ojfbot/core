/**
 * A6 adoption tests — maintenance-patrol formula + archiveStale + orphanCheck + indexRebuild
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import { initAgent } from '../agent-lifecycle.js';
import { sling } from '../sling.js';
import { archiveStale, orphanCheck, indexRebuild, runMaintenancePatrol } from '../maintenance-patrol.js';
import { parseTOMLFormula } from '../formula-parser.js';
import type { FrameBead } from '../types/bead.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATROL_TOML = path.resolve(__dirname, '../../../../formulas/maintenance-patrol.toml');

let tmpDir: string;
let store: FilesystemBeadStore;

function makeBead(id: string, overrides: Partial<FrameBead> = {}): FrameBead {
  const now = new Date().toISOString();
  return { id, type: 'task', status: 'live', title: id, body: '', labels: {},
    actor: 'system', refs: [], created_at: now, updated_at: now, ...overrides };
}

/** Create a bead closed N days ago */
function closedDaysAgo(id: string, days: number): FrameBead {
  const closedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return makeBead(id, { status: 'closed', closed_at: closedAt });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patrol-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── maintenance-patrol.toml ───────────────────────────────────────────────────

describe('maintenance-patrol formula', () => {
  it('parses without error', async () => {
    const f = await parseTOMLFormula(PATROL_TOML);
    expect(f.formula).toBe('maintenance-patrol');
    expect(f.type).toBe('patrol');
  });

  it('has the three required steps', async () => {
    const f = await parseTOMLFormula(PATROL_TOML);
    const ids = f.steps.map((s) => s.id);
    expect(ids).toContain('archive-stale');
    expect(ids).toContain('orphan-check');
    expect(ids).toContain('index-rebuild');
  });

  it('index-rebuild depends on archive-stale and orphan-check', async () => {
    const f = await parseTOMLFormula(PATROL_TOML);
    const rebuild = f.steps.find((s) => s.id === 'index-rebuild')!;
    expect(rebuild.needs).toContain('archive-stale');
    expect(rebuild.needs).toContain('orphan-check');
  });

  it('archive-stale and orphan-check have no dependencies', async () => {
    const f = await parseTOMLFormula(PATROL_TOML);
    const archiveStep = f.steps.find((s) => s.id === 'archive-stale')!;
    const orphanStep = f.steps.find((s) => s.id === 'orphan-check')!;
    expect(archiveStep.needs).toEqual([]);
    expect(orphanStep.needs).toEqual([]);
  });
});

// ── archiveStale ─────────────────────────────────────────────────────────────

describe('archiveStale', () => {
  it('archives beads closed for longer than thresholdDays', async () => {
    await store.create(closedDaysAgo('core-task-old', 35));
    const count = await archiveStale(store, 30);
    expect(count).toBe(1);
    const bead = await store.get('core-task-old');
    expect(bead?.status).toBe('archived');
  });

  it('does not archive beads closed more recently than threshold', async () => {
    await store.create(closedDaysAgo('core-task-recent', 10));
    const count = await archiveStale(store, 30);
    expect(count).toBe(0);
    const bead = await store.get('core-task-recent');
    expect(bead?.status).toBe('closed');
  });

  it('does not archive beads without closed_at', async () => {
    await store.create(makeBead('core-task-no-date', { status: 'closed' }));
    const count = await archiveStale(store, 30);
    expect(count).toBe(0);
  });

  it('dry_run mode counts without writing', async () => {
    await store.create(closedDaysAgo('core-task-dry', 40));
    const count = await archiveStale(store, 30, true);
    expect(count).toBe(1);
    const bead = await store.get('core-task-dry');
    expect(bead?.status).toBe('closed'); // unchanged
  });
});

// ── orphanCheck ───────────────────────────────────────────────────────────────

describe('orphanCheck', () => {
  it('clears hook pointing to a missing bead', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const agent = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...agent!.labels, hook: 'cv-task-ghost' },
    });

    const count = await orphanCheck(store);
    expect(count).toBe(1);
    const updated = await store.get('cv-agent-witness');
    expect(updated?.labels['hook']).toBeUndefined();
  });

  it('clears hook pointing to an archived bead', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeBead('cv-task-archived', { status: 'archived' }));
    await store.update('cv-agent-witness', {
      labels: { ...(await store.get('cv-agent-witness'))!.labels, hook: 'cv-task-archived' },
    });

    const count = await orphanCheck(store);
    expect(count).toBe(1);
  });

  it('does not clear a valid hook', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeBead('cv-task-live'));
    await sling('cv-task-live', 'cv-agent-witness', store);

    const count = await orphanCheck(store);
    expect(count).toBe(0);
    const agent = await store.get('cv-agent-witness');
    expect(agent?.labels['hook']).toBe('cv-task-live');
  });

  it('dry_run mode counts without writing', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const agent = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...agent!.labels, hook: 'cv-ghost' },
    });

    const count = await orphanCheck(store, true);
    expect(count).toBe(1);
    const updated = await store.get('cv-agent-witness');
    expect(updated?.labels['hook']).toBe('cv-ghost'); // unchanged
  });
});

// ── indexRebuild ─────────────────────────────────────────────────────────────

describe('indexRebuild', () => {
  it('counts all beads by prefix', async () => {
    await store.create(makeBead('core-task-1'));
    await store.create(makeBead('core-task-2'));
    await store.create(makeBead('cv-task-1'));

    const result = await indexRebuild(store);
    expect(result.totalBeads).toBe(3);
    expect(result.beadsByPrefix['core']).toBe(2);
    expect(result.beadsByPrefix['cv']).toBe(1);
  });

  it('returns 0 when store is empty', async () => {
    const result = await indexRebuild(store);
    expect(result.totalBeads).toBe(0);
    expect(result.beadsByPrefix).toEqual({});
  });
});

// ── runMaintenancePatrol ──────────────────────────────────────────────────────

describe('runMaintenancePatrol', () => {
  it('runs all three steps and returns a report', async () => {
    await store.create(closedDaysAgo('core-stale', 40));
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const agent = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...agent!.labels, hook: 'cv-ghost' },
    });
    await store.create(makeBead('cv-live-task'));

    const report = await runMaintenancePatrol(store, { thresholdDays: 30 });
    expect(report.archivedCount).toBe(1);
    expect(report.orphansCleared).toBe(1);
    expect(report.totalBeads).toBeGreaterThanOrEqual(2);
    expect(report.summary).toContain('archived 1');
    expect(report.summary).toContain('cleared 1');
    expect(report.dryRun).toBe(false);
  });

  it('dry_run produces a report without mutations', async () => {
    await store.create(closedDaysAgo('core-stale-dry', 40));

    const report = await runMaintenancePatrol(store, { dryRun: true });
    expect(report.archivedCount).toBe(1);
    expect(report.dryRun).toBe(true);
    const bead = await store.get('core-stale-dry');
    expect(bead?.status).toBe('closed'); // not archived
  });
});
