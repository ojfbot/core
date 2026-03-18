/**
 * Hook + GUPP types — A3 adoption.
 *
 * The hook is a persistent pointer on every AgentBead. At startup, the prime
 * node checks the hook and routes accordingly.
 *
 * GUPP (Gas Town Universal Propulsion Principle):
 *   "If there is work on your hook, YOU MUST RUN IT."
 *
 * The prime node enforces GUPP — agents are self-propelled, no central scheduler.
 */

import type { FrameBead } from './bead.js';

/**
 * Routing decision returned by runPrimeNode().
 *
 * Sub-apps use this to branch their LangGraph entry node:
 *
 *   const route = await runPrimeNode(agentId, store);
 *   if (route.next === 'execute_hook') { ... }
 *
 * 'process_mail' is reserved for A5 — prime node stubs it to 'await_input'
 * until FrameMail is adopted.
 */
export type HookApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type HookApprovalRequiredWhen = 'never' | 'budget_gt_X' | 'spawning_new_agent' | 'cross_app';

/**
 * Hook — the governance view of an agent's current assignment.
 * Stored as flattened labels on the AgentBead (hook_* prefix).
 */
export interface Hook {
  agent_id: string;
  bead_id: string;
  slung_at: string;
  slung_by: string;
  approval_status: HookApprovalStatus;
  approval_required_when: HookApprovalRequiredWhen;
}

export type PrimeRoute =
  | { next: 'execute_hook'; hookBead: FrameBead }
  | { next: 'process_mail'; mailCount: number }
  | { next: 'await_input' }
  | { next: 'await_approval'; agentId: string; hookBeadId: string }
  | { next: 'budget_exhausted'; agentId: string; budgetPct: number };

/**
 * Event emitted when a bead is slotted onto an agent's hook.
 * Returned by sling() — actual event bus dispatch wired in A7.
 */
export interface HookAssignedEvent {
  type: 'hook:assigned';
  beadId: string;
  agentId: string;
  timestamp: string;
}

/**
 * Event emitted when an agent receives a nudge.
 * Returned by nudge() — actual event bus dispatch wired in A7.
 */
export interface NudgeEvent {
  type: 'hook:nudge';
  agentId: string;
  timestamp: string;
}
