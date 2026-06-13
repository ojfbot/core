/**
 * gate-event — the first consumer of the tracking spine (deliverable tracking).
 *
 * Emit-not-magic: the slice lifecycle (/gated-slice, /validate, /tdd) calls this at
 * each transition. It builds a gate-event, emits it through the single write path
 * (honesty-enforced, op_id-idempotent), then re-projects the WHOLE ledger onto the
 * on-disk canvas. The canvas is never written from anything but a ledger projection.
 *
 * `skill:acted` (OPAV-S1) is the sibling consumer of the SAME ledger + emit; see
 * skill-acted.ts. This is deliberately not a gate-only tracker.
 */

import { eventEmit } from './emit.js';
import { EventLedger, DEFAULT_TRACKING_ROOT } from './ledger.js';
import { projectCanvas } from './projector.js';
import { readCanvas, writeCanvas } from './canvas-io.js';
import type { EvidenceRef, GateState, TrackingEvent } from './types/tracking-event.js';

export interface GateEventArgs {
  program: string;
  /** The slice id — MUST equal the target canvas node id. */
  slice: string;
  gate: string;
  toState: GateState;
  evidence?: EvidenceRef;
  actor?: string;
  /** Defaults to `${program}/${slice}/${gate}#${toState}` so a repeated transition dedups. */
  opId?: string;
  /** ISO timestamp; defaults to now. */
  ts?: string;
  /** Ledger root (default ~/selfco/tracking). Injectable for tests. */
  ledgerRoot?: string;
  /** Canvas file to project onto. If omitted, only the ledger is written. */
  canvasPath?: string;
}

export interface GateEventResult {
  event: TrackingEvent;
  canvasUpdated: boolean;
}

/** Build the canonical TrackingEvent for a gate transition. */
export function buildGateEvent(args: GateEventArgs): TrackingEvent {
  const correlation_id = `${args.program}/${args.slice}/${args.gate}`;
  return {
    event_type: 'gate-event',
    op_id: args.opId ?? `${correlation_id}#${args.toState}`,
    correlation_id,
    ts: args.ts ?? new Date().toISOString(),
    actor: args.actor ?? 'code-claude',
    to_state: args.toState,
    evidence_ref: args.evidence ?? null,
  };
}

/** Emit a gate transition and idempotently re-project the canvas from the ledger. */
export async function gateEvent(args: GateEventArgs): Promise<GateEventResult> {
  const ledger = new EventLedger(args.program, args.ledgerRoot ?? DEFAULT_TRACKING_ROOT);
  const event = buildGateEvent(args);

  // Single write path — throws (and writes nothing) if the honesty contract fails.
  await eventEmit(ledger, event);

  if (!args.canvasPath) return { event, canvasUpdated: false };

  // Projection-from-canonical: re-derive the canvas from the FULL ledger, never from
  // the prior canvas state. The canvas is a view; this is its only write path.
  const canvas = await readCanvas(args.canvasPath);
  const projected = projectCanvas(await ledger.read(), canvas);
  await writeCanvas(args.canvasPath, projected);
  return { event, canvasUpdated: true };
}
