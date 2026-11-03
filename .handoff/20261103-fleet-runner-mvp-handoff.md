---
id: 20261103-fleet-runner-mvp-handoff
type: brief
title: "fleet-runner first runnable iteration + independent review of core #575 and BookcaseDiscovery #28 — handoff"
actor: code-claude
to: codex
refs:
  - issue:core#307
  - issue:core#313
  - issue:core#311
  - issue:core#309
  - issue:core#318
  - pr:core#575
  - pr:BookcaseDiscovery#28
  - path:core/decisions/wayfinder/control-plane-conductor.md
  - path:core/decisions/fleet-runner/gate-authority-tiers.md
  - path:BookcaseDiscovery/docs/ops/compute-fleet.md
hook: fleet-runner-mvp
status: live
created_at: 2026-11-03T12:00:00-0600
labels:
  project: fleet-runner
  receiving_harness: "GPT Codex, project FleetRunner - Builder, on Yojimbo"
---

# Handoff — fleet-runner first runnable iteration, and an independent review

_Date: 2026-11-03. Written by a Claude Code session (Opus 5.5) that forked from the BookcaseDiscovery conductor. The operator is deliberately handing this to a different model and harness. Two reasons: to test how well handoff works, and to get a review that isn't anchored on the author's view._

## Two jobs, in this order

1. **Independently review the two open PRs.** Don't trust their descriptions. Run the checks yourself from a clean checkout.
   - **[core #575](https://github.com/ojfbot/core/pull/575)**, branch `claude/gate-authority-tiers`. Docs only. Check:
     - does `decisions/fleet-runner/gate-authority-tiers.md` respect the #307 map's rules (no parallel program, no replacement tickets, accepts nothing)?
     - is the four-axis authority table sound? Is anything missing?
     - does it conflict with ADR-0086, the draft `progressive-autonomy-gates`, or ADR-0109?
     - does the dated map note (2026-11-03) overclaim?
     - does any job-target or career content appear? None should (`adr:employer-evidence-boundary`).
   - **[BookcaseDiscovery #28](https://github.com/ojfbot/BookcaseDiscovery/pull/28)**, branch `claude/compute-fleet`. A plan doc plus a spike. Check:
     - `src/run/jobs.ts`: lease, fencing token, `BEGIN IMMEDIATE` transactions, the sweep-on-claim race, `release` decrementing attempts, `complete` gated on `lease_expires > now`;
     - `test/jobs.test.ts`: coverage and gaps;
     - the cost figures in `docs/ops/compute-fleet.md` §3 and §8 against `evals/F0/metrics.json`;
     - privacy, using the repo's own guard: `node scripts/privacy-guard.mjs` and `--history`. The repo is public, and photos, OCR text, titles and image ids must never appear.
     - Known: one `ingest` test times out under heavy load and passes alone; `main()` now returns `number | Promise<number>`.

   Post findings as PR review comments, or as a report to the operator. Merging is the operator's call, or the BookcaseDiscovery conductor's for #28. Don't merge either PR.
2. **Chart the shortest honest path to fleet-runner's first runnable iteration**, inside the existing map (`decisions/wayfinder/control-plane-conductor.md`, tracker #307).
   - **Grill the operator first.** Ask what the first iteration must prove, and whether a deterministic BookcaseDiscovery compute job is an acceptable first pilot before a coding work order.
   - Then propose the minimal P0–P2 slice sequence that can host one compute job: admission → lease → fenced completion → gate record → morning report.
   - Name which open tickets each slice needs settled (#315, #308, #311, #309, #313, #318) and which can wait behind an explicit hold.
   - Take the operator's chosen frontier ticket one step. The map's rule is one ticket per session.

## State at handoff

| Item | Where | State |
|---|---|---|
| Gate-authority tiers (input to #313/#318) | core #575 | Open, unmerged, Proposed |
| #307 map note: BookcaseDiscovery compute as a receiving workload, interim queue, nudge to bring P0–P2 forward | core #575 | Open |
| Compute-fleet plan, cards N-1 to N-3, interim queue spike, `bookcase jobs` CLI | BookcaseDiscovery #28 | Open; typecheck clean; privacy guards ok |
| Interim queue retirement | BookcaseDiscovery card N-3 | When fleet-runner can admit and lease a compute job |
| Worktrees on Yojimbo | `~/ojfbot/.worktrees/core-gate-tiers`, `~/ojfbot/.worktrees/bcd-compute-fleet` | Leave them; make your own |

## Operator rulings, 2026-11-03

These are recorded in the PRs and are not up for re-grilling.

- **No single agentic interface** (Claude, Codex, an owned harness) **and no single machine is the source of truth or governor.** Platform services own state and authority; agents are bounded clients. Yojimbo hosts things only because it is always on.
- **More autonomy, bounded:**
  - stochastic calls are wrapped in deterministic runners, adversarially challenged and checked;
  - some gates are human-only;
  - others are machine- or agent-reviewable through a tiered schema;
  - pinned baselines allow rollback and bisection.
- **BookcaseDiscovery does not block on fleet-runner.** It runs an interim workload-local queue and migrates with the first suitable card.
- **Multi-host:**
  - a second Mac (M3 Max, 64 GB laptop) may hold private photos (FileVault, LAN only, never cloud);
  - it works nights and when idle, with unreliable presence, so it must be safely interruptible;
  - each host provisions itself, with its own Hugging Face login and no copied credentials;
  - a NAS/NFS share is planned.
- **Day Shift / Night Shift is the north star** (`ns:l2-ojfbot#P2`). Don't build a competing standalone shift orchestrator.

- **Yojimbo is acceptable as the interim control host** for BookcaseDiscovery's job table, pending the NAS (ruled the same day).

## Open questions awaiting the operator

1. The laptop's idle and power policy: minutes idle before it claims work, the night window, GPU jobs on battery.
2. Owner-only setup for a second host: Remote Login, SSH keys, FileVault, Hugging Face login.

## Rules

- pnpm only; `pnpm dlx`, never npx.
- No `--no-verify`.
- Log deviations in `implementation-notes.md`.
- Work in your own worktree. The main core checkout holds other sessions' uncommitted edits.
- Never read or print tokens or credentials.
- No career or job-target content in core or BookcaseDiscovery (`adr:employer-evidence-boundary`).
