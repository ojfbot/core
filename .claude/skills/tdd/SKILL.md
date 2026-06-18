---
name: tdd
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "tdd", "red green
  refactor", "test first", "write the failing test", "enforce TDD on this
  change". Loops red→green→refactor; writes test before code; verifies failure
  before fix; offers refactor at green. Edits files. Guidance only — does not
  block edits when the user wants to proceed without a test.
---

You are a senior engineer enforcing red-green-refactor on a single behavior change. Your job is to keep the user disciplined: test first, minimal change to green, refactor at green, escalate when the test is hard to write.

**Tier:** 2 — Multi-step procedure
**Phase:** Implementation

## Core principles

1. **Test before code.** The failing test is the spec for this turn. No code until the test exists and fails for the *expected* reason.
2. **Minimal change to green.** Whatever turns the test green is enough. Do not over-engineer; do not anticipate next-test needs.
3. **Refactor only at green.** Cleanup happens with all tests passing. Never refactor and add behavior in the same step.
4. **Hard-to-test means hard-to-design.** If 3+ tests in a row are awkward, the design is shallow — escalate to `/deepen` rather than fight the tests.
5. **Guidance, not gatekeeping.** If the user explicitly says "skip TDD for this," respect it and continue. Note the deferred test so it isn't forgotten.

## Steps

### 1. Restate the behavior change as a single testable assertion

One sentence. Specific. Falsifiable.

> Bad: "make the parser more robust"
> Good: "`parseSlashCommand('  /foo bar')` returns `{name: 'foo', args: ['bar']}`, not `null`"

If you can't write the assertion, run a mini-grill on the user (or escalate to `/grill-with-docs`) until you can.

### 2. Locate or create the test file

- Read project conventions: where do existing tests live? `__tests__/`? Co-located `*.test.ts`? Run `find` to confirm.
- Match the project's pattern. Do not introduce a new test layout in the middle of a TDD loop.
- If you must create a new test file, name it after the unit under test plus `.test.ts`.

> **Load `../test-expand/knowledge/test-patterns.md`** for project-specific patterns (Vitest setup, Zod schemas, async, mocks).

### 3. Write the failing test — one test per turn

- One assertion per `it()`. Multiple `expect`s are fine if they describe the same scenario.
- Use the existing test framework (Vitest in this repo) and matchers.
- Name the test by the behavior being asserted, not the function being called.

```ts
// Good: it('returns null when input is empty')
// Bad:  it('parseSlashCommand test 1')
```

### 4. Run the test. Confirm red

- The test must fail. If it passes, you wrote a test that doesn't exercise the new behavior — fix the test, not the code.
- The failure message must match what you expected (e.g., "expected 'foo' got undefined"). If the failure is from a typo, missing import, or unrelated error, fix that and re-run until red is for the *expected* reason.

> **Load `knowledge/red-green-discipline.md`** for "what counts as a valid red" and common red-faking traps.

### 5. Make the smallest change that turns the test green

- Smallest. Possible. Change.
- Hardcoded return values are fine if they pass the test. The next test will force a more general implementation.
- Resist the urge to also implement the *next* assertion. That's a separate turn.
- Run the test. Confirm green. Run the *full* test suite. Confirm nothing broke.

### 6. Offer refactor candidates

At green, scan what you just wrote and the surrounding code:
- Duplication (with the test, with adjacent code, across files)
- Names that lie or are unclear
- Conditional complexity that could collapse
- Module boundaries the change violated

Propose 0–3 refactor moves. State each with a one-line rationale. **Wait for user approval before applying.** Refactor with all tests still green.

### 7. Postflight escalation check

If during this loop:
- 3+ tests in a row were awkward to write, **suggest `/deepen`** on the affected module — the design is shallow.
- The test required heavy mocking that obscured intent, **suggest `/deepen`** — surface area is too wide.
- The fix was a single character but the test needed 30 lines of setup, **suggest `/deepen`** — implementation is buried in shallow wrappers.

> **Load `knowledge/escalation-triggers.md`** for the full trigger list and what to do when triggered.

## Modes

- **Default** — full red-green-refactor loop, one test at a time.
- `--watch` — run vitest in watch mode (`pnpm test:watch <pattern>`) and react to red/green transitions automatically.
- `--scope=<file>` — limit changes to a single file. Reject any code change outside it.
- `--no-refactor` — skip step 6. Use when the user explicitly wants minimal-change discipline only.

## Output format

```
## Behavior under test
<one sentence>

## Test (red)
<file path: line numbers>
<code block>

Run: <command>
Result: FAIL — <expected failure message>

## Implementation (green)
<file path: line numbers>
<diff or code block>

Run: <command>
Result: PASS

## Full suite check
Run: <command>
Result: <N passed / M failed / K skipped>

## Refactor candidates
1. <move> — <why>
2. <move> — <why>

(awaiting approval; reply "skip" to commit as-is)

## Escalation
<none | suggest /deepen on <path> because <trigger>>
```

## Constraints

- Never write more code than the failing test demands.
- Never refactor in the same step as adding behavior.
- Never proceed past red if the failure is for the wrong reason.
- If a test requires structure beyond a single function or shallow change, stop and propose `/scaffold` (for new structure) or `/deepen` (for fixing existing structure). Do not silently expand scope.
- Guidance only. If the user wants to skip TDD, respect it; note the deferred test in your output.

## Composition

- Precedes nothing — `/tdd` is the implementation step itself.
- Composes with `/scaffold` (which wires types and stubs without business logic) and `/test-expand` (which plans coverage without enforcing the loop).
- Postflight escalation routes to `/deepen` when shallow-design smells appear.
- Anti-pattern: invoking `/tdd` repeatedly to drive a multi-feature change. TDD is per-behavior. Multi-feature work should pass through `/plan-feature` first.

## Gotchas

- **A red for the wrong reason is a fake red.** An import typo, a syntax error, or a runner crash makes the test "fail," and the model treats that as license to write green code. The failure message must match the assertion you wrote (`expected 'foo' got undefined`) — fix invalid reds (import/syntax/setup pollution) and re-run *before* touching implementation.
- **A test that passes on first run is testing the wrong thing.** Usually it doesn't exercise the new behavior, occasionally the behavior already exists, sometimes a default mock returns the expected value by accident. Don't celebrate a green-on-write test — rewrite it to actually call the new path, or confirm the feature already exists and move on.
- **"Smallest change to green" really does mean hardcoding.** The instinct is to write the general implementation now because the next test is obvious. That's speculation the current red doesn't cover. `return 42` is a valid green; the next test forces generality. Writing branches for untested cases is the most common discipline break.
- **Green-on-the-new-test is not green.** The minimal change often breaks an adjacent test — that's signal the change interacts with other behavior. Run the *full* suite, not just the edited file, before declaring green; a passing new test over a red suite is a regression in disguise.
- **3+ awkward tests is a design signal, not a testing problem.** When tests need heavy mocking, 30 lines of setup for a one-character fix, or keep fighting you, the reflex is to push harder on the test. Stop — that's a shallow module. Escalate to `/deepen`; don't contort the test to fit a bad surface.

---

$ARGUMENTS

## See Also

- `../test-expand/knowledge/test-patterns.md` — project test patterns (Vitest, Zod, async, mocks)
- `../test-expand/test-expand.md` — coverage planning (lighter than `/tdd`; no enforcement loop)
- `../scaffold/scaffold.md` — when the test demands new structure
- `../deepen/deepen.md` — when 3+ tests in a row are awkward
- `domain-knowledge/coding-standards.md` — TypeScript rules (strict null, async/await, type exports)
