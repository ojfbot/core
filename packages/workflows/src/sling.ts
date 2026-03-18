/**
 * sling + nudge — A3 adoption: hook assignment and agent propulsion.
 *
 * `sling(beadId, agentId, store)` — slots a bead onto an agent's hook.
 *   - Updates the agent bead's labels.hook field in BeadStore.
 *   - Returns a HookAssignedEvent (A7 will dispatch this to the event bus).
 *
 * `nudge(agentId, store)` — signals a running agent that it has work.
 *   - Sets labels.nudge_pending = 'true' on the agent bead.
 *   - Returns a NudgeEvent (A7 will dispatch this to the event bus).
 *   - Sub-apps poll nudge_pending in their session loop, or watch the bead.
 *
 * Gas Town mapping:
 *   gt sling <bead> <agent>  →  sling(beadId, agentId, store)
 *   gt nudge <agent>         →  nudge(agentId, store)
 */

import type { BeadStore } from './types/bead.js';
import type { HookAssignedEvent, NudgeEvent } from './types/hook.js';
import type { HookApprovalRequiredWhen } from './types/hook.js';
import { isAgentBead } from './types/agent-bead.js';
import { eventBus, makeEvent } from './event-bus.js';

/**
 * Assign a bead to an agent's hook (Gas Town: "gt sling").
 *
 * The work bead must exist and must not be closed/archived.
 * The agent bead must exist and be a valid AgentBead.
 *
 * @param beadId   ID of the work bead to place on the hook
 * @param agentId  ID of the target AgentBead
 * @param store    BeadStore instance
 * @returns        HookAssignedEvent — caller dispatches to event bus (A7)
 *
 * @throws if the work bead or agent bead is missing, or types are wrong
 */
export async function sling(
  beadId: string,
  agentId: string,
  store: BeadStore,
  approvalRequiredWhen: HookApprovalRequiredWhen = 'never',
  slungBy = 'system',
): Promise<HookAssignedEvent> {
  // Validate work bead
  const workBead = await store.get(beadId);
  if (workBead === null) {
    throw new Error(`sling: work bead not found: ${beadId}`);
  }
  if (workBead.status === 'closed' || workBead.status === 'archived') {
    throw new Error(
      `sling: cannot sling a ${workBead.status} bead (${beadId})`
    );
  }

  // Validate agent bead
  const agentBead = await store.get(agentId);
  if (agentBead === null) {
    throw new Error(`sling: agent bead not found: ${agentId}`);
  }
  if (!isAgentBead(agentBead)) {
    throw new Error(
      `sling: bead ${agentId} is not an AgentBead (type: ${agentBead.type})`
    );
  }

  // Write hook pointer to agent bead, including G3 approval fields
  const now = new Date().toISOString();
  await store.update(agentId, {
    labels: {
      ...agentBead.labels,
      hook: beadId,
      hook_approval_status: approvalRequiredWhen !== 'never' ? 'pending' : 'none',
      hook_approval_required_when: approvalRequiredWhen,
      hook_slung_at: now,
      hook_slung_by: slungBy,
    },
  });

  const event: HookAssignedEvent = {
    type: 'hook:assigned',
    beadId,
    agentId,
    timestamp: new Date().toISOString(),
  };

  eventBus.emit(makeEvent('hook:assigned', agentId,
    `hook assigned: ${beadId} → ${agentId}`, { bead_id: beadId, agent_id: agentId }));

  return event;
}

/**
 * Signal an agent that it has work waiting on its hook (Gas Town: "gt nudge").
 *
 * Sets `nudge_pending = 'true'` on the agent bead. The sub-app's session loop
 * polls this label (or watches the bead via BeadStore.watch) and re-enters the
 * graph at the prime node when it fires.
 *
 * A7 will replace the label-based signal with a real event bus dispatch.
 *
 * @param agentId  ID of the AgentBead to nudge
 * @param store    BeadStore instance
 * @returns        NudgeEvent — caller dispatches to event bus (A7)
 */
export async function nudge(
  agentId: string,
  store: BeadStore,
): Promise<NudgeEvent> {
  const agentBead = await store.get(agentId);
  if (agentBead === null) {
    throw new Error(`nudge: agent bead not found: ${agentId}`);
  }
  if (!isAgentBead(agentBead)) {
    throw new Error(
      `nudge: bead ${agentId} is not an AgentBead (type: ${agentBead.type})`
    );
  }

  await store.update(agentId, {
    labels: { ...agentBead.labels, nudge_pending: 'true' },
  });

  const event: NudgeEvent = {
    type: 'hook:nudge',
    agentId,
    timestamp: new Date().toISOString(),
  };

  eventBus.emit(makeEvent('hook:nudge', agentId,
    `nudge sent to ${agentId}`, { agent_id: agentId }));

  return event;
}

/**
 * Clear the nudge_pending flag after the agent has acknowledged the signal.
 * Called by the sub-app session loop after it re-enters the prime node.
 */
export async function clearNudge(
  agentId: string,
  store: BeadStore,
): Promise<void> {
  const agentBead = await store.get(agentId);
  if (agentBead === null || !isAgentBead(agentBead)) return;

  const labels = { ...agentBead.labels };
  delete labels['nudge_pending'];
  await store.update(agentId, { labels });
}
