---
name: prototype
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "prototype", "spike this",
  "throwaway prototype", "try a quick experiment", "explore a few UI options", "build a
  scratch version to test X". Builds disposable code that answers one specific question —
  either an interactive terminal harness for logic/state-machine edge cases, or several
  radically different UI variants switchable by URL param. Output: a runnable prototype,
  a written verdict, then deletion. Not production code — no tests, no error handling, no abstractions.
---

# /prototype

You are an engineer building a **throwaway prototype**: code whose only job is to answer a question that is hard to reason about abstractly. Once it answers the question, it gets deleted and the answer is recorded somewhere durable.

**Input:** $ARGUMENTS — the question to answer (e.g. "does this state machine handle a cancelled-then-resumed SSE stream?", "which of 3 layouts feels right for the itinerary lens?").

**Tier:** 2 — Multi-step procedure
**Phase:** kick-off (design exploration, before `/scaffold` or during `/tdd` when a design branch is unclear)

## Core Principles

1. **A prototype answers ONE question** — state it explicitly before writing code. If you can't name the question, you don't need a prototype.
2. **Throwaway means throwaway** — mark every file `// PROTOTYPE — delete after <question>`. Co-locate next to the code under test, not in a separate playground repo.
3. **One command to run** — wire it into the project's existing task runner (`pnpm --filter <app> prototype:<name>` or a `scripts/` entry). No bespoke build.
4. **No persistence** — in-memory only, unless the question *is* about persistence.
5. **Speed over polish** — no tests, no error handling, no abstractions, no types beyond what makes it run.
6. **Show full state after every action** — print/render the entire relevant state each step so changes are visible.

## Workflow

### Step 1 — State the question

One sentence. Write it at the top of the prototype file and in your reply. Pick the mode:

- **Logic mode** — the question is about behavior, state transitions, edge cases, ordering, concurrency. → interactive terminal harness.
- **UI mode** — the question is about layout, interaction feel, information density, visual hierarchy. → multiple variants in one route, switched by `?variant=` param.

### Step 2a — Logic mode: build a terminal harness

- A tiny CLI loop (Node `readline` / Python `input()`) that lets you fire the inputs/events the real system would receive.
- After each input, print the **complete** state (the LangGraph state object, the reducer output, the SSE buffer — whatever the question is about).
- Drive it through the hard cases by hand: out-of-order events, cancellation, double-submit, empty input, the case nobody can reason about on a whiteboard.

### Step 2b — UI mode: build N variants

- One page/route. `const variant = new URLSearchParams(location.search).get("variant")`.
- 2–4 **radically different** takes — not tweaks. Different layouts, different interaction models. Hardcode fake data.
- Use the project's real component library (Carbon) so the comparison is honest, but skip wiring real data/state.
- List the variant URLs in your reply so the user can flip between them side by side.

### Step 3 — Answer the question

Run it. Drive it. Write down: **the question, what you observed, the verdict** (which variant won / whether the logic holds / what breaks).

### Step 4 — Resolve

- Record the verdict somewhere durable: a commit message, an ADR (run `/adr` if it's an architectural decision), a note in the relevant `domain-knowledge/*-architecture.md`, or the PRD/issue.
- **Delete the prototype** (or leave it only if the user explicitly wants it kept as a reference; then it stays clearly marked).
- Hand off: the validated finding now feeds `/scaffold`, `/tdd`, or `/plan-feature`.

## Output

```
## Prototype: <question>

Mode: logic | ui
Run: <exact command or variant URLs>

### Observations
<what happened when you drove it>

### Verdict
<the answer — which variant, whether it holds, what breaks>

### Recorded in
<commit / ADR-NNNN / architecture doc / issue>

### Disposition
Deleted | Kept (marked) — <why>
```

---

$ARGUMENTS

## See Also
- If the verdict is an architectural decision, run `/adr` to record it.
- Feed the validated design into `/scaffold` (structure) or `/tdd` (implementation).
- For a broader read of the area before prototyping, run `/zoom-out` or `/recon`.
