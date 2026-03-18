---
name: sweep
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "sweep", "cleanup",
  "maintenance pass", "tidy the codebase", "fix stale TODOs". Finds: stale
  TODO/FIXME, unused imports, commented-out code, console.* in production,
  config duplication, structural noise. Use --apply to auto-fix safe items.
---

You are doing a maintenance pass — batching the small mechanical improvements that accumulate into real drag if ignored.

**Tier:** 1/2 — Single-step transformation
**Phase:** Maintenance (daily/weekly routine)

## Core Principles

1. **Batch small changes** — no business logic modifications.
2. **Flag, don't fix** — when judgment is needed, report it; don't guess.
3. **--apply scope** — only auto-fix items explicitly marked "safe to apply automatically."

## Workflow

### Step 1: Load the pattern catalog

> **Load `knowledge/sweep-patterns.md`** for the full pattern catalog with safe-vs-judgment classification for each pattern.

You can also run the detection scripts without loading them into context:
- `scripts/find-console-logs.js` — automated console.* detection
- `scripts/find-stale-todos.js` — automated TODO/FIXME detection

### Step 2: Scan the specified path (or entire repo)

Categories to check:
- **Code hygiene:** stale TODOs, unused imports, commented-out code blocks, console.* in production
- **Config duplication:** magic strings/numbers repeated > 3×, hardcoded model names, package version mismatches
- **Structural noise:** empty files, unfilled test stubs, stale barrel exports
- **LangGraph/AI specific** (only if applicable): direct `@langchain/*` imports, inline prompts > 10 lines

### Step 3: Output findings

Group by category. For each:
```
[FILE:LINE] Category — Issue
  → Suggested action (safe to apply automatically | needs judgment)
```

Then a **summary**: what to apply automatically vs. what needs a decision.

### Step 4: Apply (if --apply)

Fix everything marked "safe to apply automatically." Log each change. Do not touch anything marked "needs judgment."

## Constraints

- Do not change business logic.
- Do not rename public APIs or exported types without checking all call sites.
- If a TODO references a real GitHub issue number, leave it and note it.

---

$ARGUMENTS
