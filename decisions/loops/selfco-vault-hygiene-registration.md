# Selfco vault hygiene — external loop registration

Under [fleet-runner #307](https://github.com/ojfbot/core/issues/307), this entry observes an existing Codex heartbeat. Codex remains its scheduler and executor; fleet-runner does not admit or dispatch its work.

## Configuration observed 2026-10-02 (America/Chicago)

| Field | Observed value |
|---|---|
| Registry identity | `selfco-vault-hygiene` in `decisions/loops/loops.md` |
| Scheduler artifact | `~/.codex/automations/selfco-vault-hygiene/automation.toml` |
| Codex database | `~/.codex/sqlite/codex-dev.db`, `automations` and `automation_runs` |
| Kind and state | `heartbeat`, `ACTIVE` in both TOML and database |
| Cadence | `FREQ=DAILY;BYHOUR=9;BYMINUTE=0` |
| Effective next occurrence | 2026-10-03 09:01:22 CDT from `automations.next_run_at`. The TOML has no time-zone field; the 1m22s offset and future time-zone behavior are not established by this observation. |
| Target | Codex chat `01a0ff70-a911-7ea1-b752-ae9f95a76419` on the local host |
| Host assumption | The operator's Codex desktop and local Selfco checkout must be available; remote fleet-runner cannot infer availability from this local database. |
| Owner and stop path | Operator; pause or delete the existing automation in the Codex app. Registry changes never stop or reschedule it. |

At registration, `last_run_at` was null and `automation_runs` had zero rows. This is **configured, never fired**. `wiki/_lint-report.md` and `maintenance/hygiene-findings.json` existed, but their timestamps or contents do not prove a Codex fire.

## Evidence and consumption

`node scripts/codex-automation-status.mjs` selects only automation identity, schedule, status and run metadata. It never selects the private prompt or inbox text. The `automation_runs` row supplies a run thread ID, observed time, status and execution outcome independent of Selfco output files. A successful row proves a Codex run; output remains **unverified** until a run-specific output record or contemporaneous inspection can attribute changed files or a quiet run to that receipt. Missing database access stays `unverifiable`; a paused or missing automation does not project as active; an overdue scheduled occurrence with no row projects as `MISSED` after a 90-minute grace.

Morning-cockpit reads this core projection through `/api/loop` and displays configured, firing and output states separately. The cockpit panel is a read view, not evidence that a human consumed the report or took a decision. [#316](https://github.com/ojfbot/core/issues/316) still defines consumption. Ambiguous findings remain in `~/selfco/maintenance/hygiene-findings.json`; the structured bead and permission path is [#500](https://github.com/ojfbot/core/issues/500). The temporary queue pointer can expire without closing that durable issue or resolving an outbox finding.

The older `selfco-maintenance-report` registry entry remains disabled, manual and report-only. The active hygiene heartbeat may invoke its generator but has a different scheduler, scope and identity. This is an overlap candidate for [#317](https://github.com/ojfbot/core/issues/317), not a second live schedule.

## Next scheduled proof

After the 2026-10-03 occurrence, rerun `node scripts/codex-automation-status.mjs`, `node scripts/loops-liveness.mjs`, inspect the Selfco report and outbox, then inspect `/api/loop` in morning-cockpit. Compare the run row's thread ID and time with the scheduled occurrence and the target Codex chat. If no row appears by 10:31:22 CDT, the current adapter reports `MISSED`; if host access is unavailable, it reports `UNVERIFIABLE` instead. Record output and decision disposition separately. This is a concrete input to [#310](https://github.com/ojfbot/core/issues/310); the full loop census remains [#315](https://github.com/ojfbot/core/issues/315), and independent supervision remains [#318](https://github.com/ojfbot/core/issues/318).
