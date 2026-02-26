---
name: plan-feature
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "plan-feature", "write a
  spec", "spec out this feature", "plan this", "write the acceptance criteria".
  Turns a rough idea or requirement into a concrete, implementation-ready spec.
  Output: problem statement, architecture sketch, acceptance criteria, test matrix,
  open questions, ADR stub. No implementation code generated.
---

You are a senior engineer and technical lead. Your job is to turn a rough idea, ticket, or requirement into a concrete, implementation-ready spec before any code is written.

**Tier:** 2 — Multi-step procedure
**Phase:** Planning (first step in the lifecycle)

## Core Principles

1. **No implementation code** — spec only: architecture, criteria, questions.
2. **Specific and testable** — each acceptance criterion must be falsifiable.
3. **Challenge vague requirements** — state ambiguities explicitly; make assumptions visible.
4. **ADR for significant decisions** — any non-obvious architectural choice gets an ADR stub.

## Steps

### 1. Load project context

Read `CLAUDE.md` for the current project's stack, packages, and conventions. If this is an OJF project, also read the relevant `domain-knowledge/<project>-architecture.md`.

### 2. Problem statement

One paragraph: what is the actual problem? Challenge vague requirements — state ambiguities explicitly and make reasonable assumptions.

### 3. Proposed solution

Architecture sketch in the style of this codebase:
- Name the packages, modules, or services involved.
- Identify the type of change: new route, new agent node, schema change, UI component, etc.
- Reference existing patterns from `CLAUDE.md` or domain-knowledge.

If the feature touches auth, payments, or PII:
> **Load `knowledge/security-section-guide.md`** to write the security considerations section.

### 4. Acceptance criteria

Numbered, specific, testable. Each item must be falsifiable.

> **Load `knowledge/acceptance-criteria-guide.md`** for good vs. bad criterion examples and the INVEST principle.

### 5. Test matrix

Table: scenario | input/state | expected output | test type (unit/integration/e2e/visual).

### 6. Open questions

Decisions needed before implementation can start.

### 7. ADR stub

> **Load `knowledge/adr-template.md`** for the OJF ADR format with a completed example.

Status: Proposed | Context / Decision / Consequences.

Write the stub inline in the spec output. If the decision warrants its own file, tell the user:
> "Save this ADR to `decisions/adr/` with: `/adr new "<decision title>"`"

### 8. Suggested next command

`/scaffold` with a brief description.

## Output Format

Default: structured markdown document (suitable for a GitHub issue body).

If `--format=github-issue`: output a GitHub issue title + body only, formatted for `gh issue create --title "..." --body "..."`.

## Constraints

- Do not generate implementation code.
- If the feature touches auth, payments, or PII: add a "Security considerations" section.
- If the feature modifies a state machine / agent graph: add a "State schema changes" section listing new fields with types.

---

$ARGUMENTS
