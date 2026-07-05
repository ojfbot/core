---
id: 20260705-brief-pickup-audit-tranche-2-eval-layer
type: brief
title: "Pickup: audit tranche 2 (PH4, S16–S21) — the evaluation layer. Tranche 1 is 6/6 merged."
actor: code-claude
responding_to: 20260704-brief-pickup-audit-program-tranche-1-verifier-wired
session_id: 2026-07-04-multiagentic-audit
refs:
  - file:core/decisions/northstar/roadmap-l2-ojfbot.md
  - file:core/scripts/audit-delivery-check.mjs
  - file:core/AGENTIC-INTEGRATION-PLAN-2026-07-04.md
  - file:core/.handoff/20260704-report-s11-s12-shipped-truth-pipeline-cockpit-honesty.md
hook: "Run `node scripts/audit-delivery-check.mjs` FIRST; trust its verdicts over any narrative, including this bead. Then read PH4 in roadmap-l2-ojfbot.md — the slices are the spec."
status: live
labels:
  domain: workflow-engine
  project: audit-2026-07-04
  priority: P1
---

## Where the program stands (2026-07-05, end of the tranche-1 session)

Tranche 1 (S10–S15) is **6/6 merged** with movement recorded through P2=26: delivery oracle +
weekly-measure cadence (S13) · daily-logger truth pipeline (S11) · cockpit honesty + 5-state
liveness (S12) · OPAV plan recovered + committed (S10) · day-runner SHADOW verification stage +
record-movement manual-path guard (S14) · verifiability-sorted dispatch, schema v1.1 `check:`
field + compile-time demotion + /triage routing (S15). Oracle at close: 15 DELIVERED · 1
PARTIAL · 11 MISSING · 0 REGRESSED. PRs: core#192/#193/#194/#195/#196/#197,
daily-logger#225, morning-cockpit#25.

## Your mandate

Drive PH4 (S16–S21) the way tranche 1 was driven: slice statuses on the roadmap are the queue;
the oracle is the acceptance authority; every PR body carries Roadmap-Ref + Movement proposal
lines; the operator merges (gate-0) and runs record-movement on his Mac (main is PR-only — the
odometer commit goes via a data/ branch + PR). Work on branch
`claude/ojfbot-multiagentic-audit-l6555n` in each repo; if the branch's PR merged, restart it
from origin/main (same name).

**Recommended order:** S16 (agent, unblocks nothing but is the first-ever RIDM promotion —
scope out the 5 registry missing-file ERRORs first, they are working-copy artifacts) → S18 ∥
S21 (agent) → S17 (NEEDS THE OPERATOR, 30–60 min: sample ~20–30 traces/beads/articles
including the 2026-07-04 generation-failed one, open-code failures, propose clusters, he
approves) → S19 (deps S17) → S20 (NEEDS THE OPERATOR: 30–50 labels).

## Do not re-litigate

- Shadow-first everywhere; the S14 checks stay record-only until ~20 shadow runs justify an
  RIDM promotion; S14's `success_criterion.evaluated:false` stays false until S20's judge is
  calibrated (≥90% agreement, frozen regression set).
- The OPAV S5 firebreak and the anti-Goodhart contract (AGENTIC-INTEGRATION-PLAN §4) bind
  every slice: empty run = success state; frozen holdouts; no metric-only promotion; loops
  never widen their own scope.
- Six open slices is the attention budget — do not cut PH5 until PH4 merges.
- A session never writes status.jsonl (roadmap-schema § Movement contract).
- If a slice's oracle predicate proves wrong, fix the predicate in the same PR.

## Standing environment facts (learned the hard way this session)

- Cloud containers: no `gh` CLI (use GitHub MCP tools), no Dolt, no Mac telemetry — oracle
  checks touching those read from the local clones; artifacts carry a `vantage` block, never
  diff across vantages. Sibling repos resolve via ~/ojfbot fallback.
- core + daily-logger allow REBASE merges only; morning-cockpit allows squash. GitHub's
  rebase-merge commits always read Unverified — the stop-hook nag about them is a false
  positive; never rewrite merged history.
- The weekly-driver trigger (create_trigger) is still approval-walled; drives are manual until
  the operator's tap lands.
- Open loose ends: vault sync committed on the Mac but never pushed (P6.1 MISSING);
  daily-logger CLAUDE.md still has phantom ADR filename refs; cockpit SDL enum needs the
  core-side canonical change before STALLED/ZOMBIE wire to GraphQL; a live Mac `day-run
  --once` is still owed as the S14/S15 end-to-end proof; legs-band slices (S1/S2/S4) have
  moves_from drift vs P2=26 — standup replan item.
