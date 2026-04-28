# Skill adoption metrics

Generated: 2026-04-28T21:39:49.200Z  
Window: 2026-03-29T21:39:49.200Z → 2026-04-28T21:39:49.200Z (30 days)
Sources: `/Users/yuri/.claude/skill-telemetry.jsonl`, `/Users/yuri/.claude/suggestion-telemetry.jsonl`, baseline=`/Users/yuri/.claude/skill-telemetry-baseline-2026-04-28.jsonl`

## Totals

- Skill invocations (excludes knowledge/template/reference loads): **6** in window (lifetime: 30 raw events)
- Suggestion events in window: **77** (lifetime: 77)
- Baseline events: 24

## Invocations by skill (normalized; knowledge loads excluded)

| Skill | Count |
|-------|------:|
| `frame-standup` | 3 |
| `investigate` | 1 |
| `validate` | 1 |
| `init` | 1 |

## Delta vs baseline

| Skill | Baseline | Now | Delta |
|-------|---------:|----:|------:|
| `frame-standup` | 3 | 3 | +0 |
| `investigate` | 1 | 1 | +0 |
| `validate` | 1 | 1 | +0 |
| `init` | 1 | 1 | +0 |

## Sequencing (skill A precedes skill B within 3600s, same session)

| From → To | Pairs | B count | Rate | Target | Pass |
|-----------|------:|--------:|-----:|-------:|:----:|
| `grill-with-docs` → `plan-feature` | 0 | 0 | 0 | 0.5 | ✗ |

## Suggestion-followed rate (within 5min)

Overall: **1 / 34** = **2.9%** followed
Ignored: 27, no-match: 14

| Skill | Suggested | Followed | Rate |
|-------|----------:|---------:|-----:|
| `daily-logger` | 5 | 0 | 0.0% |
| `spec-review` | 3 | 0 | 0.0% |
| `validate` | 3 | 0 | 0.0% |
| `summarize` | 3 | 0 | 0.0% |
| `setup-ci-cd` | 2 | 0 | 0.0% |
| `hardening` | 2 | 0 | 0.0% |
| `pr-review` | 2 | 0 | 0.0% |
| `techdebt` | 2 | 0 | 0.0% |
| `scaffold` | 1 | 0 | 0.0% |
| `doc-refactor` | 1 | 0 | 0.0% |
| `resume-audit` | 1 | 0 | 0.0% |
| `recon` | 1 | 0 | 0.0% |
| `init` | 1 | 1 | 100.0% |
| `workbench` | 1 | 0 | 0.0% |
| `plan-feature` | 1 | 0 | 0.0% |
| `screenshot-audit` | 1 | 0 | 0.0% |
| `gastown` | 1 | 0 | 0.0% |
| `scaffold-app` | 1 | 0 | 0.0% |
| `handoff` | 1 | 0 | 0.0% |
| `roadmap` | 1 | 0 | 0.0% |

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

