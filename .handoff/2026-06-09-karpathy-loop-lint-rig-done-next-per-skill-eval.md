---
id: 20260609-2226-report-karpathy-loop-lint-rig-done
type: report
title: "Karpathy-loop lint rig DONE (Goodhart confirmed) — next: grill the per-skill-eval harness"
actor: code-claude
session_id: 2026-06-10T03:26:21Z
responding_to: 20260607-1632-decision-loop-metric-two-step
refs:
  - bead:20260607-1020-brief-close-the-loop-metric
  - bead:20260607-1632-decision-loop-metric-two-step
  - file:~/selfco/wiki/concepts/karpathy-loop.md
  - file:~/selfco/wiki/synthesis/karpathy-loop-in-ojfbot.md
  - url:https://github.com/karpathy/autoresearch
  - adr:0086
  - adr:0068
  - adr:0083
hook: null
status: live
created_at: 2026-06-10T03:26:21Z
labels:
  initiative: karpathy-loop / closed-loop-metrics
  phase: lint-rig-complete
  next-skill: grill-with-docs
  next-target: per-skill-prompt-eval-harness
---

# Karpathy-loop lint rig DONE — next: grill the per-skill-eval harness

## What got done
The **two-step shadow-first** decision (see the `decision` bead this responds to) is executed
through step one. The **vault-lint rig was a throwaway teaching prototype, and it is complete + deleted.**

- `/grill-with-docs` aligned the rig as a `/prototype` (ADR-0083) whose ONE question was: does a
  score-only keep/discard loop keep a destructive edit because it scores as well as a real fix?
- `/prototype` built + ran it on a synthetic temp sandbox (the real `~/selfco` was never touched).
  **Verdict: Goodhart confirmed in running code** — the loop kept "delete the raw file" over "add
  the source page" (both scored −1), and the archived source was destroyed while the scoreboard
  said "improved." Prototype recorded its verdict in the vault, then deleted itself.
- Filed into the vault: `concepts/karpathy-loop` (the lesson + the prototype confirmation),
  `synthesis/karpathy-loop-in-ojfbot` (decision + operating discipline), `entities/core` open thread.
  "Karpathy Loop" added to `core/domain-knowledge/GLOSSARY.md`.

## What's open
- **The real destination — the per-skill prompt-eval harness — is NOT started.** That is the next
  initiative.
- These core artifacts (this bead + the two prior beads + the GLOSSARY term) reach `main` only via
  the PR that carries this bead (core `main` is branch-protected; direct push is rejected).

## Design inputs banked for the per-skill-eval harness (carry these forward)
1. The evaluator must be **immutable AND a good proxy** — immutable alone is necessary-but-not-sufficient
   (the lint rig proved it). **accurate ≠ good.**
2. Concrete cheap guardrail found: **reject any proposal with net content deletion.** Carry into the
   per-skill design (and generalize — what's the per-skill equivalent of "destroying content"?).
3. The per-skill LLM-judge ruler is **worse** than lint: not even accurate, and **flatterable** — the
   prompt can learn to please the judge. Needs **held-out eval scenarios + adversarial/multi-judge** panels.
4. **Shadow-before-enforce** (ADR-0086 Brassboard) with a **pre-committed promotion trigger** set
   *before* gathering the corpus (e.g. "auto-keep only after N shadow runs with zero destructive /
   judge-gaming wins"). Don't let shadow become permanent open-loop.
5. **Knowledge-first / ADR-0068:** still no ADR, no harness on spec. Earn it.

## Recommended next session
**`/grill-with-docs` on the per-skill prompt-eval harness** — pick the one skill to start on (the
decision bead floats `/grill-with-docs` itself as the closest `val_bpb` analog), define the held-out
eval set + the immutable-as-possible scorer, design the anti-flattery defense, and pin the
pre-committed promotion trigger. Then `/gated-slice` for the shadow→operational gates.
Out of scope (still): `/deep-research` as a loop target (parked, run-economics); running the literal
GPU autoresearch repo.

## Supersedes (forward pointer)
This report updates the `next` field of `bead:20260607-1632-decision-loop-metric-two-step`: the lint
rig there is now **done**, not pending. The live next action is the per-skill-eval grill above.
