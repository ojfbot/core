/**
 * skill:acted — the SECOND event type on the tracking spine. STUB (OPAV-S1).
 *
 * This file deliberately exists now, empty of S1's machinery, to PROVE the spine is
 * type-general: `skill:acted` is built here and emitted through the exact same
 * eventEmit + EventLedger + honesty contract as gate-event. S1 therefore adds a TYPE,
 * not a parallel system (the duplex-drift hazard the whole spine is designed against).
 *
 * Its `correlation_id` is the SUGGESTION_ID from adr:suggestion-identity-and-denominator
 * (S0) — the identity that unifies a suggestion across observation, action, and feedback.
 *
 * DEFERRED to the S0/S1 PR (do NOT build here):
 *   - the action-rate projector (a second Projector<View> over these events);
 *   - the independent Stop-hook detector (the 2-source cross-check);
 *   - the cross-check validator (SHADOW) that reconciles emitted vs detected.
 */

import type { EvidenceRef, TrackingEvent } from './types/tracking-event.js';

export interface SkillActedArgs {
  /** The S0 SUGGESTION_ID this action corresponds to — the correlation key. */
  suggestionId: string;
  /** The skill that was acted on (e.g. 'tdd', 'validate'). */
  skill: string;
  /** Evidence the action really happened (honesty contract — required, same as gate outcomes). */
  evidence?: EvidenceRef;
  actor?: string;
  opId?: string;
  ts?: string;
  payload?: Record<string, unknown>;
}

/** Build a canonical skill:acted event. Emit it via the shared `eventEmit`. */
export function buildSkillActed(args: SkillActedArgs): TrackingEvent {
  return {
    event_type: 'skill:acted',
    op_id: args.opId ?? `${args.suggestionId}#acted`,
    correlation_id: args.suggestionId,
    ts: args.ts ?? new Date().toISOString(),
    actor: args.actor ?? 'stop-hook',
    to_state: 'acted',
    evidence_ref: args.evidence ?? null,
    payload: { skill: args.skill, ...args.payload },
  };
}
