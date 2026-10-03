# Selfco vault hygiene — external loop registration

Under [fleet-runner #307](https://github.com/ojfbot/core/issues/307), this is a provisional [#315 census](https://github.com/ojfbot/core/issues/315) entry observing an existing Codex heartbeat. The `codex-automation` trigger and `codex-run:` locator remain provisional pending #311/#310; their blocking edges are unchanged. Codex remains its scheduler and executor; fleet-runner does not admit or dispatch its work.

## Configuration observed 2026-10-02 (America/Chicago)

| Field | Observed value |
|---|---|
| Registry identity | `selfco-vault-hygiene` in `decisions/loops/loops.md` |
| Scheduler artifact | `~/.codex/automations/selfco-vault-hygiene/automation.toml` |
| Codex database | `~/.codex/sqlite/codex-dev.db`, `automations` and `automation_runs` |
| Kind and state | `heartbeat`, `ACTIVE` in both TOML and database |
| Cadence | `FREQ=DAILY;BYHOUR=9;BYMINUTE=0` |
| Effective next occurrence | 2026-10-03 09:01:22 CDT from `automations.next_run_at`. The TOML has no time-zone field; the 1m22s offset and future time-zone behavior are not established by this observation. |
| Target | Private local Codex chat; TOML/database agreement is checked locally without committing its identifier |
| Host assumption | The operator's Codex desktop and local Selfco checkout must be available; remote fleet-runner cannot infer availability from this local database. |
| Owner and stop path | Operator; pause or delete the existing automation in the Codex app. Registry changes never stop or reschedule it. |

The current documents omit the private chat identifier; earlier PR commits still contain it. This correction does not erase history.

At registration, `last_run_at` was null and `automation_runs` had zero rows. This is **configured, never fired**. `wiki/_lint-report.md` and `maintenance/hygiene-findings.json` existed, but their timestamps or contents do not prove a Codex fire.

## Evidence and consumption

`pnpm exec node scripts/codex-automation-status.mjs` selects only automation identity,
schedule, status and run metadata from SQLite. Its local output includes private thread
identifiers and must be redacted before public sharing. It does not select prompt or inbox
columns. The TOML parser reads local configuration, including any prompt field, but only
identity/kind/status/recurrence/target metadata participates in comparisons or output.

A recognized successful run row is provisional firing evidence; output stays **unverified**
until a run-specific observation attributes changed files or quiet completion. Run-status
aliases are unqualified compatibility hypotheses because no real run row existed at
registration. The first-fire verifier must pin observed vocabulary and correlation; unknown
status remains unverifiable. `codex-dev.db` is the observed schema-dependent filename.
This bounded adapter currently assumes `~/.codex`; alternate `CODEX_HOME` placement remains
unqualified and must be explicitly supported before using it on such a host.

Missing/inaccessible databases, changed schema, and malformed timestamps yield
`UNVERIFIABLE`. Static lint never reads this database or rejects a Codex UI pause.
A recorded overdue `next_run_at` with no corresponding later receipt produces `MISSED`
after 90 minutes. If Codex advances or clears that timestamp, this check alone cannot prove
a missed occurrence. Zero retained runs after the declared cadence plus grace produces a
separate age-based warning and stays `UNVERIFIABLE`, because prior pauses and retention
are unknown. A recorded failure remains `FAILED` instead of being masked by schedule age.

Morning-cockpit **will read** this projection through `/api/loop` via
[morning-cockpit #52](https://github.com/ojfbot/morning-cockpit/pull/52), unmerged at this
registration. A panel view does not prove human consumption or a decision; #316 still
owns that meaning. Ambiguous findings remain in the local Selfco outbox and their
permission path is [#500](https://github.com/ojfbot/core/issues/500).

Census denominator at registration: one declared automation inspected, one matching active
configuration, zero retained run rows, zero attributed outputs, and zero consumption
receipts. This partial census establishes configuration only. The historical reports and
outbox are not run-specific evidence. Broader census completeness remains #315; durable
runtime proofs remain #310 and independent supervision remains #318.


The older `selfco-maintenance-report` registry entry remains disabled, manual and report-only. The active hygiene heartbeat may invoke its generator but has a different scheduler, scope and identity. This is an overlap candidate for [#317](https://github.com/ojfbot/core/issues/317), not a second live schedule.

## First-fire verification ownership

The registry's `verifier` field carries the follow-up under #315; this document creates no
separate delivery tracker. Compare the first real run row privately with the scheduled
occurrence and target chat, then record output and consumption separately. The originally
observed 10:31:22 CDT threshold only implies `MISSED` if the 09:01:22 `next_run_at` remains
recorded and no later run receipt appears. The first real fire must test that assumption.
