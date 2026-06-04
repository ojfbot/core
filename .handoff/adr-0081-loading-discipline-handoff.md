# Handoff — ADR-0081 CLAUDE.md loading-discipline + rollout

_Date: 2026-06-04 · Initiative spanning a config audit → ADR → implementation. Read this to resume._

## Overview
The fleet's 6 largest `CLAUDE.md` files (304–390 lines) carry **conditional** content in an **always-loaded** file — wasting context budget and *silently* diluting instructions (Claude won't report ignoring a rule buried on line 280). ADR-0081 establishes a **standing loading-discipline**: route each block by *when it's needed* — Layer 0 (always → `CLAUDE.md`), Layer 1 (path-conditional → `.claude/rules/` glob **or** nested `<subtree>/CLAUDE.md`), Layer 2 (task reference → `domain-knowledge/` + skill), or **delete**. The metric is **always-loaded footprint, not line count** (`@import` is banned — imports load at startup). Success = **zero conditional blocks left in the always-loaded layer** (so `core`, being command-catalog-heavy, correctly barely decomposes — a flat % target would wrongly force it to evict always-true rules).

Origin: an audit of the Newline "Setting Up Claude Code" lesson vs the fleet's `.claude/` config. Full audit in the selfco vault: `wiki/synthesis/newline-setup-vs-ojfbot-claude-config.md`.

## How to run
- **Measure (M1):** `node scripts/claude-md/footprint.mjs <repo> [<repo>...]` — prints always-loaded vs conditional tokens. `--json` for telemetry.
- **Decompose one repo (judgment):** `/claude-md-audit <repo>` (propose, no edits) → `/claude-md-audit <repo> --apply` (writes only CLAUDE.md / rules/ / nested CLAUDE.md / domain-knowledge in that repo, then re-measures).
- **Advance the rollout one repo:** `/claude-md-rollout --step` (picks next `untouched` in `CLAUDE-MD-ROLLOUT.md`, audits+applies, opens a PR, updates the tracker).
- **Progress:** read `CLAUDE-MD-ROLLOUT.md`, or it surfaces in `/frame-standup`.

## Architecture (the 4 layers of the system, not to be confused with the 4 content layers)
- **Measure** (deterministic): `scripts/claude-md/footprint.mjs`. Counts root CLAUDE.md + `@imports` + non-path-scoped rules as always-loaded; **excludes** path-scoped rules/ + nested CLAUDE.md. This exclusion is what makes routing show as a real drop and `@import` show as theater.
- **Decide** (LLM judgment): `.claude/skills/claude-md-audit/`. Classifies each block; conservative toward Layer 0 (wrong eviction is silent).
- **Enforce** (Slice 2, NOT BUILT): a two-stage PreToolUse gate on `**/CLAUDE.md` edits — cheap tripwire → scoped Haiku judge → block→ask loop routed into `/grill-with-docs`, with a per-session clearance marker and an M5 judge-reliability event log.
- **Roll out** (Slice 3, this PR): `CLAUDE-MD-ROLLOUT.md` tracker + `/claude-md-rollout` step skill + a `/schedule` cron advancing one repo/cycle + a `/frame-standup` line.

## How to debug
- **footprint shows `cond-tokens` for a repo with no rules/ or nested CLAUDE.md** → check for a stray nested `CLAUDE.md` (the walker finds them) or a rules/ file missing `paths:` (then it counts as *always*, not conditional — by design).
- **`@import` not counted** → the detector is conservative (file must exist relative to the importer, not inside a code fence). None of the 6 repos use `@import` today, so this path is effectively untested — verify before relying on it.
- **rollout step opens a PR against the wrong base** → check the repo's `git remote` (golf-platform-scripts was SSH and had to be switched to HTTPS; some repos are archived/empty — see the tracker's `notes`).

## Tests
**None yet.** The spec's acceptance criteria (fixture repo with one of each layer type; @import-theater detection; gate precision; clearance) are **not** encoded as tests. `footprint.mjs` is only manually verified against the 6 repos. **This is the top follow-up before Slice 2.**

## Operations
- The rollout is **opt-in per repo** (a repo enters the tracker as `untouched` only when added) and **PR-gated** (every decomposition is a reviewable PR, never auto-merged). Kill switch: pause/delete the `/schedule` routine; the tracker and skills are inert without it.
- Metrics M1–M5 append to telemetry (same pattern as `/skill-metrics`). Scale-up to ADR-0083 (general hooks-as-enforcement) is **data-gated** on M3/M5 staying low after ~4 weeks.

## Open items (priority order)
1. **Tests for `footprint.mjs`** (the acceptance criteria) — before anything else.
2. **Run `/claude-md-audit` on one real repo** (cv-builder) in propose mode — the skill has never produced a real routing plan; validate its judgment before the gate trusts it.
3. **Slice 2 — the gate.** High blast radius (touches live editing). Needs the Haiku judge script (use `packages/workflows` `callClaude`), the per-session clearance marker, the M5 event log.
4. **Decide Layer-1 default per repo** — nested `CLAUDE.md` vs `rules/` glob (ADR-0081 leans nested for subtree-coherent content).
5. PRs to merge: **#129** (ADR + vocab), **#130** (this — slices 1+3).
