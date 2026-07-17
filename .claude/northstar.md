---
type: northstar
slug: l1-core
tier: L1
app: core
ladders_up_to: l2-ojfbot
status: active
# Bootstrapped 2026-07-17 (rm:rm-l1-core#S1) from the skill-loop RCA + SOTA pass
# (decisions/research/2026-07-17-skill-loop-sota.md). current values reflect measured
# existing state, not zero: ADR-0093 SUGGESTION_ID identity + the SKILL.md-Read
# corroboration path exist and work; the ruler is blind on three sides, not absent.
properties:
  - id: P1
    name: "The skill follow-rate metric is honest"
    target: "Every suggestion reaches exactly one terminal disposition via path-independent capture (inline SKILL.md Read, Skill-tool invocation, script exec); both populations (installed + uninstalled) are scored; followed/acted auto-emitted in shadow; capture >= 70% and false-emit <= 10% vs a labeled gold set (ADR-0095 bars); no rate published before capture-quality is green."
    current: 38
    verification: "scripts/opav-capture-quality.mjs green vs the decisions/opav gold set; replay shows the >=13 known Skill-tool follows flip from ignored; disposition rows carry a population field."
    ladders_up_to: "ns:l2-ojfbot#P2"
    okr_drivers: []
  - id: P2
    name: "Suggestions are relevant"
    target: "suggest-skills.mjs scores >= 80% precision on a fixed 20-30-case gold eval (incl. no-match cases, chance-corrected); no skill fires > 10x with 0 honest follows in a 30-day window; repo-irrelevant skills are filtered fail-open."
    current: 10
    verification: "scripts/suggester-eval.mjs reports precision/recall vs decisions/opav/suggester-gold-v1.jsonl; the trigger-precision report shows no over-firing tail."
    ladders_up_to: "ns:l2-ojfbot#P2"
    okr_drivers: []
  - id: P3
    name: "Skills are eagerly invoked in real sessions"
    target: "The honest session-level invocation rate (baseline 22/228 sessions, 2026-06-18..07-16) measurably rises after description/trigger/activation interventions, each measured only by the P1-honest metric against the frozen P2 eval."
    current: 10
    verification: "skill-metrics session-invocation mode over tool-telemetry Skill events; before/after windows cited in status.jsonl movement lines."
    ladders_up_to: "ns:l2-ojfbot#P2"
    okr_drivers: []
---

# Northstar — core (L1)

**Vision.** Core's product surface is the skill loop itself: suggestions that are relevant, skills
that get eagerly invoked, and a follow-rate metric that tells the truth. The 2026-07-16 RCA proved
the current "0 followed / 0 acted" reading is a measurement artifact (the predicate cannot see
Skill-tool invocations; the denominator excludes installed-skill suggestions; the acted ledger was
never written). This northstar closes the loop in doctrine order — fix the immutable ruler (P1),
freeze the eval (P2), then iterate the program: triggers, descriptions, activation (P3).

## P1 — The skill follow-rate metric is honest

Ladders to `ns:l2-ojfbot#P2` (work is legible / self-measuring). Karpathy-loop discipline: never
iterate the program against a broken evaluator. Capture must be path-independent and two-source
(ADR-0095); rates are unpublishable until capture-quality is green against a labeled gold set.

## P2 — Suggestions are relevant

Also ladders to `ns:l2-ojfbot#P2`. The suggester (word-overlap over catalog triggers, `--limit=1`)
gets a frozen gold eval with no-match cases and a chance-corrected headline metric before any
tuning. Embeddings come last, if ever — the field converged on lexical, model-in-the-loop discovery
at this catalog size (see the 2026-07-17 SOTA pass).

## P3 — Skills are eagerly invoked in real sessions

Also ladders to `ns:l2-ojfbot#P2`. Interventions (pushy descriptions, trigger pruning, forced-eval
activation, router-skill patterns) are data-gated on P1+P2: every change is measured against the
frozen eval and the honest live funnel, shadow-first with pre-committed promotion criteria.
