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

## The surface matrix (audit of 2026-07-22 — re-verify paths before editing; they move)

| # | Surface | File | Mechanism | Action |
|---|---------|------|-----------|--------|
| 1 | Northstar/roadmap registry | `core/decisions/northstar/README.md` | explicit YAML | register when the repo has `.claude/northstar.md` (lint ERRORs on a registered-but-missing file — never register a stub ahead of the file) |
| 2 | daily-logger collection | `daily-logger/src/collect-context.ts` `REPOS` | explicit list | append name + one-line comment |
| 3 | daily-logger API | `daily-logger/src/build-api.ts` `KNOWN_REPOS` + `TAG_TYPE_MAP` | explicit set + map | add to BOTH (set-only = tags silently dropped) |
| 4 | daily-logger prompt | `daily-logger/src/generate-article.ts` "Additional repos" | explicit prose | add a descriptive bullet (Claude mischaracterizes activity without it) |
| 5 | Cockpit fleet cards | `morning-cockpit/packages/server/src/fleet-config.ts` `REPO_META` | explicit list | add {name, role, phase} (cosmetic; adapters auto-discover) |
| 6 | Core ecosystem table | `core/CLAUDE.md` | markdown table | add a row (port, description, phase, status) |
| 7 | frame-standup sync | `core/.claude/skills/frame-standup/scripts/sync-repos.js` `REPOS` | explicit list | append |
| 8 | frame-standup extensions | `core/.claude/skills/frame-standup/scripts/read-app-standup.js` `REPOS` | explicit list | append |
| 9 | Skills/hooks install | `core/scripts/install-agents.sh <repo>` | parametric | RUN it (installs skills, hooks, settings) |
| 10 | Launcher/workbench | `core/scripts/launcher/registrations/<repo>.json` | per-repo file | OPTIONAL — only for tmux-workbench repos |
| 11 | Frame MF inventory | `core/domain-knowledge/frame-os-context.md` | explicit table | ONLY if the repo is a Frame Module-Federation remote |
| 12 | Vault repo entity | `~/selfco/wiki/entities/<repo>.md` | AUTO — `/vault sync` creates stubs for every `~/ojfbot/*/.git` | no action; note that next sync heals |
| 13 | Cockpit read-model | `listKnownRepos()` readdir + Dolt/`.handoff` adapters | AUTO | no action |
| 14 | day-runner / bead-emit | parametric on repo label; needs dir + `.git` | AUTO | no action |

## onboard <repo> steps

1. **Verify substrate**: `~/ojfbot/<repo>` exists, has `.git`, a README, and (if it will take
   roadmap slices) `.claude/northstar.md` + `.claude/roadmap.md`.
2. **Walk surfaces 1–9** in the matrix. Surfaces 2–4 (daily-logger) and 5 (cockpit) are other
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
3. Output the drift table. Do NOT auto-fix — additions are per-repo judgment (a repo can be
   deliberately excluded, e.g. the selfco vault repo is intentionally not swept). Offer to
   onboard specific repos.

## Gotchas

- **BSD sed has no GNU `0,/re/` address** — it no-ops silently. Use plain replace (verify the
  target string is unique first) or python.
- **build-api.ts needs BOTH the set and the map** — the 2026-05-05 drift incident came from
  exactly this asymmetry.
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
