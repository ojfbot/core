---
name: gated-slice
description: >
  Decompose a large agentic-harness effort into Control-Gated Slices (ADR-0086): independently
  shippable vertical slices, each delivered through ordered Control Gates with explicit Entrance +
  Success Criteria expressed as TPMs (MOE → MOP → TPM), with any enforcement/automation control
  required to mature through a Brassboard/shadow (observe-only) stage before going Operational, and
  promotion past each gate named as a data-gated RIDM decision. Use when the user says "gated-slice",
  "plan a big effort", "decompose this initiative", "how do I roll out this gate/enforcement",
  "shadow mode then enforce", "control gates", "slice this up", or when a task is too large for one
  PR and/or introduces an automated control that takes action. Output is a plan, not code: a slice
  breakdown + per-slice gates + TPMs + shadow-stage + RIDM promotion points. Distinct from
  /plan-feature (single-feature spec→test-matrix) and /orchestrate (agent-pipeline execution).
---

You are decomposing a large effort into **Control-Gated Slices**, per ADR-0086. The goal is a plan
that (a) ships observable value early via vertical slices, and (b) never flips an enforcement control
on by a hunch — every control that *takes action* matures through an observe-only shadow stage and is
promoted only on measured data.

**Tier:** 2 — Multi-step procedure
**Phase:** Planning (large-initiative decomposition; complements `/plan-feature`, `/orchestrate`)
**Output:** a plan only — no code edits. (Hand individual slices to `/plan-feature` → `/tdd` etc.)

## When to use vs skip

- **Use** when the effort is too large for one reviewable PR, *or* introduces a new automated control
  that takes action (a PreToolUse block, a CI gate, a state mutation). The shadow-stage discipline is
  the load-bearing reason to reach for this skill.
- **Skip** for a single feature with a clear test matrix (`/plan-feature`), or trivial work. Naming
  gates and TPMs for a one-PR change is overhead theater.

## Vocabulary (SEH ↔ harness — say these precisely)

| Concept | Term to use | Source | Note |
|---|---|---|---|
| Checkpoint with entry + exit | **Control Gate** / **Key Decision Point (KDP)** | NASA SEH | — |
| Minimum to *start* a gate | **Entrance Criteria** | NASA SEH | — |
| What must be *demonstrated to pass* | **Success Criteria** | NASA SEH | formerly "exit criteria" — use the current term |
| Qualitative stakeholder goal | **Measure of Effectiveness (MOE)** | NASA SEH | not a design-to number |
| Quantitative measure ensuring the MOE | **Measure of Performance (MOP)** | NASA SEH | 2+ per MOE typical |
| MOP tracked vs a baseline; deviation → corrective action | **Technical Performance Measure (TPM)** | NASA SEH | **our "metrics" ARE TPMs serving MOEs** |
| Observe-only / simulated stage before enforcing | **Brassboard / shadow stage** | Brassboard + TRL (SEH); **"shadow mode" is a harness extension** | runs, emits TPMs, takes NO action |
| Actually enforcing | **Operational** | — | promoted-to state |
| Data-gated promotion decision | **RIDM** (Risk-Informed Decision Making) | NASA SEH | promote on TPM thresholds, not a hunch |
| "Did I build it right?" (meets spec) | **Verification** | NASA SEH | proof of compliance with specification |
| "Am I building the right thing?" (meets intent) | **Validation** | NASA SEH | proof it accomplishes the intended purpose |
| Thin end-to-end shippable unit | **Vertical Slice** | **harness extension** (closest SEH: life-cycle phase / Product Baseline / WBS) | flag the gap |

The full definitions are in `domain-knowledge/GLOSSARY.md` and `knowledge/seh-mapping.md`.

## Steps

### 1. Restate + size
Restate the effort in one sentence. State whether it warrants this skill (too big for one PR, or
introduces an action-taking control) or should go to `/plan-feature` instead. If unsure, grill:
surface 1–2 assumptions and ask the highest-leverage question before decomposing.

### 2. Decompose into vertical slices
Break the effort into **independently-shippable vertical slices**. Each slice must:
- traverse all relevant layers (measure → decide → enforce → roll out, or UI → API → state → storage);
- ship observable value on its own;
- be independently reviewable and demonstrable.
Order them so the earliest slice ships value soonest (measure-first is usually right — you can't gate
on TPMs you don't yet collect). Flag that "vertical slice" is a harness extension, not a NASA term.

### 3. For each slice, lay out ordered Control Gates
List the slice's checkpoints as ordered **Control Gates / KDPs** (e.g. C0…Cn). For **each gate**:
- **Entrance Criteria** — the minimum accomplishments needed to start it.
- **Success Criteria** — what must be **demonstrated to pass**, *expressed as TPMs*: name the MOE
  (qualitative goal) → the MOP (quantitative measure) → the TPM (the measure tracked vs a baseline,
  with a threshold whose breach triggers corrective action). A Success Criterion with no number is a
  smell — make it a TPM or justify why it's a one-time Verification check.
- mark whether the gate is checking **Verification** (meets spec) or **Validation** (meets intent).

### 4. Identify enforcement controls → require a Brassboard/shadow stage
For any control in the plan that **takes action** (blocks, fails, mutates), insert an explicit
**Brassboard / shadow stage** *before* the Operational gate: the control runs observe-only / simulated,
emitting its TPMs (false-positive/false-block rate, override rate, …) but taking **no real action**.
A control that goes straight to enforcing without a shadow stage is the anti-pattern this skill exists
to prevent. Name "shadow mode" as a harness extension anchored to Brassboard + TRL.

### 5. Name the RIDM promotion decisions
For each shadow → operational promotion (and any other high-blast-radius gate), name it as a
**data-gated RIDM decision**: state *which TPMs* gate it and *what thresholds* must clear. Promotion
happens on the data, not a hunch. Make the corrective-action path explicit (if the TPM breaches, you
stay in shadow / roll back, you don't enforce).

### 6. Emit the plan
Output the slice ladder, then per-slice gate tables, then the explicit shadow→operational RIDM points
and their gating TPMs. End with the suggested next step (hand slice 1 to `/plan-feature`).

## Output format

```
## /gated-slice — <effort>

Restatement: <one sentence>   ·   Warrants Control-Gated Slices: <yes/no + why>

### Slices (vertical, ordered by value-first)
| # | Slice | Layers traversed | Observable value shipped |
|---|-------|------------------|--------------------------|
| 1 | ...   | ...              | ...                      |

### Slice <N>: <name> — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0   | ...               | MOE: ... → MOP: ... → TPM: <metric> vs <baseline>, pass if <threshold> | Verif/Valid |

Enforcement control(s): <name> — **requires Brassboard/shadow stage at <gate>** (observe-only, emits <TPMs>, no action).
RIDM promotion: shadow → operational at <gate> is gated on <TPMs> clearing <thresholds>; on breach → stay shadow / roll back.

Harness extensions flagged: vertical slice (≈ life-cycle phase/WBS); shadow mode (≈ Brassboard + TRL).
Next: hand Slice 1 to /plan-feature → /tdd; revisit gates as TPM data arrives.
```

## Worked exemplar — ADR-0081 (CLAUDE.md loading-discipline)

The canonical example (see `knowledge/seh-mapping.md` for the full walk-through):

- **Slices:** S1 measure + audit (merged) · S3 rollout (merged) · S2 enforcement gate (in progress).
- **S2 Control Gates C0→C7:** C0 criteria spec · C1 deterministic tripwire · C2 Haiku judge ·
  C3 TPM/event log · **C4 shadow mode (Brassboard, observe-only)** · C5 clearance + block→ask ·
  C6 flip-to-enforce (RIDM-gated) · C7 generalization review.
- **TPMs:** M1 always-loaded footprint · M2 Layer-1 conditionality · M3 gate precision / override rate
  (>30% override = overfit) · M4 over-decomposition · M5 judge false-block rate.
- **Data-gated promotion:** **M3 + M5 gate the C4→C6 (shadow→operational) RIDM decision** — the gate
  stays in Brassboard emitting M3/M5 until both clear threshold; C6 is the flip made on that data.

## Constraints

- **Plan only — no code.** This skill produces the decomposition; slices execute via `/plan-feature`,
  `/tdd`, `/orchestrate`.
- **Every action-taking control gets a shadow stage.** No straight-to-enforce. This is the rule.
- **Success Criteria are TPMs, not vibes.** A criterion with no measure + baseline + threshold is a
  Verification one-shot at best; otherwise make it quantitative.
- **Promotion is RIDM on data.** Name the TPMs and thresholds; don't promote on a hunch.
- **Use the SEH terms precisely**, and **flag the two harness extensions** (vertical slice, shadow
  mode) every time — they are not NASA terms.

## Composition

- Upstream of `/plan-feature` (one slice → its spec/test-matrix) and `/orchestrate` (executing a slice
  via the agent pipeline). Downstream of `/grill-with-docs` when the effort's intent is still fuzzy.
- The TPMs a slice defines feed the same telemetry pattern as `/skill-metrics`.

## See Also
- ADR-0086 (`decisions/adr/0086-control-gated-slices.md`) — the governing decision
- `knowledge/seh-mapping.md` — SEH↔harness term mapping + the full ADR-0081 walk-through
- ADR-0081 worked exemplar; `.handoff/adr-0081-loading-discipline-handoff.md`
- `seh-study` `packages/shared/src/glossary.json` — the NASA SEH nomenclature source
- `/plan-feature`, `/orchestrate`, `/grill-with-docs`
