# MC-UX-01 R4 publication digest validation

- Scope: synthetic publication-intent body digest versus the prepared artifact in the candidate profile.
- Checker parent: core `8a70a5f4`.
- Manifest artifact: `mc-ux-01-domain-contract-candidate-r4`.
- Manifest SHA-256 (October 11): `5bbe12ceda558fe2b847030ba424f54e2ab7422767df4d2b2fa5b5a800af1cbf`.
- Status: **PASS WITH NOTES**. This is conformance evidence, not a deployed producer or live delivery receipt.

## Counterexample and repair

MCUX-C22 records a prepared artifact with digest `sha256:original`, then a publication intent and delivery receipt that agree on `sha256:different`. Before the checker change, the public CLI reported 21 passing cases and one failed case: publication was incorrectly `proven` and the expected source-digest finding was absent. The receipt-to-intent comparison alone had no check against the prepared bytes.

The checker now quarantines the mismatched intent, emits `PUBLICATION_SOURCE_DIGEST_MISMATCH`, and leaves publication and consumption unproven. It does not report a source-digest mismatch for an intent that has no body digest and has not attempted publication; existing MCUX-C08 retains its earlier finding set.

## October 13 regression amendment

MCUX-C22 and its unit regression now include an otherwise valid human consumption receipt naming `delivery-1` and `report-r1`. Both assert that consumption remains unproven when the publication digest differs from the prepared artifact. The fully evidenced journey remains the positive control. The amended manifest SHA-256 is `081b172667323707c61e50ce2b8014893e60c376d821319fedf82b41ac7c6dff`.

## October 13 verification

| Check | Result |
| --- | --- |
| Parent checker `8a70a5f4` with the strengthened native unit | Expected failure: consumption incorrectly proven |
| Parent public CLI with the strengthened manifest | 21 passed, 1 failed; MCUX-C22 publication and consumption incorrectly proven |
| Current checker with the strengthened unit suite | 25 passed |
| Current public CLI with the strengthened manifest | 22 passed, 0 failed, 0 untested; MCUX-C22 publication and consumption unproven |
| Same MCUX-C22 control with prepared digest matching intent and delivery | Parent and current CLI each pass all 22 cases; publication and consumption proven |
| MCUX-C01–C21 preservation check | Manifest cases unchanged; MCUX-C08 conformance result identical on parent and current checker |
| `pnpm build` and `pnpm typecheck` | Passed with a frozen-lockfile install in the isolated worktree |

This amendment reruns the focused suite and public CLI. The full-suite results below remain the October 11 record. No production delivery, authenticated authority or profile promotion is established.

## October 11 verification

| Check | Result |
| --- | --- |
| `pnpm exec node scripts/mc-ux-01-contract-check.mjs --manifest decisions/fleet-runner/mc-ux-01-contract-manifest.json --json` | 22 passed, 0 failed, 0 untested |
| `pnpm exec vitest run scripts/lib/__tests__/mc-ux-01-contract.test.mjs --cache false` | 25 passed |
| `pnpm exec vitest run --cache false` | 61 files and 611 tests passed; 2 files and 70 tests skipped |
| `pnpm build` and `pnpm typecheck` | Pass after isolated locked dependency install |
| `pnpm exec eslint --no-ignore scripts/lib/mc-ux-01-contract.mjs` | Pass |
| `git diff --check` | Pass |

The candidate remains Proposed and non-production. This fixture does not authenticate the publisher, verify remote delivery, or advance the profile promotion gate.
