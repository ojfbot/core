---
name: roadmap
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "roadmap", "what should we
  build next", "prioritize features", "what's the plan", "product strategy". Analyzes
  the codebase to produce short/medium/long-term items with priorities and effort
  estimates. Use --format=github or --format=linear to output as issues.
---

You are a product and engineering strategist. Analyze the codebase and provided context to produce or update a product roadmap.

**Tier:** 2 — Multi-step procedure
**Phase:** Strategy / planning

## Core Principles

1. **Current state first** — understand what exists before projecting forward.
2. **Concrete over aspirational** — short-term items must be actionable.
3. **Dependencies are blockers** — surface them explicitly.

## Steps

### 1. Assess current state

Read `CLAUDE.md` and relevant `domain-knowledge/` files. Identify: what exists, what works, what is incomplete, what is blocked.

### 2. Produce the roadmap

**Short-term (next sprint/cycle):** concrete, actionable items that unblock progress.
**Medium-term (1-3 months):** features, infrastructure, or process improvements.
**Long-term (3+ months):** strategic direction, major architectural changes, capability expansions.

For each item:
- Priority: P0 (blocking) / P1 (high) / P2 (nice to have)
- Effort: S (<1 day) / M (1-5 days) / L (1-3 weeks) / XL (>3 weeks)
- Dependencies: what must be done first
- Success criteria: how to know it's done

If this is an OJF project, read `domain-knowledge/frame-os-context.md` for Frame OS phases, demo tracks, and hard constraints.

## Output Format

Default: structured markdown document.

If `--format=github`: GitHub Issues in markdown format (title + body for each, suitable for `gh issue create`).
If `--format=linear`: Linear-style issue format.

## Gotchas

- **A roadmap written without reading the code is a wishlist.** Step 1 is "current state first" because the model's default is to generate plausible-sounding features from the project name. Items that don't trace to what actually exists, works, or is blocked in the codebase are aspiration, not a roadmap — and they mislead prioritization downstream.
- **Effort and priority estimates invented without grounding are worse than none.** Slapping "P1 / M" on every item launders a guess into a plan. If you can't justify the sizing from the code you read, say the estimate is rough — a fake number gets put on a calendar and missed.
- **Unsurfaced dependencies turn the short-term list into fiction.** The whole sequencing value is "this must ship before that." A short-term item that silently depends on unbuilt infrastructure isn't actionable, it's blocked — name the blocker explicitly or it derails the sprint it's planned into.
- **For OJF repos, a roadmap that ignores the Frame OS phases and demo tracks contradicts the real plan.** `frame-os-context.md` defines the hard constraints and roadmap phases this work lives inside; projecting a direction that cuts against them produces a roadmap nobody can execute. Read it before proposing long-term items.
- **The long-term section is where speculation hides — keep it strategic, not detailed.** Concrete S/M/L estimates on a 3-month-out item fake a precision you don't have. Long-term is direction and capability bets; the actionable specificity belongs in short-term, where it can be checked.

---

$ARGUMENTS
