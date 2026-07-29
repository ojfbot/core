---
type: defect-report
slug: selfco-loops-no-verifier
class: schema-drift
severity: high
status: verified-closed
disposition: repair-mechanism
location: "core:decisions/loops/loops.md:57"
claim: "selfco-box-cultivate / selfco-box-poll-notion — verifier: \"none\", evidence_ref: \"none\""
actual: "Registered but unwatchable. Two selfco loops carry no verifier and no evidence_ref, and the maintenance-report / hot-list loops are not registered at all — so four derived surfaces froze on 2026-06-11 with no signal for 48 days."
claim_probe: "grep -A8 'slug: selfco-box-cultivate' ~/ojfbot/core/decisions/loops/loops.md | grep -q 'verifier: \"none\"'"
truth_probe: "sh ~/ojfbot/core/scripts/probes/selfco-loop-staleness.sh"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit (F-05/F-20 root cause); corrected by defects-lint --sweep on filing day"
---

# selfco's loops are registered but have no verifier, so nothing can tell they died

> **Correction, filing day.** This report was first filed as `selfco-loops-unregistered`,
> claiming selfco's loops were absent from the registry. **That was wrong** — `loops.md:57`
> and `:69` register `selfco-box-cultivate` and `selfco-box-poll-notion`, both correctly
> marked `status: disabled`. The first `defects-lint.mjs --sweep` returned `claim-gone` and
> caught it. The real defect is narrower and more interesting, and is restated below.
>
> Worth recording plainly: the independent probe invalidated an agent-filed defect on the
> ledger's first run. That is the two-source contract doing its job, and it is the reason
> an agent must never close its own report.

The registry schema has exactly the right fields — `verifier`, `evidence_ref`, `cadence`,
`stop_rule`, `status`. Both selfco entries fill them with `"none"`:

```yaml
  - slug: selfco-box-cultivate
    cadence: daily
    verifier: "none"          # <-- nothing checks it ran
    evidence_ref: "none"      # <-- nothing to check
    status: disabled
```

So `loops-liveness.mjs` has nothing to measure recency against. Registration without a
verifier is presence, not observability.

Two further loops are genuinely unregistered — `vault-maintenance-report.sh` and
`vault-hot.sh`, whose own headers ask to be scheduled ("nightly/weekly drift signal — e.g.
launchd/cron"). Neither is on any rail.

## Why it matters

This is the root cause of `dr-selfco-lint-report-stale-page-count`, not a sibling. When the
box paused on 2026-06-11, four surfaces froze silently:

| Surface | Last generated | Documented cadence |
|---|---|---|
| `wiki/_lint-report.md` | 2026-06-06 | "nightly/weekly" (unscheduled) |
| `wiki/_hot.md` | 2026-06-06 | unscheduled |
| `wiki/_suggested-links.md` | 2026-06-10 | "daily on the selfco-box" |
| `canvas/runs/experience-plane.canvas` | 2026-06-11 | on run events |

Each still renders and still looks authoritative. `status: disabled` was honest about the
*trigger* while nothing reported the *consequence*.

## Repair

1. Give both selfco entries a real `evidence_ref` — a file mtime is sufficient and honest
   (`file:~/selfco/wiki/_suggested-links.md`) — and a `verifier` naming what checks it.
2. Register `vault-maintenance-report` and `vault-hot` as loops, on the existing weekly
   launchd rail (`skill-architecture-audit`, Mon 03:45), which already accepts riders.
3. Confirm `node scripts/loops-lint.mjs` passes and `loops-liveness.mjs` reports the
   staleness rather than staying silent.

## Closure

`claim_probe` exits 0 while `selfco-box-cultivate` still carries `verifier: "none"`.
Narrow by design — it tests the specific defect, not the general aspiration. Registering
the two missing loops is part of the repair but is tracked by review, not by this probe.
