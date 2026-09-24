---
name: fleet-onboard
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "fleet-onboard", "onboard this
  repo", "register the repo everywhere", "is this repo registered", "new repo registration",
  "reconcile repo lists". Registers a repo on every fleet enumeration surface (northstar
  registry, daily-logger sweep, cockpit fleet cards, core ecosystem table, frame-standup
  lists, install-agents) — or, in reconcile mode, diffs every surface against the northstar
  registry and reports drift. Born from the 2026-07-22 audit that found 8 surfaces missed by
  a manual repo creation and 2 frame-standup lists stale for many registered repos.
---

You are the fleet registrar. A repo that exists but isn't enumerated is invisible to the
daily-logger sweep, the cockpit fleet cards, and the standup — and each hand-maintained list
drifts independently. This skill makes onboarding one pass and drift detectable.

**Tier:** 2 — Multi-step procedure
**Modes:** `onboard <repo>` (default) · `reconcile` (read-only drift report)

## Canonical source of truth

The **northstar registry** (`core/decisions/northstar/README.md` frontmatter) is the
authoritative repo list. Every other surface is a projection that may lag. `reconcile`
diffs each surface against it (plus `gh repo list ojfbot` for repos with no northstar yet).

## The surface matrix

> **Load `knowledge/surface-matrix.md`** before walking (`onboard`) or diffing (`reconcile`) any surface — the 15-surface table (file, mechanism, action per surface; audit of 2026-07-22, row 15 added 2026-08-08 — re-verify paths before editing; they move).

## onboard <repo> steps

1. **Verify substrate**: `~/ojfbot/<repo>` exists, has `.git`, a README, and (if it will take
   roadmap slices) `.claude/northstar.md` + `.claude/roadmap.md`.
2. **Walk surfaces 1–9** in the matrix. Surface 2 is AUTO since 2026-09-24 (daily-logger derives
   its sweep from `gh repo list`; it prints `::warning::fleet drift: <repo>` until 3–4 are filled).
   Surfaces 3–4 (daily-logger) and 5 (cockpit) are other
   repos: make each a small branch + PR, never a direct push. Surfaces 6–8 are one core PR.
   Before editing any list, re-grep for the anchor — line numbers in the matrix WILL rot.
3. **Concurrent-agent safety**: check `git status`/branch of each target checkout first; if a
   checkout is on a work branch or dirty, edit via a temporary worktree from `origin/main`
   (`git worktree add <scratch> -b <branch> origin/main`), and remove it after pushing.
4. **Verify**: `node core/scripts/northstar-lint.mjs` + `roadmap-lint.mjs` (no NEW errors vs
   main baseline); grep each edited surface for the repo name; run the daily-logger build if
   its files changed.
5. **Report**: the surface matrix with per-surface done/PR-link/n-a.

## reconcile steps (read-only)

1. Build the canonical set: northstar registry ∪ `gh repo list ojfbot --json name` ∪
   `ls ~/ojfbot/*/.git`.
2. For each explicit surface (2–8): extract its list, diff against canonical, classify
   (missing-from-surface / surface-has-unknown / archived).
3. **Check the generated surfaces are still generated** (14 AUTO, 15 REGISTRY-GENERATED). These
   have no list to diff, so the drift they can suffer is different in kind: a generated surface
   degrades by acquiring a hand-maintained list. For surface 15, grep the cockpit's fleet-structure
   adapter for a literal array of repo/cluster names and confirm membership is joined to the
   registry — not to `REPO_META` (surface 5). Report a hand list as drift even though nothing is
   missing; that is the TD-007 failure mode, and it is invisible to a name diff.
4. Output the drift table. Do NOT auto-fix — additions are per-repo judgment (a repo can be
   deliberately excluded, e.g. the selfco vault repo is intentionally not swept). Offer to
   onboard specific repos.

## Gotchas

- **BSD sed has no GNU `0,/re/` address** — it no-ops silently. Use plain replace (verify the
  target string is unique first) or python.
- **daily-logger surface 3 is one entry now** — `REPO_NOTES` in `daily-logger/src/fleet.ts` feeds
  `KNOWN_REPOS` and the tag classifier; the 2026-05-05 set/map asymmetry is gone.
- **Founding is onboarding.** A repo created inside a session — `gh repo create`, a `chore: repo
  init`, or a handoff memo's "founding acts" — MUST end with this skill. The 2026-09-17 play-well
  founding memo named only surface 1 (northstar); both repos were invisible to the sweep for a
  week, and dealdesk (`repo init`, 08-19) and foundry-recipes (04-30) for longer (TD-010).
- **Never register a northstar entry before the file exists** — lint blocks core PRs on it
  (registered-but-absent is an ERROR when the checkout is reachable).
- **Deliberate exclusions are policy, not drift** — check `feedback`/ADR notes (e.g.
  daily-logger intentionally excludes the `selfco` vault repo) before "healing".

---

$ARGUMENTS

## See Also
- `/scaffold-app` Step 7 overlaps for freshly-templated apps — this skill is the superset
  and the reconcile authority; scaffold-app should end by invoking this checklist.
- `/frame-standup` consumes surfaces 7–8; `/vault sync` heals surface 12.
