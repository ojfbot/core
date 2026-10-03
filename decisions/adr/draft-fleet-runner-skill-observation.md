# ADR-XXXX: Fleet-runner reconciles skill observations across all sessions
slug: fleet-runner-skill-observation
serial: draft
rev:
Date: 2026-10-02
Status: Proposed
domain: observation
type: architecture
OKR: ns:l2-ojfbot#P2
Commands affected: /skill-metrics; skill reporting and audit consumers; PR and issue reporting
Repos affected: core; morning-cockpit and daily-logger as consumers

---

## Context

Skill-use telemetry has received repeated capture and reporting repairs, including
suggestion IDs, inline engagement detection, evidence-backed action, authoring separation,
and disposition-ledger adoption. The October 2 investigation reproduces a remaining
cross-provider defect: Codex delivers a suggestion, successfully loads its skill body,
and the legacy suggestion hook marks it ignored because the matching session has no
tool-use records. Existing predicates assume Claude tool shapes. Normal disposition
persistence also ignores later evidence for an already-recorded suggestion.

The [investigation](../../docs/fleet-runner-skill-telemetry-investigation-2026-10-02.md)
provides the local trace, source references, measured cohorts, and isolated reproductions.
Those observations demonstrate measurement defects; they do not establish that every
historical ignored classification is false or that loading proves application.

Fleet-runner's accepted placement in core and succession to the conductor already include
loop observation, evidence, consumption, and independent supervision. Restricting skill
capture to runner-launched work would exclude the interactive workflows the operator
wants measured. Putting independent calculators in each consumer would preserve the
current competing definitions.

The operator confirmed the all-session advisory boundary, PR/issue reporting requirement,
and structured-correspondence direction on October 2. The
[design](../fleet-runner/skill-observation.md) is the normative source for the proposed
contract, acceptance criteria, and implementation entrance. The
[profile](../fleet-runner/skill-observation-correspondence.md) proposes adaptations of
#495 D8–D10 and an explicit amendment to D7; these require reconciliation and acceptance
in #495 before governed use. This proposal does not settle that draft's authority policy.

### Relationship to existing work

This extends [adr:fleet-runner-in-core](0108-fleet-runner-in-core.md) under the existing
[fleet-runner map](../wayfinder/control-plane-conductor.md) and #307, while preserving
[adr:fleet-runner-publication-hold](0109-fleet-runner-publication-hold.md).
It builds on [adr:skill-action-instrumentation](0095-skill-action-instrumentation.md),
[adr:suggestion-identity-and-denominator](0093-suggestion-identity-and-denominator.md),
and [adr:two-track-skill-telemetry](0098-two-track-skill-telemetry.md).
At formal acceptance, register reciprocal trace relationships for any amended contracts;
this draft does not modify their accepted semantics.

Before any slice implementation or local experiment begins, obtain approved scope and
register the bounded work with an assigned owner in the canonical roadmap. Apply the
[design's implementation entrance](../fleet-runner/skill-observation.md#out-of-scope-and-implementation-entrance),
including its source-scope and redaction prerequisites. The handoff's pickup instruction
is inert until those conditions are met. Existing ticket dependencies remain unchanged.

## Decision

Extend fleet-runner with advisory observation ingestion, reconciliation, and reporting
for all qualified Claude and Codex sessions through the proposed
[skill observation contract](../fleet-runner/skill-observation.md).

## Consequences

### Gains

- Unobserved use can no longer masquerade as known refusal under the proposed contract.
- Deliberate use and provider-specific paths become measurable without inventing suggestions.
- Late evidence can correct a report while preserving its history and provenance.
- Consumers can agree on numbers and expose exactly which sessions remain uncovered.

### Costs

- Each provider and relevant version requires real capture qualification and maintenance.
- Durable ingestion, coverage accounting, replay, and independent health checks need explicit
  operational ownership and recovery tests.
- Migrating consumers requires cohort parity and a documented disposition for legacy history.
- Independent semantic verification remains necessary; better capture cannot prove workflow
  quality by itself.

### Neutral

- Skill installation and suggestion ranking remain unchanged.
- Privacy and retention may limit reconstructible history; limits must be visible.
- This record selects no service technology, grants no remote access, and deploys nothing.

## Alternatives considered

| Alternative | Reason not selected |
| --- | --- |
| Measure only runner jobs | Excludes the interactive sessions the operator explicitly included |
| Add the missing Codex hook registrations alone | Does not address provider tool shapes, deliberate use, sticky negatives, or reporting drift |
| Require agents to emit every skill event | Repeats the compliance dependency the independent evidence contract exists to address |
| Infer completion from every SKILL.md read | Conflates loading, auditing, authoring, and application |
| Build another skill dashboard and ledger | Duplicates measurement ownership and leaves source completeness unproven |
| Block sessions until suggestions are followed | Conflicts with the confirmed advisory boundary and penalizes unobservable or inappropriate suggestions |

## Verification required

Demonstrate one suggested and one deliberate skill run in both qualified providers through
the same session-receipt contract. Then prove gap handling, duplicate and late replay,
independent evidence rejection, consumer parity, required PR/issue delivery with remote
readback, SC01–SC08 mutation coverage, and independent health detection. The
design contains the acceptance criteria and test matrix. Existing 37-test success verifies
current behavior only; no new runtime behavior has been implemented or validated.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | `e90d0621741e227375c1265d424ba5cf26526aad`, inspected main baseline for this design; no dedicated empty zero-point or runtime slice has begun |
| Inspection commit | `36594b0`, investigation and initial proposal recorded together |
| Confirmed boundary | All-session advisory observation, PR/issue reporting, and structured-correspondence direction; detailed contracts remain proposed |
| Decision authority | Explicit operator answers in the originating private conversation; public record is this proposed ADR in PR #501, not an authorization token |
| Implementation start | Pending approved scope and canonical roadmap registration with owner under the design's implementation entrance |
| Implementation end | Not implemented |
| PR | [#501](https://github.com/ojfbot/core/pull/501) |
| Convoy id | Not applicable |
