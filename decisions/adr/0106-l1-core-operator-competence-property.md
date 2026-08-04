# ADR-0106: l1-core earns an operator-competence property (P5), teach loop as instrument
slug: l1-core-operator-competence-property
serial: 0106
rev:
Date: 2026-08-03
Date accepted: 2026-08-03
Status: Accepted
domain: meta
type: policy
OKR:
Commands affected: [/merge-quiz, /wayfinder]
Repos affected: [core]
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [wayfinder-decision-maps, wrap-absorb-reject]
  parent:
  part-of-series:

---

## Context

The `teach-in-the-loop` wayfinder map (`decisions/wayfinder/teach-in-the-loop.md`, tracker #379)
was charted with an anchor **bid**: its Destination — teaching as a standing, ZPD-calibrated output
of fleet work — would anchor to a new fifth l1-core property, or fall back to `ns:l2-ojfbot#P2` if
the bid failed. Ticket #381 carried the decision.

The tension grilled (2026-08-03): l1-core's four properties are one doctrine-ordered story about
the harness measuring itself (honest ruler → frozen eval → iterate → track evolution); a property
about a *human* is a different kind of claim, and its evaluator did not exist as a settled
instrument (#384 ZPD sensor and #382 corpus location still open). Against that: the fallback anchor
is a poor semantic fit (l2-ojfbot#P2 is a work-legibility property, not a competence one), the
merge-quiz proto-instrument already lives in core, and the `se-competency-engine` synthesis frames
operator-and-fleet co-competence as a harness property.

## Decision

l1-core gains **P5 — "The harness raises operator competence"** — with the teach loop
(mission-grounded shadow-space workspaces, adopt-stack D18–D25) as its instrument. The measure is
**uplift-primary, ZPD-rate staged**: taught-vs-cold movement on the merge-quiz EWMA heatmap
(repo × domain, taught/cold never merged) is the primary measure; a lessons-served-at-ZPD rate
activates as a second metric only per the #384/#382 rulings. Measurement-first (P1 discipline):
no uplift is published before the instrument's capture quality is green. (Operator ruling,
wayfinder ticket ojfbot/core#381.)

## Consequences

- The `teach-in-the-loop` map's frontmatter anchor (`northstar: l1-core`) is ratified; the
  Destination's "accepted l1-core operator-competence property" arrival condition is now concrete.
- `.claude/northstar.md` carries P5 (numeric current/target flagged as proposals for operator
  calibration at amendment-PR review — l1-fieldwork-1 precedent). Property ids are assigned once
  and never reused (ADR-0087); P5 ladders to `ns:l2-ojfbot#P2` like its siblings.
- The amendment ships via the registry's own PR path; no session writes northstar `current:`
  movement (movement-contract discipline). Future P5 movement lands via `status.jsonl` lines with
  evidence, as with every property.
- #384 and #382 inherit a pre-registration duty: their rulings define the staged ZPD-rate metric's
  instrument and activation criteria.
- Deskilling counter-measurement is an acknowledged open consideration (see
  `decisions/open-unknowns.md`, 2026-08-03 entry): P5 measures uplift; a dependence counter-metric
  is not yet specified.
