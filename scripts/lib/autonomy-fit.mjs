// autonomy-fit.mjs — verifiability-sorted dispatch (rm-l2-ojfbot#S15, plan F1).
//
// Karpathy's rule, mechanized: unattended autonomy only works "for anything that has
// objective metrics that are easy to evaluate" — without one, agents meander. A slice's
// fitness for agent dispatch is therefore derived from ONE fact: does it carry a
// machine-runnable `check:` command? Slices without one stay valuable — they are routed
// to the human (Pocock's ready-for-agent / ready-for-human split), never silently dropped.

/** A slice carries a machine-runnable success command. */
export function hasMachineCheck(slice) {
  return typeof slice?.check === 'string' && slice.check.trim().length > 0;
}

/** 'agent' when a machine check exists, else 'human' — the F1 routing verdict. */
export function autonomyFit(slice) {
  return hasMachineCheck(slice) ? 'agent' : 'human';
}

/**
 * The queue label the compiler should post: the slice's declared claimable_by, DEMOTED to
 * human_only when it asks for agent eligibility without a machine check. Returns
 * { claimable, demoted } — callers must log demotions (no silent caps).
 */
export function effectiveClaimable(slice) {
  const declared = slice?.claimable_by || 'either';
  const agentish = declared === 'agent_eligible' || declared === 'either';
  if (agentish && !hasMachineCheck(slice)) {
    return { claimable: 'human_only', demoted: true, reason: 'no check: field — not machine-verifiable, routed to human' };
  }
  return { claimable: declared, demoted: false };
}
