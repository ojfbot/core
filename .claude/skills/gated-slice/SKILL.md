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
- **Upstream boundary** (`adr:wayfinder-decision-maps`): this skill assumes the destination and route
  are already *decided*. If the open question is still *what/whether* — the initiative is wrapped in
  fog, decisions interdependent and unmade — chart it with `/wayfinder` first; hand back here when
  nothing is left to decide. Rule of thumb: *what/whether → wayfinder; how to ship safely in stages →
  gated-slice; once sliced → roadmap slices dispatched by day-run.* Wayfinder tickets are questions
  closed by answers; the slices this skill cuts are deliveries closed by merged PRs.

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

## Deliverable tracking (the spine this skill feeds)

A gated-slice effort is exactly the **scope-appropriate** case (TD-006 scope gate) that the
deliverable-tracking spine exists for. As slices and gates transition, emit them onto the append-only
ledger so the roadmap **canvas is a live projection**, not a stale hand-edited drawing:

- **On entering a slice / gate:** `node scripts/gate-event.mjs <program> <slice> <gate> entered`
- **During validation:** `/validate` and `/tdd` emit `validating` → `passed`/`failed` (see those skills).
- **On delivery:** `node scripts/gate-event.mjs <program> <slice> <gate> delivered --evidence=<pr>`

**Emit-not-magic:** there is no Claude Code tool event for a semantic gate pass — you emit it. The
canvas node id **must equal the slice id**; the projector owns each node's color + its
`<!--gate-status-->` block and nothing else (prose is yours). The reconciler hook (`reconcile-tracking.mjs`,
SHADOW) audits canvas==ledger + evidence-on-pass + validating-staleness; **auto-repair is OFF**. No
`passed`/`delivered` without resolvable evidence. See `adr:deliverable-tracking-spine`.

## Constraints

- **Plan only — no code.** This skill produces the decomposition; slices execute via `/plan-feature`,
  `/tdd`, `/orchestrate`.
- **Every action-taking control gets a shadow stage.** No straight-to-enforce. This is the rule.
- **Success Criteria are TPMs, not vibes.** A criterion with no measure + baseline + threshold is a
  Verification one-shot at best; otherwise make it quantitative.
- **Promotion is RIDM on data.** Name the TPMs and thresholds; don't promote on a hunch.
- **Use the SEH terms precisely**, and **flag the two harness extensions** (vertical slice, shadow
  mode) every time — they are not NASA terms.

## Gotchas

- **Every action-taking control gets a shadow stage — no exceptions, no "this one's obviously safe."** The instinct to skip Brassboard for a control that "clearly works" is the exact anti-pattern this skill exists to kill. A PreToolUse block, CI gate, or state mutation runs observe-only first, emitting its TPMs, before it's ever Operational. Straight-to-enforce is the failure.
- **A Success Criterion with no number is a smell, not a pass.** The trap is writing "improves quality" or "reduces errors" as exit criteria. Each must be a TPM: MOE (qualitative goal) → MOP (quantitative measure) → TPM (measure vs baseline, with a breach threshold). If you can't number it, it's a one-shot Verification check at best — say so explicitly.
- **Promotion is RIDM on data, never on a hunch or a clean demo.** Shadow → Operational flips only when named TPMs clear named thresholds. "It looked good in shadow" is not a promotion criterion; state which metrics gate the decision and what breach does (stay shadow / roll back).
- **"Vertical slice" and "shadow mode" are harness extensions — flag them every time.** They are not NASA SEH terms (closest: life-cycle phase/WBS, and Brassboard+TRL). Silently using them as if they're canonical SEH erodes the vocabulary precision the whole skill trades on.
- **Don't reach for this on a one-PR feature.** Naming Control Gates, MOEs, and TPMs for a change with a clear test matrix is overhead theater — that's `/plan-feature`. This skill earns its weight only when the effort is too big for one PR *or* introduces an action-taking control.
- **Measure-first slice ordering is usually forced, not optional.** You cannot gate on TPMs you don't yet collect, so a slice that enforces before a slice that instruments is out of order. Order slices value-first, but respect that instrumentation is a prerequisite for any later gate.

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
