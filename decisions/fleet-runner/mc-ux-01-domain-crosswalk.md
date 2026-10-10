# MC-UX-01 UX-to-domain contract crosswalk

- Version: candidate-v1, artifact revision R2
- Status: Proposed, non-production consumer profile
- Recorded: 2026-10-10 America/Chicago
- Core base: `8d90aad84d5ed2115a0a83a4049af616fbb65489`
- Cockpit planning subject: `5078639b2e752c3e1fa7125288201a2ccfef8424`

## Claim boundary

This crosswalk makes the MC-UX-01 journey testable without making its candidate envelope
an operative shared schema. It uses current core and morning-cockpit record shapes as inputs,
retains their literal provenance and marks proposed expectations explicitly. The companion
manifest and checker prove deterministic classification of synthetic cases. They do not prove
that a producer is deployed, a human-authority mechanism is trustworthy, a comment was delivered,
or an original obligation was settled in production.

The durable design rule is: retain source observations append-only, produce versioned projections,
and promote individual propositions only when their named evidence policy passes. A strict record
shape cannot upgrade an authored claim into an assessment, an assessment into authority, a file
write into delivery, or delivery into consumption or settlement.

## Pinned sources and status

| Source | Pin and current status | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| [MC-UX-01 planning entry point](https://github.com/ojfbot/morning-cockpit/blob/5078639b2e752c3e1fa7125288201a2ccfef8424/planning/mc-ux-01/README.md) | PR #54 draft head `5078639`; source capture 60 files / 1,670,171 bytes / 29 references / inventory SHA-256 `7fdbbe469615cd3a819e15ac7681dd2b8f2c31e9c173c3adc5a012b12437bea2` | Exact amended planning and frozen captured bytes | Operator acceptance, runtime readiness or a merged main pin |
| [Transition plan](https://github.com/ojfbot/morning-cockpit/blob/5078639b2e752c3e1fa7125288201a2ccfef8424/planning/mc-ux-01/transition-plan.md) | Proposed T1–T7 sequence and Q gates | Cockpit-owned and core-owned entrances | Dispatch eligibility or a selected production shell |
| [Verification plan](https://github.com/ojfbot/morning-cockpit/blob/5078639b2e752c3e1fa7125288201a2ccfef8424/planning/mc-ux-01/verification-plan.md) | Proposed acceptance and usability checks | Future evidence obligations | Executed production evidence |
| [Fleet integration](https://github.com/ojfbot/morning-cockpit/blob/5078639b2e752c3e1fa7125288201a2ccfef8424/planning/mc-ux-01/fleet-integration.md) | Qualified T1–T7 ownership/entrance crosswalk | Registration proposal and domain gaps | Core registration, policy acceptance or a shared schema |
| [Qualified integration review](https://github.com/ojfbot/morning-cockpit/pull/54#pullrequestreview-5465329055) | Reviewed earlier planning head; later corrections landed at `5078639` | Source for qualified task/core-gate split | Acceptance of the corrected head by inference |
| [Delivery review](https://github.com/ojfbot/morning-cockpit/pull/54#pullrequestreview-5472577238) | Capture/planning approved for its declared scope; 14 future delivery criteria not proven | Concrete read-path defects and proposed first slice | Delivered future UX or producer/runtime integration |
| `adr:fleet-runner-in-core` | Accepted ADR-0108 | Core owns shared contracts; fleet-runner belongs in `packages/fleet-runner` with independent deployment | Runtime implementation, host, store or schema |
| `adr:fleet-runner-publication-hold` | Accepted ADR-0109 | Unknown publication blocks reassignment/conflicting publication for the affected item | Reconciliation mechanism, reopening authority or successful delivery |
| `correspondence-speech-act-tiers` | Proposed after merged PR #495 | Current bounded decision venue and D1–D12 vocabulary | Operative policy, authority mechanism or schema package |
| Fleet-runner map / L2 S25 | Map working; S25 `ready`, `human_only`, `gate-0` | Existing venues and narrower operating-mode proof | Fleet-runner readiness or MC-UX dispatch eligibility |

If PR #54 later merges, downstream runtime or registration work must pin the accepted main
revision that contains the reviewed planning state. This candidate retains `5078639` as the exact
subject it inspected; it does not predict the future merge commit.

## Candidate evidence envelope

The executable pack uses a deliberately small, profile-scoped envelope:

| Field | Meaning | Writer | Promotion rule |
| --- | --- | --- | --- |
| `id`, `kind`, `schema_version` | Immutable record identity, closed record class and profile version | Named producer | Unknown versions quarantine; identity is not authority |
| `subject.id`, `subject.revision` | Exact proposition/artifact/work revision being described | Producer, checked by consumer | A ruling or receipt for an older revision stays stale |
| `producer.id`, `producer.kind` | Logical writer and its claimed class | Producer/collector | Keep distinct from authenticated transmitting account and human authority |
| `source_refs[]` | Pinned inputs, observations or receipts | Collector/producer | Empty or inaccessible evidence remains a gap |
| `links[]` | Closed typed relations: `derived_from`, `reports_on`, `authorized_by`, `published_as`, `corrects` | Writer allowed for that record class | Unknown relations fail; delivery and settlement targets must match their annotations; `corrects` must point backward to the same kind and subject |
| `annotations` | Namespaced payload for the bounded record class | Record producer | No free-form annotation promotes lifecycle or authority |

Current source records are adapted into this envelope; they are not rewritten into a new
canonical ledger. Unknown or conflicting source fields remain present and unresolved. A later
shared seed may extract stable fields only after at least one real producer and two independent
consumers pass positive, mutation, replay and failure qualification.

## UX state and domain-record crosswalk

| Observable UI statement | Domain record / relation | Existing producer | Consumer | Required provenance and authority | Current status | Missing evidence | Specific entrance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| “Source item” | Source-qualified observation: source, repository, native ID and path | Cockpit handoff/Dolt adapters | Current cards; proposed inspector | Exact source revision and adapter version; conflicts retained | Existing shapes, incomplete identity preservation | Cross-repo/native collisions, stale/conflicting source diagnostics | Cockpit T2/S11 implementation authorization and public read-contract review |
| “Original action” | Existing stable action ID and source revision | Daily-logger actions feed or original repository ledger | Standup, cockpit and fleet-runner planning | Original action ID must survive every later relation | Existing in some flows; no universal join | Demonstrated action→work→settlement lineage | #315 census plus bounded adapter qualification |
| “Prepared” | `prepared_artifact reports_on original_action` | Existing handoff writer or report composer | Cockpit preview/inspector | Exact bytes/digest, path and subject revision | ADR-0005 accepts brief preparation/emission only | Report-write carve-out and remote delivery evidence | Cockpit Q3 for reports; existing ADR-0005 remains brief-only |
| “Approved” | Revision-bound approval `authorized_by` a verified human ruling | Trustworthy human-authority boundary, not a shared-account agent comment | Fleet-runner admission and cockpit display | Human decision bound to item, scope, revision and permitted act through an unforgeable boundary | Proposed prerequisite in #495 D7; mechanism absent | Replay, changed-subject, revocation and shared-account counterexample proof | #313 authority decision and accepted bounded profile |
| “Claimed” | Active queue claim/lease on the work reference | Core supported queue writer; cockpit delegates through `/api/claim` | Runner and cockpit | Lease ID, work ID, owner, expiry and readback | Existing delegated human claim exception in cockpit ADR-0010 | Cross-source work mapping and race/renewal proof | Existing claim contract; do not infer execution from claim |
| “Executing” | `execution_attempt` for exact work and subject revision | Future fleet-runner worker supervisor | Cockpit/read model/recovery | Attempt ID plus distinct process, session, host, harness, start/result evidence | Not deployed for MC-UX | Qualified producer, process authentication and recovery evidence | Registered core runtime slice after #311/#309/#313 entrances |
| “Completed attempt” | Execution-attempt outcome assessment | Verifier, separate from worker claim | Review and publication admission | Checks, artifact revision and verifier provenance | Candidate only | Deployed verifier and failure/replay qualification | Runtime implementation and exact-state review contract |
| “Published” | `delivery_receipt published_as remote_object` | Authorized publisher after independent remote readback | Cockpit, issue/PR reporting, recovery | Publication intent, destination, publisher, exact body digest/revision and remote object | Proposed profile; ADR-0109 governs unknown outcomes | Live publisher, remote readback and reconciliation proof | Accepted publication grant and bounded live qualification |
| “Publication unknown” | Publication intent with outstanding requests; affected-item hold active | Publisher/reconciler | Admission, reassignment and cockpit status | Request identities and remote inspections; absence on one read is insufficient | Hold policy accepted; enforcement absent | Reconciler and accountable reopening authority | ADR-0109 proof slice plus #318 recovery/supervision |
| “Consumed” | `consumption_receipt` referring to exact delivered revision | Attributable consumer or responding actor | Fleet-runner/cockpit | Consumer identity, exact report revision and attributable action/acknowledgment | Proposed in #316/profile | Instrumented consumer or downstream artifact evidence | #316 consumption decision and consumer qualification |
| “Disposition” | Attributable accepted/declined/deferred/acknowledged response to a named subject | Human or qualified consumer under applicable authority | Original action owner and projections | Subject revision, actor role, source, reason/revisit condition | Partly represented in existing action ledgers; mapping incomplete | Typed join to original action and authority classification | #316 plus bounded correspondence profile |
| “Settled” | Human-authorized settlement receipt `reports_on original_action` | Original obligation owner/qualified settlement adapter | Daily-logger, cockpit and fleet-runner | Human producer classification, separately verified authority, original action ID, final disposition, evidence and correction lineage | Missing end-to-end | Production source readback and negative proof that agent authorship or PR/task completion is insufficient | #316 settlement rule, then registered producer/consumer slice |
| “Needs human decision” | Projection over unresolved approval/authority evidence | Versioned projector | Cockpit UI | Projection revision, watermarks and named missing evidence | UI concept exists; exact contract proposed | Qualified identity/authority inputs | Cockpit may show explicit unknowns without waiting for runtime |

The UI may expose an earlier state while later states remain unproven. For example, a report can
be prepared while approval, claim, execution, publication, consumption and settlement all remain
unknown. It must not collapse those facts into one “done” badge.

## Closed candidate journey

```text
original action
  → prepared artifact / brief or report
  → exact-revision human approval
  → claim lease
  → execution attempt
  → verified output / review subject
  → publication intent
  → delivery receipt with remote readback
  → consumption receipt
  → disposition and settlement of the ORIGINAL action
```

No arrow is transitive by default. A later record must name the exact earlier subject. A new
closed completion bead, emitted file, rendered page or opened PR may be evidence for one stage;
none establishes the remaining stages.

## Executed conformance criteria

The versioned input artifact is
[`mc-ux-01-contract-manifest.json`](mc-ux-01-contract-manifest.json). The public checker is
`scripts/mc-ux-01-contract-check.mjs`; its implementation is profile-scoped under
`scripts/lib/mc-ux-01-contract.mjs`.

| Criterion | Positive/counterexample | Required observable |
| --- | --- | --- |
| MCUX-C01 | Authored completion without settlement | Settlement remains `unproven` |
| MCUX-C02 | Stale, missing and conflicting source identity | All three diagnostics retained; identity unresolved |
| MCUX-C03 | Same harness, distinct process/session IDs | Processes remain distinct |
| MCUX-C04 | `actor == recipient` with no obligation evidence | Recipient/obligation unresolved |
| MCUX-C05 | Unsupported profile version and missing recipient role | Both records quarantined |
| MCUX-C06 | Approval for an old revision | Approval marked `stale` |
| MCUX-C07 | Agent attempts human ruling through shared account | Approval marked `unverified` |
| MCUX-C08 | Local file write with no remote receipt | Preparation proven; publication unproven |
| MCUX-C09 | Delayed/unknown publication | Affected-item hold active; blind retry forbidden |
| MCUX-C10 | Explicit evidence at every stage | Seven journey stages proven independently; zero findings |
| MCUX-C11 | Orphan delivery receipt with absent intent fields | Publication remains unproven; missing intent diagnosed |
| MCUX-C12 | Agent-authored receipt claims settlement | Settlement remains unproven; human authority diagnosed |
| MCUX-C13 | Delivery receipt appears while publication outcome is unknown | Unknown state and affected-item hold remain dominant |
| MCUX-C14 | Later approval explicitly `corrects` the earlier record | Same-subject correction is projected; history remains append-only |
| MCUX-C15 | `published_as` target differs from remote readback object | Publication remains unproven; relation mismatch diagnosed |

Synthetic PASS means the evaluator produced the expected state and exact finding set. It is not
evidence of a deployed producer, authenticated human, live publication, consumer or settlement.
Artifact revision R2 adds the independent adversarial probes reported in
[`core#523`](https://github.com/ojfbot/core/issues/523); they are retained in the public manifest,
not only in the unit suite.

## Promotion path and entrances

1. **Proposed fixture profile — this artifact.** Synthetic cases, exact source pins, deterministic
   checker, no runtime or policy authority.
2. **Shadow conformance.** Run read-only adapters over explicitly authorized real inputs; compare
   candidate projections with current consumers; preserve disagreement and coverage gaps.
3. **Qualified bounded profile.** At least one real producer and two independent consumers pass
   the same positive, mutation, replay and failure suite. Record provider/adapter versions,
   redaction, retention, compatibility and rollback.
4. **Candidate shared contract seed.** Extract only demonstrated common fields/relations; decide
   schema/package ownership and migration. Review against #495, #307 and affected consumers.
5. **Accepted shared contract.** Explicit owner acceptance plus registered rollout slices and
   runtime proof. Acceptance remains separate from deployment and migration.

Cockpit may implement its qualified read-only preservation/inspection slice after its T2/S11
entrance clears. It does not need final fleet-runner hosting or every T1–T7 decision. Core producer,
authority, publication, consumption and settlement changes retain their own gates.

## Rollback and limitations

- Removing the candidate checker/manifest and reverting the two body-only registration notes
  restores the prior core behavior; no runtime state or queue migration exists.
- The checker is deterministic and offline. It does not authenticate accounts, access private
  telemetry, contact GitHub or prove runtime credentials.
- The candidate envelope is not installed in `packages/fleet-runner`, because no production
  package exists and this slice is not runtime scaffolding.
- Retention, redaction, export, performance, backpressure, store choice, human-authority mechanism,
  recovery and compatibility policy remain human-gated.
