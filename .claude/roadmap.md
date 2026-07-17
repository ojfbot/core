---
type: roadmap
slug: rm-l1-core
northstar: l1-core
status: active
phases:
  - id: PH1
    name: "MEASURE — fix the ruler before touching the program"
    goal: "The follow/acted pipeline captures all three follow paths, scores both suggestion populations, has exactly one live reconciler writer, auto-emits in shadow, and is verified green against a ~10-label gold set; the cockpit Loop pane renders the honest split."
  - id: PH2
    name: "EVALUATE — the immutable eval set"
    goal: "A fixed prompt->expected-skill gold set (incl. no-match) and a replay harness report chance-corrected precision/recall for suggest-skills.mjs, plus a trigger-precision report naming over-firing skills; every PH3 change is measured against these."
  - id: PH3
    name: "DISCOVER — data-gated program iterations"
    goal: "Triggers, descriptions, filters, and activation (the 'program') iterate against the PH2 eval + live honest follow-rate; each intervention is entrance-gated on evidence from PH1/PH2; embeddings last, only on logged lexical misses."
slices:
  - id: S1
    phase: PH1
    title: "Bootstrap — land l1-core northstar + this roadmap + registry entries + SOTA record"
    advances: "ns:l1-core#P1"
    moves_from: 10
    moves_to: 12
    deliverable: "core/.claude/northstar.md + core/.claude/roadmap.md committed; README.md registry + roadmaps entries added; the 2026-07-17 SOTA research pass committed as decisions/research/2026-07-17-skill-loop-sota.md; both lints clean."
    entrance: "Skill-loop plan approved by the operator (2026-07-17); slug l1-core confirmed."
    success: "northstar-lint and roadmap-lint report 0 errors with the new entries; the SOTA record's design deltas are cited by PH3 slice entrances."
    check: "node scripts/northstar-lint.mjs --check && node scripts/roadmap-lint.mjs --check"
    autonomy: gate-0
    claimable_by: either
    kind: s
    repo: core
    status: merged
  - id: S2
    phase: PH1
    title: "Widen the engagement predicate to Skill-tool invocations, with name normalization"
    advances: "ns:l1-core#P1"
    moves_from: 12
    moves_to: 25
    deliverable: "corroborate-follow.mjs recognizes tool_name:'Skill' events from ~/.claude/tool-telemetry.jsonl (normalizing scoped names like core:adr to catalog slugs) alongside the SKILL.md-Read path; a scratch replay run against a telemetry snapshot proves >=13 ignored->followed flips BEFORE any live-path write; hook tests cover both paths."
    entrance: "The >=13 same-session Skill-tool follows confirmed in transcripts (RCA 2026-07-16); replay harness runs against a snapshot, not live files."
    success: "Replay artifact in the PR shows flips >= 13 with 0 regressions on previously-corroborated rows; suggest-skill.sh's ignored-detector picks up the widened predicate unchanged (single source of truth preserved)."
    check: "pnpm vitest run scripts/hooks/__tests__"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
    depends_on: "rm:rm-l1-core#S1"
  - id: S3
    phase: PH1
    title: "Denominator split — score installed suggestions too, tag population"
    advances: "ns:l1-core#P1"
    moves_from: 25
    moves_to: 33
    deliverable: "reconcile-skill-acted.mjs accepts skill:suggested (installed, 522) in addition to skill:suggested-uninstalled (268); every new disposition row carries population: installed|uninstalled; legacy rows untouched (append-only; new-era rows labeled)."
    entrance: "S2 merged — installed follows travel via the Skill tool, so scoring that population is only meaningful once the predicate sees it."
    success: "A shadow reconcile run emits dispositions for both populations with the population field; counts reconcile to suggestion-telemetry event totals."
    check: "pnpm vitest run scripts/hooks/__tests__"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
    depends_on: "rm:rm-l1-core#S2"
  - id: S4
    phase: PH1
    title: "One reconciler writer — retire core's silent no-op Stop-hook copy"
    advances: "ns:l1-core#P1"
    moves_from: 33
    moves_to: 38
    deliverable: "core's Stop-hook reconciler registration removed OR its dist/tracking built (decision line in the PR); core-tracking's byte-identical copy declared the single writer in the loops registry; loops-liveness hook-reconcile-skill-acted-dup flag cleared."
    entrance: "loops-liveness currently flags hook-reconcile-skill-acted-dup; the no-op is confirmed (missing dist/tracking builds)."
    success: "Exactly one registered reconciler across settings files; loops-liveness clean; a live session produces exactly one disposition row per suggestion."
    check: "node scripts/loops-liveness.mjs --check"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    repo: core
    status: merged
  - id: S5
    phase: PH1
    title: "Auto-emit followed/acted from PostToolUse(Skill) — shadow mode"
    advances: "ns:l1-core#P1"
    moves_from: 38
    moves_to: 45
    deliverable: "A PostToolUse(Skill) hook correlates the invocation with the pending suggestion via the session dedup file (line 3 = SUGGESTION_ID) and emits skill:suggestion-followed plus a shadow skill:acted candidate — replacing the never-run manual skill-acted-emit.mjs path as the live acted source. Fail-open on missing/stale/default-fallback dedup files; ADR-0095 two-source contract preserved (the reconciler stays the independent cross-check)."
    entrance: "S2 + S4 merged (predicate sees Skill events; exactly one reconciler consumes what this emits)."
    success: "A live session where a suggested skill is invoked produces a shadow followed+acted pair joined on SUGGESTION_ID; no event emitted when no suggestion is pending."
    check: "pnpm vitest run scripts/hooks/__tests__"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: ready
    depends_on: "rm:rm-l1-core#S4"
  - id: S6
    phase: PH1
    title: "Gold set v0 — ~10 hand-labeled suggestion->outcome scenarios; capture-quality green"
    advances: "ns:l1-core#P1"
    moves_from: 45
    moves_to: 60
    deliverable: "decisions/opav/gold-set-v0.jsonl: ~10 operator-labeled suggestion->disposition scenarios from real transcripts (>=3 flipped Skill-tool follows, >=2 honest ignores, >=1 engaged_no_act, >=2 no-skill-applies); scripts/opav-capture-quality.mjs runs green (capture >= 70%, false-emit <= 10%). The EDD-sized seed for rm:rm-l2-ojfbot#S22's 30-label set — labels feed forward, movement is never double-counted."
    entrance: "S2-S5 merged (the pipeline being verified is the fixed one); operator has one ~30-min labeling sitting."
    success: "Capture-quality report committed citing both bars vs gold-set-v0; per the ADR-0095 honesty contract this unlocks publishing any rate."
    check: "node scripts/opav-capture-quality.mjs --check"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S5"
  - id: S7
    phase: PH1
    title: "Loop pane honest split — populations + verified followed, rate suppressed until S6"
    advances: "ns:l1-core#P1"
    moves_from: 60
    moves_to: 70
    deliverable: "morning-cockpit /api/loop + Loop pane render the S3 population split and the honest followed count; any rate is suppressed ('unverified' badge) until the S6 capture-quality artifact exists; legacy-era rows labeled, never blended."
    entrance: "S3 merged (population field exists in skill-dispositions.jsonl)."
    success: "Loop pane shows both populations with distinct denominators; pre-fix rows labeled legacy."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: morning-cockpit
    status: ready
    depends_on: "rm:rm-l1-core#S3"
  - id: S8
    phase: PH2
    title: "Suggester eval harness — fixed gold prompts, chance-corrected precision/recall replay"
    advances: "ns:l1-core#P2"
    moves_from: 10
    moves_to: 25
    deliverable: "decisions/opav/suggester-gold-v1.jsonl: 20-30 prompt->expected-skill pairs from real transcripts incl. >=5 no-match cases; scripts/suggester-eval.mjs replays each through suggest-skills.mjs scoring the FULL pre-limit scored set and reports precision/recall plus a chance-corrected metric (hit-rate flatters at N=62); a frozen holdout subset named out-of-bounds for tuning."
    entrance: "PH1 S2-S3 merged (outcome labels for real prompts are only trustworthy under the fixed predicate/denominator)."
    success: "Baseline numbers committed; harness deterministic; holdout documented."
    check: "node scripts/suggester-eval.mjs --check"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S3"
  - id: S9
    phase: PH2
    title: "Trigger-precision report — which skills over-fire, from live suggestion-telemetry"
    advances: "ns:l1-core#P2"
    moves_from: 25
    moves_to: 30
    deliverable: "A trigger-precision mode joining suggestion-telemetry fires vs honest follows per skill: fire count, follow count, ignore streak, last-followed recency. Names the over-firing tail (summarize 52x/0) and cross-references the 2026-07-13 skill-architecture-audit's 22 needs_work."
    entrance: "S3 merged (per-population counts exist); the report reads live telemetry, writes a docs/ artifact only."
    success: "Report committed listing every skill with >10 fires and 0 honest follows in the window, denominators stated."
    check: "node scripts/skill-metrics.mjs --trigger-precision --check"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S3"
  - id: S10
    phase: PH3
    title: "Trigger pruning + description refresh for the over-firing tail and 22 needs_work"
    advances: "ns:l1-core#P2"
    moves_from: 30
    moves_to: 45
    deliverable: "skill-catalog.json triggers pruned for the S9-named over-firers; descriptions refreshed per naming-guide.md + Anthropic's pushy-descriptions guidance (Claude measurably under-triggers) for the 22 needs_work skills; the missing-Gotchas skill fixed; straddler decisions logged. Every change measured: S8 eval re-run before/after in the PR."
    entrance: "S8 + S9 merged (Karpathy discipline: the evaluator is frozen before the program is touched)."
    success: "Eval delta table in the PR body; precision up; no holdout recall regression; over-firing tail shrinks in the next S9 run."
    check: "node scripts/suggester-eval.mjs --check --baseline=docs/suggester-eval-baseline.json"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S8"
  - id: S11
    phase: PH3
    title: "Repo-scoped relevance filter — promote the draft ADR, filter in the scorer, shadow prunes"
    advances: "ns:l1-core#P2"
    moves_from: 45
    moves_to: 60
    deliverable: "draft-repo-scoped-skill-relevance accepted (serial per ADR-0087); filter implemented INSIDE suggest-skills.mjs against the full scored set (pre-limit), fail-open, every prune shadow-logged for 2 weeks before suppression goes live; repo-profile.json for core + 2 pilot repos."
    entrance: "S8 eval can measure the filter's effect; the draft's red-team addenda (label/filter independence, per-repo worst-case false-prune <= 1%) restated as promotion criteria BEFORE evaluation."
    success: "Shadow prune log shows 0 false-prunes on the contested band vs eval labels; precision improves with recall held; RIDM promotion note for enabling suppression."
    check: "node scripts/suggester-eval.mjs --check --baseline=docs/suggester-eval-baseline.json"
    autonomy: gate-0
    claimable_by: either
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S10"
  - id: S12
    phase: PH3
    title: "Forced-eval activation experiment — catalog-injection commitment block, shadow first"
    advances: "ns:l1-core#P2"
    moves_from: 60
    moves_to: 65
    deliverable: "A UserPromptSubmit variant that injects the skill catalog (or a two-stage category-gate at 62 skills) and requires an explicit per-skill YES/NO commitment before implementation — the measured activation winner (Spence 2026: 50% baseline -> 84-100% with perfect precision on non-matching prompts; see the SOTA record). Ships shadow-first: logs what it WOULD have committed, A/B'd against the S8 eval + live honest funnel before replacing the single-suggestion hook."
    entrance: "DATA GATE: S8 report attributes recall/activation misses to the limit-1 single-suggestion shape; otherwise this slice is dropped with a decision line."
    success: "Shadow log shows commitment decisions on >= 2 weeks of prompts; eval + live funnel comparison in the PR; promotion criteria pre-committed before any cutover."
    check: "node scripts/suggester-eval.mjs --check --baseline=docs/suggester-eval-baseline.json"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S8"
  - id: S13
    phase: PH3
    title: "Coverage-gap decision — library-api-reference + product-verification, evidence or drop"
    advances: "ns:l1-core#P3"
    moves_from: 10
    moves_to: 15
    deliverable: "Gap analysis over S8 no-match cases + transcripts: would a library-api-reference skill (0 coverage) or a thicker product-verification skill (1; Anthropic reports the highest measurable quality impact) have been suggested AND plausibly followed? Build only what the evidence supports; a grep-able VERDICT: line per candidate either way."
    entrance: "S8 merged (no-match cases are the evidence base); the 2026-07-13 audit findings restated."
    success: "Decision doc with 2 VERDICT lines; any new skill lands with catalog triggers already covered by an eval case."
    check: "grep -c '^VERDICT' docs/coverage-gap-decision.md"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S8"
  - id: S14
    phase: PH3
    title: "Eager-invocation shaping — description-convention efficacy, chaining, router-skill option"
    advances: "ns:l1-core#P3"
    moves_from: 15
    moves_to: 30
    deliverable: "With the honest metric: session-invocation rate split by description convention (MANDATORY-prefix vs not) over the post-S6 window; suggested_after chaining surfaced at skill completion in shadow (already scored by suggest-skills.mjs --after, never emitted); an evaluated note on the router-skill pattern (one always-loaded skill routing to the other 61, per mattpocock/skills v1.1 /ask-matt) and the user-invoked vs model-invoked split as a catalog facet."
    entrance: "S6 merged >= 2 weeks (enough honest post-fix window); S10 merged (descriptions stable during the measurement window)."
    success: "Report with per-convention invocation rates and denominators; one chaining surface live in shadow for a week; router-skill verdict recorded."
    check: "node scripts/skill-metrics.mjs --invocation-by-convention --check"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S10"
  - id: S15
    phase: PH3
    title: "Semantic suggester — LAST, gated on logged lexical misses (likely never fires at N=62)"
    advances: "ns:l1-core#P2"
    moves_from: 65
    moves_to: 75
    deliverable: "A new draft ADR (two-channel: embeddings as a complementary suggestion channel with a loudly-labeled lexical fallback, suggestion-only) implemented ONLY against the logged-miss corpus; eval re-run proving the semantic channel closes misses lexical tuning could not."
    entrance: "DATA GATE (agentic-search-before-embeddings doctrine + field convergence on lexical discovery at this scale): >= 10 S8/S9-logged misses persist AFTER S10-S12, each annotated 'not fixable by trigger/description edit'; otherwise dropped with a decision line."
    success: "Eval shows the semantic channel resolves >= 70% of the logged misses without holdout precision regression; ships suggestion-only behind the existing hook surface."
    check: "node scripts/suggester-eval.mjs --check --baseline=docs/suggester-eval-baseline.json"
    autonomy: gate-0
    claimable_by: either
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l1-core#S11"
---

# Roadmap — core (l1-core): the honest skill loop

**Route.** The 2026-07-16 RCA proved the "0 followed / 0 acted" reading is the evaluator lying, not
the skills failing: the engagement predicate cannot see Skill-tool invocations, the denominator
excludes every installed-skill suggestion, and the acted ledger was never written. So the route is
doctrine-ordered (Karpathy loop, ADR-0086 shadow-first, the 2026-07-17 SOTA record): **PH1 fixes the
ruler** — never iterate the program against a broken evaluator; **PH2 freezes the eval** — a fixed
gold set with no-match cases and a chance-corrected metric, plus a trigger-precision report naming
the over-firing tail; **PH3 iterates the program** — triggers, descriptions, relevance filters, and
the forced-eval activation shape, each entrance-gated on PH1/PH2 evidence, with embeddings dead last
(the field converged on lexical, model-in-the-loop discovery at this catalog size — that gate likely
never opens).

## PH1 — MEASURE

S1 lands the identity (this file, the northstar, the registry rows, the SOTA record). S2 widens the
predicate and must prove itself on a scratch replay (≥13 known flips) before touching live files. S3
scores the installed population and tags every new row with its population so eras never blend. S4
collapses the duplicate reconciler registration to one honest writer. S5 replaces the never-run
manual acted path with a fail-open PostToolUse(Skill) auto-emit, shadow-mode, preserving the
ADR-0095 two-source contract. S6 is the human labeling sitting that makes any rate publishable. S7
carries the honest split into the cockpit Loop pane, with rates suppressed until S6 exists.

## PH2 — EVALUATE

S8 builds the immutable ruler for the *suggester*: real prompts, expected skills, no-match cases, a
frozen holdout, and scoring against the full pre-limit scored set so confusion matrices are
possible. S9 turns live telemetry into a named over-firing tail. Nothing in PH3 moves without these.

## PH3 — DISCOVER

S10 is the cheapest measured lever (prune + pushy descriptions). S11 promotes the staged relevance
draft with its red-team addenda as promotion criteria. S12 tests the measured activation winner
(forced-eval commitment block) in shadow. S13 decides the two coverage gaps on evidence. S14
measures whether the MANDATORY convention actually works and trials chaining + the router-skill
option. S15 is deliberately last and deliberately likely to be dropped.
