# Loop-Engineering Cross-Check — the loop-engineering discipline + the Advisor tool vs the audit program — 2026-07-09

Cycle 5 of the 2026-07-04 audit series. Cycle 1 (`MULTIAGENT-SDLC-AUDIT-…`) found the gaps;
cycle 2 (`AGENTIC-INTEGRATION-PLAN-…`) mapped industry eval/observability consensus onto them;
cycle 3 (`FLEET-COORDINATION-EXTENSIONS-…`) asked Karpathy/Yegge/Pocock; cycle 4
(`DIA-CROSSCHECK-…`) reconciled an external SOTA survey. This cycle reconciles two newer
external directions: (1) **"loop engineering"** as named by Boris Cherny ("I don't prompt
Claude anymore, I have loops running that prompt Claude"), formalized by Addy Osmani and
synthesized by Greyling/Masood — the discipline of designing the control system around agents
(triggers, state, verifiers, topology, stop rules) so loops, not humans, prompt the models;
and (2) Anthropic's multi-model orchestration direction, supplied to this cycle as
"Advisor-Executor". Source material: an operator-commissioned Dia research thread (2026-07-09)
plus primary-source verification run this session. Slice: `rm:rm-l2-ojfbot#S28`.

**Two terminology corrections carried up front** (primary sources verified this session,
unlike the Dia thread's secondary framing):

1. **"Advisor-Executor" is not Anthropic's terminology.** The shipped feature is the
   **Advisor tool** (Claude API beta, header `anthropic-beta: advisor-tool-2026-03-01`): a
   cheaper *executor* model (Haiku/Sonnet) runs the task end-to-end and invokes a stronger
   *advisor* (Sonnet 4.6+/Opus/Fable) mid-generation via a `server_tool_use` block; the
   advisor reads the executor's transcript and returns guidance; **the executor keeps stop
   authority** (the advisor has no veto; `max_uses` caps invocations per request). Published
   numbers: Sonnet 4.6 + Opus 4.8 advisor = **+2.7pp** SWE-bench Multilingual and **−11.9%
   cost** per agentic task vs Sonnet alone. It is an API feature, not a Claude Code feature.
2. **The loop-engineering building blocks are now product surface** in Claude Code (`/loop`,
   `/goal`-style verifiable-condition runs, `/schedule` cloud routines, lifecycle hooks,
   worktree'd subagents, workflow orchestration). This cluster built bespoke equivalents
   before those existed — which turns part of this cross-check into a wrap/absorb/reject
   question (§2a), the `/adopt-stack` lens applied to our own harness vendor.

---

## 1. What the loop-engineering framing confirms (the convergent bulk)

The discipline's named building blocks map almost one-to-one onto machinery that is live or
already programmed:

| Loop-engineering building block | Already in the program as |
|---|---|
| Triggers/schedules drive work, not humans | launchd rails (`scripts/sync-telemetry-launchd.plist`, `dolt-beads-launchd.plist`, `skill-architecture-audit-launchd.plist`); daily-logger GH Actions crons (`daily-blog.yml` et al.); session lifecycle hooks (`scripts/hooks/`) |
| Worktree isolation per sub-agent | day-runner worktrees under `~/.cache/day-runner/` outside `~/ojfbot` (S14 merged; GLOSSARY "Day-runner") |
| Maker/checker split — workers never grade their own homework | day-runner 5-clause slice-boundary contract + `scripts/lib/shadow-checks.mjs`; `record-movement.mjs` refuses unmerged PRs; daily-logger editorial council; OPAV two-source reconciler (`scripts/hooks/reconcile-skill-acted.mjs`, ADR-0095) |
| Durable state spine the loop reads/writes | `decisions/northstar/` frontmatter + `status.jsonl` append-only ledger; Dolt `beads`/`bead_events`; cockpit read-model |
| Skills / project memory hydrating every run | 40+ skills + `skill-catalog.json`; `domain-knowledge/`; ADR-0081 loading discipline |
| Stop rules and budgets | day-runner `--timeout-mins`/`--max`; queue lease TTLs (`bead-emit.mjs`); gate-0 stops-at-PR; RIDM promotion doctrine (ADR-0086) |
| Goal-condition verification ("done?" is checkable, held outside the worker) | per-slice deterministic `check:` commands; `audit-delivery-check.mjs --check` with staleness gate; S15 verifiability-sorted dispatch |
| MCP/tool connectors so loops act, not observe | `gh` CLI throughout day-runner + workflows; Dolt SQL; `.claude/.mcp.json` (notion, github) |
| Loops decide what happens next (closure) | OPAV S3 action-rate gate + S5 Routing-Feedback Writer — **designed, not shipped**; convergent as *program*, honest gap as *runtime* (cycle-1 finding stands) |

Verdict on the bulk: **convergent — no action.** The framing is the control-theory name for
what cycles 1–4 already programmed; where it prescribes topology patterns (planner→worker→
verifier, fan-out), cycle 2 consensus #10 and cycle 3 F4 already carry them with entrance
criteria intact.

## 2. The five genuine deltas, adjudicated

Format as cycle 4: the claim, the adjudication, a grep-able verdict line. Operator sign-off =
merge of this PR.

### 2a. Harness-native loop primitives vs the bespoke loop layer

Claude Code now ships the trigger/goal layer this cluster hand-built: `/loop` (interval
re-prompting), `/schedule`/routines (cron cloud agents), `/goal`-style run-until-verified,
hooks, worktree'd subagents. The question is adopt-stack-shaped: which bespoke opinions are
load-bearing vs incidental?

The dispatch/verify layer is load-bearing and has no product equivalent: Dolt CAS
queue-claim, the 5-clause slice-boundary contract, shadow checks, RIDM promotion, the
merge-gated odometer. Nothing in `/loop` or routines knows a slice, a lease, or an oracle
predicate. The *trigger* layer, by contrast, is incidental plumbing: a launchd plist that
fires a script on a schedule carries no opinion a routine couldn't carry.

VERDICT: PARTIAL-ABSORB (policy, no migration slice) — new schedule-plus-prompt loops default
to harness-native primitives (routine or `/loop`) where no queue/worktree/oracle contract is
involved; existing launchd rails stay until a loop needs changing anyway (working plists are
not debt); REJECT replacing the dispatch/verify layer. The open S25 decision (day-runner:
manual ritual vs schedule) should weigh the harness-routine option alongside launchd — this
doc is an input to S25, not an amendment of it.

### 2b. The Advisor tool (multi-model executor+advisor in one request)

Adjudicated on paper per operator decision — no spike. Candidate sites, examined:

- **day-runner worker sessions** — blocked on transport: workers run via `claude -p` CLI;
  the Advisor tool is an API-request feature. Not reachable without re-platforming the
  runner, which nothing else justifies.
- **the S20 judge** — conflicts with the standing posture. S20 calibrates ONE static judge
  against operator labels with a frozen regression set (cycle-4 §2d re-affirmed this against
  CLHF for the same reason): a judge whose reasoning depends on a mid-generation advisor call
  is harder to freeze and re-validate. Keep the judge single-model.
- **the bldgblog annotate loop** (Opus=teacher/Haiku=volume, currently HELD) — the natural
  fit: already API-side, already cost-motivated, already framed as strong-model-guides-cheap-
  model. If the HOLD ever lifts, executor=Haiku + advisor=Opus is exactly the published
  use case (+quality at Haiku-adjacent cost).

The blocking fact is cycle-1 T8: **no cost/latency telemetry exists anywhere** — the Advisor
tool is sold on a cost/quality tradeoff this cluster cannot currently measure. Same logic as
cycle-4 §2b (test-time-compute allocation): you cannot tune a lever you cannot read.

VERDICT: DEFER — entrance criteria: T8 closed (cost_usd + duration on dispatched-task
telemetry, one month of data) AND a live API-side workload (bldgblog annotate un-HELD is the
named revisit site). Not for day-runner (transport mismatch), not for the S20 judge (posture
conflict). No slice cut; the verdict line is the artifact.

### 2c. Loops as first-class named resources — a loop registry

The one structural idea in the thread the program genuinely lacks. Every loop in this cluster
(3 launchd rails, daily-logger's 4+ Actions crons, the session hooks, day-runner, the weekly
measure cadence) exists only as its implementation artifact, scattered across `scripts/*.plist`,
`.github/workflows/`, `~/.claude/settings.json`, and prose. No single place answers: what
loops exist, what triggers each, where its state lives, what verifies it, what its stop
rule/budget is. The audit series itself keeps paying for this: O8 (registry-vs-disk drift
silently skipped), P12 (no read-model reports its own input-age), T4 (Dolt outage ⇒ silent
no-op with no alarm), and the S25 finding that day-run "runs NOWHERE" surprised the program a
week ago. Precedent for the fix is in-house: the northstar registry + `northstar-lint.mjs`
did exactly this for properties (declared-vs-disk cross-check, lint operational since S16).

VERDICT: BUILD → slice `rm:rm-l2-ojfbot#S29` — a declared loops registry
(`decisions/loops/loops.md`, constrained frontmatter in the northstar-fm style: slug, purpose,
trigger kind+ref, state spine, verifier, stop rule/budget, owner, cadence) + a deterministic
`scripts/loops-lint.mjs` that cross-checks declarations against actual plists/workflows/hook
registrations both directions (undeclared loop = WARN, declared-but-absent = ERROR). Naming
follows the name-by-purpose rule: the registry names what each loop is *for*; launchd/Actions/
routine is a labeled trigger adapter, so 2a migrations later are a one-field edit.

### 2d. Loop liveness — detecting dead loops, not just dead agents

The thread's "heartbeat" concern, narrowed to what cycles 1–3 don't already own. F5 (five-state
agent liveness) covers *agent* processes; F3 (push escalation) designed the *paging rail* but
its emitters are work-item events (quarantine, SLO breach, repeated failure). Neither notices
an *infrastructure loop* dying: T4 names it for Dolt (all bead emissions `|| true`; Dolt down ⇒
silent no-op, "no buffer, retry, or alarm"), and the same failure mode holds for a launchd
job that stops firing or an Actions cron disabled by a closed issue (the daily-logger A2
gotcha). A loop that dies silently is the exact failure loop engineering exists to prevent —
and today the only detector is the operator noticing an absence.

VERDICT: BUILD → slice `rm:rm-l2-ojfbot#S30` (depends on S29) — a deterministic
`scripts/loops-liveness.mjs` that reads the loops registry, checks each declared loop's
last-run evidence (ledger append recency, workflow run timestamp, plist last-fire) against
its declared cadence, and reports stale/dead loops. Detection only, shadow posture: it emits
a report (cockpit Overnight lane / bead), it does not page and does not restart anything —
paging is F3's rail (this becomes an F3 emitter when F3 lands), and auto-restart would be an
automated control requiring its own ADR-0086 shadow stage.

### 2e. Loop closure — "verifier output feeds the next dispatch"

The thread's strongest rhetorical point ("the loop decides whether to continue") is the
program's oldest open item, not a new delta. OPAV S3 (action-rate confidence gate) and S5
(Routing-Feedback Writer, the loop closure, behind the invariant-7 firebreak: routing
feedback adjusts suggestion *ranking* only, never autonomy scope) specify precisely this,
gated behind S0→S1 honesty machinery that partially shipped (S1 shadow; C3 capture-quality
verification is S22, queued). External convergence on the design is welcome; it does not
change the entrance criteria, and the degenerate C3 distribution (190/3/0/0, cycle-1 →
PH5 rationale) is exactly why closure waits for capture quality.

VERDICT: CONVERGENT — no action; the thread independently validates the OPAV S3/S5 design
and its ordering (capture quality before any rate, rate before any closure). S22→S23 proceed
unchanged.

## 3. Ordering impact + slices cut

Existing tranches: **unchanged.** S22–S26 (PH5) proceed as cut; S25 gains this doc as an
input (§2a); S20's static-judge posture is re-affirmed a second consecutive cycle (§2b).

Unlike cycle 4, this cycle cuts slices (operator decision at plan approval): **PH6** with
S28 (this document), S29 (loops registry + lint), S30 (loops liveness, detection-only,
depends on S29). Both BUILD slices are `agent_eligible` with deterministic `check:` commands,
keeping the agent-attention budget within the PH5 WIP note's reading. F6 (context budgets)
remains the named companion candidate for a future tranche and is not folded in here.

## Appendix — source note

Operator-supplied Dia research thread (2026-07-09) synthesizing: Boris Cherny's public
loop-engineering statements (via The New Stack, "the Anthropic leader who built Claude Code…
now he just writes loops"), Addy Osmani "Loop Engineering" (addyosmani.com/blog/loop-engineering),
Cobus Greyling (cobusgreyling.substack.com/p/loop-engineering), Adnan Masood (Medium guide),
Peter Steinberger. Advisor-tool facts verified this session against the primary source
(platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool, beta
`advisor-tool-2026-03-01`), which supersedes the thread's "Advisor-Executor" framing. As in
cycle 4: the thread's role here is hypothesis generator, not evidence; every §1/§2 claim about
this cluster is adjudicated against repo files and the cycle-1..4 evidence base.
