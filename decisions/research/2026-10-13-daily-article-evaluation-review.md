# Historical article evaluation adversarial review

Date: 2026-10-13 America/Chicago. Anchor: `ns:l2-ojfbot#P2`. Status: Proposed research and proof contracts.

## Spec review verdict

**PASS WITH NOTES for a bounded, advisory historical pilot.** The discussion design preserves the right distinctions, but its integration contracts and qualification evidence are not yet complete. No demonstrated critical contradiction was found in the design. The twelve significant gaps below need explicit contracts or proof before their associated capability is claimed. This review does not establish fleet runtime readiness.

The operator requested an iterative operation comparing articles with both the inputs actually supplied to each model stage and the relevant historical ojfbot state. The operator then added generated-to-accepted editorial history, including agent-submitted changes after discussion and explicit human review. Acceptance is recorded separately from correctness. This review challenges the implementation approach while retaining that intent.

The lead and three fresh-context review sessions inspected the same discussion design. All reviewers inherited the parent model; exact hosted model and effort were not independently verified. Shared source corrections were supplied before final reports. Agreement is a coverage signal, not model diversity or independent runtime evidence. Method: source inspection, tracker readback, primary-literature review and architectural counterexamples. No proposed attack, model trial, recovery test, collector or mitigation was executed.

Sources are pinned to core `4794ec91f388759ea58d3d084f8c485b8029890a` and daily-logger `13ea71c598e60bfed4013592390372d2ec9808de`. Issue states are observations from the review, not permanent facts. The local daily-logger checkout was behind and contained unrelated changes, so it was not treated as current main.

## What the design gets right

- Historical accuracy and input faithfulness are separate findings. Missing original inputs prevent causal attribution even when historical evidence establishes an error.
- Evidence fidelity is field-specific. Unknown and unevaluated states remain visible.
- Generated, revised and accepted versions, feedback, requests and decisions retain their own identities.
- Replay consumes recorded evidence and responses; fresh model runs remain stochastic.
- Human review includes apparent passes, and the existing deterministic, real-failure golden suite remains a distinct lane.

These choices survive the adversarial review. Preserve them through implementation.

## Current architecture and corrected premises

[ADR-0108](https://github.com/ojfbot/core/blob/4794ec91f388759ea58d3d084f8c485b8029890a/decisions/adr/0108-fleet-runner-in-core.md) places fleet-runner in core, intended at `packages/fleet-runner`, with independent deployment. Runtime, database, host and operative grants remain open. [ADR-0109](https://github.com/ojfbot/core/blob/4794ec91f388759ea58d3d084f8c485b8029890a/decisions/adr/0109-fleet-runner-publication-hold.md) accepts an affected-item hold while earlier publication effects remain unknown. A local timeout cannot release that hold.

The [canonical map](https://github.com/ojfbot/core/blob/4794ec91f388759ea58d3d084f8c485b8029890a/decisions/wayfinder/control-plane-conductor.md) and [L2 roadmap](https://github.com/ojfbot/core/blob/4794ec91f388759ea58d3d084f8c485b8029890a/decisions/northstar/roadmap-l2-ojfbot.md) already register attributed maintenance calibration and independent article review. Core [#510](https://github.com/ojfbot/core/issues/510) owns the observability/evaluation trade study. [Its prior calibration contribution](https://github.com/ojfbot/core/issues/510#issuecomment-6099236413) explicitly folded a separate judge question into that work. The [October 13 skill-telemetry assessment](https://github.com/ojfbot/core/issues/510#issuecomment-6158556873) is related input, rather than another measurement program to duplicate.

S20 remains queued, human_only, gate-0: 30–50 operator-labeled historical articles, at least 90% held-out judge agreement, and ten frozen regression examples. The gaps below propose supplementary measures and a concrete case substrate. They neither replace that calibration effort nor amend its criteria. S19 remains the real-failure deterministic regression lane. S21 trace identity and S25's operating-mode/live-proof criteria retain their existing meanings.

Daily-logger [#357](https://github.com/ojfbot/daily-logger/issues/357) already owns the article-page review discovery, UI-to-machine-to-durable-source pilot, stale findings and request-changes path. The [independent review method](https://github.com/ojfbot/daily-logger/blob/13ea71c598e60bfed4013592390372d2ec9808de/docs/article-review.md) is Proposed. A declared scheduled task or merged documentation does not prove runs, Mac-sleep availability or delivered review consumption.

Current [`src/pr-body.ts`](https://github.com/ojfbot/daily-logger/blob/13ea71c598e60bfed4013592390372d2ec9808de/src/pr-body.ts) already has a 6,000-character per-body policy and a 24,000 rendered-character aggregate allocation. #342 was still open when inspected. The former missing-global-budget diagnosis is stale; the open issue is not evidence of absent implementation. Character budgets do not establish exact token limits or measured model benefit.

The [October 13 article](https://github.com/ojfbot/daily-logger/blob/13ea71c598e60bfed4013592390372d2ec9808de/_articles/2026-10-13.md) records a real model-attribution disagreement: requested Opus, a workflow summary hard-coding Sonnet, and no inspected provider-returned model identity. The executed revision model is marked unverified. This is a case for source-versus-execution attribution, not a basis for choosing either model label.

## Significant gaps and mitigation hypotheses

The IDs are local review references, not new fleet work identities. Each has a complete, copyable subagent prompt in [the structured task packet](2026-10-13-daily-article-evaluation-tasks.json). Tasks include inputs, scope, comparator, deliverables, acceptance, falsifier, dependencies and receiving work. Later invocation must preserve the recorded entrance and grants. Each caller supplies the original discussion design and immutable prerequisite deliverable/evidence references; task IDs alone do not establish completed inputs. Disposable proofs write scratch artifacts only, with repository/runtime edits, queue mutations and operational receipt creation excluded.

### G01 Bind the audit workload to existing fleet ownership

**Gap.** The CLI/case design has no explicit boundary between artifact-local state and authoritative admission, attempt, publication and settlement transitions.

**Hypothesis.** A small workload adapter can expose case/run/finding artifacts through existing identities and receipts without adding another scheduler, queue or transition authority.

**Smallest discriminating proof.** Compare a standalone queue design with a pure artifact-producing workload. Crosswalk every operation and identity to an existing owner; leave absent contracts explicit.

**Reject the hypothesis if:** A required transition depends on a second authority, undocumented grant, or invented runtime.

**Receiving work:** [core #307](https://github.com/ojfbot/core/issues/307), [core #510](https://github.com/ojfbot/core/issues/510), [core #505](https://github.com/ojfbot/core/issues/505). **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G02 Establish temporal evidence and source coverage

**Gap.** A frozen capped or failed source sweep can supply both the article and its supposed omission oracle. Source statements and byte identity also do not prove implementation, test execution or historical branch visibility.

**Hypothesis.** A bounded independently enumerated source inventory with per-field validity, observation time and evidence strength can distinguish absent, inaccessible, truncated, reconstructed and unavailable history.

**Smallest discriminating proof.** Use one real reporting window. Compare original collection with independently paginated entity/event enumeration. Include a later PR edit, reopened issue, beyond-page item, missing endpoint and predated commit merged later. Require CI receipts for claims that tests ran.

**Reject the hypothesis if:** A planted unseen event disappears from both denominators or later knowledge is used to condemn the original article.

**Receiving work:** [core #310](https://github.com/ojfbot/core/issues/310), [core #311](https://github.com/ojfbot/core/issues/311), [daily-logger #335](https://github.com/ojfbot/daily-logger/issues/335). **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G03 Recover editorial lineage and qualify authorship

**Gap.** Generated, revised and accepted bytes are not yet linked to exact discussion, requested changes, submitting actor, logical author, human authority and requested-versus-observed model evidence.

**Hypothesis.** An append-only revision and feedback graph can preserve both agent-submitted requests after discussion and direct human review without converting shared-account publication into human ground truth.

**Smallest discriminating proof.** Recover October 12 and 13 candidate chains, retaining the October 11 seed where useful. Require one direct human-review chain and one distinct agent-submitted request following discussion; missing class evidence keeps the pilot incomplete. Separate generate, discuss, request_changes, regenerate, revise, accept and publish. Include a missing discussion, agent-posted act, stale acceptance and the documented requested-Opus/hard-coded-Sonnet/unknown-response case.

**Reject the hypothesis if:** An agent submission becomes a human label, stale acceptance transfers to a successor, or a configured model is reported as observed.

**Receiving work:** [daily-logger #357](https://github.com/ojfbot/daily-logger/issues/357), [daily-logger #335](https://github.com/ojfbot/daily-logger/issues/335), [core #511](https://github.com/ojfbot/core/issues/511), [core #512](https://github.com/ojfbot/core/issues/512). **Review support:** A, B. **Scope:** proposed follow-up, not a completed proof.

### G04 Localize retrieval, packing and interpretation failures

**Gap.** Recording calls does not explain whether a consequential qualification was never collected, missed during selection, removed in packing or misinterpreted despite sufficient evidence.

**Hypothesis.** Stage-specific evidence records and normal-versus-oracle evidence ablations can localize failures with less complexity than adopting an unmeasured RAG stack.

**Smallest discriminating proof.** Compare exact repository-qualified lookup plus frozen lexical search/full-evidence baseline with the current pipeline. Record queries, time/access filters, candidates, ranking if used, selected/rejected IDs, packed spans and claim entailment. Introduce hybrid retrieval or reranking only as a measured challenger.

**Reject the hypothesis if:** Packing loss is labeled hallucination, a citation is accepted without entailment, or oracle evidence fails to support the claimed diagnosis.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [daily-logger #342](https://github.com/ojfbot/daily-logger/issues/342). **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G05 Qualify the evaluator against human evidence

**Gap.** Article-level agreement can hide severe missed claims, extractor omissions, class imbalance, judge self-preference and confident but unsupported human or agent labels.

**Hypothesis.** Frozen evidence-backed labels, sampled passes, extraction audits and category/severity confusion measures expose blind spots hidden by aggregate agreement.

**Smallest discriminating proof.** Preserve S20's queued human_only gate-0 contract: 30–50 operator-labeled articles, >=90% held-out agreement and ten frozen regression examples. Propose supplemental per-claim, severe-miss, abstention, disagreement and uncertainty measures for owner review. Blind model identity and randomize comparison order where relevant. Compare independent family judges when feasible without treating diversity as proof.

**Reject the hypothesis if:** Overall agreement improves while audited severe misses or omitted-claim rates worsen without detection.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [core #512](https://github.com/ojfbot/core/issues/512), `rm:rm-l2-ojfbot#S20`. **Review support:** A, C; lead refinement. **Scope:** proposed follow-up, not a completed proof.

### G06 Prevent lineage and optimization leakage

**Gap.** A held-out article can leak its answer through later corrections, neighboring articles, shared source events, review issues, retriever indexes or examples added to skills.

**Hypothesis.** Grouping whole editorial/causal families and recording every permitted exposure can preserve a meaningful final holdout during iterative improvement.

**Smallest discriminating proof.** Compare naive article splits with lineage/incident-grouped splits. Try retrieving held-out corrections via every optimizer input. Separate real incidents, representative dates and synthetic challenges. Keep final labels sealed; consuming them retires that final evaluation set from future tuning claims.

**Reject the hypothesis if:** A sibling correction or leaked rubric supplies the held-out answer while the experiment is still reported clean.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [core #313](https://github.com/ojfbot/core/issues/313), `rm:rm-l2-ojfbot#S20`. **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G07 Make prompt and skill improvements attributable

**Gap.** A system-prompt hash omits dynamically loaded skill references, tool schemas, packing policy and effective per-stage inputs. Simultaneously changing generator and judge obscures the cause of improvement.

**Hypothesis.** A versioned effective-instruction manifest and single-component paired changes can distinguish transferable improvements from memorization or evaluator co-adaptation.

**Smallest discriminating proof.** After S20 qualification, compare one reviewed manual patch with an unchanged baseline; consider reflective optimization only as a bounded challenger. Pin transitive skill resources, tool schemas, model requested/observed/unknown state, extraction/judge versions and full observable stage inputs. Use family-separated cohorts and multiple trials, without claiming a seed makes hosted models deterministic.

**Reject the hypothesis if:** A hidden instruction dependency changes or apparent gains vanish on independent missed-claim and held-out review.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [core #313](https://github.com/ojfbot/core/issues/313), `rm:rm-l2-ojfbot#S20`. **Review support:** A; lead refinement. **Scope:** proposed follow-up, not a completed proof.

### G08 Prove evidence trust and disclosure boundaries

**Gap.** Archiving exact discussions and tool output does not define who may read/export them, while retrieved instructions can spoof authority, suppress evidence or cause disclosure.

**Hypothesis.** Read-only source capabilities, separately permissioned raw archives and derived export views can retain useful evidence while preventing prohibited effects and disclosure.

**Smallest discriminating proof.** Define sources, access scope, retention/deletion and export allowlists before hosted trials. Use clean controls plus synthetic canaries, forged rulings, instruction-bearing PR bodies, sensitive URLs, errors and rendered HTML. Inspect outbound payloads and remote readback as well as the report.

**Reject the hypothesis if:** A source instruction changes authority or a forbidden value reaches a provider, public report, log, exception or fetch destination.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [core #313](https://github.com/ojfbot/core/issues/313), [core #511](https://github.com/ojfbot/core/issues/511), [daily-logger #335](https://github.com/ojfbot/daily-logger/issues/335). **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G09 Measure missing telemetry independently

**Gap.** A trace and its replay can agree perfectly after losing an entire attempt. The plan lacks a bounded external expected-event population and provider/capture qualification matrix.

**Hypothesis.** An independent attempt/admission oracle reconciled with durable boundary receipts can expose missing, duplicate, reordered and late capture without treating spans as truth.

**Smallest discriminating proof.** Compare strengthened existing local evidence with backend candidates separately by provider, interactive/headless mode and parent/child surface. Include disabled capture, pre-first-span crash, exporter outage, retry exhaustion, storage saturation, duplicate and late events. Pin the chosen GenAI convention version and compatibility mapping. Externally started and projectless sessions need a separate independent inventory where in scope, or explicit exclusion; runner admission counts cannot establish all-session coverage.

**Reject the hypothesis if:** A missing attempt produces a clean complete receipt or an exporter/backend's own counters are the only completeness oracle.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [core #310](https://github.com/ojfbot/core/issues/310), [core #318](https://github.com/ojfbot/core/issues/318). **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G10 Separate replay, recovery and uncertain publication

**Gap.** A reproducible report hash does not prove a live task ran correctly, an interrupted provider call was not charged, or an external publication is safe to retry.

**Hypothesis.** Explicit operation states, atomically committed event cuts and uncertainty-specific reconciliation can make resume safe within its declared scope.

**Smallest discriminating proof.** Specify ready, in-flight, completed, uncertain, budget-exhausted and failed states. Inject crashes around request/response persistence and final manifests; simulate a lost publication response. Pin the exact review-event snapshot and serializer/rendering version. Give fresh trials and rescoring separate identities.

**Reject the hypothesis if:** A clean report hides a lost response, resume silently resets spend, or stale writes compete after timeout.

**Receiving work:** [core #310](https://github.com/ojfbot/core/issues/310), [core #311](https://github.com/ojfbot/core/issues/311), [core #318](https://github.com/ojfbot/core/issues/318), [core #530](https://github.com/ojfbot/core/issues/530). **Review support:** B, C. **Scope:** proposed follow-up, not a completed proof.

### G11 Prove review consumption and source-work disposition

**Gap.** Producing or viewing a report does not prove a finding was used, a correction was delivered, or the original suggestion was resolved.

**Hypothesis.** The existing article review surface and work identities can carry finding-level acceptance, partial response, rejection and verified correction readback without adding a new review queue.

**Smallest discriminating proof.** Walk one generated-to-accepted chain through the #357 UI and machine-consumer boundary. Bind selected feedback to exact finding/article revisions and resulting diff. Include stale findings, independent rejection, declined suggestions, partial fixes, readback failure and agent-submitted request_changes.

**Reject the hypothesis if:** Report production is counted as consumption or a submitted request/PR is counted as a verified delivered correction.

**Receiving work:** [daily-logger #357](https://github.com/ojfbot/daily-logger/issues/357), [core #316](https://github.com/ojfbot/core/issues/316), [core #505](https://github.com/ojfbot/core/issues/505). **Review support:** A, B, C. **Scope:** proposed follow-up, not a completed proof.

### G12 Bound learning claims and operational burden

**Gap.** Surviving incident articles, completed reviews and accepted drafts form a biased sample. Missing dates, failed generations, unreviewed findings and audit-generated activity can disappear or inflate apparent fleet progress.

**Hypothesis.** Separate population ledgers and cohorts, plus total verified-completion cost and provenance-aware loop reconciliation, can keep the operation useful without self-amplifying workload.

**Smallest discriminating proof.** Enumerate expected dates/runs and dispositions including rest/skipped/missing/failed cases. Stratify representative dates across generator eras and activity sizes separately from incidents/synthetic probes. Track extraction/retrieval/judge/human effort, rework, latency and unknown billing. Trace audit-generated artifacts entering later articles; propose suppression or eligibility changes only through existing owners.

**Reject the hypothesis if:** The reported gain is explained by shorter articles, easier surviving cases, increased abstention, hidden human work or repeated audit-generated events.

**Receiving work:** [core #510](https://github.com/ojfbot/core/issues/510), [core #514](https://github.com/ojfbot/core/issues/514), [core #315](https://github.com/ojfbot/core/issues/315), [core #317](https://github.com/ojfbot/core/issues/317). **Review support:** Lead extension. **Scope:** proposed follow-up, not a completed proof.

## Lead disposition and agreement map

Act on five groups before claiming the corresponding capability:

1. **Ownership and editorial authority:** G01, G03 and G11. All reviewers found the need for an existing-work crosswalk and a real consumer. A/B emphasized shared-account authority; B supplied the current model-attribution counterexample.
2. **Historical coverage and RAG diagnosis:** G02 and G04. All reviewers found that two inventories can share the same blind spot, and that citations or trace IDs cannot isolate collection, selection, packing and interpretation.
3. **Evaluation validity and learning:** G05, G06 and G07. All reviewers raised lineage leakage. A/C and the lead refined the prevalence, extractor, severe-miss and effective-instruction risks. These are supplementary research requirements, not silent changes to S20.
4. **Trust, capture and recovery:** G08, G09 and G10. All reviewers found an undefined disclosure/capability boundary and missing independent capture oracle. B/C emphasized ambiguous external effects and the difference between report replay and live recovery.
5. **Population and usefulness:** G12 is the lead's extension. Missing days, incomplete reviews, human effort and self-generated activity affect what the measurements can mean. This is a hypothesis requiring the same evidence discipline as reviewer-raised gaps.

**Consider after the baseline:** hybrid retrieval, reranking, hosted evaluation backends and reflective prompt optimization. Each needs a named failure it addresses and a comparator against the strengthened incumbent. Vendor capability, larger context, or a larger council cannot substitute for that comparison.

**Noted:** old descriptions, deleted comments and expired logs may be unrecoverable. Record irreducible historical uncertainty and narrow conclusions. Do not make recovery of all past context an entrance for one useful case.

**Dismissed:** identical fresh model output as a determinism requirement; mandatory vector storage; consensus as truth; a separate scheduler or judge program; waiting for every fleet policy decision before any advisory offline case; treating every missing datum as an observed hallucination. Synthetic qualification probes are useful, but belong to a clearly named challenge cohort and do not become invented “real failure” golden tasks.

## Current practices to evaluate rather than copy wholesale

The following sources support research methods, not claims that this fleet already implements or benefits from them.

- [RAGChecker (2024)](https://arxiv.org/abs/2408.08067) separates retrieval and generation diagnostics. Apply that idea to the observable GitHub evidence path, including qualification loss during packing.
- [ARES](https://arxiv.org/abs/2311.09476) uses human annotations to correct automated evaluation error. [LLM-as-a-judge research](https://arxiv.org/abs/2306.05685) documents position, verbosity and self-enhancement biases. Evaluate judges and extraction against qualified human evidence, including false negatives.
- [ALCE](https://arxiv.org/abs/2305.14627) distinguishes correctness and citation quality. A relevant link is insufficient: the cited passage must support the particular claim, and consequential claims need coverage.
- [Anthropic's agent-evaluation guidance (January 2026)](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) distinguishes trials, graders, transcripts and actual environment outcomes. Combine deterministic checks, model recommendations and human validation; separately inspect trajectories and resulting state.
- [GEPA (2025)](https://arxiv.org/abs/2507.19457) makes reflective prompt improvement a candidate approach. An [October 8, 2026 preprint](https://arxiv.org/abs/2610.12601) specifically studies topic-disjoint evaluation, multiple seeds and verifier ablations. Treat the newer result as a research lead without independent fleet replication. Compare a reviewed manual patch first.
- [OWASP's prompt-injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) makes untrusted retrieved content a capability-boundary concern. RAG and quotation delimiters do not establish confinement.
- [OpenTelemetry Collector resilience](https://opentelemetry.io/docs/collector/resiliency/) identifies concrete loss paths. The [current GenAI convention home](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/README.md) is marked Development. Pin a convention/adapter version, qualify capture surfaces and reconcile against an independent expected-event ledger.

Use the fleet's existing RAG work as inspectable prior art, including dive-briefing and buddy-check, after checking actual current code and domain differences. Do not import their corpus authority policy or assume a documented component is delivered.

## Sequencing and delivery priorities

This is a proposed receiving-work order under existing `ns:l2-ojfbot#P2`, not a new roadmap, queue, dispatch grant or native blocking graph.

1. **First evidence slice:** G01/G02/G03/G08 establish a bounded case and capability scope. Import the October 12 and 13 generated-to-accepted chains and retain October 11's original generated revision as a useful historical seed. A missing original prompt is an explicit unavailable field. Independently inspect one disputed claim and one apparent pass. Read back the final correction and preserve unresolved lineage.
2. **Repeatable diagnostic slice:** G04/G09/G10 add observable evidence boundaries, the independent capture oracle, an interruption/resume proof and network-free replay of a pinned report/review snapshot. A workload can be investigated manually without introducing another execution authority.
3. **Qualified measurement slice:** G12 supplies the sampling/population ledger. G06 establishes lineage, feedback and instruction isolation before G05 uses the existing S20 calibration effort. Keep incident, representative and synthetic cohorts separate, including unreviewed and failed cases.
4. **Consumed review slice:** G11 supplies retrospective cases and outcome records to #357. Human-adjudicated consumption proofs and that issue's live UI pilot need not wait for S20 judge qualification or the entire retrospective harness. Governed fleet publication still needs current authority, identity, receipt and recovery entrances.
5. **Measured improvement slice:** G07 compares one prompt or skill change with a fixed evaluator/evidence set and a rollback target after S20 qualification. Changed weights, automated promotion and scheduling are separate decisions.

Core #315/#317 retain census and overlap; #310/#311 durable evidence and portability; #313 authority, budgets and promotion; #316 consumption and original-work settlement; #318 supervision/recovery; #505/#513 correspondence/interface research; #511 identity; #512 epistemic vocabulary; #514 effectiveness measures. Proposed MC-UX and skill-observation contracts retain their current maturity. [ADR-0098](https://github.com/ojfbot/core/blob/4794ec91f388759ea58d3d084f8c485b8029890a/decisions/adr/0098-two-track-skill-telemetry.md) keeps skill use and evolution separate. [ADR-0104](https://github.com/ojfbot/core/blob/4794ec91f388759ea58d3d084f8c485b8029890a/decisions/adr/0104-defect-ledger-and-closure-loop.md) supplies the existing defect/disposition precedent. No new ADR serial or adopted schema is assigned by this packet.

## Tracking

Historical evidence and editorial-lineage receiving work: [daily-logger #358](https://github.com/ojfbot/daily-logger/issues/358). This feeds existing [core #510](https://github.com/ojfbot/core/issues/510) under [fleet-runner #307](https://github.com/ojfbot/core/issues/307), with [daily-logger #357](https://github.com/ojfbot/daily-logger/issues/357) as the article-page consumer. Research relationships and proposed task order do not create native blocking edges or move roadmap state.

## Verification and limits

The source and tracker inspection support the stated current boundaries and documented counterexamples. The review establishes proposed proof obligations, not measured mitigation effectiveness. The task JSON is a research artifact, explicitly not an adopted exchange-schema version. Static packet checks cover parseability, task identity/dependencies, complete prompt fields, source references and unchanged canonical-map/roadmap frontmatter. They cannot qualify a live collector, judge, security boundary, provider or fleet runtime.

The next implementation decision is the smallest evidence-import/inspection contract and its acceptance cases. Resolve the relevant gaps through the linked owners, then register bounded implementation through existing mechanisms.
