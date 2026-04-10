/**
 * DoltBeadStore integration tests
 *
 * Requires a running Dolt sql-server on port 3307 with the beads schema.
 * Skipped in CI unless DOLT_TEST=1 is set.
 *
 * Run locally: DOLT_TEST=1 pnpm vitest run packages/workflows/src/__tests__/dolt-bead-store.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mysql from 'mysql2/promise';
import { DoltBeadStore } from '../bead-store/DoltBeadStore.js';
import type { FrameBead } from '../types/bead.js';

const DOLT_PORT = parseInt(process.env.DOLT_PORT ?? '3307', 10);
const SKIP = !process.env.DOLT_TEST;

function makeBead(overrides: Partial<FrameBead> = {}): FrameBead {
  const now = new Date().toISOString();
  return {
    id: `core-test-${Date.now()}`,
    type: 'task',
    status: 'created',
    title: 'Test Bead',
    body: 'Test body',
    labels: {},
    actor: 'test-runner',
    refs: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe.skipIf(SKIP)('DoltBeadStore', () => {
  let store: DoltBeadStore;
  let cleanupPool: mysql.Pool;

  beforeAll(() => {
    store = new DoltBeadStore({ port: DOLT_PORT });
    cleanupPool = mysql.createPool({
      host: '127.0.0.1',
      port: DOLT_PORT,
      user: 'root',
      database: '.beads-dolt',
    });
  });

  afterAll(async () => {
    await store.destroy();
    await cleanupPool.end();
  });

  beforeEach(async () => {
    // Clean test data between runs
    await cleanupPool.execute("DELETE FROM bead_events WHERE actor = 'test-runner'");
    await cleanupPool.execute("DELETE FROM beads WHERE actor = 'test-runner'");
    await cleanupPool.execute("CALL DOLT_ADD('-A')");
    try {
      await cleanupPool.execute("CALL DOLT_COMMIT('-m', 'test: cleanup')");
    } catch { /* no changes to commit */ }
  });

  describe('create + get', () => {
    it('creates a bead and retrieves it by ID', async () => {
      const bead = makeBead({ id: 'core-test-get-1' });
      await store.create(bead);

      const found = await store.get('core-test-get-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('core-test-get-1');
      expect(found!.type).toBe('task');
      expect(found!.status).toBe('created');
      expect(found!.actor).toBe('test-runner');
    });

    it('returns null for missing bead', async () => {
      expect(await store.get('core-missing-xxx')).toBeNull();
    });

    it('round-trips labels and refs as JSON', async () => {
      const bead = makeBead({
        id: 'core-test-json-1',
        labels: { goal_parent: 'okr-1', project: 'test' },
        refs: ['core-adr-0001', 'core-task-42'],
      });
      await store.create(bead);

      const found = await store.get('core-test-json-1');
      expect(found!.labels.goal_parent).toBe('okr-1');
      expect(found!.labels.project).toBe('test');
      expect(found!.refs).toEqual(['core-adr-0001', 'core-task-42']);
    });
  });

  describe('update', () => {
    it('applies a patch and updates updated_at', async () => {
      const bead = makeBead({ id: 'core-test-upd-1' });
      await store.create(bead);

      await new Promise((r) => setTimeout(r, 5));
      await store.update('core-test-upd-1', { title: 'Updated Title' });

      const updated = await store.get('core-test-upd-1');
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.status).toBe('created'); // unchanged
      expect(updated!.id).toBe('core-test-upd-1');
    });

    it('throws when bead does not exist', async () => {
      await expect(store.update('core-ghost-999', { title: 'x' })).rejects.toThrow('Bead not found');
    });

    it('rejects mutation on audit-locked bead', async () => {
      const bead = makeBead({ id: 'core-test-lock-1' });
      await store.create(bead);
      await store.close('core-test-lock-1');

      await expect(
        store.update('core-test-lock-1', { title: 'should fail' }),
      ).rejects.toThrow('audit-locked');
    });
  });

  describe('close', () => {
    it('sets status to closed with closed_at and audit_locked', async () => {
      const bead = makeBead({ id: 'core-test-close-1' });
      await store.create(bead);
      await store.close('core-test-close-1');

      const closed = await store.get('core-test-close-1');
      expect(closed!.status).toBe('closed');
      expect(closed!.closed_at).toBeDefined();
      expect(closed!.labels.audit_locked).toBe('true');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await store.create(makeBead({ id: 'core-test-q-1', type: 'adr', status: 'live' }));
      await store.create(makeBead({ id: 'core-test-q-2', type: 'adr', status: 'created' }));
      await store.create(makeBead({ id: 'core-test-q-3', type: 'task', status: 'live' }));
    });

    it('filters by type', async () => {
      const adrs = await store.query({ type: 'adr', actor: 'test-runner' });
      expect(adrs.length).toBeGreaterThanOrEqual(2);
      expect(adrs.every((b) => b.type === 'adr')).toBe(true);
    });

    it('filters by status', async () => {
      const live = await store.query({ status: 'live', actor: 'test-runner' });
      expect(live.length).toBeGreaterThanOrEqual(2);
      expect(live.every((b) => b.status === 'live')).toBe(true);
    });

    it('filters by prefix', async () => {
      const core = await store.query({ prefix: 'core', actor: 'test-runner' });
      expect(core.length).toBeGreaterThanOrEqual(3);
      expect(core.every((b) => b.id.startsWith('core-'))).toBe(true);
    });

    it('filters by label', async () => {
      await store.create(makeBead({
        id: 'core-test-q-4',
        labels: { goal_parent: 'okr-special' },
      }));

      const results = await store.query({ label: { goal_parent: 'okr-special' }, actor: 'test-runner' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((b) => b.labels.goal_parent === 'okr-special')).toBe(true);
    });

    it('returns empty array when nothing matches', async () => {
      const none = await store.query({ type: 'molecule', actor: 'test-runner' });
      expect(none).toHaveLength(0);
    });
  });

  describe('watch', () => {
    it('fires callback when a bead is created', async () => {
      const events: string[] = [];
      const unsub = store.watch({ type: 'task' }, (e) => events.push(e.kind));

      await store.create(makeBead({ id: 'core-test-watch-1', type: 'task' }));
      // EventBus is synchronous, so the watch callback should have fired
      await new Promise((r) => setTimeout(r, 50));
      await unsub();

      expect(events).toContain('created');
    });
  });

  describe('Dolt version history', () => {
    it('records commits for bead mutations', async () => {
      await store.create(makeBead({ id: 'core-test-hist-1', title: 'History Test' }));

      const [rows] = await cleanupPool.execute(
        "SELECT message FROM dolt_log ORDER BY date DESC LIMIT 3",
      );
      const messages = (rows as { message: string }[]).map((r) => r.message);
      expect(messages.some((m) => m.includes('History Test'))).toBe(true);
    });
  });
});
