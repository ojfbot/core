/**
 * FrameEvent types — A7 adoption.
 *
 * Every bead mutation, hook assignment, mail delivery, and agent state change
 * emits a FrameEvent. The event bus is the connective tissue of Frame OS:
 *   - CoreReader Activity tab renders a live feed
 *   - Shell header badge counts unread events
 *   - Sub-apps subscribe to their own domain events
 *
 * Gas Town mapping:
 *   gt feed  →  activity feed driven by FrameEvents
 */

export type FrameEventType =
  // Bead lifecycle
  | 'bead:created'
  | 'bead:updated'
  | 'bead:closed'
  | 'bead:archived'
  // Hook (A3)
  | 'hook:assigned'
  | 'hook:cleared'
  | 'hook:nudge'
  // Mail (A5)
  | 'mail:sent'
  | 'mail:read'
  // Molecule (A4)
  | 'molecule:started'
  | 'molecule:step_done'
  | 'molecule:completed'
  // Agent lifecycle (A2)
  | 'agent:started'
  | 'agent:idle'
  | 'agent:suspended'
  | 'agent:error'
  | 'agent:handoff'
  // Budget governance (G2)
  | 'agent:budget_warning'    // spending >= budget_warning_pct, still running
  | 'agent:budget_exhausted'  // spending >= 100%, agent paused
  // Hook approval (G3)
  | 'agent:awaiting_approval' // hook present but approval_status = 'pending'
  // Convoy (A8)
  | 'convoy:created'
  | 'convoy:updated'
  // Heartbeat (G5)
  | 'agent:heartbeat';

export interface FrameEvent {
  /** Unique event ID — prefixed with the emitting app's rig prefix */
  id: string;
  timestamp: string;
  type: FrameEventType;
  /** Agent or user that caused the event */
  actor: string;
  /** Primary bead this event concerns */
  bead_id?: string;
  /** Agent bead this event concerns */
  agent_id?: string;
  /** Sub-app that emitted the event (e.g. 'cv-builder', 'shell') */
  app: string;
  /** Human-readable one-line summary */
  summary: string;
  /** Additional structured payload (event-type-specific) */
  payload?: Record<string, unknown>;
}
