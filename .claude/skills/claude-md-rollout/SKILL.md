---
name: claude-md-rollout
description: >
  Advance the ADR-0081 CLAUDE.md loading-discipline rollout by exactly one repo. Reads
  core/CLAUDE-MD-ROLLOUT.md, picks the next `untouched` repo, runs /claude-md-audit --apply on a
  branch, opens a PR, and updates the tracker. Designed to be driven by a /schedule cron (one repo
  per cycle) or run manually during a /frame-standup check-in. Use when the user says
  "claude-md-rollout", "advance the claude.md rollout", "next rollout step", "roll out ADR-0081".
  Modes: --step (default, one repo) · --status (print tracker, no changes) · --dry-run (audit only,
  no PR). Opt-in + PR-gated: never auto-merges; one repo per invocation.
---

You are advancing a paced, PR-gated rollout **one repo at a time**. Never batch. Never auto-merge.

**Tier:** 2 — Multi-step procedure
**Phase:** Implementation (rollout automation)
**Modes:** `--step` (default) · `--status` · `--dry-run`

## Steps

### 1. Read the tracker
Read `core/CLAUDE-MD-ROLLOUT.md`. In `--status` mode, print the table + counts (untouched/pr-open/merged) and STOP.

### 2. Pick the next repo
The first repo in `untouched` (table order). If none → report "rollout complete; N repos merged/pr-open" and STOP. Re-verify the repo's git state first (concurrent agents move branches; some fleet repos are archived/empty — skip with a `notes` update if so).

### 3. Decompose it
On a fresh `docs/claude-md-routing` branch in that repo (branch from `origin/main`): run `/claude-md-audit <repo> --apply`. In `--dry-run`, run propose-only and STOP after reporting.

### 4. Verify + open the PR
Re-run `node core/scripts/claude-md/footprint.mjs <repo>` to capture the after-footprint. **Assert 0 blocks routed to `@import`** (check the routing record). If the audit found the repo is Layer-0-heavy and moved ~nothing, that is a **valid** outcome — open a PR documenting "minimal routing, Layer-0-heavy, correct" (or set `merged`-equivalent note and skip the PR if literally nothing changed). Otherwise open the PR (target `main`, `docs:` conventional commit, what/why/how-to-test body).

### 5. Update the tracker + stop
Set the repo's state to `pr-open` (or `audited` for `--dry-run`), fill the `After` and `PR` columns, commit `CLAUDE-MD-ROLLOUT.md`. **Do exactly one repo, then stop** — even if more are `untouched`.

## Constraints
- **One repo per invocation.** The pacing is the point (your `depression-aware-planning` / no-big-bang discipline).
- **PR-gated, never auto-merge.** Each decomposition is human-reviewed.
- **Re-verify git state** right before branching (concurrent-agent safety).
- **The judgment is delegated** to `/claude-md-audit` — this skill only orchestrates: pick → audit → PR → track.
- Idempotent: re-running when the top `untouched` repo already has an open PR → no-op + report (don't double-open).

## Composition
- Driven by a `/schedule` cron (one cycle = one `--step`) and surfaced in `/frame-standup`.
- Calls `/claude-md-audit` (judgment) + `footprint.mjs` (measurement). Governed by ADR-0081.

## See Also
- `CLAUDE-MD-ROLLOUT.md` — the tracker (state of record)
- `.handoff/adr-0081-loading-discipline-handoff.md` — the full initiative handoff
- ADR-0081; `/claude-md-audit`; `/frame-standup`
