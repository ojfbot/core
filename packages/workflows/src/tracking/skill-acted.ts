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

/**
 * Capture mode. SHADOW-first (OPAV-S1): the cross-check validator observes and
 * annotates but quarantines nothing until the C4 RIDM promotion to `active`.
 */
export type SkillActedMode = 'shadow' | 'active';

export interface SkillActedArgs {
  /** The S0 SUGGESTION_ID this action corresponds to — the correlation key. */
  suggestionId: string;
  /** The skill that was acted on (e.g. 'tdd', 'validate'). */
  skill: string;
  /** Capture mode — defaults to 'shadow' (observe-only) per SHADOW-first. */
  mode?: SkillActedMode;
  /** Skill-specific artifact the action is expected to produce (the honesty target). */
  expectedArtifact?: string;
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
    payload: {
      skill: args.skill,
      mode: args.mode ?? 'shadow',
      expected_artifact: args.expectedArtifact,
      ...args.payload,
    },
  };
}

const MODES: readonly SkillActedMode[] = ['shadow', 'active'];

/** Result of a schema-lint over a `skill:acted` event. */
export interface SkillActedLint {
  valid: boolean;
  errors: string[];
}

const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Schema-lint a `skill:acted` event (C0). Structural well-formedness only — NOT the
 * honesty contract (that's `assertHonest` at emit) nor provenance (that's the C2
 * validator). Asserts the join key, idempotency key, terminal state, and the S1
 * payload triple `{skill, mode, expected_artifact}` are present and well-formed.
 */
export function lintSkillActed(ev: TrackingEvent): SkillActedLint {
  const errors: string[] = [];
  if (ev.event_type !== 'skill:acted') errors.push(`event_type must be 'skill:acted', got '${ev.event_type}'`);
  if (ev.to_state !== 'acted') errors.push(`to_state must be 'acted', got '${ev.to_state}'`);
  if (!nonEmptyString(ev.correlation_id)) errors.push('correlation_id (SUGGESTION_ID) is required and non-empty');
  if (!nonEmptyString(ev.op_id)) errors.push('op_id is required and non-empty');

  const payload = (ev.payload ?? {}) as Record<string, unknown>;
  if (!nonEmptyString(payload.skill)) errors.push('payload.skill is required and non-empty');
  if (!MODES.includes(payload.mode as SkillActedMode)) errors.push(`payload.mode must be one of ${MODES.join('|')}`);
  if (!nonEmptyString(payload.expected_artifact)) errors.push('payload.expected_artifact is required and non-empty');

  return { valid: errors.length === 0, errors };
}
