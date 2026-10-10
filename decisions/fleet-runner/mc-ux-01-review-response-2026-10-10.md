# MC-UX-01 adversarial review response

- Review source: [`core#523`](https://github.com/ojfbot/core/issues/523), reviewing PR #522 at `a6c58898a5e16bd243dea5d821598392fd1c830d`
- Corrected implementation: `394eba4098053ebda22dd9f119bae674942c2cb5`
- Corrected artifact: `mc-ux-01-domain-contract-candidate-r2`
- Corrected manifest SHA-256: `c2f6004c83930b8df9d3d365a26fa276112bc72be0e5da5363491ce0b5c6fd04`
- Verified at: `2026-10-10T21:51:31Z`
- Disposition: **requested PR changes addressed**

The original authored fixtures confirmed only anticipated behavior. Independent adversarial probes
found two false-positive proof paths and three projection/enforcement gaps. The original R1
validation remains in the repository as historical correction evidence; it is not the current
verdict for R2.

## Finding-to-correction trace

| Review finding | Correction | Persistent regression evidence |
| --- | --- | --- |
| Orphan `delivery_receipt` proved publication through `undefined === undefined` comparisons | Publication now requires an existing named intent, non-empty matching digests, remote readback, and a `published_as` link matching the remote object | MCUX-C11 plus `does not accept an orphan delivery receipt when intent fields are absent` |
| Agent-authored `settlement_receipt` with `verified: true` proved settlement | Settlement now also requires a human producer, `authority_verified: true`, and `reports_on` the exact original action | MCUX-C12 plus `does not accept an agent-authored settlement as verified human authority` |
| A delivery receipt changed publication to `proven` while the unknown-outcome hold stayed active | An unresolved intent is dominant; a receipt cannot prove publication until an explicit correction supersedes the unknown intent | MCUX-C13 plus `keeps an unknown-publication hold active even when a receipt claims delivery` |
| First-record-only selection ignored append-only correction | `corrects` links now supersede only an earlier record of the same kind and subject; invalid/forward/cross-subject corrections are rejected | MCUX-C14 plus `projects an explicit append-only correction instead of the first record` |
| `links[]` was descriptive but unenforced | Link relations are closed; delivery, settlement, approval, and correction projections enforce their relevant relation targets | MCUX-C15 plus `requires the delivery relation to name the remote object` |
| CLI hard-coded `untested: 0` | Cases without executable findings or stage expectations emit `UNTESTED`; the summary counts them and the CLI fails | `reports a manifest case without expectations as untested and fails the run` |

## Red/green evidence

- Red: the six added regressions produced six failures against the R1 evaluator: orphan delivery,
  agent settlement, hold contradiction, ignored correction, delivery-link mismatch, and hard-coded
  untested coverage.
- Green: focused suite `18 passed / 0 failed`.
- Public conformance pack: `15 passed / 0 failed / 0 untested`.
- Full repository suite: 61 test files passed, 2 pre-existing suites skipped; 604 tests passed,
  70 skipped.
- `pnpm build`, `pnpm typecheck`, ESLint, `git diff --check`, roadmap lint and northstar lint pass.
  Roadmap/northstar retain their 22 existing checkout-vantage/rollup warnings and report zero errors.

## Scope boundary

This response corrects PR #522. Issue #523's separate proposal to add selectable review methods to
the `/pr-review` skill is not folded into this candidate-contract PR; doing so would mix workflow-
engine evolution with the contract artifact it reviewed. The adversarial probes themselves are
retained here as manifest criteria C11–C15 so the evaluator cannot regress while that broader skill
proposal is decided independently.

