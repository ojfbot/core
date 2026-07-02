# ADR: Progressive autonomy gates — branch+PR today, data-gated promotion toward auto-merge
slug: progressive-autonomy-gates
serial: draft
rev:
Date: 2026-07-02
Status: Proposed
domain: gas-town
type: convention
OKR: 2026-Q3 / O-legibility / KR-delivery-pipeline
Commands affected: /day-run (enforces gate-0 behavior), /frame-standup (surfaces gate telemetry once collected)
Repos affected: core (roadmap-schema.md `autonomy:` field, bead label `autonomy_gate`, day-runner); every repo that receives runner PRs
gate: promotion to gate-1 is a recorded RIDM decision on accumulated shadow telemetry — never a default
baseline: 0 slices delivered; no gate-verdict telemetry exists yet
traces:
  supersedes:
  amends:
  relates-to: [roadmap-under-northstar, dispatch-queue-and-day-runner, control-gated-slices, lint-shadow-to-gate]
  parent:
  part-of-series:

---

## Context

The desired end state is a day of agentic work landing with minimal supervision — but the stack's
evals and gates today cannot justify letting a model merge its own work. The user decision
(2026-07-02 grill): start at branch+PR with a human merging everything, and aim at auto-merge via
a ladder of deliverable gates that tighten progressively — low-hanging fruit first, promotion only
on evidence. This is the ADR-0086 control-gated-slices shadow→operational discipline applied to
the delivery pipeline's own autonomy.

## Decision

Every roadmap slice declares a merge gate, `autonomy: gate-0 | gate-1 | gate-2`, compiled into the
dispatch bead as `autonomy_gate` (distinct from the queue's `autonomy` claim-eligibility label).

- **Gate 0 — operative now.** Sessions stop at branch + PR + evidence + movement proposal. A human
  merges; movement is recorded at merge (`record-movement.mjs`, which refuses unmerged PRs).
  While at gate-0, the merge ritual accumulates **shadow telemetry**: for each delivered slice,
  whether its declared `success:` gate, checked mechanically where possible (CI green, tests
  named in the gate), agrees with the human's merge/reject decision.
- **Gate 1 — data-gated promotion.** Auto-merge for declared low-risk slice classes
  (docs/telemetry/read-model surfaces) once shadow data shows gate-verdict ↔ human-decision
  agreement over a run of consecutive slices (threshold recorded at promotion time; it is a
  calibratable parameter, not a magic number). Promotion is a **recorded RIDM decision** — an ADR
  revision citing the telemetry — never a silent default. Sandboxed session execution is a
  candidate co-requirement.
- **Gate 2 — aspirational, explicitly out of scope** until gate-1 has data: code-slice auto-merge
  on eval-gated quality (LLM-judge rubric + calibration, the TeamBot eval-harness pattern).
  Named now only so slices can declare intent; the runner treats gate-2 exactly like gate-0
  until promoted.
- **Demotion is always available.** Any gate-1 class that produces a bad merge reverts to gate-0
  by the same recorded-decision mechanism.

## Consequences

### Gains
- "Relatively unsupervised" gets a precise, tightening meaning; the trust boundary is declared
  per-slice in the plan, not improvised per-session at 11pm.
- The promotion path manufactures its own evidence: every gate-0 merge is a labeled data point.

### Costs
- Until gate-1, the human merge queue is the throughput ceiling for a runner day. Accepted — it
  is also the calibration set.
- Gate telemetry capture adds a small step to the merge ritual (mitigated: record-movement is
  already in that ritual and can carry the verdict).

### Neutral
- Gate values live in the roadmap file, so re-tiering a slice is an ordinary reviewed edit.
