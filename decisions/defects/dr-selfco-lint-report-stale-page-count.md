---
type: defect-report
slug: selfco-lint-report-stale-page-count
class: dead-mechanism
severity: high
status: verified-closed
disposition: repair-mechanism
location: "selfco:wiki/_lint-report.md:16"
claim: "lint: /Users/yuri/selfco/wiki  (309 pages)"
actual: "668 pages — the report is 53 days stale and describes a corpus 2.16x smaller than reality"
claim_probe: "grep -q '(309 pages)' ~/selfco/wiki/_lint-report.md"
truth_probe: "find ~/selfco/wiki -name '*.md' | wc -l | tr -d ' '"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit (F-20)"
---

# `_lint-report.md` reports a corpus less than half the real size

`wiki/_lint-report.md` self-dates to **2026-06-06 18:16 UTC** and states it scanned
**309 pages**. The vault now holds **668**. Every verdict in the file — `0 orphans`,
`0 broken links`, `0 raw-without-source`, `0 stale` — was computed against a graph missing
54% of today's nodes, and the embedded `suggested links` table is ranked over that same
partial graph.

A third page count exists in the vault simultaneously: `wiki/log.md:1218` records
"Lint gate: 0 broken links, 0 orphans (**627 pages**)" from 2026-06-29. Three numbers —
309, 627, 668 — none reconciled.

## Why it matters

This is the vault's own health surface. While it is stale, every other freshness check
inherits its blind spot, and its all-zeros verdict reads as evidence the vault is healthy.
Re-running it today still yields all zeros, which is precisely why nobody noticed: 53 days
of neglect cost no correctness, only credibility. The generated companion `wiki/_hot.md`
is frozen at the same timestamp (2026-06-06 19:00 UTC) with none of its "top 25 recently
edited" entries still in the real top 25.

Root cause is not the report — it is that **nothing schedules its regeneration**.
`scripts/vault-maintenance-report.sh` prints its own one-line regeneration command in its
header and suggests "a nightly/weekly drift signal — e.g. launchd/cron"; no such schedule
exists. This defect is the visible symptom of the unregistered-loop problem tracked in
`dr-selfco-loops-unregistered`.

## Repair

Deterministic — a generated surface with zero prose judgment:

```bash
~/selfco/scripts/vault-maintenance-report.sh
```

Then commit the regenerated `wiki/_lint-report.md`. Regenerate `wiki/_hot.md` in the same
pass (`~/selfco/scripts/vault-hot.sh`) since it froze at the same moment and has the same
cause.

The durable fix is registering the loop so this cannot silently freeze again — see
`dr-selfco-loops-unregistered`. Repairing this report without registering the loop buys
one refresh, not a mechanism.

## Closure

`claim_probe` exits non-zero once `(309 pages)` no longer appears in the file. Chosen as a
literal-string probe on the *artifact* rather than a comparison against the live page
count, so the defect closes when someone regenerates the report — not when the vault
happens to reach 309 pages again.
