---
id: 20260613-1959-brief-pickup-opav-slice-1-skill-action-instrumentation-v
type: brief
title: "Pickup: OPAV Slice 1 — skill-action instrumentation (verify S0 exit gate FIRST)"
actor: code-claude
to: code-claude
session_id: 2026-06-13T19:59:15Z
responding_to: 20260613-1900-brief-opav-loop-program
refs:
  - adr:suggestion-identity-and-denominator
  - adr:skill-action-instrumentation
  - file:core/OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md
  - bead:20260613-1959-report-opav-slice-0-shipped-suggestion-id-minted-ignored-
hook: null
status: live
created_at: 2026-06-13T19:59:15Z
labels:
  domain: workflow-engine
  project: opav-loop
  slice: S1
  effort: L
  priority: P1
---

## STEP 0 — verify the gates yourself before writing anything (do not trust this brief)

S0 is the join key everything in S1 hangs on. **Independently re-derive its exit gate and S1's
entrance gate** — do not take the prior session's word for it:

1. **S0 exit gate (must be GREEN to proceed):**
   - `node core/scripts/hooks/replay-ignored-correction.mjs` → expect `regressions 0` and
     `ignored_after ≤ ignored_before`, `PASS: yes`. (Prior run: 581→561, 20 follows. Your live numbers
     will differ as telemetry grows — that's fine; the invariant is PASS + 0 regressions, not the count.)
   - `pnpm vitest run scripts/hooks/__tests__/` → 15 S0 tests green.
   - Spot-check identity is live: emit a real suggestion and confirm the new event carries a non-empty
     `suggestion_id` (see the S0 report bead's E2E snippet), and that `corroborate-follow.mjs` is the
     ONLY corroboration implementation (grep for a second copy of the join — there must not be one).
   - Confirm the branch `adr/suggestion-identity-and-denominator` is merged (or merge/rebase it) — S1
     events MUST carry the S0 `SUGGESTION_ID`; do not invent a second key.
2. **S1 entrance gate (from the plan):** S0's `SUGGESTION_ID` is the join key; `skill:acted` schema
   must carry `SUGGESTION_ID` + `expected_artifact` + `mode` + `op_id`. If S0 isn't green, STOP and fix
   S0 — do not build S1 on a broken denominator.

If any check fails, write a discovery bead and fix-forward on S0; do not proceed to S1 code.

## Context

S0 (`adr:suggestion-identity-and-denominator`, ADR-0093) landed: durable `SUGGESTION_ID` minted in
`suggest-skill.sh`, threaded through suggested→ignored→followed, and a first inline-follow correction
to the `ignored` denominator (via `corroborate-follow.mjs`, reused by the replay). The 0.8% baseline is
struck (ADR-0068). S1 is the **measure-first** slice: make "suggestion acted on" trustworthy for inline
(Skill-tool-bypassing) follows. Its action-rate number gates everything downstream (S3 RIDM → S5
autonomy). Full gates: the plan's **S1** section.

## Goal

Build the two-source `skill:acted` signal + the honesty contract, per the plan's S1-C0…C4. The agent
emitter ALONE is the exact 0.8% failure mode — so the independent reconciler (Stop-hook / PostToolUse on
SKILL.md-Read) ships **from day one**, not as a later promotion. Note: S0 already proved the
SKILL.md-Read signal exists in `tool-telemetry.jsonl` and is joinable — S1 formalizes it into a
first-class `skill:acted` event carrying the S0 id, rather than reading the catch-all retroactively.

## Acceptance criteria (from the plan — fold the red-team addenda IN)

- [ ] `skill:acted` schema carries `SUGGESTION_ID` (S0), `expected_artifact`, `mode`, `op_id`; 20/20 schema-lint, ≥18/20 join-resolve.
- [ ] Two-source: agent emitter **+** independent reconciler from day one. Capture-rate vs the independent signal ≥70%, **and** a two-sided over-capture/false-emit TPM ≤10%.
- [ ] C2 SHADOW validator: trace produced by a *different* mechanism than the emitter, skill-specific (per-skill `expected_artifact` map); **ban self-written-log-as-its-own-corroboration**; adversarial trace-injection test; a **third verdict** (pending/indeterminate). false-flag ≤5%, coverage ≥90%.
- [ ] C3 re-derived AR0, raw **and** backed-only, scoped `acted / suggested-uninstalled`, with a **minimum-N power gate** + a join precision/recall oracle vs a gold set.
- [ ] C4 RIDM promotes validator shadow→active; **C4 ACTIVE is a HARD prerequisite for S5 autonomy** (not optional).
- [ ] Idempotency: `skill:acted` carries `op_id` so retries + reconciler don't double-count.

## Flag back — DO NOT decide these unattended

Per the program brief's closing caveat, **S1 onward carries design choices the user wants to be in the
loop on.** Surface, don't unilaterally decide:
- The **honesty-contract** shape (what counts as an independent, causally-derived artifact per skill;
  this contract is reused in S4-completion and S5-verify — invariant #2 — so its design has blast radius).
- Anything touching the **autonomy boundary** (fail-CLOSED for autonomy vs fail-OPEN for relevance —
  invariant #3; the firebreak — invariant #7). S1's validator-ACTIVE is a gate *toward* autonomy.
- The per-skill `expected_artifact` map contents (judgment calls about what "acted" means per skill).

Grill the user before committing to these. This is a measure-first slice — bias to observe/SHADOW and
get sign-off before anything enforces.

## Constraints

- pnpm only. Honor the 9 cross-slice invariants (plan §Cross-slice invariants) — esp. identity unity
  (#1), one honesty contract not three (#2), event-type partition (#4), idempotency (#5),
  telemetry-freshness SLO (#6).
- Reuse the S0 predicate module (`corroborate-follow.mjs`) where the inline-follow signal is needed;
  don't reimplement the join.
- Commit/push only when the user asks. Stage on `adr/skill-action-instrumentation`.
- Working tree also holds another agent's `deliverable-tracking-spine` work (`packages/.../tracking/`)
  — that's S4-adjacent substrate, not S1; don't entangle.
