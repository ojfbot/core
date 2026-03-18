/**
 * prime-node — A3 adoption + G2/G3 governance: GUPP-enforcing entry logic for every agent-graph.
 *
 * `runPrimeNode` is a pure async function. Sub-apps call it from their
 * LangGraph entry node to get a routing decision, then branch accordingly:
 *
 *   // In a LangGraph node:
 *   async function primeNode(state: AgentState) {
 *     const route = await runPrimeNode(state.agentId, beadStore);
 *     return { ...state, primeRoute: route };
 *   }
 *
 *   // In the graph's conditional edge:
 *   .addConditionalEdges('prime', (s) => s.primeRoute.next)
 *
 * Core owns this logic. Sub-apps own the LangGraph wiring.
 *
 * Routing priority:
 *   0. G2: Budget exhausted → budget_exhausted (agent paused)
 *   0b. G2: Budget warning emitted (agent continues)
 *   1. G3: Hook present but approval_status = 'pending' → await_approval
 *   2. G3: Hook present but approval_status = 'rejected' → clear hook, fall through
 *   3. GUPP: Hook work present → execute_hook (MUST run — GUPP)
 *   4. Unread mail present → process_mail  (A5 — stubs to await_input until adopted)
 *   5. Nothing pending → await_input
 */

import type { BeadStore } from './types/bead.js';
import type { PrimeRoute } from './types/hook.js';
import type { HookApprovalStatus } from './types/hook.js';
import { isAgentBead } from './types/agent-bead.js';
import { countUnreadMail } from './mail.js';
import { eventBus, makeEvent } from './event-bus.js';

/**
 * Run the prime node routing logic for the given agent.
 *
 * @param agentId  Agent bead ID (e.g. "cv-agent-witness")
 * @param store    BeadStore to read from
 * @returns        Routing decision — sub-app branches on `route.next`
 *
 * @throws if the agent bead does not exist or is not an AgentBead
 */
export async function runPrimeNode(
  agentId: string,
  store: BeadStore,
): Promise<PrimeRoute> {
  const agentBead = await store.get(agentId);
  if (agentBead === null) {
    throw new Error(`runPrimeNode: agent bead not found: ${agentId}`);
  }
  if (!isAgentBead(agentBead)) {
    throw new Error(
      `runPrimeNode: bead ${agentId} is not an AgentBead (type: ${agentBead.type})`
    );
  }

  const labels = agentBead.labels;

  // ── G2: Budget gate ───────────────────────────────────────────────────────
  const limit = parseInt(labels.budget_limit ?? '0', 10);
  const spent = parseInt(labels.budget_spent ?? '0', 10);
  const warnPct = parseInt(labels.budget_warning_pct ?? '80', 10);
  if (limit > 0) {
    const pct = (spent / limit) * 100;
    if (pct >= 100) {
      eventBus.emit(makeEvent(
        'agent:budget_exhausted',
        agentId,
        `Budget exhausted: ${agentId}`,
        { agent_id: agentId },
      ));
      return { next: 'budget_exhausted', agentId, budgetPct: pct };
    }
    if (pct >= warnPct) {
      eventBus.emit(makeEvent(
        'agent:budget_warning',
        agentId,
        `Budget warning: ${agentId} at ${Math.round(pct)}%`,
        { agent_id: agentId },
      ));
    }
  }

  // ── GUPP + G3: Hook check ─────────────────────────────────────────────────
  const hookBeadId = labels.hook;
  if (hookBeadId) {
    const hookBead = await store.get(hookBeadId);
    if (hookBead !== null && hookBead.status !== 'closed' && hookBead.status !== 'archived') {

      // G3: Check approval status
      const approvalStatus = (labels.hook_approval_status ?? 'none') as HookApprovalStatus;
      if (approvalStatus === 'pending') {
        eventBus.emit(makeEvent(
          'agent:awaiting_approval',
          agentId,
          `Awaiting approval: ${agentId}`,
          { agent_id: agentId, bead_id: hookBeadId },
        ));
        return { next: 'await_approval', agentId, hookBeadId };
      }
      if (approvalStatus === 'rejected') {
        // Clear the stale rejected hook — agent returns to idle
        // Use '' rather than undefined because FrameBead labels is Record<string, string>
        await store.update(agentId, {
          labels: {
            ...labels,
            hook: '',
            hook_approval_status: '',
            hook_approval_required_when: '',
            hook_slung_at: '',
            hook_slung_by: '',
          },
        });
        // Fall through to mail/await_input
      } else {
        // 'none' or 'approved' — execute
        return { next: 'execute_hook', hookBead };
      }
    }
    // Hook points to a closed/missing bead — stale hook, fall through
  }

  // ── Mail check (A5) ───────────────────────────────────────────────────────
  const unreadMailCount = await countUnreadMail(agentId, store);
  if (unreadMailCount > 0) {
    return { next: 'process_mail', mailCount: unreadMailCount };
  }

  // ── Nothing pending ────────────────────────────────────────────────────────
  return { next: 'await_input' };
}
