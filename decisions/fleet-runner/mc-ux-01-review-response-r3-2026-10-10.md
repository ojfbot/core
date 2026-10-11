# MC-UX-01 second adversarial review response

- Review source: [PR #522 comment](https://github.com/ojfbot/core/pull/522#issuecomment-6103617342), reviewing `dcf6c33c8d15d51d4fd1347f97d88a70f8c2f791`
- Corrected implementation: `4aa42adfa840a37572efa8626e13af4d5e56a36d`
- Corrected artifact: `mc-ux-01-domain-contract-candidate-r3`
- Corrected manifest SHA-256: `b9aa0e1fdf9dbde3b9d0ad998d3de5c465daa8f9b7b60df8af8af2195437f73f`
- Verified at: `2026-10-11T00:28:33Z`
- Disposition: **all requested and noted changes addressed**

The blocking finding exposed a positional-successor bypass: a later authored success could replace
an unresolved publication intent without establishing correction lineage or reconciliation. The
same projection rule also affected approval. R3 removes positional replacement for those record
classes and makes both the refusal and the qualified recovery path executable.

## Finding-to-correction trace

| Review finding | Correction | Persistent regression evidence |
| --- | --- | --- |
| F1 — later agent-authored publication success plus receipt clears an unknown hold | Approval/publication successors no longer replace prior evidence by array position; publication corrections of unknown outcomes require declared reconciliation authority, every outstanding request ID and remote inspection references | MCUX-C16 rejects the unlinked successor; MCUX-C17 rejects incomplete reconciliation; MCUX-C18 proves the bounded recovery path |
| F2 — later approval without `corrects` becomes effective | Approval projection requires an explicit backward same-kind, same-subject `corrects` relation | MCUX-C19 and `does not replace an approval by array position without a correction link` |
| F3 — “separately verified authority” overclaims checker capability | Crosswalk now says the checker validates declared producer/annotation/relation shape only and cannot authenticate real-world authority | R3 crosswalk claim boundary, state table and limitations; production authority remains gated by #313 |
| F4 — settlement with no `authorized_by` proves settled | Settlement also requires a non-empty `authorized_by` relation | MCUX-C20 and `requires settlement authority to be named by relation` |
| F5 — object-valued `links` throws | Non-array `links` quarantine before relation traversal | MCUX-C21 and `quarantines a record whose links field is not an array` |

## Red/green and repository evidence

- Red: 5 expected failures against the R2 evaluator reproduced the two positional replacement
  defects, missing settlement authority relation and malformed-links crash.
- Green: focused suite `24 passed / 0 failed`.
- Public conformance pack: `21 passed / 0 failed / 0 untested`.
- Full repository suite: 61 test files passed, 2 pre-existing suites skipped; 610 tests passed,
  70 skipped.
- `pnpm build`, `pnpm typecheck`, production-module ESLint, `git diff --check`, roadmap lint and
  northstar lint pass. Roadmap/northstar retain 22 existing shadow warnings and zero errors.
- Detailed validation: [`mc-ux-01-validation-r3-2026-10-10.md`](mc-ux-01-validation-r3-2026-10-10.md).

## Scope boundary

This remains a synthetic, non-production consumer profile. It does not claim a deployed producer,
authenticated human-authority mechanism, live delivery, consumption or settlement. Queue records
remain separated in daily-logger PR #340; no queue/runtime changes are folded into this PR.

