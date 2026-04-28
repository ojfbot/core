# Escalation triggers — when to break out of TDD

A healthy TDD loop hums: red, green, refactor, repeat. When the loop fights back, that's information about the design, not a TDD failure. Listen to it.

## Trigger 1: Three awkward tests in a row

What it looks like: each test takes 30+ lines of setup, mocks four collaborators, and the assertion is buried at the bottom. You spent more time setting up than writing the assertion.

What it means: the unit under test has too wide a surface — too many collaborators, too many responsibilities. The tests are awkward because the *design* is awkward.

What to do: stop. Suggest `/deepen` on the affected module. State which collaborators keep showing up and which seam would consolidate them.

> "These three tests all needed `mockLogger`, `mockDB`, `mockAuth`, and `mockHTTP`. The unit is too wide. Suggesting `/deepen` on `<module>` to consolidate the persistence + auth seam."

## Trigger 2: Heavy mocking that obscures intent

What it looks like: you can't read the test and tell what behavior is being verified, because the test's first 20 lines are wiring fakes together.

What it means: the unit's collaborators carry information the unit shouldn't depend on, OR the unit is doing something its name doesn't suggest.

What to do: extract the seam where the mocking is heaviest. Usually means moving a side-effect (DB, network, time) behind a smaller interface or pulling pure logic out of an effectful method. Suggest `/deepen` and name the seam.

## Trigger 3: One-character fix, thirty-line test

What it looks like: the production change is `if (x) return null` → `if (x) return undefined`. The test needed a fixture, three mocks, and a 30-line setup to drive it.

What it means: the behavior under test is buried under thin wrappers. To get to the line that matters, the test has to traverse half the system.

What to do: suggest `/deepen` on the call chain. Either the wrappers should be inlined (so the test exercises the actual behavior directly), or there should be a single deeper module that owns this responsibility and tests can target it directly.

## Trigger 4: Tests fail intermittently

What it looks like: same test, same code, sometimes red, sometimes green.

What it means: implicit dependency on shared state — order, time, randomness, network, filesystem, other tests. TDD cannot give you signal here because red doesn't mean what you think it means.

What to do: do not continue. The flake is a higher-priority bug than whatever you were trying to add. Switch to `/investigate` to find the source of the flake. Add the fix as a separate change, return to TDD when the suite is reliable.

## Trigger 5: The test demands new infrastructure

What it looks like: you can't write the test without first creating a fixture loader, a test database, a mock LLM, or a new test utility.

What it means: the loop should pause to add the missing infrastructure as a *separate* change. Don't bundle infrastructure into a behavior PR.

What to do: stop. Suggest `/scaffold` for the missing infrastructure, get it merged separately, then resume TDD on the original behavior. Note the deferred work in your output.

## Trigger 6: User says "skip TDD"

What it looks like: the user explicitly says "just do it" or "skip TDD for this fix."

What it means: the user has decided the cost of the test isn't worth it for this turn. Respect it.

What to do: skip. Note the deferred test in your output ("Recommend adding a regression test for `<case>` before merge"). If skips compound (3+ in a row), recognize this isn't TDD-shaped work and switch to `/investigate` or `/recon`.

## Trigger 7: You can't state the assertion

What it looks like: you start to write the test and realize you don't know exactly what behavior you're trying to add.

What it means: the work isn't TDD-ready yet. There's design ambiguity upstream of the loop.

What to do: stop. Run a brief grill on the user (or escalate to `/grill-with-docs` if the work is non-trivial). Return to `/tdd` once you can state the assertion in one sentence.

## Trigger 8: Long-running test slows the loop

What it looks like: a single test takes 30+ seconds. The red-green cycle drags. You start avoiding the loop.

What it means: integration cost is hiding in the test. Either the unit is doing too much, or the test is at the wrong level (integration test masquerading as unit test).

What to do: suggest a unit test at a lower level for the immediate behavior, leave the integration test as a slower-running suite. Or move the slow setup to a `beforeAll` if the test files share fixtures.

## Format for the postflight section

In your `## Escalation` output:

```
Escalation: <skill-name>
Reason: <which trigger fired>
Detail: <one specific observation about the affected code>
Suggested next: <one-line skill invocation>
```

Example:

```
Escalation: /deepen
Reason: Trigger 1 (three awkward tests in a row)
Detail: Each test in `parseCommand.test.ts` mocks `logger`, `clock`, and `argParser` despite testing pure string parsing.
Suggested next: /deepen --scope=packages/workflows/src/parseCommand.ts
```

If no trigger fired, output `Escalation: none`.
