# SEH ↔ harness mapping for Control-Gated Slices

Reference for `/gated-slice` (ADR-0086). Source of the NASA definitions: `seh-study`
`packages/shared/src/glossary.json` (NASA Systems Engineering Handbook nomenclature). Definitions
below are quoted/condensed from that source; the **harness extension** rows are ours and are flagged
as such.

## Term mapping

### Control Gate / Key Decision Point (KDP) — NASA SEH
> A defined point in the program/project life cycle where the decision authority can evaluate
> progress and determine next actions. These may include a key decision point, life cycle review, or
> other milestones.

In the harness: a checkpoint in a slice with an entry and an exit. We number them C0…Cn per slice.

### Entrance Criteria — NASA SEH
> Guidance for minimum accomplishments each project needs to fulfill prior to a life cycle review.

The minimum to *start* a gate.

### Success Criteria — NASA SEH (formerly "exit criteria")
> Specific accomplishments that need to be satisfactorily demonstrated to meet the objectives of a
> technical review so that a technical effort can progress further in the life cycle. … Formerly
> referred to as "exit" criteria.

What must be *demonstrated to pass* a gate. **In Control-Gated Slices these are expressed as TPMs.**

### Measure of Effectiveness (MOE) — NASA SEH
> A measure by which a stakeholder's expectations are judged… typically qualitative in nature or not
> able to be used directly as a design-to requirement.

The qualitative goal. Example (ADR-0081): "the gate blocks the right edits and doesn't annoy."

### Measure of Performance (MOP) — NASA SEH
> A quantitative measure that, when met by the design solution, helps ensure that a MOE… will be
> satisfied. There are generally two or more measures of performance for each MOE.

The quantitative measure under a MOE.

### Technical Performance Measure (TPM) — NASA SEH
> A set of performance measures monitored by comparing the current actual achievement of the
> parameters with that anticipated… Assessed parameter values that fall outside an expected range
> around the anticipated values indicate a need for evaluation and corrective action. TPMs are
> typically selected from the defined set of MOPs.

A MOP tracked against a baseline with a threshold whose breach triggers corrective action.
**The harness's "metrics" ARE TPMs serving MOEs** — that's why M1–M5 in ADR-0081 are TPMs, not decoration.

### Brassboard — NASA SEH (the anchor for "shadow mode")
> A medium-fidelity functional unit that uses as much operational hardware/software as possible…
> structured to operate in simulated operational environments to assess critical functions.

Plus the **TRL** ladder (1–9): TRL 6 ≈ "demonstrated in a relevant environment."

**Harness extension — "shadow mode":** an enforcement control running observe-only / simulated,
emitting its TPMs but taking **no real action**, before promotion to Operational. NASA has **no exact
"shadow mode" term**; Brassboard + TRL is the closest analog. Always flag this as an extension.

### RIDM (Risk-Informed Decision Making) — NASA SEH
> RIDM informs systems engineering decisions through better use of risk and uncertainty information in
> selecting alternatives and establishing baseline requirements.

A promotion across a gate (especially shadow → operational) is a **data-gated RIDM decision**: you
promote when the measured TPMs clear thresholds, not on a hunch.

### Verification vs Validation — NASA SEH (verbatim)
- **Verification (of a product):** "Proof of compliance with specifications… (Answers the question,
  'Did I build the product right?')"
- **Validation (of a product):** "The process of showing proof that the product accomplishes the
  intended purpose based on stakeholder expectations and the Concept of Operations… (Answers the
  question, 'Am I building the right product?')"

A gate should say which it checks. An enforcement control can be **verified** (meets spec) yet not
**validated** (wrong control) — the shadow stage exists partly to catch that before it enforces.

### Vertical Slice — HARNESS EXTENSION
Closest SEH analogs: a life-cycle **phase**, a **Product Baseline**, or a **WBS** element — but those
are horizontal program structures. Our "vertical slice" is a thin end-to-end **independently
shippable** unit that traverses all relevant layers and ships observable value. Not a NASA term; flag it.

## The two harness extensions (say these every time)

1. **Vertical slice** — not a NASA term (closest: life-cycle phase / Product Baseline / WBS).
2. **Shadow mode** — not a NASA term (closest: Brassboard on the TRL ladder).

Everything else in the pattern is genuine NASA SEH vocabulary.

## Worked exemplar — ADR-0081 (CLAUDE.md loading-discipline)

The initiative that the pattern is abstracted from. See
`.handoff/adr-0081-loading-discipline-handoff.md` and `CLAUDE-MD-ROLLOUT.md` for full detail.

**Vertical slices (value-first ordering):**
- **Slice 1 — measure + audit (merged).** `footprint.mjs` (deterministic measurement of always-loaded
  vs conditional tokens) + `/claude-md-audit` (LLM routing judgment). Ships value alone: you can
  measure and propose routings before any enforcement exists. Measure-first is deliberate — you can't
  gate on TPMs you don't collect.
- **Slice 3 — rollout (merged).** `CLAUDE-MD-ROLLOUT.md` tracker + `/claude-md-rollout --step` +
  `/schedule` cron + `/frame-standup` line. Paced, opt-in, PR-gated; one repo per cycle.
- **Slice 2 — the enforcement gate (in progress).** The PreToolUse gate on `**/CLAUDE.md` edits. This
  is the slice that *takes action*, so it carries the Brassboard/shadow stage.

**Slice 2 Control Gates (C0→C7):**
| Gate | What |
|------|------|
| C0 | criteria spec |
| C1 | deterministic tripwire (cheap pre-filter) |
| C2 | Haiku judge (scoped) |
| C3 | TPM / event log |
| **C4** | **shadow mode — Brassboard, observe-only: judges the edit, logs M3/M5, takes NO action** |
| C5 | clearance marker + block→ask mechanics (routed into `/grill-with-docs`) |
| **C6** | **flip-to-enforce — RIDM-gated promotion to Operational** |
| C7 | generalization review (scale-up to ADR-0083 general hooks-as-enforcement) |

**TPMs:**
| TPM | Measures | Serves (MOE) |
|-----|----------|--------------|
| M1 | always-loaded footprint (descriptive baseline, not a target) | context budget not wasted |
| M2 | Layer-1 conditionality | conditional content actually left the always-loaded layer |
| M3 | gate precision / override rate (**>30% override = overfit**) | gate blocks the *right* edits |
| M4 | over-decomposition | didn't shred coherent rule sets |
| M5 | judge false-block rate | the Haiku judge is reliable enough to trust |

**The data-gated promotion (the heart of the pattern):**
**M3 and M5 are the TPMs that gate the C4 → C6 (shadow → operational) promotion.** The gate sits at
C4 in Brassboard/shadow, emitting M3 and M5 on real edits while taking no action. C6 — flip-to-enforce
— is the **RIDM decision**: promote to Operational only once M3 (override rate) and M5 (false-block
rate) are inside threshold. On breach, you stay in shadow and fix the judge / criteria; you do not
enforce. The handoff records the *next* level of RIDM too: scaling the gate pattern up to ADR-0083
general hooks-as-enforcement is "data-gated on M3/M5 staying low after ~4 weeks."

**V&V at the gates:** C0–C3 are mostly **Verification** (the tripwire/judge/log meet spec). C4's
shadow stage is where **Validation** happens — does the gate block the *right* things per the criteria
spec (stakeholder intent), measured by M3/M5 — before C6 makes it operational.
