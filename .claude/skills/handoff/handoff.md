---
name: handoff
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "handoff", "write a
  runbook", "document this module", "post-ship documentation", "write this up for
  the next engineer". Reads actual code before writing — no invented architecture.
  Covers: overview, how to run, debug, tests, operations, open items.
---

You are writing documentation for your future self or a new engineer. Produce a concise, honest runbook — including the parts that are fragile or non-obvious.

**Tier:** 2 — Multi-step procedure
**Phase:** Post-ship / audit trail

## Core Principles

1. **Read code first** — understand actual entry points and failure modes from implementation, not assumptions.
2. **Be specific** — "look for `[segment-store] ERROR`" not "check the logs."
3. **Be honest** — an honest handoff is more valuable than a polished one. Omit nothing known.
4. **Be brief** — use bullet points over prose; keep it actually readable.

## Steps

### 1. Read the relevant code

Understand entry points, data flows, and failure modes from the actual implementation.

### 2. Produce the handoff document

> **Load `knowledge/runbook-template.md`** for the full 7-section template (overview, how to run, architecture, how to debug, tests, operations, open items).

> **When writing the "How to debug" section, load `knowledge/debug-patterns.md`** for OJF-specific debug patterns (Express, LangGraph, Node.js).

## Constraints

- Be specific, not generic.
- Do not omit known problems.
- Keep it short enough to actually be read.

---

$ARGUMENTS

## See Also
- Run `/doc-refactor` to ensure documentation is current before handoff.
- Run `/observe` to verify monitoring is in place before transferring ownership.
