/**
 * agent-lifecycle — A2 adoption: AgentBead init and teardown.
 *
 * Usage in an agent-graph's prime node:
 *
 *   const store = new FilesystemBeadStore();
 *   const bead = await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
 *   // ... run graph ...
 *   await closeAgent(store, bead.id);
 *
 * GUPP contract (A3, not yet implemented):
 *   After initAgent(), check bead.labels.hook — if set, work is waiting.
 *   The prime node MUST route to execute_hook before await_input.
 */

import type { BeadStore } from './types/bead.js';
import type { AgentBead, AgentRole, AgentStatus } from './types/agent-bead.js';
import { isAgentBead } from './types/agent-bead.js';
import { eventBus, makeEvent } from './event-bus.js';

/**
 * Read an agent bead from the store, creating it if it does not exist.
 *
 * On first call: creates the bead with status 'active'.
 * On subsequent calls: updates status to 'active', preserves all other fields
 * (including any hook set between sessions).
 *
 * @param store  BeadStore instance (typically FilesystemBeadStore)
 * @param id     Agent bead ID — must use the correct rig prefix, e.g. "cv-agent-witness"
 * @param role   AgentRole
 * @param app    Sub-app identifier, e.g. 'cv-builder', 'shell', 'blogengine'
 * @param actor  Who is initialising this agent (default: 'system')
 */
export async function initAgent(
  store: BeadStore,
  id: string,
  role: AgentRole,
  app: string,
  actor = 'system',
): Promise<AgentBead> {
  const existing = await store.get(id);

  if (existing !== null) {
    if (!isAgentBead(existing)) {
      throw new Error(
        `Bead ${id} exists but is not an AgentBead (type: ${existing.type})`
      );
    }
    await store.update(id, {
      labels: { ...existing.labels, agent_status: 'active' as AgentStatus },
    });
    const updated = await store.get(id);
    return updated as AgentBead;
  }

  const now = new Date().toISOString();
  const bead: AgentBead = {
    id,
    type: 'agent',
    status: 'live',
    title: `${role} agent — ${app}`,
    body: '',
    labels: {
      role,
      app,
      agent_status: 'active',
    },
    actor,
    refs: [],
    created_at: now,
    updated_at: now,
  };

  await store.create(bead);
  return bead;
}

/**
 * Mark the agent idle at session end.
 *
 * Preserves the hook field so the prime node can pick up pending work on the
 * next session (GUPP — A3).
 *
 * @param store  BeadStore instance
 * @param id     Agent bead ID
 */
export async function closeAgent(store: BeadStore, id: string): Promise<void> {
  const existing = await store.get(id);
  if (existing === null) {
    throw new Error(`Cannot close agent: bead ${id} not found`);
  }
  if (!isAgentBead(existing)) {
    throw new Error(
      `Bead ${id} is not an AgentBead (type: ${existing.type})`
    );
  }

  await store.update(id, {
    labels: {
      ...existing.labels,
      agent_status: 'idle' as AgentStatus,
      last_session: new Date().toISOString(),
    },
  });
}

/**
 * Start a periodic heartbeat for the given agent.
 * Emits `agent:heartbeat` on the eventBus every `intervalMs` milliseconds.
 * Returns a stop function — call it when the agent session ends.
 *
 * Default interval: 30s (30_000 ms) per G5 spec.
 *
 * Usage in a LangGraph graph:
 *   const stopHeartbeat = startHeartbeat(agentId)
 *   // ... run graph ...
 *   stopHeartbeat()
 */
export function startHeartbeat(
  agentId: string,
  intervalMs: number = 30_000,
): () => void {
  const timer = setInterval(() => {
    eventBus.emit(makeEvent(
      'agent:heartbeat',
      agentId,
      `heartbeat: ${agentId}`,
      { agent_id: agentId },
    ));
  }, intervalMs);

  return () => clearInterval(timer);
}
