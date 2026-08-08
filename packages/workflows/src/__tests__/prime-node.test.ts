/**
 * A3 adoption tests — prime-node + sling + nudge
 *
 * Covers:
 *  - GUPP: hook present → execute_hook routing
 *  - Stale hook (bead closed) → falls through to await_input
 *  - No hook, no mail → await_input
 *  - sling(): assigns bead to agent hook, returns HookAssignedEvent
 *  - sling(): rejects closed/archived beads
 *  - sling(): rejects missing beads and non-AgentBead targets
 *  - nudge(): sets nudge_pending label, returns NudgeEvent
 *  - clearNudge(): removes nudge_pending label
 *  - Full GUPP flow: sling → prime → execute_hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import { initAgent, closeAgent } from '../agent-lifecycle.js';
import { runPrimeNode } from '../prime-node.js';
import { sling, nudge, clearNudge } from '../sling.js';
import type { FrameBead } from '../types/bead.js';

let tmpDir: string;
let store: FilesystemBeadStore;

function makeTaskBead(id: string, overrides: Partial<FrameBead> = {}): FrameBead {
  const now = new Date().toISOString();
  return {
    id,
    type: 'task',
    status: 'created',
    title: `Task ${id}`,
    body: '',
    labels: {},
    actor: 'system',
    refs: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'a3-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── runPrimeNode ─────────────────────────────────────────────────────────────

describe('runPrimeNode', () => {
  it('routes to await_input when agent has no hook', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('await_input');
  });

  it('GUPP: routes to execute_hook when hook bead exists and is open', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-abc12'));
    await sling('cv-task-abc12', 'cv-agent-witness', store);

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('execute_hook');
    if (route.next === 'execute_hook') {
      expect(route.hookBead.id).toBe('cv-task-abc12');
    }
  });

  it('falls through stale hook (bead closed) to await_input', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-stale'));
    await sling('cv-task-stale', 'cv-agent-witness', store);

    // Mark the work bead as closed — hook becomes stale
    await store.close('cv-task-stale');

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('await_input');
  });

  it('falls through stale hook (bead missing) to await_input', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    // Manually set a hook pointing to a non-existent bead
    const bead = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...bead!.labels, hook: 'cv-task-ghost' },
    });

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('await_input');
  });

  it('throws if agent bead does not exist', async () => {
    await expect(runPrimeNode('nonexistent-agent', store)).rejects.toThrow('not found');
  });

  it('throws if bead is not an AgentBead', async () => {
    await store.create(makeTaskBead('cv-task-bad'));
    await expect(runPrimeNode('cv-task-bad', store)).rejects.toThrow('not an AgentBead');
  });
});

// ── sling ────────────────────────────────────────────────────────────────────

describe('sling', () => {
  it('assigns bead to agent hook and returns HookAssignedEvent', async () => {
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    await store.create(makeTaskBead('blog-task-x1'));

    const event = await sling('blog-task-x1', 'blog-agent-worker', store);

    expect(event.type).toBe('hook:assigned');
    expect(event.beadId).toBe('blog-task-x1');
    expect(event.agentId).toBe('blog-agent-worker');
    expect(event.timestamp).toBeTruthy();
  });

  it('persists hook label on agent bead', async () => {
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    await store.create(makeTaskBead('blog-task-x1'));
    await sling('blog-task-x1', 'blog-agent-worker', store);

    const agent = await store.get('blog-agent-worker');
    expect(agent?.labels['hook']).toBe('blog-task-x1');
  });

  it('rejects slinging a closed bead', async () => {
    await initAgent(store, 'trip-agent-worker', 'worker', 'tripplanner');
    await store.create(makeTaskBead('trip-task-done', { status: 'closed' }));
    await expect(
      sling('trip-task-done', 'trip-agent-worker', store)
    ).rejects.toThrow('closed');
  });

  it('rejects slinging an archived bead', async () => {
    await initAgent(store, 'trip-agent-worker', 'worker', 'tripplanner');
    await store.create(makeTaskBead('trip-task-arch', { status: 'archived' }));
    await expect(
      sling('trip-task-arch', 'trip-agent-worker', store)
    ).rejects.toThrow('archived');
  });

  it('rejects missing work bead', async () => {
    await initAgent(store, 'hq-agent-mayor', 'mayor', 'shell');
    await expect(
      sling('nonexistent-task', 'hq-agent-mayor', store)
    ).rejects.toThrow('not found');
  });

  it('rejects non-AgentBead target', async () => {
    await store.create(makeTaskBead('hq-task-src'));
    await store.create(makeTaskBead('hq-task-target'));
    await expect(
      sling('hq-task-src', 'hq-task-target', store)
    ).rejects.toThrow('not an AgentBead');
  });
});

// ── nudge + clearNudge ───────────────────────────────────────────────────────

describe('nudge', () => {
  it('sets nudge_pending label and returns NudgeEvent', async () => {
    await initAgent(store, 'pure-agent-crew', 'crew', 'purefoy');

    const event = await nudge('pure-agent-crew', store);
    expect(event.type).toBe('hook:nudge');
    expect(event.agentId).toBe('pure-agent-crew');

    const agent = await store.get('pure-agent-crew');
    expect(agent?.labels['nudge_pending']).toBe('true');
  });

  it('throws if agent does not exist', async () => {
    await expect(nudge('ghost-agent', store)).rejects.toThrow('not found');
  });
});

describe('clearNudge', () => {
  it('removes nudge_pending label', async () => {
    await initAgent(store, 'pure-agent-crew', 'crew', 'purefoy');
    await nudge('pure-agent-crew', store);

    await clearNudge('pure-agent-crew', store);
    const agent = await store.get('pure-agent-crew');
    expect(agent?.labels['nudge_pending']).toBeUndefined();
  });

  it('is a no-op for non-existent agent (does not throw)', async () => {
    await expect(clearNudge('ghost-agent', store)).resolves.toBeUndefined();
  });
});

// ── Full GUPP flow ────────────────────────────────────────────────────────────

describe('GUPP full flow', () => {
  it('sling → close session → reopen → prime routes to execute_hook', async () => {
    // Session 1: agent starts, work gets slung while active
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-tailor-resume'));
    await sling('cv-task-tailor-resume', 'cv-agent-witness', store);

    // Session 1 ends
    await closeAgent(store, 'cv-agent-witness');

    // Session 2: agent restarts — prime must route to execute_hook
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const route = await runPrimeNode('cv-agent-witness', store);

    expect(route.next).toBe('execute_hook');
    if (route.next === 'execute_hook') {
      expect(route.hookBead.id).toBe('cv-task-tailor-resume');
    }
  });
});
