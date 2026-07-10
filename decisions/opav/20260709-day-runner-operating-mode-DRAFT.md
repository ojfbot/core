# DRAFT — day-runner operating mode (rm-l2-ojfbot#S25 decision packet)

**Status: DRAFT — no mode chosen, nothing scheduled.** This packet stages the S25
decision; the decision itself and the owed live proof are the operator's. Sign-off
converts this into the RIDM-style note (S16 pattern) with the chosen option kept and
the others recorded as rejected-with-reasons.

## The decision

day-run runs NOWHERE today (verified 2026-07-08: crontab empty, no launchd plist —
and now permanently visible: the `day-runner` loops-registry entry is `trigger: manual`,
and `weekly-measure` sits in the same state). Choose its operating mode:

### Option A — manual ritual (a /frame-standup evening step)
- **Trigger:** operator runs `node scripts/day-runner.mjs --once` (or `/day-run`) as a
  standup/evening step; loops registry stays `trigger: manual, cadence: manual`.
- **F10.6 allowlist:** repos = whatever the claimed slice's `repo:` field names (single
  repo per session, worktree-isolated); spend = 1 session × `--timeout-mins 45`,
  `--max 2`; scope = slice-boundary contract (branch + PR only, no merge, no status.jsonl).
- **For:** zero new always-on surface; attention stays the scheduler (matches the
  "human attention is the throughput bottleneck" thesis — the ritual IS the attention).
- **Against:** it has run nowhere for a month — the ritual demonstrably doesn't happen
  unprompted; dispatch throughput stays coupled to operator memory.

### Option B — launchd on the audit rail (com.ojfbot.skill-architecture-audit pattern)
- **Trigger:** a `day-runner-launchd.plist` (e.g. weekday mornings 06:30), wrapper with
  the fnm/exit-0 discipline; loops registry flips to `trigger: launchd, cadence: daily`.
- **F10.6 allowlist:** DECLARED IN THE PLIST-WRAPPED BRIEF — repos = agent_eligible slices'
  repos only; spend cap = `--max 2` sessions × 45 min/day hard ceiling; gate-0 unchanged
  (PRs only; merge stays human).
- **For:** dispatch happens without being remembered; the S30 liveness check watches it.
- **Against:** first always-on spawner of headless sessions on this Mac; needs the
  two-supervised-runs pattern (S26's) before the schedule goes live.

### Option C — harness-native routine (cycle-5 §2a PARTIAL-ABSORB path)
- **Trigger:** a Claude Code cloud routine / `/schedule` invoking `/day-run` on a cron;
  registry `trigger: harness-routine`.
- **F10.6 allowlist:** same declaration as B, carried in the routine prompt.
- **For:** no local plist to rot; consistent with the cycle-5 verdict that NEW
  schedule+prompt loops default harness-native; survives the Mac being asleep only if
  the runner itself moves cloud-side — which it can't yet (worktrees + Dolt are local).
- **Against:** day-runner is exactly the dispatch/verify layer the cycle-5 verdict said
  NOT to migrate (Dolt CAS + local worktrees + local ledgers); a cloud trigger for a
  local-only body is a split-brain rail. **Recorded as considered; recommend against
  until the runner's dependencies are reachable off-box.**

## TPMs (whichever mode is chosen — promotion criteria written BEFORE the shadow runs, §4.4)
- **Trace coverage:** ≥95% of dispatched slices resolve end-to-end via
  `node scripts/trace-join.mjs --latest` (S21 join).
- **Spend:** ≤ declared cap per run; report actual in the run bead (T8 closure feeds this).
- **Error rate:** sessions ending in timeout/contract-violation < 20% over the first 10
  runs, else the mode demotes back to manual and this note gets a breach addendum.

## The owed live proof (S25's second half — unchanged by mode choice)
One real `day-run --once` against an agent_eligible `check:`-bearing slice (S26's build
is now claimable once merged) producing a PR whose bead carries S14's `checks:{...}` and
S21's `Trace:` line, resolved by `trace-join.mjs`. Run it manually regardless of the mode
decision — the proof gates nothing but is owed from the tranche-2 brief.

## What sign-off looks like
Operator picks A/B/C (or hybrid A-now-B-later), strikes the others, renames this file
without `-DRAFT`, adds the sign-off line + date, and (if B) the plist ships through the
S26 two-supervised-runs pattern with the loops-registry flip as the "schedule enabled"
switch.
