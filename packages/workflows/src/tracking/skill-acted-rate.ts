/**
 * skill-acted-rate — the OPAV-S1 action-rate projector (a second Projector<View> over
 * the shared spine, NOT a parallel ledger). It classifies each suggestion into one
 * terminal disposition and reports the corrected action-rate.
 *
 * The disposition model (adr:skill-action-instrumentation, signed off 2026-06-13):
 *
 *   acted          — a valid (C2-checked) skill:acted exists + its artifact resolves
 *   engaged_no_act — engaged, no skill:acted, no artifact on disk → EXPECTED terminal,
 *                    NOT a gap/failure; excluded from the capture-rate denominator
 *   capture_miss   — engaged, no skill:acted, but the artifact DOES exist → the real
 *                    C1 failure (agent did the work but failed to self-report)
 *   pending        — engaged, act_expected, within window, artifact not yet present
 *   ignored        — never engaged
 *
 * Artifact existence is the discriminator between honest non-completion and a self-report
 * failure. Capture-rate = acted / (acted + capture_miss) — engaged_no_act never inflates
 * the denominator, so honest "engaged but didn't finish" never reads as a gap.
 */

export type Disposition = 'acted' | 'engaged_no_act' | 'capture_miss' | 'pending' | 'ignored';

/**
 * Which denominator population a suggestion belongs to: `installed`
 * (`skill:suggested` — the skill is present in the repo) or `uninstalled`
 * (`skill:suggested-uninstalled` — inline-path only). Both populations are scored;
 * they are reported side by side, never silently merged or excluded (RCA d92e3b15:
 * the installed population was dropped from the denominator for 25 days).
 */
export type SuggestionPopulation = 'installed' | 'uninstalled';

/** A suggestion as projected from S0 suggestion telemetry (the SUGGESTION_ID join root). */
export interface SuggestionRecord {
  suggestionId: string;
  skill: string;
  sessionId: string;
  /** ISO ts of the suggestion — the lower bound for engagement/action. */
  ts: string;
  /** Population tag; absent on records projected before the 2026-07-17 split. */
  population?: SuggestionPopulation;
}

/** The independently-derived facts about one suggestion, used to classify it. */
export interface DispositionInputs {
  suggestion: SuggestionRecord;
  /** Independent signal: a SKILL.md Read for this skill+session at/after the suggestion. */
  engaged: boolean;
  /** A valid skill:acted event for this SUGGESTION_ID (C2-checked when the validator is active). */
  acted: boolean;
  /** Does the skill's expected artifact resolve on disk right now? */
  artifactExists: boolean;
  /** From the expected_artifact map: false for engaged-only skills (recon/zoom-out/...). */
  actExpected: boolean;
  /** Still inside the grace window for the artifact to appear? */
  withinWindow: boolean;
}

/** Classify one suggestion into its terminal disposition. Pure. */
export function classifyDisposition(i: DispositionInputs): Disposition {
  if (i.acted) return 'acted'; // terminal precedence — a confirmed action wins
  if (!i.engaged) return 'ignored';
  // engaged, not acted:
  if (!i.actExpected) return 'engaged_no_act'; // engaged-only skill — expected terminal
  if (i.artifactExists) return 'capture_miss'; // artifact exists but no self-report — the real failure
  if (i.withinWindow) return 'pending'; // artifact may still appear
  return 'engaged_no_act'; // window passed, no artifact — honest non-completion
}

export interface ActionRate {
  counts: Record<Disposition, number>;
  /**
   * acted / (acted + capture_miss). Null when the denominator is 0 (nothing was
   * capturable), to avoid reporting a rate over an empty base.
   */
  captureRate: number | null;
}

/** Aggregate dispositions into the corrected action-rate. */
export function computeActionRate(dispositions: readonly Disposition[]): ActionRate {
  const counts: Record<Disposition, number> = {
    acted: 0,
    engaged_no_act: 0,
    capture_miss: 0,
    pending: 0,
    ignored: 0,
  };
  for (const d of dispositions) counts[d] += 1;

  const denom = counts.acted + counts.capture_miss;
  const captureRate = denom === 0 ? null : counts.acted / denom;
  return { counts, captureRate };
}
