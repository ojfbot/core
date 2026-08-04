# Loop mechanics — per-step detail

Elaboration for Steps 1, 3, 4, 6, and 7 of the `/tdd` loop. The gates themselves stay in SKILL.md; this is the how-to detail.

## Step 1 — the testable assertion

> Bad: "make the parser more robust"
> Good: "`parseSlashCommand('  /foo bar')` returns `{name: 'foo', args: ['bar']}`, not `null`"

## Step 3 — locate or create the test file

- Read project conventions: where do existing tests live? `__tests__/`? Co-located `*.test.ts`? Run `find` to confirm.
- If you must create a new test file, name it after the unit under test plus `.test.ts`.

## Step 4 — writing the failing test

- One assertion per `it()`. Multiple `expect`s are fine if they describe the same scenario.
- Use the existing test framework (Vitest in this repo) and matchers.
- Name the test by the behavior being asserted, not the function being called.

```ts
// Good: it('returns null when input is empty')
// Bad:  it('parseSlashCommand test 1')
```

## Step 6 — smallest change to green

- Hardcoded return values are fine if they pass the test. The next test will force a more general implementation.
- Resist the urge to also implement the *next* assertion. That's a separate turn.

## Step 7 — refactor-candidate scan

At green, scan what you just wrote and the surrounding code:

- Duplication (with the test, with adjacent code, across files)
- Names that lie or are unclear
- Conditional complexity that could collapse
- Module boundaries the change violated
