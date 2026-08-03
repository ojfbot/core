# Core principles

The six principles behind the `/tdd` loop. The steps in SKILL.md operationalize these; load this file before starting the loop.

1. **Test only at pre-agreed seams.** A seam is the public boundary you observe behavior through. Before any test is written, name the seams under test and confirm them with the user — the fewest seams, at the highest level that still exercises the behavior; the ideal number is one. If a spec from `/plan-feature --from-conversation` already names the seams, inherit them instead of re-negotiating.
2. **Test before code.** The failing test is the spec for this turn. No code until the test exists and fails for the *expected* reason.
3. **Minimal change to green.** Whatever turns the test green is enough. Do not over-engineer; do not anticipate next-test needs.
4. **Refactor only at green.** Cleanup happens with all tests passing. Never refactor and add behavior in the same step. (Cross-cutting structural smells belong to the review stage; green-time refactors are the small, fresh-context cleanups.)
5. **Hard-to-test means hard-to-design.** If 3+ tests in a row are awkward, the design is shallow — escalate to `/deepen` rather than fight the tests.
6. **Guidance, not gatekeeping.** If the user explicitly says "skip TDD for this," respect it and continue. Note the deferred test so it isn't forgotten.

## Seam agreement in practice (Step 2)

Aim for the fewest seams at the highest level that still exercises the behavior — ideally one. A test at an unconfirmed seam doesn't get written. If the driving spec or ticket already names the seams (a `/plan-feature --from-conversation` spec records them as Testing Decisions), inherit them and confirm only deviations.
