# OPAV loop gated-slice plan — RECOVERED SUMMARY (not the original)

> **Provenance.** The master plan `core/OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md` was authored
> 2026-06-13 by an 11-agent workflow (~807k tokens: 5 decompose + 5 red-team + 1 loop-closure
> critic) and **was never committed — it exists only on the operator's Mac.** This file is a
> reconstruction assembled 2026-07-04 **verbatim from four in-repo derived sources**, with zero
> invented content:
> `~/selfco/canvas/opav-loop-roadmap.canvas` (full slice map, same-day) ·
> `~/selfco/wiki/log.md` §2026-06-13 (delivery entry: findings + invariants) ·
> `core/.handoff/2026-06-13-opav-loop-program.md` (program bead) ·
> `core/.handoff/20260613-1959-report-opav-slice-0-…` + ADR-0093/0095 (what shipped since).
> Where the original carried per-slice detail these sources don't preserve (red-team addenda
> bodies, per-criterion TPM text), that detail is **absent here, not paraphrased**.
> **This file does NOT satisfy `audit-delivery-check.mjs` H0.1 / rm-l2-ojfbot#S10** — S10 still
> requires the original, copied from the Mac. When it lands, this summary stays as the index.

## The loop

**O**bservation → **P**lanning → **A**cting → **V**erification, applied to the skill system so
skill usage becomes self-auditing AND self-improving. Six slices S0–S5 plus the Routing-Feedback
Writer (S5-C4b). Flow: S0 → S1 → {S2, S3} → S4 → S5 → S5-C4b → back to S0's data
("feedback → ranking only — LOOP CLOSES · firebreak").

## The four reshaping findings (red-team, 2026-06-13)

1. **The loop didn't close as drafted** — no slice owned the Routing-Feedback Writer
   (observability ≠ self-improvement) → promoted to S5-C4b with the firebreak (adjusts
   suggestion RANKING only; autonomy can never widen its own scope).
2. **Keystone Slice 0** — no durable SUGGESTION_ID existed in telemetry (verified 0/1279
   events); everything joined on temporal guesses.
3. **The 0.8% follow baseline was FALSE** — the lone "follow" was `skill:init`, not a skill
   action. Discarded.
4. **Confirmed live bug** — the ignored-detector mislabeled all inline follows as
   `suggestion-ignored` (ADR-0092 killed the funnel-close; 575 ignored inflated).

## Slices (from the canvas, verbatim structure)

### S0 · Suggestion identity + denominator — Observation · KEYSTONE · ~1 PR
C0 mint `SUGGESTION_ID` (0/1279 today) · C1 fix ignored-detector (575 mislabeled) · C2 discard
false 0.8% baseline. ADR: `suggestion-identity-and-denominator`. *Blocks everything.*
**Status: SHIPPED — ADR-0093 accepted; replay corrected ignored 581→561 (20 corroborated inline
follows, 3.4% — a floor, not the full correction).**

### S1 · Action instrumentation — Observation · measure-first
C0 `skill:acted` schema + honesty spec · C1 emitter + independent Stop-hook (2-source) ·
C2 cross-check validator (SHADOW) · C3 re-derived action-rate (raw + backed) · C4 validator →
active (RIDM; **HARD prerequisite for S5**). ADR: `skill-action-instrumentation`.
**Status: C0–C2 SHIPPED SHADOW (ADR-0095, PRs #157/#158, merged 2026-06-14). C3 open (brief:
`.handoff/20260618-brief-pickup-opav-s1-c3-litter-usage-signal.md`); C4 not started.**

### S2 · Repo-scoped relevance — Planning
C0 ground truth → C1 schema (`applies_to` + repo-profile) → C2 SHADOW would-prune → C3 enforce
(PR-gated) → C4 fleet. ADR: `repo-scoped-skill-relevance` (+ red-team addenda: label/filter
independence; *gotcha: suggester runs `--limit=1`*). **Status: not started; ADR draft filed.**

### S3 · Action-rate confidence gate — Verification · was UNSAFE (stub) → rebuilt
C0 re-baseline (discard 0.8%) · C1 friction-nudge SHADOW · C2 auto-install SHADOW · C3
auto-install OPERATIONAL (RIDM). **This TPM licenses S5 autonomy.** ADR: `action-rate-gate`
(still to write — original came back unsafe-as-drafted, rebuild from scratch).
**Status: not started.**

### S4 · Duplex task queue (beads ↔ issues) — Planning + Acting
C0 projector → C1 op_id outbox → C2 fencing → C3 rev/tombstone → C4 liveness → C5 reconciler
SHADOW → C6 certified. Zero-tolerance soak TPMs (double-exec / resurrection = 0). ADR:
`duplex-work-item-sync` (+ addenda: autonomy-safety intake gate, split bead-vs-sink completion,
real-webhook-trace replay). **op_id MUST be the S0 identity.** **Status: not started.**

### S5 · Autonomous loops — Acting · LAST · AND-gated (S3 ∧ S4 ∧ S1-active)
C0 autonomy-safety classify (fail-CLOSED) · C1 propose/approve SHADOW (Cockpit) · C2 bounded
delivery (runtime AND-gate + fence) · C3 verify + honesty (TPM9 ∧ TPM10) · C4a concurrency ramp
1→2→3. ADR: `autonomous-loops` (to write). **Status: not started.**

### S5-C4b · Routing-Feedback Writer — THE LOOP CLOSURE
Was unowned (observability ≠ self-improvement). Action-data → suggestion **RANKING ONLY**.
SHADOW (would-reweight vs frozen control) → RIDM via **diff-in-diff A/B**. **FIREBREAK: never
touches the autonomy classifier / eligibility / human-gate. Autonomy cannot widen its own
scope.** **Status: not started.**

## The 9 cross-slice invariants (verbatim from the canvas)

1. Identity unity (S0 id everywhere)
2. No 'done' without an independent artifact
3. Relevance fails **OPEN** / autonomy fails **CLOSED**
4. Event-type partition
5. Dedup everywhere a retry can double-count
6. Telemetry-freshness SLO (anti stale-green)
7. **FIREBREAK** — feedback = ranking only
8. Runtime AND-gate (class ∧ fence ∧ op_id)
9. Exposure floors on every =0 / =100% bar

## Decisions already made (program bead — do not re-litigate)

- The loop does NOT close without an owned Routing-Feedback Writer (S5-C4b); ranking only.
- The 0.8% baseline is false; discard it.
- S0 before publishing any rate (ignored-detection bug).
- S1's honesty validator ACTIVE is a HARD prerequisite for S5 autonomy, not optional.
- S2 + S4 ADRs carry red-team addenda — fold in before implementing (addenda bodies are in the
  **original plan only**; this is the largest known loss in this reconstruction).
- Still to write: `draft-action-rate-gate` (S3), `draft-autonomous-loops-and-routing-feedback` (S5).

## Relationship to the 2026-07-04 audit program

The audit (`MULTIAGENT-SDLC-AUDIT-2026-07-04.md`) found the OPAV program stalled after S1-C2
and its constitution uncommitted (theme 3: documented-but-absent artifacts). Slice
rm-l2-ojfbot#S10 commits the original; H4/I5/I6 build the same verification discipline into the
day-runner and daily-logger; the S5 firebreak is restated as non-negotiable #5 in
`AGENTIC-INTEGRATION-PLAN-2026-07-04.md`.
