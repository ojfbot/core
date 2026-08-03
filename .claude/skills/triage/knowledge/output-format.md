Reference for `/triage`: the exact output block format.

```
## Issue triage — <repo> — <count> issues

## Rubric proposals
| # | Title | Severity | Effort | Domain | Type | Reason |
| ... |

## Ordered backlog
1. [score=8.0] #12 Auth bypass on /api/v2/threads (p0/s/auth/bug)
2. [score=4.0] #34 Loading state stuck on cv-builder export (p1/s/ui/bug)
3. [score=1.0] #17 Add markdown preview to chat (p3/m/ui/feature)
...

## Anomalies (require attention)
- #45 has no clear domain — body describes both UI and persistence
- #19 marked p1/s but body suggests xl scope — recommend split
- #8 is 187 days old at p3 — recommend close or upgrade

## Suggested next
- Apply labels: re-invoke with --apply
- Or: address top-3 by priority score; re-triage weekly
```
