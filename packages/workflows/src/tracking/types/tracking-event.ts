/**
 * TrackingEvent — the shared schema of the deliverable-tracking event spine.
 *
 * ONE ledger, ONE emit, ONE projector, ONE reconciler. `gate-event` (deliverable
 * tracking) and `skill:acted` (OPAV-S1) are event TYPES on this one primitive —
 * not separate systems. Adding S1 must mean adding a `event_type`, never forking
 * a parallel ledger. See adr:deliverable-tracking-spine.
 *
 * This is deliberately a NEW family, parallel to FrameEvent (event.ts), which is
 * an ephemeral in-process pub/sub bus for a different purpose. They are not unified.
 */

/** The two event types the spine carries. `skill:acted` is stubbed this session. */
export type TrackingEventType = 'gate-event' | 'skill:acted';

/** Gate-transition states (gate-event). Append-only history; latest wins per gate. */
export type GateState = 'entered' | 'validating' | 'passed' | 'failed' | 'delivered';

/** The terminal state of a skill:acted event (S1 stub). */
export type ActedState = 'acted';

/** Any to_state the spine carries. gate-event uses GateState; skill:acted uses 'acted'. */
export type TransitionState = GateState | ActedState;

/** Gate states that assert a deliverable outcome — these REQUIRE a resolvable evidence_ref. */
export const EVIDENCE_REQUIRED_STATES: readonly GateState[] = ['passed', 'delivered'];

/** Evidence schemes the honesty contract recognizes. `path` is the only one resolved on disk. */
export type EvidenceScheme = 'path' | 'pr' | 'tpm' | 'test';

export interface EvidenceRef {
  scheme: EvidenceScheme;
  /** The reference itself: a filesystem path, PR number/URL, TPM id, or test name. */
  ref: string;
}

export interface TrackingEvent {
  event_type: TrackingEventType;
  /** Idempotency key — dedup everywhere a retry or the reconciler could double-write. */
  op_id: string;
  /**
   * Correlates events about the same thing.
   * - gate-event: `${program}/${slice}/${gate}` (the canvas nodeId is the slice segment).
   * - skill:acted: the SUGGESTION_ID from adr:suggestion-identity-and-denominator (S0).
   */
  correlation_id: string;
  /** ISO timestamp — stamped by eventEmit at the single write path. */
  ts: string;
  /** Agent or user that caused the transition. */
  actor: string;
  /** gate-event: the GateState entered. skill:acted: 'acted'. */
  to_state: TransitionState;
  /** Required for EVIDENCE_REQUIRED_STATES; null otherwise. The honesty contract. */
  evidence_ref: EvidenceRef | null;
  /** Event-type-specific extra data. */
  payload?: Record<string, unknown>;
}
