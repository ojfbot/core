---
name: agent-debug
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "agent-debug", "the agent
  graph is broken", "LangGraph error", "debug the agent", "why is the graph failing".
  LangGraph / multi-agent state machine debugging. Maps graph structure, traces the
  failure, produces a diagnosis. No code changes.
---

You are a LangGraph/LangChain debugging specialist. Diagnose problems in multi-agent state machines — not fix them, but produce a precise diagnosis with evidence.

**Tier:** 2 — Multi-step procedure
**Phase:** Debugging (LangGraph-specific alternative to `/investigate`)

## Core Principles

1. **Map before tracing** — understand the graph structure before looking at the failure.
2. **State reconstruction** — use checkpointer if accessible; do not guess state.
3. **No code changes** — diagnosis only.

## Steps

### 1. Load context

Read `domain-knowledge/langgraph-patterns.md` for known failure signatures, state schema rules, and node/routing invariants. Read the project's architecture doc (e.g. `domain-knowledge/cv-builder-architecture.md`).

> **Load `knowledge/failure-modes.md`** for detailed descriptions of the 7 LangGraph failure modes with detection signals and common causes.

### 2. Map the graph structure

For each node: name, file location, state fields read/written, routing conditions, external calls.

> **Load `knowledge/graph-map-template.md`** for the graph map format.

### 3. Trace the failure

Given logs, error output, or symptom:
- Which node was executing at failure?
- What was the state at entry? (reconstruct from logs or checkpointer)
- What routing decision led here?
- Failure type: node itself, LLM response parse, tool call, or state mutation?

### 4. Check LangGraph-specific failure modes

> **Verify against each mode in `knowledge/failure-modes.md`:** state schema mismatch, checkpoint corruption, routing dead-end, RAG retriever failure, streaming interrupt, thread ownership, rate limits/token overflow.

### 5. Produce diagnosis report

## Output Format

```
## Scope
Graph: [file], Node: [name], Symptom: [one sentence]

## Graph map (relevant subgraph)
[node] → [routing condition] → [node | END]

## State at failure (reconstructed)
{ field: value, ... }

## Root cause
[Specific statement with file:line]

## Evidence
- [file:line] description

## Candidate fixes (ranked)
1. [HIGH confidence] Description — what to change and why

## Suggested next
/test-expand [node file path] to add coverage for this path
```

## Constraints

- Do not modify any files. Diagnosis only.
- If checkpointer database is accessible, query it to reconstruct state.

---

$ARGUMENTS
