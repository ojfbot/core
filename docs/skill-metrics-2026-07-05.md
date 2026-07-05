# Skill adoption metrics

Generated: 2026-07-05T00:07:50.856Z  
Window: 2026-06-05T00:07:50.852Z → 2026-07-05T00:07:50.852Z (30 days)
Sources: invocations from `/Users/yuri/selfco/tracking/skill-dispositions.jsonl` (live, ADR-0095; `skill-telemetry` frozen since 2026-05-12), suggestions from `/Users/yuri/.claude/suggestion-telemetry.jsonl`

## Totals

- Skill invocations (excludes knowledge/template/reference loads): **4** in window (lifetime: 92 raw events)
- Suggestion events in window: **1668** (lifetime: 2437)

## Invocations by skill (normalized; knowledge loads excluded)

| Skill | Count |
|-------|------:|
| `validate` | 1 |
| `gated-slice` | 1 |
| `adopt-stack` | 1 |
| `summarize` | 1 |

## Delta vs baseline

| Skill | Baseline | Now | Delta |
|-------|---------:|----:|------:|
| `validate` | 0 | 1 | +1 |
| `gated-slice` | 0 | 1 | +1 |
| `adopt-stack` | 0 | 1 | +1 |
| `summarize` | 0 | 1 | +1 |

## Sequencing (skill A precedes skill B within 3600s, same session)

| From → To | Pairs | B count | Rate | Target | Pass |
|-----------|------:|--------:|-----:|-------:|:----:|
| `grill-with-docs` → `plan-feature` | 0 | 0 | 0 | 0.5 | ✗ |

## Suggestion-followed rate (within 5min)

Overall: **0 / 256** = **0.0%** followed
Ignored: 759, no-match: 369

| Skill | Suggested | Followed | Rate |
|-------|----------:|---------:|-----:|
| `vault` | 54 | 0 | 0.0% |
| `validate` | 27 | 0 | 0.0% |
| `summarize` | 17 | 0 | 0.0% |
| `roadmap` | 16 | 0 | 0.0% |
| `grill-with-docs` | 12 | 0 | 0.0% |
| `bead` | 12 | 0 | 0.0% |
| `daily-logger` | 11 | 0 | 0.0% |
| `techdebt` | 9 | 0 | 0.0% |
| `push-all` | 8 | 0 | 0.0% |
| `investigate` | 8 | 0 | 0.0% |
| `init` | 7 | 0 | 0.0% |
| `prototype` | 7 | 0 | 0.0% |
| `frame-standup` | 7 | 0 | 0.0% |
| `spec-review` | 6 | 0 | 0.0% |
| `recon` | 6 | 0 | 0.0% |
| `claude-md-audit` | 5 | 0 | 0.0% |
| `plan-feature` | 5 | 0 | 0.0% |
| `adr` | 4 | 0 | 0.0% |
| `claude-md-rollout` | 4 | 0 | 0.0% |
| `setup-ci-cd` | 4 | 0 | 0.0% |

## Targets vs actual (from ADRs)

| Kind | Target | Observed | Goal | Pass | Source |
|------|--------|---------:|-----:|:----:|--------|
| invocations | `grill-with-docs` invocations | 0 | 10 | ✗ | ADR-0045 + plan §Success metrics |
| invocations | `tdd` invocations | 0 | 5 | ✗ | ADR-0046 + plan §Success metrics |
| invocations | `deepen` invocations | 0 | 3 | ✗ | Plan §Success metrics — ≥3 TECHDEBT entries |
| invocations | `triage` invocations | 0 | 1 | ✗ | Plan §Success metrics — ≥1 full backlog pass |
| sequencing | `grill-with-docs` → `plan-feature` rate | 0 | 0.5 | ✗ | ADR-0045: ≥50% of /plan-feature preceded by /grill-with-docs |

## Gaps

- `grill-with-docs` needs 10 more invocations (target: 10, observed: 0)
- `tdd` needs 5 more invocations (target: 5, observed: 0)
- `deepen` needs 3 more invocations (target: 3, observed: 0)
- `triage` needs 1 more invocations (target: 1, observed: 0)
- `grill-with-docs` → `plan-feature` rate needs +0.5 (target: 0.5, observed: 0)

