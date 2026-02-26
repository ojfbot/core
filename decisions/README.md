# Decisions

This directory is the written record of architectural and product decisions made in this project. It exists so that the reasoning behind how things are built is explicit, searchable, and can be challenged when circumstances change.

```
decisions/
  adr/     Architecture Decision Records — why the system is built the way it is
  okr/     Objectives and Key Results — what we are trying to achieve
```

---

## ADR index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0001](adr/0001-module-federation-not-iframes.md) | Module Federation over iframes for shell composition | Accepted | 2026-01 |
| [0002](adr/0002-single-llm-gateway.md) | Single LLM gateway (frame-agent) for all sub-apps | Accepted | 2026-01 |
| [0003](adr/0003-skill-directories-over-flat-files.md) | Skill directories over flat command files | Accepted | 2026-02 |
| [0004](adr/0004-pnpm-workspaces.md) | pnpm workspaces as the package manager for all monorepos | Accepted | 2026-01 |
| [0005](adr/0005-carbon-design-system.md) | IBM Carbon Design System for sub-app UI components | Accepted | 2026-01 |

---

## OKR index

| Period | File | Track |
|--------|------|-------|
| Q1 2026 | [okr/2026-q1.md](okr/2026-q1.md) | Technical |

Personal/career OKRs live in `personal-knowledge/okr/` (not tracked publicly).

---

## How to write an ADR

Use `/adr new "title of the decision"` to generate a stub from the template.

Or copy [adr/template.md](adr/template.md) manually. Filename convention: `XXXX-kebab-case-title.md`.

**Status lifecycle:** `Proposed` → `Accepted` → `Deprecated` / `Superseded-by: ADR-XXXX`

### When to write an ADR

Write one when you are making a decision that:
- Affects multiple repos or multiple commands
- Involves a trade-off (you rejected at least one alternative)
- Would be confusing to a future reader without context
- Is mentioned in a `/validate`, `/investigate`, or `/techdebt` output

### The "3 places" rule

When a mistake or pattern is caught and a decision is updated:
1. Update or add the ADR (here)
2. Update the relevant `knowledge/` file in the affected command
3. Update `memory/MEMORY.md` with the summary

This is the full write-back loop. Stopping at step 1 means the next session won't have the context loaded.
