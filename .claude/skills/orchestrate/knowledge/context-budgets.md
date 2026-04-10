# Context Budgets

Reference for `/orchestrate`. Defines what context each layer of the
progressive decomposition pipeline receives — and critically, what it
does NOT receive.

---

## Why context budgets matter

Large language models perform worse with irrelevant context. Passing an
entire architecture doc to an agent that only needs to edit one file dilutes
its attention and increases the chance of hallucinated changes. Each layer
receives the minimum context needed to do its specific job.

---

## Layer 0 — Central Orchestrator (`/frame-standup`)

**Role:** Morning planning, priority ranking, audit

**Receives:**
- `domain-knowledge/frame-os-context.md` — full roadmap and repo inventory
- All `domain-knowledge/<repo>-architecture.md` files (for audit)
- `personal-knowledge/` — job targets, deadlines (for priority ranking)
- Daily-logger structured API data (actions, decisions, tags)
- Per-app standup extensions (`.claude/standup.md`)
- Diagram intake output (if provided)

**Does NOT receive:** Source code files (it doesn't need to read code)

**Output:** Confirmed per-app priority list with tags, specificity, and
context file pointers.

---

## Layer 1 — Per-App Orchestrator

**Role:** Decompose priorities into discrete tasks for one app

**Receives:**
- `domain-knowledge/<repo>-architecture.md` — the ONE relevant architecture doc
- `~/ojfbot/<repo>/CLAUDE.md` — development setup and conventions
- `~/ojfbot/<repo>/.claude/standup.md` — current blockers and open work
- The priorities assigned to this app (from Layer 0)

**Does NOT receive:**
- Other apps' architecture docs or context
- `personal-knowledge/` (deadlines already factored into priorities)
- `frame-os-context.md` (roadmap already used at Layer 0 for ranking)
- Daily-logger raw data (already consumed at Layer 0)
- Source code (Layer 1 plans — it reads architecture docs, not code)

**Output:** Numbered task list with file paths, dependencies, and verification
criteria for each task.

---

## Layer 2 — Task Decomposer

**Role:** Refine a single task into implementation-ready instructions

**Receives:**
- The specific source file(s) identified by Layer 1 (read them)
- The specific test file(s) that verify this task
- An ADR or spec defining the target state (if applicable)
- A parallel implementation in another repo (if applicable, for following patterns)

**Does NOT receive:**
- Architecture overview docs (the task is already scoped)
- Standup extensions (blockers already handled at Layer 1)
- Roadmap context (priority already set)
- Other tasks' files (no cross-contamination)
- CLAUDE.md (conventions embedded in the source files themselves)

**Output:** A single Layer 3 execution prompt with exact change descriptions.

---

## Layer 3 — Execution Agent

**Role:** Implement a single change, run tests, open PR

**Receives:**
- The exact file(s) to modify (paths + what to change)
- The expected behavior after the change (success criteria)
- A verification command (e.g. `pnpm vitest run <test-file>`)
- The PR title and base branch

**Does NOT receive:**
- Architecture docs of any kind
- Roadmap or priority context
- Other tasks' descriptions
- Standup extensions
- Why this change matters (that's Layer 0-1's job)

**Output:** Code changes + PR.

---

## Context handoff pattern

Each layer's output IS the next layer's input. The key discipline:

```
Layer 0 output → Layer 1 input
  "cv-builder has 3 priorities today"
  + pointers to architecture doc + standup.md

Layer 1 output → Layer 2 input
  "Task 1.1: add GET /api/tools endpoint"
  + specific file paths: src/routes/tools.ts, src/__tests__/tools.test.ts
  + ADR: decisions/adr/0007-tools-contract.md

Layer 2 output → Layer 3 input
  "In src/routes/tools.ts: export function getTools(req, res) { ... }"
  + expected: GET /api/tools returns 200 with {tools: [...]}
  + verify: pnpm vitest run src/__tests__/tools.test.ts
```

Notice how the context narrows from "all of Frame OS" to "one function in
one file" across four layers. This is intentional.

---

## When to break the budget

Rarely. But acceptable when:
- Layer 2 discovers the task touches more files than Layer 1 predicted
  → expand scope but report the expansion
- Layer 3 hits a test failure caused by a dependency Layer 1 missed
  → escalate to Layer 1 for re-planning, don't try to fix adjacently
- Layer 1 can't decompose without reading source code (architecture doc
  is too stale) → read the minimum source files needed, flag the doc
  for `/doc-refactor`
