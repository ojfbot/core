/**
 * G4 — Audit trail tests
 *
 * Verifies audit_locked bead enforcement in FilesystemBeadStore:
 *   - close() sets labels.audit_locked = 'true'
 *   - update() on a closed+locked bead throws
 *   - double-close throws (already locked after first close)
 *   - update on a live bead works fine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import type { FrameBead } from '../types/bead.js';

let tmpDir: string;
let store: FilesystemBeadStore;

function makeBead(id: string): FrameBead {
  const now = new Date().toISOString();
  return {
    id,
    type: 'task',
    status: 'live',
    title: `Test bead ${id}`,
    body: '',
    labels: {},
    actor: 'system',
    refs: [],
    created_at: now,
    updated_at: now,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'g4-audit-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('G4: audit-locked bead enforcement', () => {
  it('close() sets labels.audit_locked = "true"', async () => {
    await store.create(makeBead('core-task-abc01'));
    await store.close('core-task-abc01');

    const bead = await store.get('core-task-abc01');
    expect(bead?.status).toBe('closed');
    expect(bead?.labels['audit_locked']).toBe('true');
  });

  it('update() on a closed+locked bead throws the audit-locked error', async () => {
    await store.create(makeBead('core-task-abc02'));
    await store.close('core-task-abc02');

    await expect(
      store.update('core-task-abc02', { title: 'Mutated after close' })
    ).rejects.toThrow('audit-locked and cannot be mutated');
  });

  it('double-close throws (already locked after first close)', async () => {
    await store.create(makeBead('core-task-abc03'));
    await store.close('core-task-abc03');

    await expect(
      store.close('core-task-abc03')
    ).rejects.toThrow('audit-locked and cannot be mutated');
  });

  it('update on a live (open) bead works fine — no lock', async () => {
    await store.create(makeBead('core-task-abc04'));

    await expect(
      store.update('core-task-abc04', { title: 'Updated while live' })
    ).resolves.toBeUndefined();

    const bead = await store.get('core-task-abc04');
    expect(bead?.title).toBe('Updated while live');
    expect(bead?.labels['audit_locked']).toBeUndefined();
  });
});
