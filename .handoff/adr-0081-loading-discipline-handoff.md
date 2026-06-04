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
- **Enforce** (Slice 2, **SHADOW STAGE BUILT** — `scripts/hooks/claude-md-gate/`): a two-stage `PreToolUse` gate on `Edit|Write` of governed CLAUDE.md files — cheap deterministic tripwire (`tripwire.mjs`) → scoped Haiku judge (`judge.mjs`, safe-degrade) → block→ask loop routed into `/grill-with-docs` with a per-session clearance marker (`clearance.mjs`), all observed via a TPM event log (`events.mjs` + `analyze.mjs`). Orchestrated by `gate.mjs` (+ `claude-md-gate.sh`). **Mode defaults to `shadow`** (observe-only, never blocks — the Brassboard stage); promotion to `enforce` is **RIDM-gated** on M3 (<30%) + low M5 over ~4 weeks. 35 unit tests. Wired via `install-agents.sh` (settings.json is gitignored). Built as Control-Gated Slices (ADR-0086). Checkpoints C0–C5 done; **C6 enforce + C7 generalization NOT built** (data-gated). See `claude-md-gate/SPEC.md`.
- **Roll out** (Slice 3, this PR): `CLAUDE-MD-ROLLOUT.md` tracker + `/claude-md-rollout` step skill + a `/schedule` cron advancing one repo/cycle + a `/frame-standup` line.

## How to debug
- **footprint shows `cond-tokens` for a repo with no rules/ or nested CLAUDE.md** → check for a stray nested `CLAUDE.md` (the walker finds them) or a rules/ file missing `paths:` (then it counts as *always*, not conditional — by design).
- **`@import` not counted** → the detector is conservative (file must exist relative to the importer, not inside a code fence). None of the 6 repos use `@import` today, so this path is effectively untested — verify before relying on it.
- **rollout step opens a PR against the wrong base** → check the repo's `git remote` (golf-platform-scripts was SSH and had to be switched to HTTPS; some repos are archived/empty — see the tracker's `notes`).

## Tests
**`footprint.mjs` is covered** — `scripts/claude-md/__tests__/footprint.test.mjs` (16 tests, vitest). Encodes the spec's measurement-layer acceptance criteria: a fixture repo with **one of each layer type** (root CLAUDE.md, @import, unconditional rule, path-scoped rule, nested CLAUDE.md); the **@import-theater** property (relocating text into an @import does NOT shrink always-loaded, but routing the same text to a path-scoped rule DOES); recursive @import following; the conservative-detector guard (bare `@filename` and fenced `@import`s are not followed); `node_modules` skip; and the pure helpers. Run: `pnpm vitest run scripts/claude-md/__tests__/footprint.test.mjs`. The script was refactored to export its functions + guard `main` behind an `import.meta.url` check so it stays runnable as a CLI.
**Still untested:** the **gate** acceptance criteria (precision, clearance) — they belong with Slice 2, which isn't built. The `/claude-md-audit` LLM judgment is validated by running it, not by unit tests (open item #2).

## Operations
- The rollout is **opt-in per repo** (a repo enters the tracker as `untouched` only when added) and **PR-gated** (every decomposition is a reviewable PR, never auto-merged). Kill switch: pause/delete the `/schedule` routine; the tracker and skills are inert without it.
- Metrics M1–M5 append to telemetry (same pattern as `/skill-metrics`). Scale-up to ADR-0083 (general hooks-as-enforcement) is **data-gated** on M3/M5 staying low after ~4 weeks.

## Open items (priority order)
1. ~~**Tests for `footprint.mjs`**~~ ✅ **Done** — `scripts/claude-md/__tests__/footprint.test.mjs` (16 tests, incl. @import-theater). See Tests above.
2. ~~**Run `/claude-md-audit` on a real repo**~~ ✅ **Done** — validated on cv-builder + purefoy (propose), then applied: **purefoy MERGED** (~69%), **cv-builder MERGED** (~77%, after dep-fix #149). The hardened skill (delete-safety + repo-native L2) held across both.
3. **Slice 2 — the gate.** ✅ **Shadow stage (C0–C5) built + 35 tests** (see Architecture/Enforce above). **Remaining: C6 — run shadow ~4 weeks, then RIDM-promote to `enforce` if M3<30% & low M5; C7 — generalization (ADR-0083).** This is now the top open item.
4. **Decide Layer-1 default per repo** — nested `CLAUDE.md` vs `rules/` glob (ADR-0081 leans nested for subtree-coherent content).
5. ~~PRs to merge: #129, #130~~ ✅ **All merged** (rebase-only ruleset). Remaining rollout targets: **virtualLight, TripPlanner, blogengine**.
