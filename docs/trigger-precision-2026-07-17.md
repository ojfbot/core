# Trigger-precision report (rm:rm-l1-core#S9)

Generated: 2026-07-17T23:53:32.647Z

## Era boundary (the honest denominator)

- Joinable fires (carry a SUGGESTION_ID; ADR-0093 (SUGGESTION_ID minted from 2026-06-13)): **371**
- Pre-era events counted and EXCLUDED: 414 installed + 16 uninstalled
- pre-era installed-suggestion events carry no suggestion_id and are STRUCTURALLY UNJOINABLE to outcomes — counted, excluded, never fudged into either denominator.

## Over-firing tail — >10 fires, 0 honest follows

| Skill | Fires | Ignore streak | needs_work (2026-07-13 audit) |
|-------|------:|--------------:|:---:|
| `spec-review` | 21 | 21 | yes |
| `validate` | 21 | 21 | no |
| `init` | 20 | 20 | yes |
| `recon` | 19 | 19 | yes |
| `prototype` | 13 | 13 | yes |
| `handoff` | 11 | 11 | no |

## All skills with joinable fires

Honest follow = corroborated engagement or C2-valid acted in the disposition ledger (never the 5-min heuristic). skill-authoring rows are excluded from follows per the two-track rule (ADR-0098). Unresolved = no disposition row yet (stays in the fire denominator).

| Skill | Fires (inst/uninst) | Honest follows (inst/uninst) | Authoring | Unresolved | Ignore streak | Last followed | needs_work |
|-------|--------------------:|-----------------------------:|----------:|-----------:|--------------:|---------------|:---:|
| `summarize` | 62 (0/62) | 18 (0/18) | 0 | 0 | 9 | 2026-07-03 | — |
| `vault` | 29 (29/0) | 6 (6/0) | 1 | 0 | 8 | 2026-06-29 | — |
| `spec-review` | 21 (1/20) | 0 (0/0) | 0 | 0 | 21 | never | yes |
| `validate` | 21 (21/0) | 0 (0/0) | 0 | 0 | 21 | never | — |
| `init` | 20 (0/20) | 0 (0/0) | 0 | 0 | 20 | never | yes |
| `recon` | 19 (2/17) | 0 (0/0) | 0 | 0 | 19 | never | yes |
| `techdebt` | 15 (0/15) | 1 (0/1) | 0 | 0 | 1 | 2026-07-03 | — |
| `plan-feature` | 14 (0/14) | 2 (0/2) | 1 | 0 | 9 | 2026-06-24 | — |
| `roadmap` | 14 (14/0) | 5 (5/0) | 0 | 0 | 2 | 2026-07-03 | yes |
| `prototype` | 13 (0/13) | 0 (0/0) | 0 | 0 | 13 | never | yes |
| `bead` | 11 (11/0) | 2 (2/0) | 1 | 0 | 4 | 2026-06-28 | yes |
| `handoff` | 11 (0/11) | 0 (0/0) | 0 | 0 | 11 | never | — |
| `push-all` | 10 (0/10) | 2 (0/2) | 0 | 0 | 2 | 2026-07-03 | — |
| `claude-md-audit` | 9 (0/9) | 0 (0/0) | 0 | 0 | 9 | never | yes |
| `daily-logger` | 8 (8/0) | 0 (0/0) | 0 | 0 | 8 | never | — |
| `grill-with-docs` | 7 (7/0) | 1 (1/0) | 0 | 0 | 2 | 2026-06-29 | — |
| `setup-ci-cd` | 7 (0/7) | 0 (0/0) | 0 | 0 | 7 | never | — |
| `investigate` | 6 (6/0) | 0 (0/0) | 0 | 0 | 6 | never | — |
| `test-expand` | 6 (0/6) | 0 (0/0) | 0 | 0 | 6 | never | — |
| `zoom-out` | 6 (0/6) | 0 (0/0) | 0 | 0 | 6 | never | yes |
| `frame-standup` | 5 (5/0) | 1 (1/0) | 0 | 0 | 0 | 2026-07-03 | — |
| `gated-slice` | 5 (0/5) | 2 (0/2) | 0 | 0 | 3 | 2026-06-25 | — |
| `scaffold` | 5 (0/5) | 0 (0/0) | 0 | 0 | 5 | never | — |
| `tdd` | 5 (5/0) | 0 (0/0) | 0 | 0 | 5 | never | — |
| `scaffold-app` | 4 (0/4) | 1 (0/1) | 0 | 0 | 2 | 2026-06-14 | yes |
| `adr` | 3 (3/0) | 1 (1/0) | 1 | 0 | 0 | 2026-07-17 | — |
| `doc-refactor` | 3 (0/3) | 0 (0/0) | 0 | 0 | 3 | never | — |
| `extension-audit` | 3 (0/3) | 0 (0/0) | 0 | 0 | 3 | never | — |
| `skill-metrics` | 3 (0/3) | 0 (0/0) | 0 | 0 | 3 | never | — |
| `claude-md-rollout` | 2 (0/2) | 0 (0/0) | 0 | 0 | 2 | never | yes |
| `gastown` | 2 (0/2) | 0 (0/0) | 0 | 0 | 2 | never | — |
| `hardening` | 2 (0/2) | 0 (0/0) | 0 | 0 | 2 | never | — |
| `observe` | 2 (0/2) | 0 (0/0) | 0 | 0 | 2 | never | — |
| `skill-loader` | 2 (2/0) | 0 (0/0) | 0 | 0 | 2 | never | — |
| `sweep` | 2 (0/2) | 0 (0/0) | 0 | 0 | 2 | never | — |
| `adopt-stack` | 1 (0/1) | 0 (0/0) | 1 | 0 | 1 | never | — |
| `council-review` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `deepen` | 1 (1/0) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `diagram-intake` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `rag-audit` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `resume` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | yes |
| `resume-audit` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `scaffold-frame-app` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | yes |
| `screenshot-audit` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `skill-create` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `speculative-pass` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | yes |
| `workbench` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | — |
| `writing-beats` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | yes |
| `writing-shape` | 1 (0/1) | 0 (0/0) | 0 | 0 | 1 | never | yes |

## needs_work cross-reference

22 skills carry the 2026-07-13 audit's needs_work verdict; 15 of them have joinable fires in this window. Over-firing ∩ needs_work: `spec-review`, `init`, `recon`, `prototype`.

## Evidence evolution note (honesty over continuity)

The S9 slice was authored citing "summarize 62 fires / 0 follows" from the legacy
`skill:suggestion-followed` stream — a stream known to under-fire (repo-scope
registration; see loops.md `hook-log-skill`). Under the honest join (corroborated
engagement / C2-valid acted against the S16-rebuilt disposition ledger), summarize
reads **62 fires / 18 honest follows** — all uninstalled-population inline reads.
The over-firing tail this report names is the corrected one above. The ruler moved;
the number moved with it; both readings are preserved here so the change is auditable.

Window: the full joinable era (2026-06-13 → generation date). This is deliberately
era-bounded rather than a rolling 30d — the denominator is every fire that CAN be
joined, stated exactly.
