/**
 * FrameConvoy — A8 adoption: multi-agent coordinated work unit.
 *
 * A convoy groups a set of work beads and the agents assigned to them,
 * providing a shared status surface for cross-agent pipelines (e.g. a
 * blog-publish formula where research, draft, and publish run in different
 * agents / rigs).
 *
 * Gas Town mapping:
 *   gt convoy create <title>     →  createConvoy(title, store)
 *   gt convoy add <convoy> <bead> →  addToConvoy(convoyId, beadId, store)
 *   gt convoy status <convoy>    →  convoyProgress(convoyId, store)
 */

import type { FrameBead } from './bead.js';

export type ConvoyStatus = 'forming' | 'active' | 'completed' | 'failed';

/**
 * A slot in a convoy — one work bead + its assigned agent (if any).
 */
export interface ConvoySlot {
  beadId: string;
  agentId?: string;
  /** Slot status mirrors the bead's status at snapshot time */
  status: 'pending' | 'active' | 'done' | 'failed';
}

/**
 * FrameConvoy bead — the coordination envelope for a multi-agent job.
 *
 * Stored as a bead (type: 'convoy') under the initiating agent's rig prefix.
 * labels.convoy_status tracks overall convoy state.
 * labels.slots is JSON-serialised ConvoySlot[].
 */
export interface FrameConvoy extends FrameBead {
  type: 'convoy';
  labels: FrameBead['labels'] & {
    convoy_status: ConvoyStatus;
    /** JSON-encoded ConvoySlot[] */
    slots: string;
    /** Optional: molecule bead driving this convoy */
    molecule_id?: string;
  };
}

export function isFrameConvoy(bead: FrameBead): bead is FrameConvoy {
  return bead.type === 'convoy';
}

/**
 * Progress snapshot returned by convoyProgress().
 */
export interface ConvoyProgressReport {
  convoyId: string;
  title: string;
  status: ConvoyStatus;
  total: number;
  done: number;
  active: number;
  pending: number;
  failed: number;
  slots: ConvoySlot[];
}
