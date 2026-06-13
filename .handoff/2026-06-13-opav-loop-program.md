---
id: 20260613-1900-brief-opav-loop-program
type: brief
title: "Pickup: OPAV skill self-improvement loop — full gated-slice plan + 4 ADRs, red-team-hardened"
actor: code-claude
session_id: 2026-06-13T19:00:00Z
responding_to: 20260613-1700-brief-repo-scoped-skill-relevance
refs:
  - file:core/OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md
  - adr:suggestion-identity-and-denominator
  - adr:skill-action-instrumentation
  - adr:repo-scoped-skill-relevance
  - adr:duplex-work-item-sync
  - file:core/CLAUDE-CONFIG-AUDIT-2026-06-13.md
  - adr:0092
  - adr:0068
hook: null
status: live
labels:
  domain: workflow-engine
  effort: XL
  priority: P1
---

## For the next agent

The Observation→Planning→Acting→Verification loop that makes skill usage self-auditing AND
self-improving. Full plan: `core/OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md` (6 slices S0–S5 +
Routing-Feedback Writer, built + adversarially red-teamed by an 11-agent workflow). **Plan only — no
code yet.** Each slice hands to `/plan-feature` → `/tdd`.

## Start HERE (the order is load-bearing)
1. **S0 keystone first** (`adr:suggestion-identity-and-denominator`, ~1 PR): mint a `SUGGESTION_ID` at
   suggestion time + thread it everywhere + fix the broken ignored-detector. **Nothing else is
   spawn/verify-able without it** — verified 0/1279 events carry an id today.
2. **S1** (`adr:skill-action-instrumentation`): the two-source `skill:acted` signal + honesty contract.
   Measure-first; the action-rate number gates everything downstream.
3. Then S3 re-baseline ∥ S2; S3 promotion; S4 (op_id MUST be the S0 identity); S5 last, AND-gated.

## Decisions/gotchas already made (do not re-litigate)
- **The loop does NOT close without an owned Routing-Feedback Writer** (S5-C4b) — it adjusts SUGGESTION
  RANKING ONLY (the firebreak; autonomy must never widen its own scope).
- **The 0.8% baseline is FALSE** — the lone "follow" was `skill:init`, not a skill action. Discard it.
- **Confirmed live bug:** ignored-detection mislabels all inline follows as `suggestion-ignored`
  (ADR-0092 killed the funnel-close). Fix in S0 before publishing any rate.
- **9 cross-slice invariants** in the plan (identity unity, fail-open-vs-fail-closed by domain,
  telemetry-freshness SLO, runtime AND-gate, exposure floors, the firebreak…). Honor them.
- S1's honesty validator ACTIVE is a HARD prerequisite for S5 autonomy (not an optional promotion).
- S2 + S4 ADRs are filed but carry **red-team addenda** (see the plan's per-slice sections) — fold them
  in before implementing: S2 label/filter independence + suggester-runs-at-limit-1; S4 autonomy-safety
  intake gate + split bead-vs-sink completion + real-webhook-trace replay.

## Still to write (ADRs)
`draft-action-rate-gate` (S3, rebuild from stub), `draft-autonomous-loops-and-routing-feedback` (S5).
