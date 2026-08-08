---
id: 20260808-2352-brief-core-improvement-queue-after-s2-6-tracked-symlinks
type: brief
title: "core improvement queue after S2 — 6 tracked symlinks, northstar check paths, ADR-0061, then S3"
actor: code-claude
to: code-claude
session_id: 2026-08-08T23:52:46Z
refs:
  - github:ojfbot/core#438
  - github:ojfbot/core#439
  - bead:20260808-2352-report-core-decomposition-s2-bead-store-salvage-shipped-p
  - bead:20260808-1450-brief-decomposition-s2-personal-exile
  - file:TECHDEBT.md
  - file:docs/audits/README.md
hook: null  # NO tracker item exists for the decomposition program — see "Flag back" #1
status: live
created_at: 2026-08-08T23:52:46Z
labels:
  project: core-decomposition
  slice: S3
---

## Context

Core decomposition is Option A — **in-repo re-layering, NO repo split** (operator-ratified;
a split breaks the ×33 `decisions/` symlink and single-writer discipline). Ladder:
S1 reconciler → S2 personal exile → **S3 domain-knowledge manifest** → S4 decisions hygiene →
S5 honest caches → S6 flip reconciler to blocking.

**S1 and S2 are merged.** S2 (#438) moved `personal-knowledge/` to `~/selfco/career/`, dropped
`install-agents.sh` §5 (it shipped one stale job doc into 30 repos with zero readers), moved 9
dated audits to `docs/audits/`, and deleted `skills/`, `packages/cli`, `packages/vscode-extension`.
A separate salvage (#439) landed an unrelated bead-store fix rescued from an abandoned worktree.

Four small items were deliberately left undone by S2 — three because they cross a fence this
session type must not cross. They are items 1–3 below. S3 is item 4.

## Goal

Clear items 1–3 (each small, each independently shippable), then start S3: split
`domain-knowledge/` into `universal/` + `apps/` behind a manifest, so the fleet-symlinked corpus
stops being a flat pile where app-specific files ride along into every repo.

Items 1–3 are not prerequisites for S3 — take them first only because they are cheap and they
close S2's loose ends. If time is short, do item 1 and go straight to S3.

## Acceptance criteria

- [ ] **1. Six tracked symlinks removed.** `personal-knowledge/tbcony-job-target.md` is git-tracked
      in `frame-ui-components`, `hailstone`, `lean-canvas`, `mirrorworld`, `seh-study`,
      `workstation-yuri`. Each needs its own single-file commit + PR. Verify after:
      `find <repo>/personal-knowledge -type l ! -exec test -e {} \; -print` returns nothing, and
      the repo-wide dead-symlink sweep is empty fleet-wide.
- [ ] **2. `decisions/northstar/roadmap-l2-ojfbot.md` S27/S28 `check:` paths retargeted** from repo
      root to `docs/audits/`. Both slices are already `merged`, so these are post-hoc checks on
      delivered work, not live gates — this is hygiene, not a fix. **Operator-gated** (see Flag back).
- [ ] **3. ADR-0061 revised** — it sketches `node packages/cli/dist/index.js`, which no longer
      exists. The ADR self-hedges toward `@core/workflows`, so nothing is broken. Use `/adr revise`,
      not a hand edit (slug-as-identity, adr:adr-slug-identity).
- [ ] **4. S3 shipped**: `domain-knowledge/` reorganised into `universal/` + `apps/` with a manifest;
      `install-agents.sh` §2 reads the manifest instead of its hardcoded file list; installer
      idempotent fleet-wide with zero dead symlinks; `node scripts/fleet-manifest.mjs` shows no NEW
      drift vs the pre-change baseline; full suite green.

## References

- `github:ojfbot/core#438` — S2 PR; its body lists every moved/deleted path with disposition
- `github:ojfbot/core#439` — bead-store salvage (unrelated to the ladder, closes the worktree)
- `bead:20260808-2352-report-core-decomposition-s2-bead-store-salvage-shipped-p` — what shipped
- `file:docs/audits/README.md` — attic index; records the stale S27/S28 `check:` paths
- `file:scripts/install-agents.sh` — §2 is the S3 target (universal domain-knowledge file list)
- `file:scripts/fleet-manifest.mjs` — S1 reconciler, shadow mode, `--check` unwired
- `file:TECHDEBT.md` — TD-007 is the debt the ladder pays down

## Flag back

1. **No tracker item exists for this program.** There is no GitHub issue and no roadmap slice for
   core decomposition — S1/S2 were tracked only by beads, which is why `hook:` is null here and
   `bead-lint` will WARN. Do **not** invent a machine key. Ask the operator whether to mint an
   issue (or roadmap slices) before S3, so the remaining ladder is sweepable.
2. **`decisions/northstar/` is fenced.** A slice session never writes northstar frontmatter and
   never touches `current:`. Item 2 edits `check:` lines in slice bodies, which is adjacent enough
   that S2 refused to do it unilaterally. Get an explicit operator OK, and ship it alone — never
   bundled with S3.
3. **S3 touches the fleet-symlinked corpus.** Moving a `domain-knowledge/` file changes what every
   repo sees. If the split would orphan a file some sibling repo reads, surface it rather than
   guessing which repos still need it.
4. **Do not remove `personal-knowledge/` from `.gitignore`** in core. The dir survives holding only
   a pointer README; the ignore rule is what stops career material being re-tracked.

## Constraints

- **Cut worktrees from `origin/main`, never local `main`** — it runs diverged (has been 16 ahead /
  1 behind) and concurrent agent worktrees move branches mid-task.
- **Rebase-merge only on core.** Squash is disallowed. One human-gated PR per slice.
- **Run `pnpm build` before `pnpm test`.** `scripts/hooks/__tests__/skill-acted-emit` and
  `reconcile-skill-acted` read `packages/workflows/dist/` and fail on a clean tree without it.
  Those 3 failures are a missing-artifact symptom, not a regression — don't chase them.
- **`runs/` is a live runtime output dir**, not dead structure — `writeRun()` in
  `packages/workflows/src/utils/runs.ts` is called by `runner.ts` on every dispatch. Never remove
  its `.gitignore` entry.
- **`format:check` fails on 67 files on main.** Pre-existing, not a CI gate. Do not run
  `prettier --write` on a touched file — it reflows the whole file and bloats the diff.
- **Never touch `~/selfco/tracking/`.**
- Log deviations under a dated heading in `implementation-notes.md` — discovery rate, never a
  defect rate.

## Time-box

Items 1–3 are ~an hour together. If item 2 is still waiting on the operator after that, leave it
and start S3 — it blocks nothing.
