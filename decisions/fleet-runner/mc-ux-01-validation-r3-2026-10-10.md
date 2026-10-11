# MC-UX-01 R3 validation

- Scope: Claude's second review of core PR #522
- Review base: `dcf6c33c8d15d51d4fd1347f97d88a70f8c2f791`
- Implementation head: `4aa42adfa840a37572efa8626e13af4d5e56a36d`
- Artifact: `mc-ux-01-domain-contract-candidate-r3`
- Manifest SHA-256: `b9aa0e1fdf9dbde3b9d0ad998d3de5c465daa8f9b7b60df8af8af2195437f73f`
- Verified at: `2026-10-11T00:28:33Z`
- Verdict: **PASS WITH NOTES**

## Requested-change coverage

| Finding | Executable evidence | Result |
| --- | --- | --- |
| F1: later unlinked publication intent bypasses an unknown-outcome hold | MCUX-C16; focused test `does not let an unlinked publication successor clear an unknown-outcome hold` | PASS: earlier unknown evidence remains effective; hold remains active |
| F2: later approval replaces earlier evidence by array position | MCUX-C19; focused test `does not replace an approval by array position without a correction link` | PASS: explicit same-kind, same-subject `corrects` is required |
| F3: authority wording overstates what the checker proves | Crosswalk claim boundary, “Approved”/“Settled” rows and limitations | PASS: docs distinguish declared evidence shape from authenticated real-world authority |
| F4: settlement omits `authorized_by` | MCUX-C20; focused test `requires settlement authority to be named by relation` | PASS: settlement remains unproven without a named authority relation |
| F5: non-array `links` crashes evaluation | MCUX-C21; focused test `quarantines a record whose links field is not an array` | PASS: malformed record quarantines and projection continues |

The release path is also executable: MCUX-C17 rejects a correction without reconciliation
evidence, while MCUX-C18 accepts a non-agent correction only when it declares authority shape,
resolves every outstanding request, names remote inspection evidence, and has a matching delivery
receipt.

## Verification evidence

| Check | Result |
| --- | --- |
| Red phase against the R2 evaluator | 5 expected failures: F1, missing reconciliation, F2, F4 and F5 |
| Focused contract suite | 24 passed, 0 failed |
| Public conformance manifest | 21 passed, 0 failed, 0 untested |
| Full repository suite | 61 files passed, 2 pre-existing suites skipped; 610 tests passed, 70 skipped |
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS |
| ESLint over production checker modules with `--no-ignore` | PASS |
| `git diff --check` | PASS |
| `roadmap-lint --check` | 0 errors, 22 existing checkout-vantage/rollup warnings |
| `northstar-lint --check` | 0 errors, 22 existing checkout-vantage/rollup warnings |

## Invariant and smell checks

- Unknown publication remains dominant until an explicit, valid correction supplies the declared
  reconciliation evidence required by the candidate profile.
- Record ordering alone does not replace approval or publication evidence.
- Invalid correction targets and invalid reconciliation do not supersede their targets.
- Malformed link shape is quarantined before relation traversal, so one record cannot abort the
  fixture projection.
- Settlement requires independent shapes for producer class, authority declaration,
  `authorized_by`, original-action relation and verified disposition.
- No runtime state, queue records, credentials, network calls or production package behavior are
  introduced by this patch.

## Notes and remaining gates

- The checker validates declarations and relations; it does not authenticate the authority named
  by `authority_ref` or `authorized_by`. Production authority remains gated by #313.
- Synthetic conformance does not prove a deployed producer, live remote delivery, attributable
  consumption or production settlement.
- Forcing the ignored test file through the production ESLint configuration reports its three
  pre-existing `process` globals; the changed production modules pass the explicit no-ignore run.
- Roadmap/northstar warnings are unchanged shadow diagnostics from this worktree's fleet vantage;
  both blocking checks report zero errors.

