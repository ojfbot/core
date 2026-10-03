# Fleet runner skill telemetry investigation and proposed extension

Date: 2026-10-02, America/Chicago. Status: investigation complete; design boundary confirmed; detailed extension proposed. Runtime implementation is not authorized by this report.

The current measurements cannot reliably distinguish unused skills from unobserved skill use. This session reproduced that failure: a skill was suggested, its instructions were successfully retrieved, and the suggestion was subsequently recorded as ignored while the session had no records in the tool ledger used for corroboration. Fleet-runner should own reconciliation and reporting across all sessions, using provider-specific capture and an explicit account of missing evidence. The operator confirmed that all-session scope in this conversation. The operator also confirmed the observation-only design boundary and directed that it be developed and recorded. Detailed contracts remain proposed.

## Symptom

Expected: suggestions, acceptance or refusal, skill loading, application, and resulting evidence can be traced across Claude and Codex sessions, including sessions not launched by fleet-runner. Observed: incompatible reports, missing capture paths, suggestion-scoped usage counts, and premature ignored classifications prevent reliable measurement.

## Evidence

### Sources and vantage

Inspected the operator Mac, core checkout `3520649a77ff3b0846613173004a8b7f7dffde17`, relevant local and remote branches, both existing fleet-runner worktrees, GitHub issues and PRs, registered hooks, local telemetry, and this conversation's native Codex rollout. Refreshed `origin/main` to `e90d0621741e227375c1265d424ba5cf26526aad`. The inspected capture and metrics source files have no diff against that main revision. This is not a census of every fleet host or every possible Codex installation.

Raw prompts and transcripts remain local. This revision contains aggregate counts and an opaque reference to a local reproduction. Native identifiers and identifying timestamps have been removed from the current document; earlier PR commits still retain them, so this edit is not a history-erasure claim. No hook configuration, live projection, consumer, queue, or roadmap status was changed. The confirmed design boundary is recorded in documentation. No GitHub publication was performed during the initial investigation; the resulting proposal was subsequently published as PR #501.

| Finding | Evidence | Implication |
| --- | --- | --- |
| Codex produces suggestions without the paired capture hooks | `~/.codex/hooks.json` registers `suggest-skill.sh` on UserPromptSubmit, but contains neither `log-tool-use.sh` nor `reconcile-skill-acted.mjs`. `~/.claude/settings.json` registers both. | Producer installation does not establish measurement coverage. |
| This session contains a false ignored event | Opaque local evidence reference `codex-missed-skill-load`: skill-loader was suggested, its body returned successfully about 45 seconds later, and ignored was recorded about 25 seconds after that. At inspection, the corroborating legacy ledgers contained zero rows for the session. | Missing corroboration is being interpreted as behavior. Native evidence remains local; this reference is not a public evidence-verification endpoint. |
| Engagement detection assumes Claude-specific tool shapes | `scripts/hooks/corroborate-follow.mjs:57` requires `Read` plus `file_path`; other branches recognize `Skill` or `Bash` executing a skill's `scripts/` path. | Codex `exec_command`, nested `functions.exec`, and ordinary shell reads do not qualify through these predicates. Copying hook registrations alone is insufficient. |
| Negative classification precedes the grace window | Built `classifyDisposition` returns `ignored` for `!engaged` before considering `withinWindow`. `scripts/hooks/suggest-skill.sh:55` also checks the previous suggestion on the next prompt without proving capture completeness. | A running, delayed, or unobserved session can acquire an ignored classification. |
| Late evidence does not correct ordinary persisted rows | `scripts/hooks/reconcile-skill-acted.mjs:179` excludes any previously persisted suggestion ID. The separate rebuild operation replaces the projection. | Reconciliation needs ordinary revisions, not a manual full rebuild to correct a negative observation. |
| Usage depends on a prior suggestion | `scripts/skill-metrics.mjs:94` acknowledges this; lines 98–103 turn engaged dispositions into invocations and combine them with legacy records. | Deliberate and proactive skill use can disappear; overlapping signals can also count the same use more than once. A suggestion is not a skill-run identity. |
| Default report uses another denominator and another clock | `scripts/skill-metrics.mjs:296` uses installed suggestions and a five-minute proximity test. Disposition serialization records reconciliation time in `ts`; default metrics use that as invocation time. | Reported follow-through and sequencing can change with reconciliation timing rather than behavior. |
| Trigger-precision mode does not apply date bounds | `scripts/skill-metrics.mjs:843` reads both entire files and passes them directly to the calculator. | The requested 30-day window is not honored in that mode. Its output cannot be presented as a comparable 30-day rate. |
| Live capture executes from a mutable checkout | `decisions/loops/loops.md`, `hook-reconcile-skill-acted`, documents dependence on the checkout and built `dist/tracking`. | A branch change or stale build can change the observer independently of an intentional rollout. |
| Following the prescribed emission step does not guarantee a classifiable action | This session emitted `skill:acted` for `skill-loader` with this report as evidence. The current validator returned `indeterminate: no expected_artifact spec for skill 'skill-loader'`. | Evidence-contract coverage must be reported alongside collector coverage; a successful write is not validated application. |
| Historical fixes already established useful contracts | [PR 154](https://github.com/ojfbot/core/pull/154), [ADR 0095](../decisions/adr/0095-skill-action-instrumentation.md), [PR 209](https://github.com/ojfbot/core/pull/209), [PR 215](https://github.com/ojfbot/core/pull/215), [ADR 0098](../decisions/adr/0098-two-track-skill-telemetry.md), and the July 17 hardening brief. | Reuse suggestion identity, evidence validation, shadow operation, and separate authoring observations. Do not create another competing definition of skill use. |

The private native-source mapping for `codex-missed-skill-load` remains with the operator. Earlier attempts included a missing `.Codex/skills` path and a truncated output; those are not the successful-load evidence. Reproduction fixtures must follow the design's minimum redaction rule before publication.

### Measured snapshot

Ran the existing calculator with `pnpm exec node scripts/skill-metrics.mjs --since=2026-09-03T00:00:00-05:00 --until=2026-10-03T00:00:00-05:00 --format=json`. This is the 30-day interval beginning September 3 and ending after October 2 in Chicago. The sources were live at inspection, so these are point-in-time counts, not an immutable raw-data export.

| View | Observed values | Interpretation limit |
| --- | --- | --- |
| Default calculator | 9 invocation-shaped records; 236 lifetime skill-event records; 402 suggestion-stream events in the interval | These are neither nine independently verified skill applications nor a census of all sessions. |
| Default follow-through calculation | 45 suggestions; 3 proximity matches; 145 ignored events; 115 no-match events | Different populations and event counts. The displayed 6.7% is not a defensible all-session acceptance or application rate. |
| Diagnostic exact-ID join, both populations | 119 unique suggestions: 45 installed and 74 uninstalled; 71 have dispositions and 48 are unresolved | Join coverage is 71/119. It is not capture completeness. |
| Dispositions in that joined cohort | 66 ignored; 5 engaged_no_act; 0 acted | These are stored classifications. The false ignored event reproduced here means they cannot establish actual behavior without coverage qualification. |
| Trigger-precision invocation with the same bounds | 836 lifetime joinable fires; 82 honest follows; 8 authoring exclusions; 51 unresolved | The mode ignores those bounds. Label this as lifetime output, not a 30-day result. |

The diagnostic join selected `skill:suggested` and `skill:suggested-uninstalled` by suggestion timestamp, deduplicated by nonempty suggestion ID, then joined the disposition ledger by that ID. It is a diagnostic comparison, not a replacement adoption calculator. No acceptance percentage is inferred from it.

The absence of `~/selfco/tracking/loop-health.jsonl` was observed. Absence alone proves neither a healthy reconciler nor a failure. The legacy skill ledger has recent events, despite comments describing it as frozen; it should not be treated as permanently inactive without a source-status check.

### Prior work and ownership

[ADR 0068](../decisions/adr/0068-follow-skill-suggestions.md) contains a correction withdrawing the historical 0.8% figure as invalid provenance. The copied user instructions still repeat that number. The new design must not use it as a validated baseline or assume that historical low counts establish agent noncompliance.

[PR 209](https://github.com/ojfbot/core/pull/209) landed the disposition ledger as the primary skill-use source. The [July 17 brief](../.handoff/20260717-1756-brief-skill-telemetry-loop-hardening.md) already identifies capture-path, writer, build, population, and reliability problems. The proposed extension follows that work; it does not claim these concerns are new.

[Fleet-runner issue 307](https://github.com/ojfbot/core/issues/307), [merged placement PR 497](https://github.com/ojfbot/core/pull/497), and [merged publication-hold PR 498](https://github.com/ojfbot/core/pull/498) establish the current umbrella. Fleet-runner belongs in core, intended at `packages/fleet-runner`, with independent deployment. Its inherited obligations already include loop census, output consumption, contradictory measurements, and independent supervision. Runtime, store, host, and remaining execution policies remain open.

This extension supplies bounded evidence to existing decisions #315, #310, #311, #316, #317, and #318. It does not close those tickets, duplicate their tracker, or delay the governed execution pilot by silently broadening its acceptance criteria. Existing `rm-l1-core` and `rm-l2-ojfbot` skill slices must be reconciled before registering implementation work.

## Cause map

Observed counts cannot distinguish skill non-use from missing observation.

- Confirmed capture cause: Codex suggestions are registered without the corresponding fleet tool logger and reconciler; the live session demonstrates the resulting false ignored event.
- Confirmed interpretation cause: detection predicates encode particular Claude tool shapes, and absence of engagement is classified as ignored without a coverage check.
- Confirmed persistence cause: normal projection persistence freezes the first terminal row for a suggestion, even when evidence arrives later.
- Confirmed reporting cause: consumers use different populations, timestamps, and heuristics; deliberate use without suggestions has no complete representation in the primary usage source.
- High-confidence structural diagnosis: the system has a suggestion/action contract but no end-to-end, provider-qualified observation contract covering source completeness, delivery, independent skill runs, revision, and consumer consistency.

This evidence does not establish that every historical ignored classification is false or that agents always apply loaded skills. Loading a skill and executing its workflow are different facts.

## Candidate fixes

1. High confidence, bounded first slice: qualify session capture and the observation-to-receipt boundary in Claude and Codex, including deliberate invocation. This repairs the demonstrated blind spot; adapter compatibility and transcript privacy are the principal risks.
2. High confidence, moderate scope: make negative classifications coverage-dependent and projections revisable. This repairs premature/sticky ignored results; preserve historical facts and consumer compatibility during migration.
3. High confidence, cross-repo scope: move reporting consumers to one versioned snapshot contract. This repairs contradictory cohorts and timestamps; prove parity before retiring legacy paths.

The detailed [fleet-runner extension design](../decisions/fleet-runner/skill-observation.md) specifies ownership, records, recovery, reporting, proposed slices, and acceptance experiments. The operator subsequently confirmed its all-session, evidence-preserving, observation-only boundary and directed that the design be recorded. Detailed contracts remain proposed; runtime implementation remains unperformed.

## Verification experiments

Completed against current source and built projector:

- An isolated fixture recognizes a Claude `Read` of `SKILL.md` but not Codex `exec_command` or a Claude `Bash` `cat` of the same file.
- A pure classifier fixture with no engagement and `withinWindow: true` returns `ignored`.
- A temporary projection first stores ignored, then receives acted evidence for the same suggestion. The second persistence writes zero rows and leaves ignored stored. The temporary directory was removed; live telemetry was not rebuilt.
- `pnpm exec vitest run scripts/hooks/__tests__/reconcile-skill-acted.test.mjs scripts/hooks/__tests__/log-tool-use-skill-field.test.mjs`: 37 tests passed across two files. An initial invocation under Node's test runner failed because these are Vitest tests; the corrected invocation above passed. This is a test-runner correction, not a product failure.

Required before implementation acceptance:

| Experiment | Required observable result |
| --- | --- |
| Same workflow in Claude and Codex | Equivalent facts and projections with source provenance preserved |
| Explicit use without suggestion | One run counted; zero invented suggestions |
| Failed read, definition audit, authoring, loaded-but-unused | No false application credit |
| Decline, deferral, interrupted session, missing collector | Distinct response and coverage outcomes |
| Late/out-of-order events and repeated delivery | Corrected projection; no double-counting |
| Repeated same-skill suggestions, child sessions, same-name plugins | No cross-session or cross-package attribution |
| Missing, old, mismatched, or forged evidence | Invalid or indeterminate application, never automatic credit |
| Collector failure and healthy-empty session | Distinct health states, independently detected |
| Two reports over one pinned snapshot | Identical populations, counts, event-time interval, and exclusions |
| Offline buffering and recovery | Evidence survives interruption within an explicitly accepted loss/recovery policy |

## Skill workflow receipt

`/skill-loader` inspected catalog version 1.24 and actual installation paths. Keep `/investigate`, `/skill-metrics`, and `/grill-with-docs` for this task. They are available under both core `.agents/skills` and `.claude/skills`; the documented core `.Codex/skills` path is absent. No installation or removal is needed. No removal is recommended merely because other skills are irrelevant to this task.

`/investigate` supplied the symptom, evidence, cause map, ranked fixes, and experiments in this report. `/skill-metrics` ran the existing calculators; its results are qualified above instead of presented as validated adoption. `/grill-with-docs` obtained the all-session ownership answer and proposed the design boundary; its design boundary was subsequently confirmed, so the unknowns ledger and design records carry that decision. Pages writing guidance was used for this repository report, and `/unslop` was applied to the prose.

`/plan-feature` supplied the proposed design and test matrix. `/spec-review` is recorded in the [companion author review](../decisions/fleet-runner/skill-observation-review.md); no independent peer review is claimed. The ADR workflow supplied a uniquely named proposed architecture record. No skill application, accepted architecture, completed slice, or provider coverage is claimed solely because a file was read or this report exists.

The suggested skill-loader action was emitted in shadow mode with this report as evidence and verified present in the existing OPAV ledger. Validation remains indeterminate because its expected-artifact contract is absent. The other skills used here are recorded in this receipt; no suggestion IDs were invented to force them into the suggestion-scoped emitter.

## Follow-up evidence for structured reporting

Publication follow-up: `/gated-slice` supplied the [delivery handoff](../decisions/fleet-runner/skill-observation-delivery.md). `/pr-review` subsequently supplied separate author-session Standards and Spec agent reviews. Their scope and the external review are linked from the [verification notes](../decisions/fleet-runner/skill-observation-review.md). These are workflow-use claims with linked outputs, not OPAV-validated application receipts or proof that the proposed telemetry runtime exists.

The operator clarified that PR and issue comments are required reporting surfaces and directed application of structured-correspondence lessons. Inspection of `scripts/hooks/bead-session.sh:238` found a further confirmed publication defect: `gh pr comment` errors are suppressed with `|| true`, after which the hook unconditionally appends `skill:pr-commented`. The recorded event therefore does not establish delivery. This was a source-path inspection, not a deliberately failed live publication experiment.

The new [correspondence profile](../decisions/fleet-runner/skill-observation-correspondence.md) requires separate publication intent, remote readback receipt, and consumption receipt. It draws from core PR #495, still OPEN and draft at `62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb`, and the accepted fleet-runner publication hold. No GitHub comment was posted during this design extension.

The skill-create suggestion in this follow-up was explicitly declined as a scope mismatch. This is architecture work, not creation of a skill. The profile preserves that as a proposed decline fixture under an opaque local reference; no skill-create action or live typed disposition is claimed.
