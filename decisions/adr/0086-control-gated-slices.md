# ADR-0086: Control-Gated Slices — how we decompose and ship large agentic-harness work

Date: 2026-06-04
Status: Accepted
OKR: 2026-Q2 / O-skills / KR-coverage
Commands affected: new `/gated-slice` skill; complements `/plan-feature`, `/orchestrate`, `/claude-md-rollout`
Repos affected: core (source); the pattern applies fleet-wide

---

## Context

Large efforts in this harness — a new enforcement gate, a fleet-wide config rollout, a
multi-phase pipeline — repeatedly fail in the same two ways when run as one big push:

1. **No observable value until the end.** A horizontal "build all of layer X, then all of
   layer Y" plan ships nothing demonstrable until the last layer lands, so we can't course-correct.
2. **Enforcement controls flipped on by a hunch.** A new automated gate (a PreToolUse block, a
   CI check) goes from "doesn't exist" to "blocks your edit" with no evidence it won't fire on
   the wrong thing. The first time we learn the false-positive rate is in production.

We already work around both, but the practice was tribal — encoded in handoffs and one ADR's
checkpoint list, not named or reusable. ADR-0081 (CLAUDE.md loading-discipline) is the clearest
worked example: it was decomposed into independently-shippable slices (measure+audit, rollout,
enforcement-gate), and the enforcement gate is explicitly staged to run **observe-only first**,
promoted to actually-blocking only when measured precision clears a threshold. That is a repeatable
shape, and it maps almost one-to-one onto NASA's Systems Engineering Handbook (SEH) life-cycle
vocabulary — which the fleet already curates in `seh-study`
(`packages/shared/src/glossary.json`). Naming the pattern in SEH terms lets us reuse a mature,
precise vocabulary instead of inventing ad-hoc words, and flags exactly the two places our
agentic-harness practice *extends* SE rather than restates it.

## Decision

Adopt **Control-Gated Slices** as the standing pattern for decomposing and delivering large
agentic-harness work, grounded in NASA SEH nomenclature, with two explicit harness extensions.
The pattern, and its SEH↔harness term mapping:

1. **Decompose into vertical slices.** Break the effort into independently-shippable **vertical
   slices**, each traversing all relevant layers and shipping observable value. *"Vertical slice"
   is a **harness extension**, not a NASA term* — its closest SEH analogs are a life-cycle phase /
   Product Baseline / WBS element, but those are horizontal program structures, not the
   end-to-end-thin-and-demonstrable unit we mean. We keep our word and note the gap.

2. **Deliver each slice through ordered Control Gates.** Each checkpoint is a **Control Gate**
   (a.k.a. **Key Decision Point / KDP**): a defined point in the life cycle where the decision
   authority evaluates progress and determines next actions. Every gate has explicit **Entrance
   Criteria** (the minimum accomplishments needed to *start* it) and **Success Criteria** (the
   specific accomplishments that must be *demonstrated to pass* it). NASA renamed "exit criteria" to
   **Success Criteria**; we use the current term.

3. **Express Success Criteria as a tracked metric hierarchy.** Each Success Criterion is a
   **quantitative metric tracked over time**, structured as **MOE → MOP → TPM**:
   a **Measure of Effectiveness (MOE)** is the qualitative stakeholder goal; a **Measure of
   Performance (MOP)** is a quantitative measure that, when met, helps ensure the MOE; a **Technical
   Performance Measure (TPM)** is a MOP tracked against a baseline/anticipated value, where a
   deviation outside the expected range triggers evaluation and corrective action. **"Metrics" in
   our harness ARE TPMs serving MOEs** — that is the whole point of tracking them.

4. **Mature any enforcement control through a Brassboard / "shadow" stage first.** A new
   automation that *takes action* (blocks an edit, fails CI, mutates state) must first run in an
   **observe-only / simulated mode** that emits TPM data but takes **no real action**, BEFORE it is
   promoted to **Operational** (actually enforcing). The closest SEH analog is the **Brassboard**
   ("a medium-fidelity functional unit … structured to operate in simulated operational environments
   to assess critical functions") on the **TRL** maturity ladder. *NASA has **no exact "shadow
   mode" term** — this is the second **harness extension**.* We name it explicitly and anchor it to
   Brassboard + TRL.

5. **Promote past a gate by data-gated RIDM.** Promotion across a Control Gate — especially
   shadow → operational — is a **Risk-Informed Decision Making (RIDM)** decision **gated on measured
   TPMs clearing their thresholds**, not on a hunch. You flip the control to operational only when
   the shadow-stage TPMs (e.g. false-block rate, override rate) are inside their thresholds.

6. **Distinguish Verification from Validation at the gates.** Use NASA's verbatim definitions.
   **Verification** answers *"Did I build the product right?"* (proof of compliance with
   specification). **Validation** answers *"Am I building the right product?"* (proof the product
   accomplishes the intended purpose per stakeholder expectations). A gate's Success Criteria should
   say which it is checking; an enforcement gate that passes its spec (verified) can still be the
   wrong gate (not validated) — the shadow stage exists partly to surface that.

The pattern ships as an invokable skill, **`/gated-slice`** (`.claude/skills/gated-slice/`), which
takes a large task and produces a slice breakdown, then per-slice ordered Control Gates each with
Entrance + Success Criteria expressed as TPMs, explicitly marking any enforcement control as needing
a Brassboard/shadow stage before operational, and naming the RIDM promotion decision. The
SEH↔harness vocabulary is captured in `domain-knowledge/GLOSSARY.md` (each term tagged NASA-SEH or
harness-extension) and the skill's `knowledge/` file.

### Slash-command name

`/gated-slice` chosen over `/control-gated-slices` (too long, hyphen-heavy), `/slice` (collides with
the generic "vertical slice" noun and reads as a verb on a file), and `/gate` (too narrow — the gate
is one part; the pattern is *slices delivered through gates*). `/gated-slice` reads as a noun phrase,
is short enough to type, and foregrounds the load-bearing idea (gates control slice promotion).

### Worked exemplar — ADR-0081

ADR-0081 (CLAUDE.md loading-discipline) is the canonical worked example and the skill cites it:

- **Slices:** Slice 1 = measure + audit (merged); Slice 3 = rollout (merged); Slice 2 = the
  enforcement gate (in progress) — each independently shippable.
- **Slice 2 Control Gates C0→C7:** C0 criteria spec · C1 deterministic tripwire · C2 Haiku judge ·
  C3 TPM/event log · **C4 shadow mode (Brassboard, observe-only)** · C5 clearance + block→ask
  mechanics · C6 flip-to-enforce (RIDM-gated) · C7 generalization review.
- **TPMs:** M1 always-loaded footprint · M2 Layer-1 conditionality · M3 gate precision / override
  rate (>30% override = overfit) · M4 over-decomposition · M5 judge false-block rate.
- **The data-gated promotion:** **M3 and M5 are the TPMs that gate the C4→C6 (shadow→operational)
  promotion.** The gate stays in Brassboard/shadow (emitting M3/M5) until both clear threshold; the
  C6 flip-to-enforce is the RIDM decision made on that data — exactly the pattern this ADR names.
  The handoff records the scale-up to ADR-0083-style general hooks-as-enforcement as itself
  "data-gated on M3/M5 staying low after ~4 weeks" — RIDM again, one level up.

## Consequences

### Gains

- **A shared, precise vocabulary** for plans, ADRs, and standups: "this slice's C4 is in Brassboard;
  promotion to C6 is RIDM-gated on M5 < threshold" is unambiguous and reusable.
- **Enforcement controls can't be flipped on a hunch** — the shadow stage and TPM thresholds are now
  the documented default path, with a worked precedent.
- **Each slice ships observable value**, so large efforts stay demonstrable and course-correctable.
- **Reuses mature SE thinking** instead of reinventing it, while honestly flagging the two places we
  extend it.

### Costs

- **More upfront structure** per large effort: naming gates, writing Entrance/Success Criteria, and
  defining TPMs costs planning time. Trivial work should skip it (the skill says so).
- **TPM instrumentation is real work** — a shadow stage that emits no data is theater; the control
  must actually log TPMs for the RIDM gate to mean anything.
- **Vocabulary onboarding:** the SEH terms (MOE/MOP/TPM, RIDM, Brassboard) are unfamiliar; the
  GLOSSARY and skill knowledge file carry that load.

### Neutral

- The pattern overlaps `/plan-feature` (acceptance criteria) and `/orchestrate` (decomposition) but
  operates at a different altitude — multi-slice initiatives with enforcement controls, not a single
  feature's test matrix. `/gated-slice` cross-references both rather than replacing them.
- Two terms (`vertical slice`, `shadow mode`) are tagged as harness extensions in the GLOSSARY, a
  permanent annotation we maintain.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Leave the pattern tribal (handoffs + ADR-0081's checkpoint list only) | The practice was already in use but unnamed and non-reusable; new initiatives re-derived it ad hoc and some skipped the shadow stage entirely. |
| Invent harness-native names for every concept | Throws away NASA SEH's mature, precise vocabulary that `seh-study` already curates; we'd re-litigate definitions. We reuse SEH and flag only the genuine extensions. |
| Keep "exit criteria" / generic "metrics" wording | Imprecise. "Success Criteria" is NASA's current term; "metric" hides the MOE→MOP→TPM hierarchy that makes a metric *gating* rather than decorative. |
| Fold the pattern into `/plan-feature` | Wrong altitude — `/plan-feature` is single-feature spec→test-matrix; this is multi-slice initiative decomposition with enforcement staging. Composition, not absorption. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | ADR-0081 loading-discipline initiative (slices 1+3 merged, slice 2 in progress) as the worked exemplar |
| SEH source | `seh-study` `packages/shared/src/glossary.json` (NASA SEH nomenclature) |
| Harness extensions | "vertical slice" (closest SEH: life-cycle phase / Product Baseline / WBS); "shadow mode" (closest SEH: Brassboard + TRL) |
| Implementation start | this PR (ADR + `/gated-slice` skill + GLOSSARY terms + catalog entry) |
| Implementation end | _pending review_ |
