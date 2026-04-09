/**
 * FilesystemBeadStore unit tests
 *
 * Uses a temp directory as beadsRoot via the constructor parameter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import type { FrameBead } from '../types/bead.js';

let tmpDir: string;

function makeADRBead(overrides: Partial<FrameBead> = {}): FrameBead {
  const now = new Date().toISOString();
  return {
    id: 'core-adr-0001',
    type: 'adr',
    status: 'live',
    title: 'Test ADR',
    body: '# Test ADR\n\nStatus: Accepted',
    labels: { goal_parent: 'okr-1', okr: 'O1 KR1' },
    actor: 'system',
    refs: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('FilesystemBeadStore', () => {
  let store: FilesystemBeadStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bead-test-'));
    store = new FilesystemBeadStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('create + get', () => {
    it('creates a bead and retrieves it by ID', async () => {
      const bead = makeADRBead();
      await store.create(bead);
      const found = await store.get(bead.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe('core-adr-0001');
      expect(found!.type).toBe('adr');
      expect(found!.status).toBe('live');
      expect(found!.labels.goal_parent).toBe('okr-1');
    });

    it('returns null for missing bead', async () => {
      expect(await store.get('core-missing-x')).toBeNull();
    });
  });

  describe('update', () => {
    it('applies a patch and updates updated_at', async () => {
      const bead = makeADRBead();
      await store.create(bead);

      // Ensure at least 1ms passes so updated_at is different from created_at
      await new Promise((r) => setTimeout(r, 5));
      await store.update(bead.id, { title: 'Updated Title' });
      const updated = await store.get(bead.id);

      expect(updated!.title).toBe('Updated Title');
      expect(updated!.status).toBe('live');         // unchanged
      expect(updated!.id).toBe(bead.id);            // ID never overwritten
      expect(updated!.updated_at).not.toBe(bead.updated_at);
    });

    it('throws when bead does not exist', async () => {
      await expect(store.update('core-ghost', { title: 'x' })).rejects.toThrow();
    });
  });

  describe('close', () => {
    it('sets status to closed and sets closed_at', async () => {
      await store.create(makeADRBead());
      await store.close('core-adr-0001');

      const closed = await store.get('core-adr-0001');
      expect(closed!.status).toBe('closed');
      expect(closed!.closed_at).toBeDefined();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await store.create(makeADRBead({ id: 'core-adr-0001', type: 'adr', status: 'live' }));
      await store.create(makeADRBead({ id: 'core-adr-0002', type: 'adr', status: 'created' }));
      await store.create(makeADRBead({ id: 'core-task-0001', type: 'task', status: 'live' }));
    });

    it('returns all beads with no filter', async () => {
      const all = await store.query({});
      expect(all).toHaveLength(3);
    });

    it('filters by type', async () => {
      const adrs = await store.query({ type: 'adr' });
      expect(adrs).toHaveLength(2);
      expect(adrs.every((b) => b.type === 'adr')).toBe(true);
    });

    it('filters by status', async () => {
      const live = await store.query({ status: 'live' });
      expect(live).toHaveLength(2);
      expect(live.every((b) => b.status === 'live')).toBe(true);
    });

    it('filters by type AND status', async () => {
      const liveAdrs = await store.query({ type: 'adr', status: 'live' });
      expect(liveAdrs).toHaveLength(1);
      expect(liveAdrs[0].id).toBe('core-adr-0001');
    });

    it('filters by label', async () => {
      await store.create(makeADRBead({ id: 'core-adr-0003', labels: { goal_parent: 'okr-2' } }));

      const okr1 = await store.query({ label: { goal_parent: 'okr-1' } });
      expect(okr1.every((b) => b.labels.goal_parent === 'okr-1')).toBe(true);
      expect(okr1.find((b) => b.id === 'core-adr-0003')).toBeUndefined();
    });

    it('returns empty array when nothing matches', async () => {
      const none = await store.query({ type: 'molecule' });
      expect(none).toHaveLength(0);
    });
  });

  describe('watch', () => {
    it('fires callback with created event when a new bead is written', async () => {
      // Pre-create the subdirectory so chokidar watches it before the file lands
      await fs.mkdir(path.join(tmpDir, 'core'), { recursive: true });

      const events: string[] = [];
      const unsub = store.watch({ type: 'adr' }, (e) => events.push(e.kind));

      // Give chokidar time to attach before writing
      await new Promise((r) => setTimeout(r, 200));
      await store.create(makeADRBead({ id: 'core-adr-0010' }));

      await new Promise((r) => setTimeout(r, 500));
      await unsub();

      expect(events).toContain('created');
    });

    it('fires callback with updated event when a bead is updated', async () => {
      await store.create(makeADRBead({ id: 'core-adr-0020' }));

      const events: string[] = [];
      const unsub = store.watch({ type: 'adr' }, (e) => events.push(e.kind));

      // Give chokidar a moment to attach the watcher before we write
      await new Promise((r) => setTimeout(r, 200));
      await store.update('core-adr-0020', { title: 'New Title' });
      await new Promise((r) => setTimeout(r, 500));
      await unsub();

      expect(events).toContain('updated');
    });
  });
});
