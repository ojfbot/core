# DIA Cross-Check — external SOTA survey vs the audit program — 2026-07-08

Cycle 4 of the 2026-07-04 audit series. Cycle 1 (`MULTIAGENT-SDLC-AUDIT-…`) found the gaps;
cycle 2 (`AGENTIC-INTEGRATION-PLAN-…`) mapped industry eval/observability consensus onto them;
cycle 3 (`FLEET-COORDINATION-EXTENSIONS-…`) asked Karpathy/Yegge/Pocock. This cycle reconciles
an **independent external survey** (operator-commissioned "DIA" research, delivered 2026-07-08:
SOTA self-improvement patterns + multi-agent orchestration/coordination) against cycles 2–3 —
a cheap convergence test: does an outside sweep, run without access to this repo, land on the
same program? Slice: `rm:rm-l2-ojfbot#S27`.

---

## 1. What the survey confirms (the convergent bulk)

The survey's center of mass restates cycles 2–3, independently:

| DIA survey claim | Already in the program as |
|---|---|
| "Eval-first, harness-as-code, all under CI" is SOTA self-improvement | Cycle 2 §1 consensus #1–#5; S16–S19 delivered |
| Meta-agents propose config-as-code changes; CI tests; human promotes | I3/opportunity B → S26 triager (proposal-only) |
| Continuous evals from live incidents/edge cases | S18 outcome capture + golden-candidate filer |
| "Fully autonomous self-improving agents aren't a thing; narrow loops + tests + HITL" | ADR-0086 discipline; OPAV S5 firebreak; gate-0 posture |
| Hierarchical decomposition, shared task graph/backlog, humans as PM | roadmap → compile → queue beads → day-runner; /orchestrate |
| Deterministic task ownership, single owner, explicit state machine | CAS queue-claim; slice lifecycle queued→…→merged |
| Token/time budgets per task | day-runner --timeout-mins; F6 (deferred, tranche 4) |
| Worktree/sandbox isolation per agent, coordination at PR level | day-runner worktrees outside ~/ojfbot; PR-only main |
| LLM-as-judge needs calibration; verifier at every step | S20 (calibrate ONE judge first); cycle 2 consensus #4 |
| Checkpoints/rollback for agent workflows | F2 (deferred); bead re-anchoring doctrine |
| Runtime guardrails, allowlists, prompt-injection modeling | F10.6 consent allowlists; hardening skill; deny rules |

Verdict on the bulk: **convergent — no action.** The survey validates the program's shape from
outside; where it names tools (LangGraph, vibe-kanban, agentbox…), cycle 3 §2's do-not-import
reasoning stands unchanged.

## 2. The four genuine deltas, adjudicated

Each delta is something the survey carries that cycles 2–3 did not fold in. Format: the claim,
the adjudication, and a grep-able verdict line. Operator sign-off = merge of this PR.

### 2a. SIA-style harness + weights co-evolution

The survey's headline (SIA, arXiv 2605.27276): a feedback agent that rewrites the harness AND
triggers test-time training / small weight updates on a domain model, outperforming
scaffold-only iteration on narrow benchmarks.

The harness half is already this program: S26 is the feedback agent, config-as-code, PR-gated.
The weights half contradicts cycle 2's explicit stance ("nothing here needs weights") — and
that stance was not arbitrary: weight updates need a trustworthy metric to train against, and
the program's whole current posture is that no such metric exists yet (S20 uncalibrated, C3
capture unverified, AR0 unpublished). The one live candidate for weights in this cluster is the
bldgblog/deposit-library fine-tune thread (Opus=teacher/Haiku=volume), which is already HELD by
the operator and is a *content* model, not a harness component.

VERDICT: REJECT-for-now (weights half) — the harness half is S26 and is already in tranche 3;
revisit weights only behind the same entrance criterion as GEPA-class optimization: one judge
calibrated and holding for a month (S20), plus a task where a small domain model demonstrably
beats prompt-level fixes. The bldgblog fine-tune HOLD is unaffected and stays a content
decision, not a harness one.

### 2b. Test-time-compute allocation as the self-improving policy

The survey: treat search/sampling budget as the controllable lever (LATS, repeated sampling,
"the self that improves is the policy for allocating inference compute").

The program has no cost/latency telemetry at all — audit finding T8; `gen_ai.usage.*` fields
specified in I1 but only partially stamped. A compute-allocation policy without cost
measurement is Goodhart bait: you cannot tune a lever you cannot read.

VERDICT: DEFER — entrance criterion is T8 closed (cost_usd + duration on dispatched-task
telemetry, one month of data). Then the first application is day-runner retry/timeout budgets
(F2's bounded-retry design), not model-level search policies.

### 2c. Consensus / voting for high-impact actions

The survey: N independent proposers/checkers + a vote gates critical operations (BFT-flavored;
2–3 independent reviewers before committing).

The cluster's high-impact actions are already human-gated (gate-0: nothing merges itself), so
voting would today duplicate the operator. The real future site is F4/F8: fresh-context
reviewer sessions (implementation and review in separate contexts, reviewer on the stronger
model) and non-author stamps — that IS a 2-reviewer quorum in embryo, and cycle 3 already
scheduled it for >~5 concurrent agents when the serial human merge gate becomes the cliff.

VERDICT: DEFER into F4/F8 — adopt as "non-author stamp + fresh-context reviewer = minimum
quorum of 2" when concurrency crosses ~5 agents; no new machinery before the cliff is visible
(cycle 3 §1 F4's own rule).

### 2d. CLHF — continuously-retrained evaluator models

The survey (Galileo-style): small eval models continuously retrained from live incidents,
feeding back into harness checks and verifier models.

This is the opposite bet from the program's: S20 calibrates ONE static judge against operator
labels, freezes a regression set, re-validates monthly and on model upgrades. Cycle 2
consensus #4 ("a judge is a product needing its own eval") and the anti-Goodhart contract
(frozen holdouts, §4.2) exist precisely because continuously-moving evaluators are how judge
drift and reward hacking get industrialized. The valuable kernel — evaluators learn from live
incidents — is already captured structurally: S18 outcomes and S26 proposals grow the *golden
suites* (the judge's data), not the judge itself.

VERDICT: REJECT — keep the calibrate-one-static-judge posture (S20) with scheduled
re-validation; incident learning flows into golden suites via S18/S26, never into silent
evaluator retraining.

## 3. Ordering impact

None. The two DEFERs land behind existing entrance criteria (T8; the >5-agent cliff), the
harness half of 2a is already S26, and 2d reaffirms S20 as cut. Tranche 3 (PH5, S22–S27)
proceeds unchanged.

## Appendix — source note

The DIA survey (operator-supplied, 2026-07-08) cites: SIA (arXiv 2605.27276), Stanford CS329A,
Galileo multi-agent coordination posts, Addy Osmani "Code Agent Orchestra", the MAS failure
survey (arXiv 2502.14743), awesome-agent-orchestrators, r/AI_Agents threads. Claims here are
adjudicated against the cycle-2/3 evidence base; the survey's own fetch provenance was not
independently re-verified (its role in this doc is hypothesis generator, not evidence).
