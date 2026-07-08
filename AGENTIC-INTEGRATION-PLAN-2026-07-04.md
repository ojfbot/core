# Agentic Integration & Self-Improving Loop Plan — 2026-07-04

> Cycle 4 (`DIA-CROSSCHECK-2026-07-08.md`) cross-checked this plan against an independent
> external survey: convergent on the bulk; 4 deltas adjudicated (2 REJECT, 2 DEFER).

Cycle 2 of the 2026-07-04 audit (`MULTIAGENT-SDLC-AUDIT-2026-07-04.md`). That document says
what is broken; this one says what to build, grounded in current (2025–2026) industry practice.
Two web-research passes back it: one on self-improving loops and evaluation practice, one on
multi-agent observability/orchestration standards. Load-bearing sources are cited inline;
findings reference the audit's T/O/P/E numbering and H-slices.

**Reading order:** §1 is the external consensus in one page. §2 maps each practice to this
cluster. §3 is the integration slices (I1–I8), each with a measurement design. §4 is the
anti-Goodhart contract. §5 is the two-week on-ramp.

---

## 1. What the field converged on (and how ojfbot scores against it)

| # | Consensus practice (2025–26) | Key sources | ojfbot today |
|---|---|---|---|
| 1 | **Error analysis before metrics** — manually read 20–50 traces, open-code failures, cluster into a taxonomy; only then build evals | Hamel Husain & Shreya Shankar (hamel.dev/blog/posts/evals-faq); OpenAI eval-flywheel cookbook | ❌ No failure taxonomy exists; findings evaporate at session end (E5) |
| 2 | **Small golden suites seeded from real failures**, grown monotonically; 20–50 tasks beats 500 synthetic | Anthropic "Demystifying evals for AI agents" (anthropic.com/engineering/demystifying-evals-for-ai-agents) | ❌ Zero golden sets anywhere (E4) |
| 3 | **Binary pass/fail + written critique**, never Likert; code assertions where deterministic, calibrated LLM-judge only where subjective | hamel.dev/blog/posts/llm-judge; Anthropic multi-agent post | ⚠️ Council emits prose critiques (good instinct) but no pass/fail, no persistence (E3) |
| 4 | **A judge is a product needing its own eval** — calibrate against human labels, hold out data, re-check on schedule and on model upgrades | Shankar et al. "Who Validates the Validators" (arXiv 2404.12272) | ❌ No judge is calibrated; council output never measured (E3/E4) |
| 5 | **The trace-first flywheel**: telemetry → mine failures → eval cases → CI gate → improve → repeat | LangChain "the agent improvement loop starts with a trace"; Arthur ADLC | ⚠️ Telemetry exists in volume; zero mining into eval cases; no CI gate on LLM output (E1/E4) |
| 6 | **Implicit human feedback > thumbs** — your edits/rejections/overrides ARE the signal; convert them to labels | Langfuse user-feedback docs; arXiv 2507.23158 (raw feedback noisy — curate first) | ❌ No outcome field on any bead/article/suggestion; edits invisible (T8) |
| 7 | **Reflection only works against external verification** (tests, execution output) — intrinsic self-critique is neutral-to-harmful; gains compound only when persisted into artifacts | Huang et al. arXiv 2310.01798; Reflexion→Voyager lineage; Claude Code best practices ("if you can't verify it, don't ship it") | ⚠️ day-runner has no test-in-the-loop (O2); beads persist decisions (good) but no lessons layer |
| 8 | **Memory accretion needs curation** — delta updates + scheduled promote/prune, never in-flight CLAUDE.md self-editing; bloat degrades instruction-following | ACE, arXiv 2510.04618 (context collapse, brevity bias); Anthropic memory docs | ⚠️ ADR-0081 loading-discipline rollout is exactly the right instinct — 2/6 repos done, no lessons pipeline feeding it |
| 9 | **Shadow → trial → enforce with promotion criteria defined up front**; never metric-only promotion; error budgets pause autonomy | convergent SRE-transplant doctrine (multiple 2026 playbooks) | ⚠️ ADR-0086 IS this pattern — entry discipline excellent, **no gate has ever promoted** (E-series theme 2) |
| 10 | **Multi-agent only when parallelizable and worth ~15× tokens**; orchestrator-worker with 4-part delegation contracts (objective, output format, tool guidance, boundaries) | Anthropic multi-agent research system (90.2% uplift, token-use explains most variance) | ⚠️ System B respects this; System A (`/orchestrate`) is unenforced prose (O1) |
| 11 | **OTel GenAI vocabulary without OTel infrastructure** — `gen_ai.*` field names in whatever store you have; three-layer identity (trace ⊂ session ⊂ durable workflow id); span-links across human gates | github.com/open-telemetry/semantic-conventions-genai (Development status); Claude Code telemetry docs (code.claude.com/docs/en/monitoring-usage) | ❌ Four unjoined identity systems (T3/O11); no gen_ai vocabulary; cost/latency unmeasured (T8) |
| 12 | **Session↔git correlation via commit trailers** — parse them back out to join PRs to sessions | GitHub Copilot agent sessions; Cursor agent-trace; Claude Code `Claude-Session:` trailer | ⚠️ Trailers are emitted, **never parsed** — the join exists on disk, unread |

Two overall verdicts from the research pass worth stating plainly:

- **Your architecture instincts are repeatedly ahead of the field** — ADR-0086 shadow-first,
  cultivate's "empty run is a success state," cockpit's recency-derived liveness and honest
  empty states, `/resume`'s evidence tiers, and the merge-gated odometer all match or exceed
  published practice. The gap is *operation*, not design: loops built, never run (audit theme 1).
- **The field's strongest warning is aimed at your next temptation**: automated prompt
  optimization and self-adjusting autonomy (OPAV S5) without a calibrated metric industrializes
  Goodharting (GEPA works *given* a trustworthy metric; Anthropic's reward-hacking paper,
  arXiv 2511.18397, shows grader-gaming generalizes to broad misalignment). Everything below
  therefore builds the metric layer first and keeps the S5 firebreak intact.

---

## 2. Where agentic workflows should be integrated (opportunity map)

Ordered by (value ÷ risk). "Agentify" here means: a scheduled or event-triggered headless
Claude session with a narrow delegation contract, shadow-first, reporting into the existing
bead/telemetry rails.

| Opportunity | Replaces / closes | Pattern | Risk posture |
|---|---|---|---|
| **A. Weekly measurement session** — runs skill-metrics snapshot, `/vault sync`, staleness checks, SLO report; files a dated report + diff vs prior | E1, P6, H7 | Routine/cron → headless session; deterministic scripts do the math, the agent narrates the diff | Read-only + report PR; lowest risk, highest leverage |
| **B. Trace-mining triager** — weekly, samples 20–30 recent sessions/beads/articles, open-codes failures, proposes taxonomy deltas and candidate golden tasks | Consensus #1/#5; E5 | Agent proposes → human approves taxonomy + task promotion | Proposal-only |
| **C. day-runner verification stage** — post-session, run repo test command in the worktree + evaluate slice `success:` line; record on bead | O2, H4; consensus #7 | Deterministic tests + one judge call; SHADOW then blocking | Shadow-first, RIDM promote |
| **D. Article fact-checker** — deterministic claim extraction vs collected context (`verifyFileExistenceClaims`), plus one calibrated accuracy judge | P4, P11, E4, H8; TD-001 | Code assertions first; judge only for the subjective residue | Demotes to draft, never deletes |
| **E. Council persistence + persona curator** — persist notes per article; monthly agent aggregates recurring critiques → proposed persona diff PR | E3; consensus #3/#8 | Evaluator-optimizer, human-merged | Proposal-only |
| **F. Lessons pipeline** — per-repo `learnings.md` append target for working agents; scheduled curator session promotes/prunes into CLAUDE.md via the existing `/claude-md-audit` machinery | Consensus #8; ADR-0081 | ACE-style delta curation; never in-flight self-editing | Curator is a separate session; PR-gated |
| **G. Reconciler fleet** — inventory diff (northstar registry / cockpit REPO_META / selfco entities), doc-drift check (H0's script), status.jsonl vs northstar current% | P5, P9, H0, H9 | Deterministic scripts; agent only writes the summary | Shadow lint, candidate for H6 ratchet |
| **H. Queue janitor** — dedup hand-posted beads, quarantine repeat-failers with failure context, expire stale available items | O4, O5, H5 | Deterministic; agent triages quarantine weekly | Acts only on queue metadata |

Explicitly **not** proposed, per research: automated prompt optimization (premature until I4/I5
provide a trusted metric), autonomous suggestion re-ranking (OPAV S5 — firebreak stands),
fine-tuning (nothing here needs weights), buying an eval platform (Hamel: the differentiator is
your labeled data; your JSONL + a vitest harness is the right size).

---

## 3. Integration slices I1–I8 (each: build → measure → iterate)

These extend the audit's H-plan; where an H-slice exists, the I-slice is its research-grounded
specification. All follow ADR-0086: entrance criteria, success TPM, shadow stage, RIDM promotion.

### I1 — Telemetry vocabulary + identity (specifies H1, H3)
**Build:** Adopt `gen_ai.*` field names in the JSONL/bead schemas — `gen_ai.operation.name`
(`invoke_agent`|`execute_tool`|`chat`), `gen_ai.usage.input_tokens`/`output_tokens`,
`gen_ai.request.model`, `cost_usd` (Claude Code's own folk-standard name), `error.type`,
duration. Stamp **three identities everywhere**: `trace_id` (per dispatched task),
`session.id`, `workflow.id` (= bead/convoy/roadmap ref — you already have durable IDs; this
names them consistently). Across human gates (PR merge hours later), start a new trace with a
`links:[…]` field back — never hold identity open. Parse `Claude-Session:` trailers in the
daily-logger sweep and cockpit so commits/PRs join to sessions (the join already exists on
disk, unread — cheapest possible win).
**Measure:** the H1 exit gate — one slice traceable prompt→PR→movement via a single join
script; % of new telemetry lines carrying all three IDs (target 100% of new, ignore backlog).
**Iterate:** monthly, check which questions the join still can't answer; add fields only then.
**Why this shape:** the OTel GenAI semconv is Development-status — track the *names*, skip the
infrastructure; vendors already ingest these names if you ever want a backend.

### I2 — Outcome capture: make your own behavior the training signal
**Build:** one new field, everywhere a human touches agent output: `outcome:
accepted | edited | rejected | abandoned`. Concretely: on queue/convoy beads (set at
merge/close/quarantine), on daily-logger articles (accepted = editorial-accept, edited =
ADR-0038 revision ran, rejected), on skill suggestions (exists post-S0/S1 — align names). A
tiny cron files every `rejected`/`edited` item as a **candidate golden task** in the repo's
eval file (I4), with the trace attached.
**Measure:** outcome-coverage % (items with an outcome ÷ items a human touched); candidate
tasks filed per week.
**Iterate:** if edits dominate rejections, add an `edit_kind` (factual|style|scope) — the
research warns edits are noisy signals; the taxonomy (I3) disambiguates.

### I3 — Weekly error-analysis ritual + failure taxonomy (the missing "Think" stage)
**Build:** `core/decisions/failure-taxonomy.md` (living, versioned). Weekly 30–60 min: the
trace-mining triager (opportunity B) samples 20–30 recent traces/beads/articles, open-codes
failures into notes, proposes cluster deltas; you approve. Every audit finding, TECHDEBT entry,
and pipeline-alert issue gets a taxonomy tag on triage.
**Measure:** taxonomy coverage (% of failures assignable to an existing cluster — new-cluster
rate should fall over time); the distribution itself becomes the prioritization input for
which evals to build next.
**Why first:** every source agrees this is the highest-leverage single addition — evals built
without it measure failures you don't have.

### I4 — Golden task suites + config-as-code eval runner (specifies H8's harness; closes E4)
**Build:** per active repo, one eval file (5–15 tasks), each task = input fixture +
deterministic assertions where possible + rubric line otherwise — seeded **only** from real
failures (I2/I3 feed it). Runner: a small vitest harness (fits the pnpm posture; promptfoo is
the alternative if config-over-code wins) with trials-per-task ≥3 for stochastic paths.
Triggered in CI on changes to SKILL.md files, shared prompts, personas, or model version —
**advisory first** (post the diff vs last run), blocking is an H6 ratchet candidate.
**Measure:** pass-rate per suite with per-task trial counts (report pass^k for flaky tasks —
τ-bench showed pass^1→pass^8 can fall 61%→25%; consistency is a separate axis from capability);
suite growth rate (should track incident rate).
**Iterate:** quarterly, retire saturated tasks (passed every run for a quarter) to a smoke set;
promote harder cases. Statistical honesty: 5–15 tasks gives *direction*, not significance —
never claim a win from a 1-task delta (arXiv 2503.01747).

### I5 — Calibrate exactly one judge: daily-logger article accuracy (specifies H8's judge)
**Build:** the deterministic layer first — `verifyFileExistenceClaims()` (TD-001, designed
March, never built) + frontmatter arithmetic cross-check: no LLM needed, catches the worst
class. Then the judge for the subjective residue ("does this narrative match what shipped?"):
label 30–50 historical articles pass/fail + one-line critique yourself (the 84-article corpus
exists); iterate the judge prompt to ≥90% agreement with your labels; freeze 10 labeled
articles as the **judge-regression set**, re-run monthly and on every model upgrade. Judge from
a different model family than the drafter where feasible (preference-leakage control).
**Measure:** judge↔human agreement on the frozen set (alarm < 85%); article demotion rate.
**Iterate:** only after this judge holds calibration for a month does a second judge get built
(candidate: slice `success:` evaluation in I6/C). One calibrated judge that you trust beats
five you don't — and this is the entrance criterion for ever considering GEPA-class
optimization.

### I6 — day-runner verification stage (specifies H4; consensus #7 applied)
**Build:** post-session, in the worktree: run the repo's declared check command (test/build/
lint), evaluate the slice `success:` line (judge call, I5-calibrated pattern), write
`checks:{tests, success_criterion}` onto the `pr-created` bead and into the PR body. SHADOW:
record only. Promotion to "red ⇒ task-failed + quarantine" is an RIDM decision after ~20
shadow runs with your merge decisions as the reference labels (promotion evidence: how often
would the gate have agreed with you?).
**Measure:** shadow-agreement rate (gate verdict vs your actual merge/reject); post-promotion,
red-PR-merged rate should → 0.
**Also:** enrich the brief's delegation contract to Anthropic's four parts — objective, output
format, tool guidance, **boundaries** — the brief has three; explicit boundaries ("do not touch
X") measurably reduce drift.

### I7 — Lessons pipeline: learnings.md → curated CLAUDE.md (consensus #8; extends ADR-0081)
**Build:** working agents append one-liners to per-repo `learnings.md` (candidate lessons,
never rules). A scheduled **curator session** — separate from any working agent — monthly:
promotes proven entries into CLAUDE.md/rules via the existing `/claude-md-audit --apply`
machinery (PR-gated), prunes stale rules, archives entries. Delta updates only, never
wholesale rewrite (ACE's context-collapse finding). Cap CLAUDE.md sizes — the rollout tracker
already knows which repos are over.
**Measure:** CLAUDE.md line count per repo (should stay flat while learnings accumulate);
lesson promotion rate; repeat-failure rate for taxonomized failures that got a promoted lesson
(the actual point: does memory reduce recurrence?).

### I8 — Fleet SLOs + error budget in `/frame-standup` (specifies H7's teeth; consensus #9)
**Build:** three SLOs, checked every standup from data the weekly measurement session (A)
produces: **telemetry freshness** (no stream silent >7d — makes the next dark-stream failure
*detected* rather than discovered), **overnight success rate** (day-run slices + daily-blog
runs), **verified-outcome coverage** (I2's metric). Breach ⇒ the standup's first priority is
the breach, and — the SRE transplant that matters — **a breached budget pauses autonomy
expansion** (no new gate promotions, no autonomy widening) until green.
**Measure:** the SLOs themselves; budget-breach days per month.
**Iterate:** quarterly, tighten thresholds only if they've been green ≥1 quarter.

### Sequencing (builds on the H-plan's H0→H1 spine)

```
Week 1-2:  H0 quick wins  +  I2 outcome field  +  I3 first ritual  +  I5 deterministic layer
                │
Week 3-4:  I1 vocabulary/identity (with H1)  +  I4 first golden suite (daily-logger)  +  A (weekly session live)
                │
Month 2:   I5 judge calibration  →  I6 shadow  +  I7 pipeline  +  I8 SLOs in standup
                │
Month 3:   first H6/RIDM promotions (roadmap-lint CI, I6 shadow→blocking if agreement ≥ target)
           first persona-curator run (E)  ·  quarterly eval-set freeze/rotate
```

---

## 4. The anti-Goodhart contract (non-negotiables for every loop above)

Distilled from Anthropic's reward-hacking findings (arXiv 2511.18397), judge-drift literature,
and your own cultivate guardrail — which generalizes:

1. **Empty run is a success state — everywhere.** The triager (B), curator (I7), janitor (H),
   and persona curator (E) each log "nothing above threshold" as a valid, good outcome. Any
   loop rewarded for output volume will manufacture filler.
2. **Frozen holdouts.** The judge-regression set (I5) and one golden holdout per suite (I4)
   are never touched during development; living sets grow, frozen sets rotate quarterly by
   deliberate decision, logged.
3. **A judge is a product**: no judge output gates anything until it has a human-labeled
   agreement score, and every judge re-validates on model upgrades. Different model family
   from the generator where feasible.
4. **Promotion is never metric-only.** Shadow → trial → enforce, promotion criteria written
   *before* the shadow run starts, human sign-off recorded (RIDM note). ADR-0086 already says
   this; the addition is: **define the promotion criteria up front** — "shadow mode forever"
   (the audit's E-theme) is the failure mode on the other side.
5. **The loop never widens its own scope.** OPAV S5's firebreak (autonomy adjusts suggestion
   ranking only) extends to every I-slice: an agent may propose taxonomy entries, golden
   tasks, lessons, persona diffs — a human promotes them. Breached error budget (I8) freezes
   promotions fleet-wide.
6. **Report what was dropped.** Every sampler (B's 20–30 traces, A's snapshot) states its
   denominator and what it didn't look at — silent truncation reads as coverage.

---

## 5. First two weeks, concretely

1. Merge the audit's H0 quick wins (already specified; ~1 day total).
2. Add `outcome` to bead close + article accept/revise paths (I2 core; ~2 hours).
3. Build `verifyFileExistenceClaims()` + frontmatter arithmetic check in daily-logger
   (I5 deterministic layer; TD-001 finally closes; ~half day).
4. Run the first error-analysis ritual on the last 2 weeks of traces + the 2026-07-04
   `generation-failed` article; commit `failure-taxonomy.md` v1 (I3; one sitting).
5. Stand up the weekly measurement Routine (opportunity A) producing snapshot #2 of
   skill-metrics — the first re-measurement in the cluster's history (H7/E1).
6. Parse `Claude-Session:` trailers in the daily-logger sweep (I1's cheapest join; ~2 hours).

Everything above is proposal + shadow-first; nothing in this plan takes an enforcement action
without a recorded human promotion decision.

---

## Appendix — source index (primary)

- Anthropic: Building effective agents · Demystifying evals for AI agents · How we built our
  multi-agent research system · Claude Code best practices · claude-code monitoring/telemetry
  docs · "Natural emergent misalignment from reward hacking" (arXiv 2511.18397)
- Hamel Husain / Shreya Shankar: AI Evals FAQ · LLM-as-a-Judge guide (hamel.dev) ·
  "Who Validates the Validators?" (arXiv 2404.12272)
- OpenTelemetry: semantic-conventions-genai repo (Development status; gen_ai spans/metrics/
  agent-spans) — vocabulary adoptable without collector infrastructure
- τ-bench (arXiv 2406.12045) — pass^k consistency metric · Anthropic statistical approach to
  evals (arXiv 2411.00640) · CLT caution (arXiv 2503.01747)
- ACE — Agentic Context Engineering (arXiv 2510.04618) · Reflexion (2303.11366) · Voyager
  (2305.16291) · "LLMs Cannot Self-Correct Reasoning Yet" (2310.01798) · GEPA (2507.19457)
- LangChain trace-first improvement loop · Langfuse user-feedback docs · OpenAI evaluation
  flywheel cookbook · Temporal/durable-execution for agents · promptfoo / Inspect (harness
  categories)

Fetch caveat: anthropic.com/hamel.dev/openai.com blocked direct fetch from this environment's
proxy; those claims were corroborated via ≥2 independent secondary sources each (Simon
Willison, ByteByteGo, inkeep, ZenML) — spot-check exact wording against the originals before
quoting externally.
