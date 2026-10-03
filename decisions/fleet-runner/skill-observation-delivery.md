# Delivering skill observation

Date: 2026-10-02. Status: proposed delivery handoff. Initiative: [core #307](https://github.com/ojfbot/core/issues/307). Accountable owner: operator; implementation owner is assigned when the work is picked up. No implementation or delivery gate has passed in this record.

The [design](skill-observation.md), [correspondence profile](skill-observation-correspondence.md), [draft ADR](../adr/draft-fleet-runner-skill-observation.md), and [investigation](../../docs/fleet-runner-skill-telemetry-investigation-2026-10-02.md) are the git-tracked specification. The [existing map](../wayfinder/control-plane-conductor.md) owns unresolved fleet-runner decisions. PRs and issue correspondence link to those files at a commit; they report evidence and decisions against an identified revision.

## First delivery

Start with design slice 1, local provider qualification. A developer should be able to inspect a session receipt and answer which suggestion was delivered, what response was observed, whether instructions loaded, what application evidence exists, and what remains unknown. The same facts must render into scoped PR and issue comment fixtures without gaining certainty during rendering.

The first implementation PR contains a bounded local replay command, redacted provider fixtures, a reproducible qualification report, session receipts, and rendered PR/issue comment fixtures. Record the command and its executed nonzero test count in that PR. Use the existing pnpm workspace and test runner. Determine the experimental file location during pickup; this proof must not silently select fleet-runner's runtime, database, or production schema package.

Before writing the adapters, pin the installed Claude and Codex versions and their observed input/output contracts. Name the source interval, successful-load evidence, capture gaps, redaction procedure, and expected receipt for each fixture. If a version cannot be exercised, mark it unqualified. Never replace missing live evidence with a synthetic fixture and call the provider qualified.

The proof can use experimental record shapes derived from the proposed profile. Mark those outputs as experimental, retain their source references, and do not export them as an accepted shared API. Ratification and shared schema ownership remain prerequisites for production integration. This permits a bounded proof while the contracts are still being reviewed.

Required demonstrations:

- A delivered suggestion and successful load for each pinned provider; a load earns no verified-application credit by itself.
- A deliberate skill invocation without a suggestion; no synthetic suggestion is minted.
- An explicit response remains distinct from load and application. An absent response with incomplete coverage or an open interval stays unknown or pending.
- The investigation's missed Codex load appears in the receipt. The legacy ignored row remains attributable as a legacy interpretation; it cannot erase the load evidence.
- A failed read, a definition audit, and an application claim with indeterminate OPAV validation earn no verified-application credit.
- Both PR and issue fixtures name the source snapshot, evidence, gaps, and proposed dispositions. Rendering creates neither a delivery receipt nor a consumption receipt.
- The command reads only explicitly selected local inputs, writes to its selected output directory, and does not change live ledgers, hooks, consumers, dispatch, or remote comments.

Use the public input-to-receipt-and-comment boundary. Include positive and mutation cases for the correspondence rules exercised by this slice; list the remaining SC01–SC08 obligations as untested. Require at least one executed positive and one executed mutation case for every rule claimed as covered. Retain the existing OPAV validator and its indeterminate outcome when an artifact contract is missing.

## Ordered deliveries and Control Gates

Restatement: deliver trustworthy all-session skill reporting through demonstrated behavior. Control Gates are warranted because later slices publish remotely and replace trusted reporting inputs.

| Slice | Layers and observable value | Entrance Criteria | Success Criteria and verification |
| --- | --- | --- | --- |
| 1. Local qualification | Provider source → observation → receipt → PR/issue fixture; missed use becomes inspectable | Assign implementation owner; pin both provider contracts; review redacted fixture expectations | Execute every demonstration above. Report observed versus expected outcomes and nonzero rule coverage. Any unsupported provider stays unqualified. |
| 2. Replay and correction | Retained facts → replay → revised reports; interruption and late evidence do not silently corrupt totals | Slice 1 evidence reviewed; select local durability semantics and correction rules | Demonstrate duplicate, late, interrupted, and restart cases through receipt outputs. Preserve revision lineage and report gaps. Resolve the closure policy before asserting ignored. |
| 3. Verified publication and consumer cutover | Qualified report → authorized PR and issue comments → remote readback → consumer snapshot | Accept shared contracts, publication grant, explicit test targets, privacy policy, and applicable recovery policy; resolve overlapping roadmap scope | Fault tests show exact-revision delivery on both target types, correction lineage, and no false delivery or consumption. Unknown writes obey ADR-0109. Compare consumers on the same cohort, bounds, and snapshot before cutover. |
| 4. Independent observation and expansion | Collector/consumer health → independent finding → attributable disposition | Accept independent checker ownership, coverage policy, and operating targets | Stop collector and consumer separately; distinguish each from healthy empty activity. Qualify additional versions individually and report exclusions. |

The Measure of Effectiveness is that reported skill use and missing evidence are trustworthy enough to act on. Initial Measures of Performance are required scenarios passed versus attempted, correspondence rules with executed positive/mutation coverage versus claimed coverage, and providers qualified versus attempted. Track these as Technical Performance Measures against the committed fixture expectations. No claimed scenario or rule may fail and no claimed coverage may have zero executed cases. These are bounded qualification thresholds, not evidence of estate-wide accuracy or production reliability.

The first two slices are local verification. Slice 3 begins with shadow comparison; consumer promotion requires an accepted policy and evidence against its thresholds. Existing OPAV RIDM criteria remain separate. A failed comparison retains the existing consumers and records the discrepancy. Do not invent production targets to make a gate pass. Vertical slice and shadow mode are harness extensions to the SEH vocabulary.

## Relationship to existing work

| Existing record | Reuse and boundary |
| --- | --- |
| [Core skill roadmap](../../.claude/roadmap.md), especially S2–S7 | Reuse existing identity, validation, and capture work. Their delivery history does not establish complete native Codex capture. This proof records the uncovered paths. |
| [L2 roadmap](../northstar/roadmap-l2-ojfbot.md), S23 and S24 | Preserve OPAV promotion and the existing single-source migration. Consumer replacement belongs to slice 3 after comparison. |
| L2 S25 | Local skill qualification does not dispatch work or select day-runner's operating mode. Reconcile S25 before overlapping fleet-runner runtime dispatch. |
| #315 and #308 | Provider capability and capture evidence contribute to the existing census and research. Neither ticket is closed by two local examples. |
| #311, #313, #316, #318 and correspondence PR #495 | Portability, authority, consumption, independent supervision, and operative correspondence remain their owners' decisions. Live integration must meet the relevant accepted contracts. |

This file is a delivery handoff linked from the existing roadmaps, not a second dispatch queue. It assigns no movement, changes no slice status, and creates no agent-claimable work item. At pickup, attach the bounded implementation PR to #307 and link this handoff. Before unattended dispatch, register the accepted slice through the canonical roadmap with a real executable check and assigned owner.

## Pickup instruction

> Implement local qualification from `decisions/fleet-runner/skill-observation-delivery.md`, slice 1, in core. Start by pinning and documenting the two provider contracts and expected fixtures. Build a bounded local proof through session receipts and PR/issue comment fixtures, with positive and mutation tests. Preserve OPAV outcomes and explicit unknown coverage. Keep live hooks, ledgers, consumers, dispatch, and GitHub publication unchanged. Return a reviewable implementation PR linked to #307 with executed evidence and any unqualified paths. Do not mark the wider fleet-runner runtime delivered.
