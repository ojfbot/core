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
> **Load `knowledge/wayfinder-boundary.md`** before accepting the effort when the destination or route may still be undecided — the wayfinder-vs-gated-slice boundary rule.

## Vocabulary (SEH ↔ harness — say these precisely)

> **Load `knowledge/seh-vocabulary.md`** before writing any gate, criterion, or TPM — the full SEH ↔ harness term table (Control Gate/KDP, Entrance/Success Criteria, MOE → MOP → TPM, Brassboard/shadow, RIDM, Verification vs Validation, Vertical Slice) and which terms are harness extensions.

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

> **Load `knowledge/output-format.md`** before emitting the plan (Step 6) — the exact output template: slice ladder, per-slice gate tables, shadow/RIDM lines, and the harness-extension flags.

## Worked exemplar — ADR-0081 (CLAUDE.md loading-discipline)

> **Load `knowledge/adr-0081-exemplar.md`** before laying out gates if you need a calibration example — the canonical ADR-0081 walk-through (slices, C0→C7 gates, TPMs M1–M5, the C4→C6 RIDM promotion).

## Deliverable tracking (the spine this skill feeds)

> **Load `knowledge/deliverable-tracking.md`** before emitting the plan and whenever a slice or gate transitions — the `gate-event.mjs` emission commands, the canvas/ledger rules (emit-not-magic, node id = slice id), and the no-evidence-no-pass rule.

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
