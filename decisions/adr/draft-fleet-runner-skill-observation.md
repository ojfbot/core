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
traces:

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

## Decision

Extend fleet-runner with observation ingestion, reconciliation, and reporting for all
qualified Claude and Codex sessions, including sessions it did not launch. Provider-local
collectors supply evidence; core owns shared identities and semantics; reporting consumers
read one versioned projection contract. Telemetry remains advisory and grants no execution
or publication authority.

The operator confirmed that boundary on October 2, then required PR and issue comments alongside telemetry storage and directed the design to apply structured-correspondence lessons. The following detailed contract is
proposed for review in the [design](../fleet-runner/skill-observation.md):

- Model sessions, suggestions, and skill runs separately. Runs do not require a suggestion.
- Distinguish explicit acceptance or decline, instruction loading, workflow evidence,
  authoring, and observation coverage. Missing evidence remains unknown.
- Classify ignored only under an explicit interval-closure and capture-completeness rule.
  An explicit decline and no observed response are different facts.
- Preserve ADR 0095's independent evidence requirement and ADR 0098's separate authoring
  track. Neither a self-report nor a file read alone proves completed application.
- Retain immutable observations and revise derived projections when late evidence arrives.
  Deduplicate by source identity; preserve event time separately from ingestion time.
- Qualify collector capabilities by provider/version and install pinned runtime releases
  independently of mutable working branches. Add independent health and consumption checks.
- Require every consumer to state cohort, interval, watermarks, projection version, and
  exclusions. Suppress adoption claims when coverage is insufficient.
- Make scoped PR and issue comments required outputs for associated authorized targets.
  Render them from typed report revisions; retain publication intents, confirmed remote
  delivery, corrections, and consumption as separate records. Storage alone is not delivery.
- Apply the [correspondence profile](../fleet-runner/skill-observation-correspondence.md):
  separate authored claims from derived assessments, constrain writers and predicates,
  version heuristic interpretations, and invalidate dependent reports when evidence changes.
  Require positive and mutation coverage for every enforced profile rule.

Use compatible extensions to the existing tracking contracts. A local transport buffer is
not a parallel authoritative ledger. Runtime, database, host, remote export policy, retention,
and numerical service targets remain separate decisions. No universal capture guarantee is
claimed for unqualified environments.

### Relationship to existing work

The structured-correspondence input is draft [PR #495](https://github.com/ojfbot/core/pull/495)
at `62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb`. Its authored/derived distinction,
verified transfer, and mutation-test discipline inform this profile; the draft is not
represented as accepted. Reporting comments do not constitute its proposed commit-based
operative transfer. Binding requests and human rulings retain their own acceptance and
authority requirements. Shared-account authorship alone does not prove human approval.


This proposal extends [adr:fleet-runner-in-core](0108-fleet-runner-in-core.md) within the
existing [fleet-runner map](../wayfinder/control-plane-conductor.md) and #307 tracker.
It preserves [adr:fleet-runner-publication-hold](0109-fleet-runner-publication-hold.md).
Observation does not reopen execution policy or clear implementation.

It develops [adr:skill-action-instrumentation](0095-skill-action-instrumentation.md),
[adr:suggestion-identity-and-denominator](0093-suggestion-identity-and-denominator.md),
and [adr:two-track-skill-telemetry](0098-two-track-skill-telemetry.md). At formal acceptance,
record reciprocal amendment relationships for changed negative-classification and run
identity semantics. Those accepted records are not silently rewritten by this draft.

Reconcile the existing core and fleet roadmaps before registering implementation slices.
The bounded investigation contributes to the inherited census; it does not complete #315
or any other open conductor decision. Full skill observation remains a distinct delivery
obligation, not an unannounced expansion of the first governed execution pilot.

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
| Zero-point | Operator request to extend fleet-runner after repeated skill telemetry failures, 2026-10-02 |
| Confirmed boundary | All sessions; fleet-runner reconciles and reports; preserve OPAV evidence validation; distinguish response/loading/application/unknown; no telemetry session gate |
| Decision authority | Explicit operator answers in Codex conversation `01a0ff67-4f93-7b21-9e03-87fa01116a2f` |
| Source baseline | core main `e90d0621741e227375c1265d424ba5cf26526aad` |
| Acceptance scope | All-session advisory boundary, PR/issue reporting requirement, and structured-correspondence direction confirmed; detailed contracts proposed; no ADR serial assigned |
| Implementation start | Pending registered slice, relevant policy decisions, and provider qualification scope |
| Implementation end | Not implemented |
