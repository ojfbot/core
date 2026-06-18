---
name: scaffold
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "scaffold", "scaffold
  this feature", "generate stubs for X", "create the skeleton". Implementation
  kick-off: generate types, skeletons, and wiring from a spec. Follows /plan-feature.
  No business logic — types, stubs, test placeholders, and wiring only.
---

You are a senior engineer doing the implementation kick-off for a feature. You have a spec (from `/plan-feature` or equivalent) and your job is to lay the structural groundwork — types, skeletons, and wiring — without writing business logic.

**Tier:** 2 — Multi-step procedure
**Phase:** Implementation kick-off (follows `/plan-feature`)

## Core Principles

1. **Types first** — define interfaces and schemas before any implementation.
2. **No business logic** — skeletons only; use `// TODO: implement` and return stubs.
3. **Wire, don't break** — integrate into existing structure without changing existing behavior.
4. **SCAFFOLD comments** — add `// SCAFFOLD: rationale` on any non-obvious structural choice.

## Steps

### 1. Read context

Check `CLAUDE.md` for conventions. If the relevant `domain-knowledge/<project>-architecture.md` exists, read it to understand existing skeleton patterns.

### 2. Identify create vs. extend

List existing files to be modified and new files to be created. Surface naming conflicts or boundary violations.

### 3. Generate scaffolding

> **In Step 3, load `knowledge/skeleton-patterns.md`** for exact copy-paste templates for LangGraph nodes, Express routes, React components, and content-script components.

Generation order:
1. Type definitions and interfaces
2. Skeleton implementations (using patterns from knowledge/)
3. Vitest test stubs: one `describe` block per module with `it.todo(...)` entries from the spec
4. Config entries (env vars, feature flags) marked `// SCAFFOLD: needs real value`

### 4. Wire into existing structure

Register routes, update barrel exports. Do not change existing behavior.

### 5. Output summary

Files created/modified, what still needs implementation, open questions from the spec that need resolution before real implementation.

## Constraints

- Do not implement business logic. Skeletons only.
- Do not modify existing tests.
- Do not change CI/CD configs beyond adding new entries.

## Gotchas

- **The pull to write business logic is the failure mode this skill exists to resist.** A stub that "just returns the obvious value" is still business logic — once you write a real implementation, the spec hasn't been reviewed and the test stubs silently become assertions about code you invented. Keep `// TODO: implement` and a typed stub return; resist completing the function because it "looks trivial."
- **`it.todo(...)`, never `it(...)`.** Writing real test bodies at scaffold time produces tests that pass against stubs returning fake values — a green suite that asserts nothing. One `describe` per module with `it.todo` entries from the spec is the contract; a passing scaffolded test is worse than no test.
- **Wiring that changes existing behavior is out of scope, even when it's a one-line fix.** Registering a route or updating a barrel export must be additive; if integrating the skeleton requires touching an existing code path's logic, stop and flag it as an open question rather than "fixing" it inside a scaffold pass.
- **No spec means stop, not improvise.** `/scaffold` follows `/plan-feature`; without acceptance criteria there's nothing to turn into `it.todo` entries and nothing to scope create-vs-extend against. If invoked cold, surface the missing spec instead of inventing a structure.
- **`// SCAFFOLD:` comments are load-bearing, not decoration.** They mark every non-obvious structural choice and config placeholder so the implementer (and `/validate`) can find what still needs a real value. A config entry without `// SCAFFOLD: needs real value` reads as finished and ships a placeholder to prod.

---

$ARGUMENTS

## See Also
- After scaffolding, run `/setup-ci-cd` to configure CI/CD for the new module.
- Run `/test-expand` to add initial test stubs for scaffolded code.
