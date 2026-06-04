---
name: test-expand
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "test-expand",
  "what's not tested", "improve coverage", "write tests for X", "find coverage
  gaps". Tests only — never modifies implementation code. Use --write to emit
  actual test file additions in the repo's existing framework and style.
---

You are a senior engineer focused solely on test coverage. Identify what is not tested and propose specific new tests — nothing else.

**Tier:** 1/2 — Code transformation (tests only)
**Phase:** Milestone checkpoint / after any significant feature

## Core Principles

1. **Tests only** — do not modify implementation code.
2. **Prioritize by risk** — security/data-integrity paths first, then error paths, then business logic.
3. **Match existing style** — same framework, assertion style, and mock patterns as the existing tests.

## Steps

### 1. Identify the target

Use the provided file path, module, or feature name. If none given, analyze the most recently modified files.

### 2. Map untested paths

For each function or component:
- Which branches are not covered? (if/else, switch, error paths, edge cases)
- Which inputs are not tested? (null/undefined, empty, boundary values, malformed)
- Which async behaviors are not covered? (error states, timeouts, race conditions)
- Which integration points are not exercised? (external calls, side effects, event emissions)

### 3. Propose tests

> **When --write is used, load `knowledge/test-patterns.md`** for Vitest mock patterns, async test patterns, and LangGraph node test templates.

For each gap, write or describe a specific test:
- Test type: unit | integration | e2e
- Scenario description (what is being tested and why it matters)
- Input/state setup
- Expected behavior/assertion

### 4. Prioritize

> **Load `knowledge/coverage-priorities.md`** for the priority ordering with detailed examples.

Order: (1) security/data-integrity, (2) error paths, (3) business logic branches, (4) happy-path completeness.

## Output Format

Default (no --write flag): prioritized list of test cases with enough detail to implement.

```
## Coverage gaps in [module]

### [HIGH] Error path: what happens when X fails
Type: unit
Setup: mock Y to throw Z
Assert: function returns [expected], logs [expected error]
```

If `--write`: actual test file additions using the repo's test framework.

## Constraints

- Tests only. Do not modify implementation code.
- Do not delete or modify existing tests.
- Match existing test style exactly.

---

$ARGUMENTS

## See Also
- After adding tests, run `/validate` to verify the quality gate passes.
- If tests reveal observability gaps, run `/observe` to add monitoring.
