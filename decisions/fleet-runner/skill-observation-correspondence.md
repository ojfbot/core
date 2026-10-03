# Structured correspondence for skill observation

Date: 2026-10-02. Status: operator-directed design extension; contracts proposed, not implemented. This profile is part of the [skill observation design](skill-observation.md) under fleet-runner #307.

PR and issue comments are required reporting outputs for associated work. The telemetry store retains detailed observations and replay history; informational comments carry reviewable claims, evidence, gaps, corrections, and observed dispositions where the work is discussed. Storing a report or attempting a comment does not fulfill delivery.

The ontology separates what happened, what someone asserted, what a heuristic inferred, what a verifier established, and what an authorized actor decided. It cannot make an inference true by giving it a type. Its value is that unsupported transitions become rejectable and corrections propagate to the reports that depend on them.

## Sources and acceptance boundaries

The correspondence source is [core PR #495](https://github.com/ojfbot/core/pull/495), inspected while OPEN and draft at `62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb`. References below cite its [pinned ADR](https://github.com/ojfbot/core/blob/62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb/decisions/adr/draft-correspondence-speech-act-tiers.md). That proposal is not an operative fleet-wide contract. This profile applies its lessons without declaring its grammar, identity policy, or transfer rule accepted.

| Correspondence lesson | Application here |
| --- | --- |
| D4/D5/D8: render registers and status from evidence; separate authored and derived schemas | Agents submit observations or claims. Only the reconciler emits assessments and projections. Render comment bodies from a pinned report revision; never hand-maintain a second set of totals or status. |
| D1/D2: a report and a binding request are different speech acts | An informational telemetry report creates no work order or ruling. A request to fix, change policy, or accept a finding must name its recipient and route through the operative correspondence/authorization contract. |
| D3: machine identity replaces hand-assigned counters | Preserve source event and suggestion IDs; mint independent run/report/operation IDs. Store GitHub's actual comment ID after readback. No issue per tool event, manual sequence allocation, or invented remote ID. |
| D6: possession or preparation does not prove transfer | A rendered comment is prepared; a completed remote verification establishes delivery of that exact revision. Reporting delivery alone is not the commit-based transfer of an operative work order proposed in D6. |
| Proposed amendment to D7, not its accepted meaning | Preserve authenticated publisher identity separately from claimed logical actor. This profile proposes requiring evidence beyond shared-account authorship to verify a human ruling; #495 must decide whether to accept that amendment. |
| D9: one strict schema, provider-neutral validation | Shared core contracts define discriminated records and emit exchange schema, typed bindings, and validators. Consumers do not maintain their own ontology or parse status from English prose. |
| D10: every rule proves it can reject a violation | Every profile rule below requires a positive fixture and a mutation fixture; a zero-case, skipped, or missing-rule run fails qualification. |

D8/D9/D10 in that historical source and SC01–SC08 below are proposed adaptations, not operative
qualification gates for the fleet. An approved local experiment may test them as hypotheses;
a failed case is evidence against that experimental contract. Before production enforcement,
reconcile and accept the applicable bounded profile in the existing policy venues. The original
D7 account-authorship-sufficiency proposal was replaced in the current Proposed source below;
neither version was made operative by publication of this profile.

### Current-source reconciliation, 2026-10-03

[#495](https://github.com/ojfbot/core/pull/495) merged as
`bc6d120503416c9d21d627730f27f2d10cfc13f8`; the
[bounded correspondence ADR](../adr/draft-correspondence-speech-act-tiers.md) remains Proposed.
The table above is a historical mapping to its pinned original draft, not the current meaning
of those D labels. This follow-up preserves the following distinctions:

| Current Proposed source | Skill-observation reconciliation |
| --- | --- |
| D1–D3 preserve artifacts and leave identity/canonical state open | Typed report references do not replace beads or require issue-per-artifact identity. Resolve mapping before the operative profile |
| D4–D6 require pinned evidence and distinguish availability, delivery and consumption | Retain immutable report revisions and independent remote readback; publication cannot establish consumption |
| D7 rejects shared-account authorship as sufficient human proof; mechanism remains open | SC04 now aligns with this proposed prerequisite. It is no longer an amendment to the current D7, and no mechanism is selected or qualified here |
| D8 distinguishes authored claims, assessments and transmitting identity | Retain writer/provenance separation; logical actor fields confer no authority |
| D9 defers exchange schemas/tooling; D10 requires positive/counterexample evidence | Record classes and relations below remain a proposed bounded profile, not an approved shared package or mandatory fleet grammar. Local experimental shapes require their own scope |
| D11–D12 separate acceptance, execution, offline shape and remote evidence | Roadmap registration, source grants and live qualification remain distinct gates; historical #501 merge clears none |

The [rollout extension](skill-observation-rollout.md) applies these limits to release pins,
consumer cutover and the daily-logger qualification case. It does not revive #495's deferred
fleet-wide grammar or LEGO/play-well migration. Informational reporting remains the scope;
requests and human-authority acts require their separate operative contracts.

The [selfco ontology decision](../adr/0103-selfco-ontology-program.md) contributes a closed, reviewed relation vocabulary, explicit inference provenance, and dependency invalidation. Its vault storage decisions do not select telemetry storage. The [accepted publication hold](../adr/0109-fleet-runner-publication-hold.md) governs uncertain writes belonging to fleet-runner work items. This profile cannot weaken that hold.

## Record classes and writing authority

All records share machine identity, schema version, issuer identity, source references, event and ingestion times, and scope. References are typed: provider/session/segment/turn, skill origin and revision, suggestion, run, work item, evidence, report, and GitHub target are not interchangeable strings.

| Record class | Who produces it | Required meaning and fields beyond the common envelope |
| --- | --- | --- |
| Observation | Qualified collector | A bounded source event, its native cursor, provider/adapter version, result, and coverage interval. It can establish that a tool returned particular bytes; it cannot assert that a workflow was useful. |
| Agent claim | Identified agent | A proposition about a skill/run, claimed evidence, and source utterance or emission. A claimed application is not verified application. |
| Interpretation | Versioned deterministic rule or model | Input observation IDs, proposed relation or classification, rule/model version, applicable domain, and uncertainty. Confidence is optional and must name its calibration basis; an uncalibrated score is not a probability. |
| Assessment | Named verifier under a versioned evidence policy | The exact claim or interpretation assessed, evidence and subject revision, method, coverage limits, and `supported`, `refuted`, or `indeterminate` verdict. Supporting a load does not support an application claim. |
| Disposition | Attributable actor responding to a named subject | `accepted`, `declined`, `deferred`, or `acknowledged`, with subject ID, actor role, reason where supplied, and response source. An agent accepting a suggestion is not a human authorizing work. |
| Report revision | Reconciler and deterministic renderer | Stable report ID, revision identity, topic/work scope, pinned input watermarks, rule/ontology versions, claim IDs, counts and exclusions, body digest, and prior revision reference. |
| Publication intent | Authorized publisher | Exact report revision, destination repository and issue/PR identity, operation ID, publication grant reference, expected publisher, and intended append or summary replacement. |
| Delivery receipt | Publisher after independent remote readback | Publication intent ID, actual remote comment ID/URL, observed body digest/revision, remote publisher identity, and verification time. A local subprocess exit is insufficient. |
| Consumption receipt | Consumer or attributable responding actor | Exact report revision and what was consumed, acknowledged, or acted on, with a source/response reference. Rendering, page views, and publication alone do not prove consumption. |

A ruling is a reference to a verified authority act under the operative correspondence contract,
not another classifier verdict. Under the current Proposed D7 prerequisite, claims about human
authorization remain unverified until an approved mechanism distinguishes the human decision
from agents using the same account and binds its subject, scope and permitted act. This profile
selects no mechanism and does not settle the broader grant policy.

Evidence independence is a provenance property. Two files, agents, or reports copying the same self-claim are one source, not independent corroboration. Preserve collection-method and origin links so the verifier can detect that dependency. An independent mechanism can confirm a tool result or artifact revision while the meaning or quality of the work still requires a separate assessment.

Closed-world schema validation rejects unknown discriminator values, undeclared fields, empty required identifiers, hollow nested records, and null bypasses. Missing semantic evidence remains unknown; strict shape validation must not turn an absent observation into a false proposition. Unknown schema versions are quarantined with a coverage gap, not silently dropped or accepted as the latest version.

Agent-facing input schemas exclude derived outcome, revision, delivery-confirmed, and authority-verified fields. Native observation ingress authenticates the collector; assessment ingress authenticates the verifier. Validate admissible writers as well as JSON shape. None of these roles gains execution or publication permission by setting an `actor` field.

## Closed relation vocabulary

This is a proposed application profile of core's shared contracts. Existing correspondence identifiers and links remain intact. Each allowed predicate declares source and target classes; widening the vocabulary requires a reviewed schema version and fixtures.

| Relation | Source to target | Constraint |
| --- | --- | --- |
| `derived_from` | Interpretation, assessment, or report to input observations/claims/assessments | Inputs are pinned by immutable ID or revision; derivation graph is acyclic |
| `supports` / `refutes` | Assessment to the exact claim or interpretation assessed | Evidence and policy are required; the edge does not promote unrelated propositions |
| `in_reply_to` | Disposition or correspondence response to suggestion, finding, or report revision | Subject exists and is accessible; ambiguous subjects remain unresolved |
| `supersedes` | Correction to an earlier record of the same correction lineage | Preserve original bytes and basis; a new authority, recipient, or materially changed purpose creates a new act, not a disguised correction |
| `reports_on` | Report to explicit work, session/run, suggestion, or finding | Repo/time proximity is only a candidate association until verified; report scope cannot broaden silently |
| `published_as` | Delivery receipt to report revision and remote comment | Must agree with the actual destination, publisher, and verified revision |
| `authorized_by` | Publication intent or binding act to a verified grant/ruling | Source grants apply to that actor, target, scope, and operation; report findings do not grant authority |

Skill-specific propositions are also closed and versioned: suggestion generated/delivered, instructions loaded, application claimed/verified, and response observed are separate predicates. Explanatory prose and free-form tags cannot introduce new predicates. A heuristic may propose a `reports_on` association, but cannot write it as an established fact.

## Heuristic lifecycle and correction

Register each detector's rule ID/version, input capabilities, output proposition, applicability conditions, known failure modes, evidence policy, gold-set revision, and last qualification result. Distinguish detection quality, evidence sufficiency, and source coverage. A high classification score cannot compensate for a missing collector or an unavailable artifact.

For example, a command string mentioning `SKILL.md` creates a candidate load interpretation. A qualified adapter's verified successful read may support a load assessment. Neither proves skill application. An explicit model response that a suggestion is out of scope is an attributable decline; a missing response remains pending or unknown until the qualified closure rule applies. Competing assessments coexist with their evidence and a conflict disposition rather than being overwritten by the last arrival.

Changing a detector or evidence policy creates a new version. Re-evaluate affected interpretations from retained sources and produce new assessment/report revisions; preserve previous results and changed-case counts. Compare against a held-out labeled set before qualification. Authoring the heuristic, grading its output, and approving any authority change remain distinguishable roles. The shared-account limitation remains explicit.

Maintain reverse dependencies from observations and rule versions through assessments to reports and comments. A retracted source, incompatible adapter, expired evidence policy, or superseded assessment marks dependent reports stale or disputed and schedules correction. This is the concrete ontology payoff: identify exactly which claims and published reports need review when evidence changes.

## Required PR and issue comment contract

For work with a configured PR and issue, publish to both. The PR report is scoped to the reviewed code/PR revision and its associated sessions. The issue report covers the work's cumulative findings, decisions, unresolved questions, and linked PR/session evidence. Where their scopes overlap they cite the same claims and snapshot; differing scopes explain differing totals. A projectless or unassociated session remains explicitly unrouted until a target is authorized. It must not be assigned to an arbitrary issue by a filename or timing heuristic.

Every comment carries a machine-readable marker plus human-readable content from the same report revision:

| Required part | Purpose |
| --- | --- |
| Report ID/revision, ontology/schema versions, snapshot ID, body digest, target scope | Identify exactly what was published and permit deduplication and audit |
| Reporting actor, publisher identity, intended audience/recipient, and report purpose | Distinguish an automated report from a decision request or human ruling |
| Suggestions, explicit responses, observed loads, assessed applications, and capture gaps | Make the actual result reviewable in the comment, not only behind a dashboard link |
| Claim-level method and evidence references | Distinguish observation, agent assertion, heuristic interpretation, and verified assessment |
| Named findings, observed disposition, previously assigned owner, and links to already issued decisions or requests | Report current evidence without requesting action, setting a deadline, or assigning work |
| Prior revision/correction link and reason, plus affected PR head where relevant | Preserve continuity when late evidence or new code changes the report |

Use a compact summary and a details section for evidence. Coalesce repeated unchanged inputs; publish on meaningful report revisions, work milestones, or the accepted reporting cadence, not on every tool event. Exact thresholds are operational configuration, not semantic changes. A verified application count should never replace the statement that some sessions are unobservable.

The informational report schema excludes requested dispositions, next-decision requests, assignments, and imperatives. If a comment asks anyone to act, answer, or decide, classify that content as a separate binding speech act with a named `to:` and apply the operative correspondence/authorization contract; an informational label cannot exempt it from D2. The report may link an already issued request and its recipient as an observed fact. An issue/PR comment URL may be evidence for a ruling only when the operative authority checks succeed.

## Publication and receipt lifecycle

1. Persist the exact report revision and a publication intent in durable state before the outward write. Its idempotency key includes reporting authority, target, report ID, revision, and operation kind. Resolve target and actor grants before sending.
2. One publisher coordinates writes for that report target. Keep local ownership separate from the remote service's guarantees; a marker or local lock is not a GitHub uniqueness constraint.
3. Attempt publication and retain request identity and outcome evidence. On uncertain outcome, record `unknown`, inspect remote state, and account for outstanding requests. A missing comment on one read or a timeout does not authorize blind retry.
4. Confirm delivery only after remote readback verifies the destination, publisher identity, report revision, and expected rendered body. Persist the resulting comment ID/URL and evidence. Definite rejection, unavailable verification, and successful delivery remain different states.
5. Replay deduplicates known operations and resumes unresolved reconciliation. Where the accepted fleet-runner affected-item hold applies, it blocks reassignment and conflicting publication until effects are accounted for. Capturing telemetry for other sessions continues. These delivery checks do not create a new skill-compliance gate.

Corrections append an identifiable immutable report revision and state what changed and why. A stable summary comment may be refreshed as a derived convenience view and links to those revisions. Never overwrite human comments or silently rewrite an issued ruling. For the same reporting act, a corrected payload is a revision; a new recipient, authority, or purpose requires a new act. Retain the verified bytes of every delivered revision in durable evidence because remote comments themselves can later be edited or deleted.

Before updating a summary, verify current identity, ownership, and revision. Unexpected remote edits are conflicts; serialize and reconcile instead of overwriting them. Readback detects divergence but is not a claim of atomic compare-and-swap at GitHub. Deletion or later modification produces a divergence observation; it does not erase the historical delivery receipt or prove the human consumed the original.

Store delivery receipts back in telemetry and expose pending, rejected, uncertain, and confirmed targets. Do not mark a reporting obligation complete while its configured PR or issue delivery is unresolved. A reader acknowledgment or downstream consumer action creates a separate consumption receipt; no inferred human-read event is allowed.

## Rules and adversarial acceptance cases

These are proposed test obligations, not executed tests or already accepted fleet policy. For rules included in an approved experimental scope, each claimed rule ID must map to at least one executed positive and one mutation case; missing or skipped cases cannot qualify that experimental contract. SC06–SC08 remain future slice-3 obligations. Governed qualification awaits reconciliation and acceptance in the policy venues above.

| Rule | Positive case | Mutation that must fail or remain explicitly unknown |
| --- | --- | --- |
| SC01 Typed truth and writer boundaries | Qualified observation plus applicable assessment supports a load claim | Agent inserts `verified_application` or `delivery_confirmed`; detector score alone is presented as fact |
| SC02 Closed schema and identity | Known variants, typed references, supported schema, distinct same-name skills | Null required evidence, unknown predicate, extra derived input field, alias collision, or dangling reply target |
| SC03 Evidence-qualified inference | Matching run/evidence revision supports only its named claim | Old artifact, absent collector, or instruction read used to prove application or intentional ignoring |
| SC04 Proposed authority prerequisite and speech-act separation | Attributable decline; independently verified human ruling under the current Proposed D7 prerequisite | Shared-account authorship alone satisfies the proposed human-verification check; an action or decision request is mislabeled informational |
| SC05 Revisions and dependency invalidation | Late evidence creates corrected assessment and marks dependent reports for correction | Old comment stays current after its supporting assessment is superseded; rewrite of issued authority act |
| SC06 Required routed reporting | Authorized PR and issue targets each receive their scoped report revision | Store-only success, PR-only delivery for two configured targets, arbitrary issue inferred from timing |
| SC07 Verified publication and recovery | Remote readback confirms exact target/publisher/revision; replay reuses the receipt | CLI failure logged as posted; timeout triggers duplicate creation; deleted/edited comment silently overwritten |
| SC08 Receipt and consumption distinction | Explicit acknowledgment links to exact delivered revision | Posting, rendering, or a page view is counted as human acceptance or consumption |

Add replay permutations and fault cases for concurrent publishers, delayed remote acceptance, lost response, restart from older state, late correction, and one sink unavailable while the other succeeds. Existing fleet-runner recovery policy decisions still apply. Receipt creation and state transitions must be assessed through the public observation-to-comment-and-readback boundary, not by comparing two counters computed by the same helper.

## Worked dispositions from this conversation

- The earlier skill-loader suggestion was emitted, its body was successfully retrieved, and the legacy hook recorded ignored without tool-ledger coverage. Retain that ignored row as a legacy classification. The new report must state the contradictory load evidence and coverage gap rather than pretend the old row was a trustworthy behavioral fact.
- The skill-loader acted emission has real report evidence but its expected-artifact contract is missing. Record the claim and the validator's indeterminate assessment separately; do not call the emission verified application.
- Opaque local evidence reference `skill-create-scope-decline` concerns a skill-create suggestion that the assistant declined because this task extends an existing design. That response is a candidate fixture for attributable decline, not an ignored suggestion or a claim that skill-create was used. The private source mapping remains local; no live typed disposition implementation is claimed.

## Open integration decisions

Accept the applicable bounded correspondence profile and authority mechanism in their existing
venues. Establish whether a shared schema package is needed and its ownership/compatibility
before production integration; current #495 D9 defers that choice. Do not create a parallel
telemetry type system to bypass it or require the deferred fleet-wide grammar as a hidden
prerequisite. Select the publication grant, test targets, operational cadence, redaction policy
and durable receipt store before live delivery tests. This document authorizes no GitHub write
and introduces no runtime.
