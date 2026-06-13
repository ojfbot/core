/**
 * eventEmit — the single write path onto the tracking spine.
 *
 * Emit-not-magic: a semantic transition (a gate pass, a skill action) has no
 * corresponding Claude Code tool event, so it is EXPLICITLY emitted here. Hooks
 * only audit (see reconciler.ts); they never perform the primary write.
 *
 * Both `gate-event` and (later) `skill:acted` call this. It enforces the one
 * honesty contract before the append, then delegates idempotent persistence to
 * the EventLedger (op_id dedup).
 */

import fsSync from 'fs';
import type { EventLedger } from './ledger.js';
import {
  EVIDENCE_REQUIRED_STATES,
  type EvidenceRef,
  type TrackingEvent,
} from './types/tracking-event.js';

/** Thrown when the honesty contract is violated — surfaced to the caller, no append. */
export class HonestyContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HonestyContractError';
  }
}

/**
 * Is this evidence reference resolvable? `path` refs must exist on disk; other
 * schemes are accepted structurally (a non-empty ref of a known scheme). A fuller
 * resolver (does PR #123 exist?) is out of scope for the spine — the contract is
 * "independent + present + well-formed", not "fetched".
 */
export function isResolvable(ref: EvidenceRef | null): boolean {
  if (!ref || !ref.ref || ref.ref.trim().length === 0) return false;
  if (ref.scheme === 'path') return fsSync.existsSync(ref.ref);
  return ref.scheme === 'pr' || ref.scheme === 'tpm' || ref.scheme === 'test';
}

/**
 * Validate the honesty contract for an event. Throws HonestyContractError if a
 * passed/delivered event lacks a resolvable evidence_ref. Reused by the reconciler.
 */
/**
 * Does this event assert an outcome that the honesty contract backs with evidence?
 * One contract, reused across types: gate-event passed/delivered AND skill:acted.
 * Exported so the reconciler audits the SAME contract rather than re-deriving it.
 */
export function requiresEvidence(event: TrackingEvent): boolean {
  return (
    event.event_type === 'skill:acted' ||
    (EVIDENCE_REQUIRED_STATES as readonly string[]).includes(event.to_state)
  );
}

/** True when an event breaches the honesty contract (asserts an outcome with no resolvable evidence). */
export function violatesHonesty(event: TrackingEvent): boolean {
  return requiresEvidence(event) && !isResolvable(event.evidence_ref);
}

export function assertHonest(event: TrackingEvent): void {
  if (!violatesHonesty(event)) return;
  const reason = event.evidence_ref
    ? `its evidence_ref (${event.evidence_ref.scheme}:${event.evidence_ref.ref}) does not resolve`
    : `it has no evidence_ref`;
  throw new HonestyContractError(
    `${event.event_type} '${event.to_state}' for ${event.correlation_id} rejected — ${reason}. ` +
      `passed/delivered require independent evidence (path/pr/tpm/test).`,
  );
}

/** Emit an event: enforce the honesty contract, then idempotently append to the ledger. */
export async function eventEmit(ledger: EventLedger, event: TrackingEvent): Promise<void> {
  assertHonest(event);
  await ledger.append(event);
}
