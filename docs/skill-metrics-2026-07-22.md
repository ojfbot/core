# Skill adoption metrics

Generated: 2026-07-22T20:25:12.969Z  
Window: 2026-06-22T00:00:00.000Z → 2026-07-22T20:25:12.964Z (31 days)
Sources: invocations from `/Users/yuri/selfco/tracking/skill-dispositions.jsonl` (live, ADR-0095; `skill-telemetry` frozen since 2026-05-12), suggestions from `/Users/yuri/.claude/suggestion-telemetry.jsonl`

## Totals

- Skill invocations (excludes knowledge/template/reference loads): **51** in window (lifetime: 142 raw events)
- Suggestion events in window: **968** (lifetime: 2563)

## Invocations by skill (normalized; knowledge loads excluded)

| Skill | Count |
|-------|------:|
| `summarize` | 18 |
| `vault` | 8 |
| `roadmap` | 5 |
| `adr` | 4 |
| `bead` | 3 |
| `push-all` | 3 |
| `plan-feature` | 3 |
| `gated-slice` | 2 |
| `scaffold-app` | 1 |
| `adopt-stack` | 1 |
| `grill-with-docs` | 1 |
| `techdebt` | 1 |
| `frame-standup` | 1 |

## Delta vs baseline

| Skill | Baseline | Now | Delta |
|-------|---------:|----:|------:|
| `summarize` | 0 | 18 | +18 |
| `vault` | 0 | 8 | +8 |
| `roadmap` | 0 | 5 | +5 |
| `adr` | 0 | 4 | +4 |
| `bead` | 0 | 3 | +3 |
| `push-all` | 0 | 3 | +3 |
| `plan-feature` | 0 | 3 | +3 |
| `gated-slice` | 0 | 2 | +2 |
| `scaffold-app` | 0 | 1 | +1 |
| `adopt-stack` | 0 | 1 | +1 |
| `grill-with-docs` | 0 | 1 | +1 |
| `techdebt` | 0 | 1 | +1 |
| `frame-standup` | 0 | 1 | +1 |

## Sequencing (skill A precedes skill B within 3600s, same session)

| From → To | Pairs | B count | Rate | Target | Pass |
|-----------|------:|--------:|-----:|-------:|:----:|
| `grill-with-docs` → `plan-feature` | 0 | 3 | 0 | 0.5 | ✗ |

## Suggestion-followed rate (within 5min)

Overall: **0 / 88** = **0.0%** followed
Ignored: 438, no-match: 221

| Skill | Suggested | Followed | Rate |
|-------|----------:|---------:|-----:|
| `validate` | 17 | 0 | 0.0% |
| `vault` | 15 | 0 | 0.0% |
| `roadmap` | 13 | 0 | 0.0% |
| `bead` | 8 | 0 | 0.0% |
| `daily-logger` | 7 | 0 | 0.0% |
| `grill-with-docs` | 6 | 0 | 0.0% |
| `investigate` | 6 | 0 | 0.0% |
| `tdd` | 5 | 0 | 0.0% |
| `frame-standup` | 4 | 0 | 0.0% |
| `adr` | 3 | 0 | 0.0% |
| `deepen` | 1 | 0 | 0.0% |
| `skill-loader` | 1 | 0 | 0.0% |
| `recon` | 1 | 0 | 0.0% |
| `resume` | 1 | 0 | 0.0% |

## Targets vs actual (from ADRs)

| Kind | Target | Observed | Goal | Pass | Source |
|------|--------|---------:|-----:|:----:|--------|
| invocations | `grill-with-docs` invocations | 1 | 10 | ✗ | ADR-0045 + plan §Success metrics |
| invocations | `tdd` invocations | 0 | 5 | ✗ | ADR-0046 + plan §Success metrics |
| invocations | `deepen` invocations | 0 | 3 | ✗ | Plan §Success metrics — ≥3 TECHDEBT entries |
| invocations | `triage` invocations | 0 | 1 | ✗ | Plan §Success metrics — ≥1 full backlog pass |
| sequencing | `grill-with-docs` → `plan-feature` rate | 0 | 0.5 | ✗ | ADR-0045: ≥50% of /plan-feature preceded by /grill-with-docs |

## Gaps

- `grill-with-docs` needs 9 more invocations (target: 10, observed: 1)
- `tdd` needs 5 more invocations (target: 5, observed: 0)
- `deepen` needs 3 more invocations (target: 3, observed: 0)
- `triage` needs 1 more invocations (target: 1, observed: 0)
- `grill-with-docs` → `plan-feature` rate needs +0.5 (target: 0.5, observed: 0)

