/**
 * agent-lifecycle tests — A2 adoption
 *
 * Verifies initAgent() and closeAgent() against a temp FilesystemBeadStore.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import { initAgent, closeAgent } from '../agent-lifecycle.js';
import { isAgentBead } from '../types/agent-bead.js';

let tmpDir: string;
let store: FilesystemBeadStore;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-lifecycle-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('initAgent', () => {
  it('creates a new AgentBead if none exists', async () => {
    const bead = await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');

    expect(bead.id).toBe('cv-agent-witness');
    expect(bead.type).toBe('agent');
    expect(bead.status).toBe('live');
    expect(bead.labels.role).toBe('witness');
    expect(bead.labels.app).toBe('cv-builder');
    expect(bead.labels.agent_status).toBe('active');
    expect(isAgentBead(bead)).toBe(true);
  });

  it('persists the bead to the store', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const stored = await store.get('cv-agent-witness');
    expect(stored).not.toBeNull();
    expect(stored?.type).toBe('agent');
  });

  it('reads and reactivates an existing bead on subsequent calls', async () => {
    // First session
    await initAgent(store, 'blog-agent-mayor', 'mayor', 'shell');
    await closeAgent(store, 'blog-agent-mayor');

    // Verify it is idle
    const idleBead = await store.get('blog-agent-mayor');
    expect(idleBead?.labels['agent_status']).toBe('idle');

    // Second session — should reactivate
    const reactivated = await initAgent(store, 'blog-agent-mayor', 'mayor', 'shell');
    expect(reactivated.labels.agent_status).toBe('active');
  });

  it('preserves hook field across sessions', async () => {
    // Create agent bead, manually set a hook (simulating A3 sling)
    await initAgent(store, 'cv-agent-worker', 'worker', 'cv-builder');
    await store.update('cv-agent-worker', {
      labels: {
        role: 'worker',
        app: 'cv-builder',
        agent_status: 'idle',
        hook: 'cv-task-abc12',
      },
    });

    // Re-init — hook must survive
    const bead = await initAgent(store, 'cv-agent-worker', 'worker', 'cv-builder');
    expect(bead.labels.hook).toBe('cv-task-abc12');
  });

  it('throws if the bead exists but is not an AgentBead', async () => {
    // Plant a non-agent bead with the same ID
    await store.create({
      id: 'cv-agent-witness',
      type: 'adr',
      status: 'live',
      title: 'Wrong type',
      body: '',
      labels: {},
      actor: 'system',
      refs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder')
    ).rejects.toThrow('not an AgentBead');
  });

  it('accepts all four agent roles', async () => {
    for (const [suffix, role] of [
      ['mayor', 'mayor'],
      ['witness', 'witness'],
      ['worker', 'worker'],
      ['crew', 'crew'],
    ] as const) {
      const bead = await initAgent(store, `hq-agent-${suffix}`, role, 'shell');
      expect(bead.labels.role).toBe(role);
    }
  });
});

describe('closeAgent', () => {
  it('sets agent_status to idle', async () => {
    await initAgent(store, 'trip-agent-witness', 'witness', 'tripplanner');
    await closeAgent(store, 'trip-agent-witness');

    const bead = await store.get('trip-agent-witness');
    expect(bead?.labels['agent_status']).toBe('idle');
  });

  it('records last_session timestamp', async () => {
    const before = new Date().toISOString();
    await initAgent(store, 'trip-agent-witness', 'witness', 'tripplanner');
    await closeAgent(store, 'trip-agent-witness');
    const after = new Date().toISOString();

    const bead = await store.get('trip-agent-witness');
    const lastSession = bead?.labels['last_session'];
    expect(lastSession).toBeDefined();
    expect(lastSession! >= before).toBe(true);
    expect(lastSession! <= after).toBe(true);
  });

  it('throws if the bead does not exist', async () => {
    await expect(
      closeAgent(store, 'nonexistent-agent')
    ).rejects.toThrow('not found');
  });

  it('preserves hook field on close', async () => {
    await initAgent(store, 'blog-agent-crew', 'crew', 'blogengine');
    await store.update('blog-agent-crew', {
      labels: {
        role: 'crew',
        app: 'blogengine',
        agent_status: 'active',
        hook: 'blog-task-xyz99',
      },
    });

    await closeAgent(store, 'blog-agent-crew');
    const bead = await store.get('blog-agent-crew');
    expect(bead?.labels['hook']).toBe('blog-task-xyz99');
    expect(bead?.labels['agent_status']).toBe('idle');
  });
});
