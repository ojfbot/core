# Red-green discipline — rules for the loop

The discipline is small but rigid. Skip a rule and the loop stops giving you signal.

## What counts as a valid red

The test must fail **for the reason you intended**, not for any other reason.

Valid reds:
- Assertion mismatch on the value/state your test exercises (`expected 'foo' got 'bar'`)
- Missing function/method that doesn't exist yet (`undefined is not a function`)
- Wrong type returned (`expected number got string`)

Invalid reds (re-fix and re-run before continuing):
- Import error (typo in path, missing module, wrong export name)
- Syntax error in the test or fixture
- Unrelated test elsewhere in the file failing because of test setup pollution
- The test runner crashed (out of memory, vitest config error)

If the red is invalid, fix it. Don't proceed to green code until red comes from the assertion you actually wrote.

## What counts as the smallest change to green

You are allowed to:
- Hardcode the value the test expects (`return 42`)
- Add the minimum branching to satisfy this test (`if (x === 0) return 0; return 42`)
- Add the function/method that doesn't exist yet, with the simplest body that passes

You are not allowed to:
- Implement what *the next test* will need
- Generalize beyond the cases the current red covers
- Refactor surrounding code (that's step 6, at green)
- Add comments explaining what you're about to do (write the next test instead)

If you find yourself writing branches for cases your tests don't cover, stop. Either:
- Write a test for that case (one test per turn), then make it pass.
- Or recognize that you're speculating and revert.

## What "tests still pass" means

Run the *full* test suite, not just the file you edited. The minimal-change discipline often surprises by breaking adjacent tests — that's signal that the change interacts with other behavior. Don't continue past green-on-the-new-test until the suite is green.

If an adjacent test breaks:
- Read it. Decide whether the break is a real regression or a stale assumption.
- Real regression → revert, write a *narrower* implementation that doesn't break the adjacent test.
- Stale assumption → update that test (one expectation per turn) and document why in the commit message.

## When the test feels wrong

Sometimes you write a test, run it, and it passes immediately. Three causes:

1. **Test doesn't exercise the new behavior.** Most common. The test checks something that already works. Rewrite it to actually call the new path.
2. **Behavior already exists.** The "new" feature is already implemented. Fine — confirm with the user, delete the redundant test, move on.
3. **Mock/stub returned the expected value by accident.** Less common, but possible with default mocks. Tighten the mock.

If you wrote three tests in a row that all passed without code changes, you're not testing the right thing. Stop and re-state the behavior assertion.

## When the loop slows down

A healthy red-green-refactor cycle is **30 seconds to 5 minutes per turn** for most code. If a single turn is taking 15+ minutes, something's wrong:

- Test setup is too heavy → escalate to `/deepen`, the surface area is too wide
- You're writing too much production code per turn → split the test into smaller assertions
- The implementation depends on infrastructure that isn't there yet → stop, scaffold the missing pieces with `/scaffold`, then resume

Long turns kill the loop. Notice them and break out.

## Common red-faking traps

- **Asserting on a side-channel.** "I'll check that the function logged 'X'." If logging is the assertion, you're testing logs, not behavior. Find the actual behavior.
- **Asserting on internal state.** Testing private fields directly couples the test to implementation. Test through the public surface.
- **Testing the framework.** "I'll check that React renders the component." That's React's job. Test what *your* code does to the rendered output.
- **Tautological tests.** `expect(add(2, 3)).toBe(2 + 3)` proves nothing. Use literal expected values: `expect(add(2, 3)).toBe(5)`.

## When to skip TDD

The user is allowed to skip:
- One-line bug fixes where the regression test would be more code than the fix
- Pure refactors where existing tests already cover the behavior
- Spike/prototype code that will be deleted before merge

When skipping, note the deferred test in your output: "Skipped TDD for this fix per user request; recommend adding a regression test for <case> before merge."

If you find yourself skipping more than 2-3 turns in a row, the work isn't suited to TDD — it's exploration. Switch to `/investigate` or `/recon` and come back to TDD when the shape of the change is clearer.
