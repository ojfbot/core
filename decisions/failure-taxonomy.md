# Failure taxonomy — v1 (2026-07-06)

**Program:** audit-2026-07-04 · rm:rm-l2-ojfbot#S17 (integration plan § I3)
**Method:** first error-analysis ritual, run live with the operator 2026-07-06. 24 items sampled
across five sources (article pipeline, live Dolt bead store, oracle artifacts, cross-session
findings, CI/auth failures), open-coded item-by-item (operator confirmed/edited every code),
then clustered. Agent proposed, operator approved — per the I3 contract.
**Versioning:** this file is living and versioned by git. Each ritual appends a dated section and
bumps the version line; clusters are only added/renamed/merged in a ritual, never ad hoc.

## How to use this (triage rule)

Every audit finding, TECHDEBT entry, incident, and pipeline-alert issue gets ONE primary
`failure:` tag from the cluster list at triage time. If no cluster fits, tag `failure:unclassified`
and queue the item for the next ritual — a rising unclassified rate is the signal to re-cluster.
These tags are failure-CAUSE vocabulary; they are orthogonal to the S18 `outcome` enum
(accepted|edited|rejected|abandoned), which records human DISPOSITION of agent output. Do not
conflate them.

**Coverage metric (I3):** % of new failures assignable to an existing cluster. Target: the
new-cluster rate falls ritual over ritual. First measurement lands at ritual #2.

## Clusters

### 1. `failure:no-validation-gate`
Corrupted or invalid data crosses a stage boundary unchecked — no schema/sanity gate between
assemble → generate → route/publish.
Evidence: articles 2026-07-03/-04 (`origin/article/*`): 162-ADR registry injected wholesale,
truncated mid-word (`0004-narrow-su…`), generator emitted raw prompt context which then reached
council review and (07-04) publication; ADR registry ingestion emitting title-less partial
records (asset-foundry ADR-0004–0007).
Root-cause hypothesis (operator, 2026-07-06): the daily-logger single-runner design — one prompt
carrying ALL context — is the structural cause; decomposition into staged runners is the fix
candidate. **Deferred deliberately** (tranche-2 divergence guard); belongs on the daily-logger
roadmap as its own slice.

### 2. `failure:blind-retry`
Failure handling that repeats without diagnosis: identical rerun with no intervening fix,
manual-only recovery, leftover state blocking the rerun.
Evidence: three consecutive identical generation failures 2026-07-03→05; scheduled run
28095863784 (2026-06-24) — alert fired, recovery manual; expired-GH_PAT outage — rerun no-op'd
because the failed day's `article/` branch already existed.

### 3. `failure:dup-identity`
Records minted without a stable identity or idempotency key.
Evidence (live Dolt query, 2026-07-06): 23× "PR #100 on core" beads, 23× #99, 20× #77, 10× #101
and #102 — the PR watcher re-mints on every poll; 7 beads titled "PR #pending" (identity never
resolved, placeholder persisted). Note: S21 (trace_id) gives joins a stable key but does NOT fix
minting idempotency — that is open work.

### 4. `failure:silent-stall`
Delivery stops while every signal stays green; nothing nags.
Evidence: "Twenty-two green runs, zero articles" (`_articles/2026-06-10.md`) — green measured
"job ran," not "post exists"; 82 unmerged `article/*` branches while on-disk `_articles/` ends
2026-06-11 (operator verdict: a stalled publication line, not a draft-first workflow); vault sync
24 days stale against a 14-day gate (oracle P6.1) with no alarm.
Operator note (2026-07-06): morning-cockpit needs a failing-items surface for exactly this class —
future slice candidate (F5 territory), deferred.

### 5. `failure:stranded-work`
Done or posted work parked where no consumer looks — stashes, single sessions, an unclaimed queue.
Evidence: /adopt-stack hardening stranded uncommitted → stash at a checkout switch, #174 recovered
only the pre-hardening version; the ADR-0092 installer fix itself sits in core stash@{0}; the F1
delivery plan lived only in one chat session until the 2026-07-03 audit caught it; queue shows 36
sweep events vs 3 claims — **operator recode:** not abandonment; the operator-side tooling to keep
the day-runner loop alive doesn't exist yet. Tooling gap, tracked, not a motivation problem.

### 6. `failure:unowned-drift`
Lifecycle states with no owner, clock, or escalation never progress.
Evidence: `verifyFileExistenceClaims` designed in TECHDEBT in March, unbuilt until S11 (July);
ADR-0012 in Proposed with no owner and no target date (flagged by council review 2026-07-04).

### 7. `failure:asserted-not-verified`
Hand-asserted records that nothing machine-checks against reality.
Evidence: daily-logger CLAUDE.md claimed nonexistent `src/bead-store.ts` for months (oracle H0.3,
class persists beyond the S11 fix); the ~100k context ceiling and Dolt ≥ 2.1.0 pin documented
nowhere machine-readable (oracle F6.1/F10.1); legs-band `moves_from` drift vs live P2 — parallel
movement bands with hand-asserted rollup (audit finding P5).

### 8. `failure:vantage-isolation`
Truth or state depends on where you run it; contexts contaminate or contradict.
Evidence: DOLT_TEST suites share the production bead store with name-based cleanup — concurrent
runs purge each other (S18 agent, 2026-07-06) and one "Test task sweep-rotted" bead litters
production; northstar-lint ERROR for l1-cv-builder is a WIP-checkout artifact reading as a
registry lie (slice S1); "Editorial Revision" CI job failed assuming push permissions it lacked
(2026-07-06); tranche-1 cloud-container vs Mac verdict contradictions until artifacts carried a
`vantage` block.

## First eval to build (feeds S19)

**Cluster 1, `no-validation-gate`, on the daily-logger drafter.** Fixture replays the real July
failure: a truncated/title-less ADR registry as input; assert (a) output parses as a valid
article against the schema, (b) output contains zero raw-prompt fragments, (c) the invalid-output
branch produces the honest failure stub rather than publishing. Chosen because it has three
consecutive real occurrences, a ready-made fixture from `origin/article/2026-07-0{3,4,5}`, and
the highest blast radius (it reached publication).

## Ritual contract (I3, AGENTIC-INTEGRATION-PLAN § lines 103–112)

Weekly, 30–60 min, operator + agent. Agent samples 20–30 recent sessions/beads/articles, proposes
codes and cluster deltas; operator approves. Measure taxonomy coverage; new-cluster rate should
fall. Every finding gets a tag at triage (rule above).

## Appendix — ritual #1 sample (24 items, operator-confirmed codes)

| # | Source | Code | Cluster |
|---|--------|------|---------|
| 1 | origin/article/2026-07-03 | Unvalidated LLM output passed downstream | 1 |
| 2 | origin/article/2026-07-04 | Context assembly corrupted input before the LLM call | 1 |
| 3 | origin/article/2026-07-05 | Known failure repeated 3 runs, no intervening fix | 2 |
| 4 | GH run 28095863784 (06-24) | Hard fail; alert worked, recovery manual | 2 |
| 5 | _articles/2026-06-10.md | Silent no-op reported as success | 4 |
| 6 | Dolt query 07-06 (dup pr beads) | pr-created has no idempotency key | 3 |
| 7 | Dolt query 07-06 ("PR #pending") | Bead minted before identity resolved | 3 |
| 8 | "Test task sweep-rotted" + S18 flake report | Test data cohabits production store, name-based cleanup | 8 |
| 9 | bead_events 36 sweeps / 3 claims | Posted work expires unclaimed — operator run-loop tooling missing (operator recode) | 5 |
| 10 | oracle I5.1 / TD-001 | Designed-but-never-built, no expiry or escalation | 6 |
| 11 | oracle P6.1 | Cadence commitment silently lapsed | 4 |
| 12 | oracle H0.3 | Docs assert files that don't exist | 7 |
| 13 | oracle F6.1/F10.1 | Operational constraints undocumented machine-readably | 7 |
| 14 | July posts: ADR-0004–0007 | Registry ingestion emits partial records | 1 |
| 15 | 07-04 post: ADR-0012 | Lifecycle state with no exit criteria drifts | 6 |
| 16 | tranche-1 brief: legs-band drift | Parallel bands diverge; hand-asserted rollup masks it | 7 |
| 17 | northstar-lint l1-cv-builder (S1) | Working-copy state masquerades as registry lie | 8 |
| 18 | #174 + empty adopt-stack pickaxe | Uncommitted session work stranded at checkout boundary | 5 |
| 19 | core stash@{0} (ADR-0092 fix) | The fix for a known gap is itself stranded | 5 |
| 20 | 2026-07-03 cross-session audit (F1 plan) | Plans outside delivery machinery rot invisibly | 5 |
| 21 | 82 article/* branches vs disk ending 06-11 | Publication stalled silently for weeks (operator: stalled line) | 4 |
| 22 | outage-2 postmortem + b9ae3de | Credential died silently; leftover state blocked recovery | 2 |
| 23 | GH run failure 07-06 (Editorial Revision) | CI job assumes permissions/state it lacks | 8 |
| 24 | tranche-1 environment facts | Same check, different vantage, contradictory verdicts | 8 |
