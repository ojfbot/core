/**
 * G3 hook approval gate tests — sling() approval fields + prime-node approval routing.
 *
 * Covers:
 *  - sling() with approvalRequiredWhen='never' → hook_approval_status = 'none', prime routes to execute_hook
 *  - sling() with approvalRequiredWhen='spawning_new_agent' → hook_approval_status = 'pending', prime returns await_approval
 *  - agent with hook_approval_status='approved' → prime routes to execute_hook
 *  - agent with hook_approval_status='rejected' → prime clears hook, returns await_input
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import { initAgent } from '../agent-lifecycle.js';
import { runPrimeNode } from '../prime-node.js';
import { sling } from '../sling.js';
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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'g3-approval-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('G3 hook approval gate', () => {
  it("sling() with approvalRequiredWhen='never' sets hook_approval_status='none', prime routes to execute_hook", async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g3-1'));

    await sling('cv-task-g3-1', 'cv-agent-witness', store, 'never', 'system');

    const agentBead = await store.get('cv-agent-witness');
    expect(agentBead?.labels['hook_approval_status']).toBe('none');
    expect(agentBead?.labels['hook_approval_required_when']).toBe('never');
    expect(agentBead?.labels['hook_slung_by']).toBe('system');
    expect(agentBead?.labels['hook_slung_at']).toBeTruthy();

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('execute_hook');
  });

  it("sling() with approvalRequiredWhen='spawning_new_agent' sets hook_approval_status='pending', prime returns await_approval", async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g3-2'));

    await sling('cv-task-g3-2', 'cv-agent-witness', store, 'spawning_new_agent', 'user:jim');

    const agentBead = await store.get('cv-agent-witness');
    expect(agentBead?.labels['hook_approval_status']).toBe('pending');
    expect(agentBead?.labels['hook_approval_required_when']).toBe('spawning_new_agent');
    expect(agentBead?.labels['hook_slung_by']).toBe('user:jim');

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('await_approval');
    if (route.next === 'await_approval') {
      expect(route.agentId).toBe('cv-agent-witness');
      expect(route.hookBeadId).toBe('cv-task-g3-2');
    }
  });

  it("agent with hook_approval_status='approved' routes to execute_hook", async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g3-3'));
    await sling('cv-task-g3-3', 'cv-agent-witness', store, 'spawning_new_agent');

    // Simulate approval
    const agentBead = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...agentBead!.labels, hook_approval_status: 'approved' },
    });

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('execute_hook');
    if (route.next === 'execute_hook') {
      expect(route.hookBead.id).toBe('cv-task-g3-3');
    }
  });

  it("agent with hook_approval_status='rejected' clears hook and returns await_input", async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g3-4'));
    await sling('cv-task-g3-4', 'cv-agent-witness', store, 'spawning_new_agent');

    // Simulate rejection
    const agentBead = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...agentBead!.labels, hook_approval_status: 'rejected' },
    });

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('await_input');

    // Hook labels should be cleared (set to empty string)
    const updatedBead = await store.get('cv-agent-witness');
    expect(updatedBead?.labels['hook']).toBe('');
    expect(updatedBead?.labels['hook_approval_status']).toBe('');
  });
});
