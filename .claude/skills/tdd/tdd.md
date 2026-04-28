---
name: tdd
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "tdd", "red green
  refactor", "test first", "write the failing test", "enforce TDD on this
  change". Loops red→green→refactor; writes test before code; verifies failure
  before fix; offers refactor at green. Edits files. Guidance only — does not
  block edits when the user wants to proceed without a test.
---

# /tdd — Red-green-refactor enforcer

**Status: scaffold — full implementation lands in Phase 2 of the Pocock skills foundation work (see plan file at `/Users/yuri/.claude/plans/with-a-browser-agent-compressed-castle.md` and ADR-0046 once written).**

For now, when invoked: tell the user this skill is scaffolded and link them to `/test-expand` (which plans tests) and the standard TDD discipline below.

## Discipline (interim guidance, until full body lands)

1. Restate the behavior change as a single testable assertion.
2. Locate or create the test file matching project conventions.
3. Write a failing test. Run it. Confirm it fails with the expected message — not a typo, not an import error.
4. Make the smallest change that turns the test green. Run.
5. At green, propose refactor candidates. Apply only with user approval.
6. If you wrote 3+ tests that were hard to write, the design is shallow — suggest `/deepen` on the affected module.

## Constraints

- Never write more code than the failing test demands.
- If the implementation needs structure beyond a single function, stop and propose `/scaffold` or `/deepen`.
- Guidance only. If the user wants to skip TDD for a small fix, do not block — note the deferred test and continue.

---

$ARGUMENTS
