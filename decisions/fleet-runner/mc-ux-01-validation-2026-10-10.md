# MC-UX-01 candidate contract validation

- Verdict: **PASS WITH NOTES**
- Spec axis: **PASS**
- Standards axis: **PASS WITH NOTES**
- Validated base: `8d90aad84d5ed2115a0a83a4049af616fbb65489`
- Validated implementation head: `0d5885f27f087b8e4761214dd9d4eaa07ba089d4`
- Validated at: `2026-10-10T19:58:31Z`
- Manifest SHA-256: `e829e9f2e6ed7a35e58269850c0ec798759673c76dd4247e4ea4aba85923643b`

The three-dot diff was non-empty and contained nine files. This verdict applies to the proposed,
non-production `mc-ux-01/domain-contract` `candidate-v1` consumer profile. It does not qualify a
deployed producer, accept a shared schema or authorize production execution.

## Spec coverage

| Criterion | Status | Evidence |
| --- | --- | --- |
| MCUX-C01 — authored completion does not settle the original action | PASS | `completion-claim-without-settlement`; settlement remains `unproven` |
| MCUX-C02 — stale, missing and conflicting source identity stays explicit | PASS | Three exact diagnostics; identity remains unresolved |
| MCUX-C03 — processes sharing a harness remain distinct | PASS | Independent process/session/host tuples retained |
| MCUX-C04 — `actor == recipient` is not obligation evidence | PASS | Recipient remains unresolved without evidence |
| MCUX-C05 — unsupported versions and missing recipient roles quarantine | PASS | Both records quarantined and excluded from projections |
| MCUX-C06 — approval is bound to exact subject revision | PASS | Older approval is `stale` |
| MCUX-C07 — a shared-account agent cannot create a human ruling | PASS | Approval is `unverified` |
| MCUX-C08 — local preparation is not remote delivery | PASS | Preparation proven; publication unproven |
| MCUX-C09 — unknown publication creates an affected-item hold | PASS | Hold active; retry forbidden |
| MCUX-C10 — every stage can be proven independently | PASS | Seven stages proven; zero findings |

The public checker reported `10 passed / 0 failed / 0 untested`. The focused suite also includes
CLI report and unexpected-finding failure tests, for `12 passed / 0 failed` total.

## Invariant checks

- [x] Exported evaluator/CLI behavior has focused positive and failure coverage.
- [x] Full repository suite: 61 test files passed, 2 pre-existing suites skipped; 598 tests passed,
  70 skipped.
- [x] `pnpm build` and `pnpm typecheck` pass.
- [x] ESLint reports zero errors and zero warnings for the two production `.mjs` modules. The test
  path is intentionally ignored by the repository ESLint configuration and is exercised by Vitest.
- [x] `git diff --check` passes.
- [x] Roadmap lint reports 0 errors and 22 existing shadow warnings; northstar lint reports 0 errors
  and the same 22 checkout-vantage/rollup warnings.
- [x] No routes, authentication boundary, user-scoped storage, network fetch, dependency, secret,
  SQL or LLM-input path is added.
- [x] No production `console.*`, `eval`, `new Function`, silent catch or external call is added.
- [~] LangGraph, RAG, browser-extension and Carbon-specific checks are not applicable.
- [~] `@frame/eslint-plugin` is not installed; the repository's existing ESLint configuration was
  run directly instead.

The first standards pass found undeclared Node `process` globals. That pass ended without a code
change. Commit `0d5885f` then imported `node:process` explicitly, after which the pinned final gate
passed. The build-before-test ordering discovered during validation is recorded in
`implementation-notes.md`.

## Regression and architecture review

There are no existing runtime callers: the checker is a new explicit CLI and the profile is not
registered as a production package. The two roadmap edits are body-only and change no frontmatter,
slice, dependency, movement, readiness, queue or autonomy. The candidate relies on accepted
ADR-0108/0109 boundaries and records still-open decisions in `decisions/open-unknowns.md`; promotion
to a shared contract is where schema/package ownership and migration would require an accepted ADR.

No blocking issue remains. The non-blocking limitation is intentional: all current conformance
evidence is synthetic. Production trustworthiness still requires a real producer, two independent
consumers, and positive/mutation/replay/failure qualification.

## Human-gate packet

This packet records readiness for the next decision; it is not approval and its checkpoint is not
a deadline.

| Decision | Recommendation | Owner | Ready since | Requested next checkpoint | Next action if accepted |
| --- | --- | --- | --- | --- | --- |
| Authorize cockpit's bounded read-only source-preservation/inspection slice | Proceed through its existing T2/S11/S18 entrance; do not adopt this profile as a shared runtime schema | morning-cockpit operator | 2026-10-10T19:58:31Z | PR #54 disposition / implementation authorization | Pin the accepted cockpit revision and qualify its exact diagnostic fields as consumer 1 |
| Select a trustworthy human-authority mechanism | Keep approval `unverified` until #313 produces an unforgeable revision-bound ruling path | core operator | 2026-10-10T19:58:31Z | #313 decision review | Add counterexample/replay fixtures for the selected mechanism |
| Promote from fixture profile to shadow conformance | Wait for one named real producer and two independent named consumers | core contract owner | 2026-10-10T19:58:31Z | Producer/consumer qualification proposal | Register a read-only shadow run with retention/redaction and rollback boundaries |

