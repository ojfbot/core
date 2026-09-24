# ADR-XXXX: Judge primitive — typed questions over a state, answered with a calibrated verdict, behind swappable providers
slug: judge-primitive
serial: draft
rev:
Date: 2026-09-24
Status: Proposed
domain: meta
type: architecture
OKR: 2026-Q3 / O-legibility / KR-evaluation-layer
Commands affected: /adopt-stack (record), /gated-slice (pilot shape); later /validate, /pr-review consumers
Repos affected: core (this ADR, glossary, l2 roadmap S40); cv-builder (first consumer, S40); later daily-logger, morning-cockpit, shell, switchboard
gate: promotion of any Judge from shadow to deciding is a recorded RIDM decision on a sealed gold set (agreement, κ, ECE/Brier, false-verdict rate at τ) — never a default
baseline: five ad-hoc judge-shaped calls in the fleet, none sharing an interface, none reporting calibration; 0 sealed gold sets for routing decisions
traces:
  supersedes:
  amends:
  relates-to: [control-gated-slices, daily-cleaner-confidence-threshold-policy, pocock-lifecycle-absorption, progressive-autonomy-gates]
  parent:
  part-of-series:

---

## Context

The fleet makes cheap *decisions* with models in at least five places, each with its own shape and
none with a shared contract: the CLAUDE.md gate judge (`scripts/hooks/claude-md-gate/judge.mjs`,
Haiku → `{isConditional, suggestedLayer, confidence|null}`; confidence logged, never read), the
daily-logger cleaner (Opus → `{resolved, confidence: high|medium|low}`), the cockpit watch scorer
(qwen2.5:7b → three 0–1 scores with a deterministic floor), the f1-pit-wall router (rules → cheap
slot-fill → validator), and shell's frame-agent `classify()` (regex → 20-token Sonnet call). Each
re-invents "ask a typed question, get a verdict, decide whether to trust it".

A new model class ("System One": TypeSafe Jev and open clones SemIf/Kev) makes this shape explicit
at the API level — `choice`/`score`/`noul` questions over a state, probabilities in one forward
pass, no text — and cheap enough to run inside a graph edge. The `/adopt-stack` pass
(`decisions/adopt-stack/system-one-decision-model.md`, D60–D69) absorbed the *idea* and rejected
the hosted vendor (closed to new accounts) and the router/suggester use case. The fleet already
uses **judge** for exactly this concept at a higher cost tier: buddy-check ("judge ≠ generator;
judge untrusted until agreement ≥ 80%/dim"), f1-doctrine's blind judge, and the l2 roadmap's PH4
"one calibrated judge" (S20). Standing rulings constrain the design: ADR-0033 rejected float
confidence thresholds because LLM probabilities were uncalibrated; cockpit ADR-0003 forbids silent
cloud cascade; switchboard ADR-0001 admits cascade only as an opted-in, labeled route class;
f1-pit-wall measured that escalating rule-rejected queries produced 4 misroutes and 0 wins;
prompt-injected state demonstrably moves a decision model's verdict.

## Decision

Name one fleet primitive, the **Judge**: `judge({state, questions}) → {answers, confidence,
provider, model}` where each question is `noul` (yes/no probability), `choice` (labels →
probabilities + confidence) or `score` (ordered rubric → score + confidence), and every answer is a
**Verdict** that records which provider produced it. Providers are swappable (Haiku/Opus via the
existing Anthropic call, self-hosted Kev via the `/v1/systemone` wire shape, a deterministic
rule-set) and confined to one labeled adapter each. The primitive's contract:

1. **Untrusted until calibrated.** A Judge decides nothing until it has run in shadow (ADR-0086
   Brassboard) beside the incumbent and a deterministic floor on a sealed gold set committed before
   scoring, and its agreement, κ, ECE/Brier and false-verdict rate at the candidate threshold clear
   pre-registered bars. Promotion is a recorded RIDM decision.
2. **Rules first.** A deterministic floor runs before the model; the Judge only ranks what the floor
   cannot settle, and never escalates what the floor rejected on purpose.
3. **Escalation is labeled, never silent.** Below threshold the verdict says `routed_by: <incumbent>`;
   degradation on provider failure is to the deterministic floor, never silently to a cloud model
   (ADR-0003, switchboard ADR-0001).
4. **State is user-authored.** Fetched content and tool outputs are stripped from `state`;
   consequential or destructive actions are never gated on a Judge verdict alone; option order and
   adversarial payloads are tested before promotion.
5. **Verdicts are logged.** Probabilities, confidence, provider and model land in the consumer's
   ledger (graph state, run report, jsonl) so calibration can be re-read later.

A numeric confidence threshold becomes admissible only where rule 1's evidence exists for that Judge;
that evidence, not this ADR, is what opens a revision of `adr:daily-cleaner-confidence-threshold-policy`.

## Consequences

### Gains
- One vocabulary (Judge / Verdict / judge provider) across harness and apps; the buddy-check trust
  rule becomes a fleet contract instead of one repo's README.
- Cheap decisions become measurable: every pilot produces a calibration read on fleet data instead of
  trusting vendor benchmarks whose independent spread is 26 pp → 0.6 pp.
- The vendor is replaceable at the adapter (Kev today; Jev if it reopens; Haiku always), so the
  primitive survives the ecosystem's churn (SDK 0.x, nine days old at adoption).

### Costs
- Sealed gold sets and an eval script per consumer are real work before any model can decide.
- Shadow runs cost the incumbent *plus* the cheap arm until promotion.
- Local Kev is a Python server on the Mac (MLX); it does not run on the Pi and adds an out-of-process
  dependency, mitigated by rule 3's deterministic degrade.

### Neutral
- "Judge" now carries two cost tiers under one word; `CONTEXT.md` records the reconciliation.
- The claude-md-gate judge is a *consumer* of this primitive, not its zero-point: its reusable seam is
  the injected `complete(system, user)` provider boundary, not its verdict shape.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Import the vendor SDK directly in each consumer | Vendor names leak into domain code; five call sites keep five contracts; a closed vendor account strands every consumer at once. |
| Adopt hosted Jev with a Claude fallback (the external report's shape) | Jev is closed to new accounts; the fallback is the silent cascade ADR-0003 and switchboard ADR-0001 forbid; ADR-0033's calibration objection is unanswered without measurement. |
| Use it first for skill suggestion / slash-command routing (vendor's headline demo) | Router skill rejected (D15); S15 semantic suggester gated last on logged lexical misses; ADR-0068 shows follow-through, not matching, is the bottleneck. |
| Keep judging inside generation calls (status quo) | Confidence is emitted but never read; no calibration, no shared floor, no injection rule; each new consumer re-derives the pattern. |
| Name it "classifier" or "decider" | "Classifier"/"router" carry the rejected-skill history; "judge" is already the fleet's word for a calibrated model verdict (buddy-check, f1-doctrine, l2 PH4). |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | `/adopt-stack` record D60–D69 (2026-09-24); external input: Dia report "System One Inside Your LangGraph Harness" |
| Implementation start | `rm:rm-l2-ojfbot#S40` (shadow pilot on cv-builder route; entrance `rm:rm-l1-cv-builder#S1`) |
| Implementation end | _pending_ — accept this ADR when S40's verdict (2026-10-22) is recorded |
