# Skill flows — the lifecycle on-ramps map

Absorbed from mattpocock/skills v1.1 `ask-matt` (verdict D15, `decisions/adopt-stack/pocock-skills-v1-1.md`):
the router *skill* was rejected — the suggest-skill hook + catalog triggers are the measured discovery
mechanism here (hook-forced eval 84–100% vs router ~80%, `decisions/research/2026-07-17-skill-loop-sota.md`)
— but the router's *map of flows* is worth keeping. This file is that map, for `/skill-loader` and any
agent orienting on "which skill comes next."

## The main flow (an idea becomes merged code)

```
idea
 └─ /grill-with-docs ──────────────── shared design concept (confirmation stop-gate)
     └─ /plan-feature --from-conversation ── spec (seams confirmed → Testing Decisions)
         └─ /orchestrate --emit=github-issues ── tracer-bullet tickets w/ blocking edges
             └─ per ticket (frontier order): implement per the execution contract
                 ├─ /tdd at the pre-agreed seams (red → green; refactor at green)
                 ├─ typecheck + single-file tests regularly; full suite once at end
                 ├─ /pr-review (two parallel axes + smell baseline) or /validate
                 └─ commit; PR; human merges (gate-0)
```

## On-ramps (situational entries that merge onto the main flow)

- **Too big / wrapped in fog** → `/wayfinder` (chart decisions, work the frontier) → hands off at
  `/plan-feature --from-conversation`, or `/gated-slice` for enforcement-bearing initiatives.
  Litmus: check-statable → roadmap slice · question-statable → wayfinder ticket · else fog.
- **Staged shipping of a decided initiative** → `/gated-slice` → slices land on a northstar roadmap
  → dispatched by `/day-run`.
- **Something is broken** → `/investigate` (cause map) → main flow at the fix's spec/ticket.
- **Backlog full of issues/PRs** → `/triage` (labels, order, `ready-for-agent` promotion).
- **Unknown design branch** → `/prototype` (one question, disposable; primary-source branch
  disposition available) → verdict feeds the spec.
- **Unknown territory** → `/recon` (cold start) or `/zoom-out` (in-loop orientation).
- **Question needing sources** → the deep-research workflow harness (serial, one cycle at a time)
  → findings filed to `decisions/research/`.

## Context hygiene

One ticket / one slice per fresh session. Specs and tickets are written to be consumed by a fresh
context window — that sizing rule is load-bearing, not stylistic (upstream's "smart zone" point,
kept without the token arithmetic).

## Sources

- `decisions/adr/0100-pocock-lifecycle-absorption.md` (lifecycle + improvement-loop contract)
- `decisions/adr/0101-wayfinder-decision-maps.md` (boundary rule, placement litmus)
- `decisions/adr/0099-two-axis-review-hardening.md` (review axes)
- upstream `skills/engineering/ask-matt` @ `ed37663` (shape only; router rejected)
