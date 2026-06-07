---
id: 20260607-1632-decision-loop-metric-two-step
type: decision
title: "First closed-loop metric: vault-lint rig → per-skill eval (two-step, shadow-first)"
actor: code-claude
session_id: 2026-06-07T16:32:51Z
refs:
  - bead:20260607-1020-brief-close-the-loop-metric
  - file:~/selfco/wiki/synthesis/karpathy-loop-in-ojfbot.md
  - file:~/selfco/wiki/concepts/karpathy-loop.md
  - adr:0086
  - adr:0068
hook: null
status: live
created_at: 2026-06-07T16:32:51Z
labels:
  origin: karpathy-loop-teaching-session
  answers-brief: 20260607-1020-brief-close-the-loop-metric
  next-skill: grill-with-docs
---

# First closed-loop metric: vault-lint rig → per-skill eval (two-step, shadow-first)

## Context
Answers the 2026-06-07 brief (`bead:20260607-1020-brief-close-the-loop-metric`). Done as a
teaching session — the user wanted to learn the technology, not just receive a pick. We taught
open-loop vs closed-loop, the autoresearch loop mechanism, the immutable-evaluator catch, then
the user independently re-derived ADR-0086's shadow/Brassboard stage. We scored the three
candidate metrics on six dimensions (ruler-calibration-needed · gameability · run-cost/corpus-
speed · blast-radius · destination-value · teaching-value).

## Options considered
1. **Per-skill prompt eval score** — closest analog to autoresearch's `val_bpb`; real compounding
   value; but needs an eval set built upfront, touches a fleet-symlinked `SKILL.md`, and its
   LLM-judge ruler has *both* failure modes (inaccurate AND gameable).
2. **`/deep-research` report-quality rubric** — high value, but run economics are disqualifying as
   a *first* pick: shadow mode needs volume, each run is a slow serialized cycle (the 2026-06-05
   API-saturation rule forbids parallel cycles).
3. **Vault lint/health score** — deterministic, instant, reversible; ruler needs no accuracy
   calibration; but the destination is janitorial (`/vault lint --fix` exists) and the score is a
   weak proxy (gameable by *deleting* content — Goodhart).

## Decision
**Two-step, shadow-first.** Start on the **vault-lint health score as a throwaway teaching rig**
(learn the loop mechanics safely), then graduate to **per-skill prompt eval as the real
destination**. **Park `/deep-research`** until the loop is understood on something cheap.
Everything runs **shadow / observe-only** first, with a **pre-committed promotion trigger** set
before any corpus is gathered.

Validated live: one shadow iteration on the real finding "`program.md` has no source page" showed
"add a source page" and "delete the raw file" both move the lint score −1 — a score-only loop
would keep the destructive edit. **Goodhart, demonstrated.** Lesson carried into the design:
an *immutable* evaluator is necessary but not sufficient; the ruler must also be a *good proxy*
(**accurate ≠ good**).

## Consequences
- **Commits us to:** building the lint rig as a shadow-mode harness next (`/grill-with-docs` to
  pin the evaluator + the pre-committed promotion trigger → `/gated-slice` for the shadow →
  operational gates). Knowledge-first per ADR-0068 — no `/autoresearch` build, no ADR, no GPU repo
  until the rig earns it.
- **Forecloses (for now):** deep-research as the first closed-loop target; any loop that fans out
  concurrent research cycles (inherits the sequential-deep-research constraint).
- **Watch:** the lint rig's destination value is low by design — it's a *teaching* rig, not the
  prize. Don't let it become the end state; the per-skill eval is where the compounding value is.
- This decision bead should only be promoted toward an ADR once the rig has actually run in shadow
  and the approach has stabilized (ADR-0068).
