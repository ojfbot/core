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

---

$ARGUMENTS
