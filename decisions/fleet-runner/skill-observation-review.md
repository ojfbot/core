# Fleet runner skill observation design review

Date: 2026-10-02. Scope: author-run `/spec-review` against repository code, live local evidence, existing ADRs, and GitHub status. This is not an independent peer review. Reviewed the [design](skill-observation.md), [draft ADR](../adr/draft-fleet-runner-skill-observation.md), and [investigation](../../docs/fleet-runner-skill-telemetry-investigation-2026-10-02.md).

## Verdict

PASS WITH NOTES for recording the architecture proposal. Production implementation and rollout remain gated by the open decisions identified below. No new runtime behavior has been verified.

## Critical errors

None found in the documentation proposal. It does not claim that collectors, durable ingestion, shared report APIs, or fleet-runner runtime already exist. No ports, service endpoints, framework, or database are invented. It retains accepted placement and publication boundaries.

## Significant gaps

1. Provider capture qualification remains unproven. The native Codex transcript demonstrates a recoverable missed load in this session; the local hook configuration and `corroborate-follow` predicates demonstrate today's mismatch. They do not establish a supported complete collector for every Codex or Claude version. The design correctly makes qualification and unknown coverage part of its first slice. Before implementing that slice, pin the two intended provider versions and the observed native input/output contract.
2. Response-interval closure remains a policy choice. Current `classifyDisposition` classifies no engagement as ignored before its time-window branch, and normal persistence retains the first terminal row. The design fixes the conceptual error but deliberately leaves the exact closed interval and completeness rule open. Resolve that rule before implementing negative classifications; otherwise the new system could recreate the same false certainty.
3. Remote evidence handling and durable recovery targets remain open. The accepted fleet-runner placement ADR selects no runtime or store, and the inherited map requires explicit evidence reconstruction and privacy boundaries. Local qualification can proceed as a bounded future slice; production ingestion cannot claim loss bounds or export private transcripts until those decisions are accepted.

## Minor issues

The ADR skill documents the resolver at `scripts/adr-slugs.sh`, but the actual resolver is under `.claude/skills/adr/scripts/`. The existing helper was used and the deviation recorded. This did not require another helper or a skill-distribution change.

## What the design gets right

- It reuses #307 and the existing fleet-runner map, without closing inherited tickets or expanding the first governed execution pilot implicitly.
- It preserves OPAV evidence validation and authoring separation rather than inventing a competing action ledger.
- It distinguishes response, loading, application, and coverage, including deliberate use without suggestions.
- It requires normal late-evidence correction and event-time reporting instead of immutable negative interpretations.
- It identifies actual missing behavior and does not interpret existing 37-test success as end-to-end provider coverage.
- It reports the validator's indeterminate result for the prescribed skill-loader emission rather than claiming the write proves application.
- It keeps proposed vocabulary, runtime choices, and unqualified environments explicit.

## Verification performed

- Existing capture suites: 37 tests passed in two files under Vitest.
- Isolated current-behavior fixtures reproduced unrecognized shell/Codex loads, premature ignored, and ignored surviving a later acted row.
- New ADR slug resolves exactly once through the existing helper; draft carries no numeric serial.
- Relative links in the new investigation, design, ADR, and review resolve locally.
- `git diff --check` passes. Files changed are documentation only.

## Before implementation

Choose the first provider qualification scope and public observation-to-receipt test boundary, reconcile existing roadmap slices, and register the bounded work. Resolve interval closure before negative classification. Resolve deployment-specific privacy and recovery policies before remote rollout. Obtain independent review before runtime acceptance; this author check is not its substitute.

## Follow-up review of the correspondence profile

Scope: author review of the operator-directed extension, including [the new profile](skill-observation-correspondence.md), revised design, and ADR. Verdict remains PASS WITH NOTES for the documentation proposal, not runtime acceptance.

The prior design left issue comments and confirmed comment delivery implicit. The revision now requires both configured PR and issue targets, useful claim-level content, exact report revisions, independent remote readback, correction lineage, and a separate consumption receipt. The source inspection of `bead-session.sh` confirms that the present hook can log a posted event after a failed GitHub command; SC07 explicitly targets that failure.

The typed profile distinguishes observations, agent claims, interpretations, assessments, dispositions, report revisions, publication intents, delivery receipts, and consumption receipts. Human rulings remain governed by the shared authority contract. It separates schema validity from evidential support and distinguishes a shared account's authorship from human authorization. Source-independence checks cannot be satisfied by copying one claim into two records.

PR #495 was verified OPEN and draft at `62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb`. The profile uses its authored/derived distinction and verification lessons without claiming the proposal is accepted or replacing its operative-transfer rule with a comment. It retains the accepted publication hold and names uncertain-outcome recovery as unproven. No new runtime schema, inference engine, publisher, or rule tests are claimed to exist.

No additional critical error found in the documentation. Remaining significant integration decisions are the operative correspondence grammar and authority mechanism, shared schema ownership/version compatibility, and qualification of comment recovery and routing. They are explicitly deferred before implementation. SC01–SC08 each has a positive and mutation case specified; the next implementation must prove nonzero executed coverage rather than counting this table as a test pass.

## Independent PR review: fleet-runner skill observation and delivery handoff

Date: 2026-10-02. Two separate review agents ran the `/pr-review` Standards and Spec axes. The reports below are retained verbatim. The earlier sections remain author reviews of earlier revisions.

Fixed point: `origin/main` at `e90d0621741e227375c1265d424ba5cf26526aad`. Reviewed head: `4515641d3afe7d21c658f782359b1dc2824076af`. Four commits, 12 files. This review record itself is appended after that reviewed head.

### Verdict: APPROVE

### Standards

Standards verdict: **PASS — 0 findings**.

Reviewed the full documentation change from `e90d062` through `4515641`, including the final delta.

The added requirement establishes positive OPAV application evidence for each qualified provider and prevents an all-indeterminate run from passing qualification. The deviation entry accurately distinguishes historical 37-test evidence from the unsuccessful repeat attempt.

The change preserves accepted ownership and publication boundaries, documents remaining decisions, and makes no unsupported runtime-delivery claims. No secrets, privacy violations, documented standards violations, or applicable code-smell findings found. Framework checks remain inapplicable.

### Spec

Verdict: **APPROVE** for the documentation proposal. Open findings: **0**. One prior P2 finding resolved.

Reviewed base `e90d0621741e227375c1265d424ba5cf26526aad` through head `4515641d3afe7d21c658f782359b1dc2824076af`. The delivery handoff now requires an evidenced application for each qualified provider, run-specific OPAV validation, and the resulting assessment in both session receipts and PR/issue fixtures. An all-indeterminate result explicitly cannot pass qualification.

The documentation preserves the confirmed scope, distinguishes evidence from interpretation and authority, and supplies a bounded implementation entry consistent with the design. No scope creep or security violation found. The logged unsuccessful test rerun does not replace the earlier investigation evidence or claim new validation. Runtime qualification and shared GitHub publication remain outstanding.

### Acceptance criteria

| Criterion | Status |
|---|---|
| All-session observation, including sessions fleet-runner did not launch | PASS — specified |
| Fleet-runner owns reconciliation/reporting within accepted core placement | PASS — specified |
| OPAV preserved; acceptance, loading, application, decline, ignored, and unknown distinguishable | PASS — specified |
| Missing coverage cannot establish intentional refusal; late evidence supports correction | PASS — specified |
| Informational telemetry does not become a session gate or publication grant | PASS — specified |
| Required authorized PR and issue reporting, separate delivery and consumption | PASS — specified |
| Structured correspondence: typed claims, evidence provenance, heuristic versions, mutation obligations | PASS — specified |
| Existing #307/roadmap ownership, ADR-0109 hold, and proposed #495 status preserved | PASS — specified |
| Git-tracked design with actionable, consistent first delivery handoff | PASS — positive application proof now required |
| New capture, replay, publication, consumption, and independent-health behavior | UNTESTED — no runtime implementation in this PR |
| Shared GitHub persistence | UNTESTED — draft PR publication remains pending |

### Per-axis summary

Standards: 0 findings, worst: none. Spec: 0 open findings, worst: none; prior P2 corrected and re-reviewed.

### Summary

Both independent axes approve the documentation proposal through `4515641`. The first delivery gate now requires positive run-specific application evidence for each qualified provider. Acceptance covers the recorded design and handoff; provider qualification, production runtime, remote publishing behavior, and deployment remain unimplemented.

### Publication checks

Roadmap and northstar lints each returned zero errors and 22 warnings from the isolated checkout. ADR provenance returned zero errors and three documentary/cross-repository warnings, including two segments of the session UUID interpreted as possible SHAs. The 45 checked relative links resolve, and the branch diff passes whitespace checks. The repeated capture-suite command did not execute tests because this worktree lacks Vitest; the 37 passing tests above remain earlier investigation evidence. No dependency installation was needed for this documentation change.
