import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import {
  createConvoy,
  addToConvoy,
  updateSlotStatus,
  convoyProgress,
  finalizeConvoy,
} from '../convoy.js';
import { eventBus } from '../event-bus.js';
import type { FrameEvent } from '../types/event.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string;
let store: FilesystemBeadStore;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'convoy-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function makeWorkBead(id: string): Promise<void> {
  const now = new Date().toISOString();
  await store.create({
    id,
    type: 'task',
    status: 'live',
    title: `Task ${id}`,
    body: '',
    labels: {},
    actor: 'core-agent-1',
    refs: [],
    created_at: now,
    updated_at: now,
  });
}

// ── createConvoy ──────────────────────────────────────────────────────────────

describe('createConvoy', () => {
  it('creates a convoy bead with forming status and empty slots', async () => {
    const convoy = await createConvoy('Blog Publish: Issue #42', 'core-agent-1', store);

    expect(convoy.type).toBe('convoy');
    expect(convoy.labels.convoy_status).toBe('forming');
    expect(JSON.parse(convoy.labels.slots)).toEqual([]);
    expect(convoy.title).toBe('Blog Publish: Issue #42');
    expect(convoy.actor).toBe('core-agent-1');
  });

  it('persists to store', async () => {
    const convoy = await createConvoy('Test Convoy', 'core-agent-1', store);
    const fetched = await store.get(convoy.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.type).toBe('convoy');
  });

  it('prefixes id with actor rig prefix', async () => {
    const convoy = await createConvoy('CV Build', 'cv-agent-1', store);
    expect(convoy.id).toMatch(/^cv-convoy-/);
  });

  it('emits convoy:created event', async () => {
    const events: FrameEvent[] = [];
    const unsub = eventBus.on((e) => events.push(e));
    await createConvoy('Test', 'core-agent-1', store);
    unsub();

    const found = events.find((e) => e.type === 'convoy:created');
    expect(found).toBeDefined();
    expect(found!.summary).toContain('Test');
  });
});

// ── addToConvoy ───────────────────────────────────────────────────────────────

describe('addToConvoy', () => {
  beforeEach(async () => {
    await makeWorkBead('core-task-1');
    await makeWorkBead('core-task-2');
  });

  it('adds a slot in pending status', async () => {
    const convoy = await createConvoy('Build Run', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.total).toBe(1);
    expect(progress.pending).toBe(1);
    expect(progress.slots[0].beadId).toBe('core-task-1');
    expect(progress.slots[0].status).toBe('pending');
  });

  it('stores agentId on slot when provided', async () => {
    const convoy = await createConvoy('Build Run', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store, 'core-agent-2');

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.slots[0].agentId).toBe('core-agent-2');
  });

  it('sets convoy_status to active on first slot', async () => {
    const convoy = await createConvoy('Build Run', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.status).toBe('active');
  });

  it('is idempotent — same bead added twice yields one slot', async () => {
    const convoy = await createConvoy('Build Run', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.total).toBe(1);
  });

  it('supports multiple slots', async () => {
    const convoy = await createConvoy('Multi', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await addToConvoy(convoy.id, 'core-task-2', store);

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.total).toBe(2);
    expect(progress.pending).toBe(2);
  });

  it('throws if convoy not found', async () => {
    await expect(addToConvoy('core-convoy-missing', 'core-task-1', store)).rejects.toThrow('convoy not found');
  });
});

// ── updateSlotStatus ──────────────────────────────────────────────────────────

describe('updateSlotStatus', () => {
  beforeEach(async () => {
    await makeWorkBead('core-task-1');
    await makeWorkBead('core-task-2');
  });

  it('advances a slot from pending to active', async () => {
    const convoy = await createConvoy('Run', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await updateSlotStatus(convoy.id, 'core-task-1', 'active', store);

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.active).toBe(1);
    expect(progress.pending).toBe(0);
  });

  it('marks a slot done', async () => {
    const convoy = await createConvoy('Run', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await updateSlotStatus(convoy.id, 'core-task-1', 'done', store);

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.done).toBe(1);
  });

  it('no-ops if bead not in slots', async () => {
    const convoy = await createConvoy('Run', 'core-agent-1', store);
    // Should not throw
    await updateSlotStatus(convoy.id, 'core-task-missing', 'done', store);
  });
});

// ── convoyProgress ────────────────────────────────────────────────────────────

describe('convoyProgress', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 3; i++) await makeWorkBead(`core-task-${i}`);
  });

  it('counts all slot statuses correctly', async () => {
    const convoy = await createConvoy('Mixed', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await addToConvoy(convoy.id, 'core-task-2', store);
    await addToConvoy(convoy.id, 'core-task-3', store);

    await updateSlotStatus(convoy.id, 'core-task-1', 'done', store);
    await updateSlotStatus(convoy.id, 'core-task-2', 'active', store);
    // core-task-3 stays pending

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.total).toBe(3);
    expect(progress.done).toBe(1);
    expect(progress.active).toBe(1);
    expect(progress.pending).toBe(1);
    expect(progress.failed).toBe(0);
  });

  it('throws if convoy not found', async () => {
    await expect(convoyProgress('core-convoy-missing', store)).rejects.toThrow('convoy not found');
  });
});

// ── finalizeConvoy ────────────────────────────────────────────────────────────

describe('finalizeConvoy', () => {
  beforeEach(async () => {
    await makeWorkBead('core-task-1');
    await makeWorkBead('core-task-2');
  });

  it('returns completed when all slots done', async () => {
    const convoy = await createConvoy('All Done', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await addToConvoy(convoy.id, 'core-task-2', store);
    await updateSlotStatus(convoy.id, 'core-task-1', 'done', store);
    await updateSlotStatus(convoy.id, 'core-task-2', 'done', store);

    const result = await finalizeConvoy(convoy.id, store);
    expect(result).toBe('completed');

    const progress = await convoyProgress(convoy.id, store);
    expect(progress.status).toBe('completed');
  });

  it('returns failed when any slot failed', async () => {
    const convoy = await createConvoy('Partial Fail', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await addToConvoy(convoy.id, 'core-task-2', store);
    await updateSlotStatus(convoy.id, 'core-task-1', 'done', store);
    await updateSlotStatus(convoy.id, 'core-task-2', 'failed', store);

    const result = await finalizeConvoy(convoy.id, store);
    expect(result).toBe('failed');
  });

  it('returns active if not all slots settled', async () => {
    const convoy = await createConvoy('Still Going', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await addToConvoy(convoy.id, 'core-task-2', store);
    await updateSlotStatus(convoy.id, 'core-task-1', 'done', store);
    // core-task-2 still pending

    const result = await finalizeConvoy(convoy.id, store);
    expect(result).toBe('active');
  });

  it('emits convoy:updated event on finalize', async () => {
    const events: FrameEvent[] = [];
    const unsub = eventBus.on((e) => events.push(e));

    const convoy = await createConvoy('Done', 'core-agent-1', store);
    await addToConvoy(convoy.id, 'core-task-1', store);
    await updateSlotStatus(convoy.id, 'core-task-1', 'done', store);

    events.length = 0; // clear setup events
    await finalizeConvoy(convoy.id, store);
    unsub();

    const found = events.find((e) => e.type === 'convoy:updated');
    expect(found).toBeDefined();
    expect(found!.summary).toContain('completed');
  });
});
