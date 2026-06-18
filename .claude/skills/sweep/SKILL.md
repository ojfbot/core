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

## Gotchas

- **"Unused import" is a claim the bundler can disprove.** An import with no obvious reference may still be a side-effecting module, a type-only import, or pulled in for ambient declarations. Removing it on appearance breaks the build in ways that don't show in the diff. When in doubt, flag for judgment — don't auto-apply.
- **`--apply` only touches items the catalog marks safe.** The pull is to also fix the "obviously dead" commented-out block or the magic-number duplication while you're there. Those need judgment and stay in the report. Auto-applying anything not explicitly classified safe is how a cleanup pass introduces a regression.
- **Commented-out code can be load-bearing documentation.** A commented block may be a deliberate example, a disabled-on-purpose path, or a reference the team kept intentionally. Deleting it as "noise" loses context that wasn't in version control's reach for that reader. Flag it; let a human decide.
- **A TODO tied to a real issue is not stale.** Before flagging a TODO/FIXME, check for a tracking reference (issue number, ticket). Those are intentional markers, not rot — leave them and note the link. Sweeping them away erases the backlog's breadcrumbs.
- **Hands off business logic — config duplication is the edge.** Magic strings repeated 3+× look like a trivial extract-constant, but consolidating them can change behavior if the values diverged on purpose. Report the duplication; don't refactor logic or rename public APIs/exports without checking every call site.

---

$ARGUMENTS
