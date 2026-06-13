/**
 * Reconciler — the hook target, SHADOW-first.
 *
 * Claude Code hooks fire on TOOL events, not semantic gate passes, so the hook
 * never performs the primary write (that's eventEmit). It runs THIS auditor, which
 * compares the derived canvas against the canonical ledger and raises alarms:
 *
 *   1. divergence  — a slice node's OWNED REGION (color + fence) differs from the
 *                    ledger-derived projection (a hand-edit to revert). Prose outside
 *                    the fence is outside the contract and never compared.
 *   2. evidence    — a current passed/delivered state with no resolvable evidence_ref
 *                    (the honesty contract, audited even when emitted out-of-band).
 *   3. staleness   — a gate stuck in `validating` past the SLA (anti stale-green).
 *
 * Auto-repair is an ACTION-TAKING control, so it stays OFF: reconcile WRITES NOTHING.
 * It returns findings plus a `proposedCanvas` (the ledger-derived form) that a future
 * OPERATIONAL mode could apply once shadow TPMs clear. `autoRepairApplied` is always
 * false in this skeleton.
 */

import { violatesHonesty } from './emit.js';
import {
  GATE_STATUS_OPEN,
  GATE_STATUS_CLOSE,
  latestPerGate,
  projectCanvas,
} from './projector.js';
import type { CanvasDoc, CanvasNode } from './types/canvas.js';
import type { TrackingEvent } from './types/tracking-event.js';

/** 24 hours — the default validating-staleness SLA. */
export const DEFAULT_SLA_MS = 24 * 60 * 60 * 1000;

export interface Divergence {
  nodeId: string;
  reason: string;
}
export interface EvidenceViolation {
  correlation_id: string;
  to_state: string;
  op_id: string;
}
export interface Staleness {
  correlation_id: string;
  since: string;
  ageMs: number;
}
export interface ReconcileReport {
  divergences: Divergence[];
  evidenceViolations: EvidenceViolation[];
  stale: Staleness[];
  /** Always false in the shadow skeleton — auto-repair is action-taking. */
  autoRepairApplied: false;
  /** The ledger-derived canvas a future operational mode could apply. Observe only. */
  proposedCanvas: CanvasDoc | null;
}

export interface ReconcileOptions {
  /** Wall-clock for the staleness check (injectable for determinism). */
  nowMs?: number;
  /** Staleness SLA in ms (default 24h). */
  slaMs?: number;
}

/** Extract only the projector-OWNED region of a node: its color + the fenced block. */
function ownedRegion(node: CanvasNode): { color: string | undefined; fence: string | null } {
  const text = node.text ?? '';
  const start = text.indexOf(GATE_STATUS_OPEN);
  const end = text.indexOf(GATE_STATUS_CLOSE);
  const fence =
    start !== -1 && end !== -1 && end > start
      ? text.slice(start, end + GATE_STATUS_CLOSE.length)
      : null;
  return { color: node.color, fence };
}

function ownedRegionEqual(a: CanvasNode, b: CanvasNode): boolean {
  const x = ownedRegion(a);
  const y = ownedRegion(b);
  return x.color === y.color && x.fence === y.fence;
}

/**
 * Audit a canvas against its ledger. Pure: reads events + canvas, writes nothing,
 * returns a report. The divergence check compares ONLY the owned region, so prose
 * edits are ignored by design.
 */
export function reconcile(
  events: TrackingEvent[],
  canvas: CanvasDoc,
  opts: ReconcileOptions = {},
): ReconcileReport {
  const nowMs = opts.nowMs ?? Date.now();
  const slaMs = opts.slaMs ?? DEFAULT_SLA_MS;

  // (1) Divergence: project the ledger over the current canvas, compare owned regions.
  const expected = projectCanvas(events, canvas);
  const expectedById = new Map(expected.nodes.map((n) => [n.id, n]));
  const divergences: Divergence[] = [];
  for (const node of canvas.nodes) {
    const exp = expectedById.get(node.id);
    if (!exp) continue;
    if (!ownedRegionEqual(node, exp)) {
      divergences.push({ nodeId: node.id, reason: 'owned region (color/fence) differs from ledger-derived projection' });
    }
  }

  // (2) + (3): evidence + staleness over the LATEST state per gate.
  const evidenceViolations: EvidenceViolation[] = [];
  const stale: Staleness[] = [];
  for (const gates of latestPerGate(events).values()) {
    for (const e of gates.values()) {
      if (violatesHonesty(e)) {
        evidenceViolations.push({ correlation_id: e.correlation_id, to_state: e.to_state, op_id: e.op_id });
      }
      if (e.to_state === 'validating') {
        const ageMs = nowMs - Date.parse(e.ts);
        if (ageMs > slaMs) stale.push({ correlation_id: e.correlation_id, since: e.ts, ageMs });
      }
    }
  }

  return {
    divergences,
    evidenceViolations,
    stale,
    autoRepairApplied: false,
    proposedCanvas: divergences.length > 0 ? expected : null,
  };
}
