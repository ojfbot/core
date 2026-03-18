/**
 * G2 budget enforcement tests — prime-node budget gate.
 *
 * Covers:
 *  - No budget labels → budget gate skipped, routes to execute_hook
 *  - budget_limit='1000', budget_spent='800' (80%) → execute_hook + emits agent:budget_warning
 *  - budget_limit='1000', budget_spent='1000' (100%) → budget_exhausted
 *  - budget_limit='1000', budget_spent='1200' (120%) → budget_exhausted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import { initAgent } from '../agent-lifecycle.js';
import { runPrimeNode } from '../prime-node.js';
import { sling } from '../sling.js';
import { eventBus } from '../event-bus.js';
import type { FrameBead } from '../types/bead.js';
import type { FrameEvent } from '../types/event.js';

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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'g2-budget-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('G2 budget gate', () => {
  it('skips budget gate when no budget labels are set — routes to execute_hook', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g2-1'));
    await sling('cv-task-g2-1', 'cv-agent-witness', store);

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('execute_hook');
  });

  it('emits agent:budget_warning at 80% and still routes to execute_hook', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g2-2'));
    await sling('cv-task-g2-2', 'cv-agent-witness', store);

    // Set budget labels directly on the agent bead
    const agentBead = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: {
        ...agentBead!.labels,
        budget_limit: '1000',
        budget_spent: '800',
      },
    });

    const emitted: FrameEvent[] = [];
    const unsub = eventBus.onType('agent:budget_warning', (e) => emitted.push(e));

    try {
      const route = await runPrimeNode('cv-agent-witness', store);
      expect(route.next).toBe('execute_hook');
      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe('agent:budget_warning');
      expect(emitted[0].actor).toBe('cv-agent-witness');
    } finally {
      unsub();
    }
  });

  it('returns budget_exhausted at 100% spend', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await store.create(makeTaskBead('cv-task-g2-3'));
    await sling('cv-task-g2-3', 'cv-agent-witness', store);

    const agentBead = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: {
        ...agentBead!.labels,
        budget_limit: '1000',
        budget_spent: '1000',
      },
    });

    const emitted: FrameEvent[] = [];
    const unsub = eventBus.onType('agent:budget_exhausted', (e) => emitted.push(e));

    try {
      const route = await runPrimeNode('cv-agent-witness', store);
      expect(route.next).toBe('budget_exhausted');
      if (route.next === 'budget_exhausted') {
        expect(route.agentId).toBe('cv-agent-witness');
        expect(route.budgetPct).toBe(100);
      }
      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe('agent:budget_exhausted');
    } finally {
      unsub();
    }
  });

  it('returns budget_exhausted at 120% spend (over-budget)', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');

    const agentBead = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: {
        ...agentBead!.labels,
        budget_limit: '1000',
        budget_spent: '1200',
      },
    });

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('budget_exhausted');
    if (route.next === 'budget_exhausted') {
      expect(route.budgetPct).toBe(120);
    }
  });
});
