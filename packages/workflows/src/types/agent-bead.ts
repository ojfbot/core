/**
 * AgentBead — persistent identity bead for every Frame agent-graph.
 *
 * Every agent-graph (Mayor, Witness, Worker, Crew) has one AgentBead that
 * survives browser close. On session init, the prime node reads or creates this
 * bead. On session end, it updates last_session and status.
 *
 * Gas Town / Paperclip mapping:
 *   Gas Town "polecat"  → role: 'worker'  (ephemeral, per-task)
 *   Gas Town "crew"     → role: 'crew'    (persistent specialist)
 *   Gas Town "mayor"    → role: 'mayor'   (shell-level coordinator)
 *   Gas Town "witness"  → role: 'witness' (per-app supervisor)
 *
 * Defined in ADR-0016 (A2 adoption).
 */

import type { FrameBead } from './bead.js';

/**
 * Agent role taxonomy. Frame vocabulary wins at every boundary.
 *
 * | Role    | Gas Town  | Lives in         | Purpose                         |
 * |---------|-----------|------------------|---------------------------------|
 * | mayor   | Mayor     | shell agent-graph | Cross-app coordination          |
 * | witness | Witness   | per-app graph     | Domain supervision, merge queue |
 * | worker  | Polecat   | per-app ephemeral | Single task, then discarded     |
 * | crew    | Crew      | per-app persistent| Long-running specialist         |
 */
export type AgentRole = 'mayor' | 'witness' | 'worker' | 'crew';

/** Status of an agent between sessions. */
export type AgentStatus = 'active' | 'idle' | 'suspended' | 'error';

/**
 * AgentBead extends FrameBead (type: 'agent') with agent-specific labels.
 *
 * All agent fields are stored in `labels` for uniform BeadStore querying:
 *   labels.role         — AgentRole
 *   labels.app          — sub-app identifier ('shell', 'cv-builder', etc.)
 *   labels.agent_status — AgentStatus
 *   labels.last_session — ISO timestamp of last session end
 *   labels.hook         — bead ID currently on this agent's hook (A3)
 */
export interface AgentBead extends FrameBead {
  type: 'agent';
  labels: FrameBead['labels'] & {
    role: AgentRole;
    app: string;
    agent_status: AgentStatus;
    last_session?: string;
    hook?: string;

    // G2: budget governance (all optional — omitted = unlimited)
    budget_limit?: string;          // e.g. "50000" (tokens/month ceiling)
    budget_spent?: string;          // e.g. "12400" (tokens consumed this period)
    budget_warning_pct?: string;    // e.g. "80" (warn threshold; default 80)
    reports_to?: string;            // parent agent ID for org-chart traversal

    // G3: hook approval state (set and cleared by sling/prime-node)
    hook_approval_status?: 'none' | 'pending' | 'approved' | 'rejected';
    hook_approval_required_when?: 'never' | 'budget_gt_X' | 'spawning_new_agent' | 'cross_app';
    hook_slung_at?: string;         // ISO timestamp
    hook_slung_by?: string;         // actor who called sling()
  };
}

/** Type guard — narrows a FrameBead to AgentBead. */
export function isAgentBead(bead: FrameBead): bead is AgentBead {
  return bead.type === 'agent'
    && typeof bead.labels['role'] === 'string'
    && typeof bead.labels['app'] === 'string';
}
