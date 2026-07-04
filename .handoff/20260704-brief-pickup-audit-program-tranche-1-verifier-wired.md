---
id: 20260704-brief-pickup-audit-program-tranche-1-verifier-wired
type: brief
title: "Pickup: 2026-07-04 audit program tranche 1 — verifier is the contract, roadmap PH3 is the queue"
actor: code-claude
session_id: 2026-07-04-multiagentic-audit
refs:
  - file:core/MULTIAGENT-SDLC-AUDIT-2026-07-04.md
  - file:core/AGENTIC-INTEGRATION-PLAN-2026-07-04.md
  - file:core/FLEET-COORDINATION-EXTENSIONS-2026-07-04.md
  - file:core/scripts/audit-delivery-check.mjs
  - file:core/decisions/northstar/roadmap-l2-ojfbot.md
hook: "Run `node scripts/audit-delivery-check.mjs` FIRST. Trust its verdicts over any narrative — including this bead."
status: live
labels:
  domain: workflow-engine
  project: audit-2026-07-04
  priority: P1
---

## For the next agent

A 3-cycle audit (2026-07-04) produced three program documents (~27 slices of promised work) on
branch `claude/ojfbot-multiagentic-audit-l6555n`. The operator's concern: "big and sprawling
beyond human attention." The answer built this session:

1. **`scripts/audit-delivery-check.mjs`** — the delivery oracle. One deterministic predicate per
   promised artifact (27 checks), 3 baseline regression guards, a 14-day staleness gate.
   Baseline verdict at commit time: **3 DELIVERED (baselines) · 24 MISSING** — that is the honest
   starting truth, not a failure. `--json` for machines, `--check` for gating.
2. **`roadmap-l2-ojfbot.md` PH3 (S10–S15)** — tranche 1 encoded on the existing dispatch rails.
   S10–S13 `ready` (S10 human-only: the OPAV plan file exists only on the operator's Mac);
   S14→S13, S15→S14 dependencies are deliberate. Every slice's `success:` names verifier checks.

## The delivery contract (do not re-litigate)

- **The verifier is the source of truth for "delivered".** A slice is done when its named checks
  print DELIVERED, not when a session says so. If you ship a slice, re-run the verifier and
  paste its output into the PR body as the movement evidence.
- **Six open slices is the attention budget.** Do NOT add PH4/more slices until tranche 1 is
  `merged`. The remaining ~21 program slices wait inside the three documents.
- **When you deliver a slice whose predicate is wrong or too weak, fix the predicate in the same
  PR** — the checker and the promises must move together or the oracle rots.
- Staleness: >14 days with no program commit while slices are undelivered ⇒ `--check` fails.
  The intended consumer is the S13 weekly routine and `/frame-standup`.

## Recommended first session

S11 (daily-logger truth pipeline) — `agent_eligible`, fully specified by verifier checks
H2.1/I5.1/I5.2/H0.3, closes TD-001 (open since March). S10 needs the operator (file on his Mac).
