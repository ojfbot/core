---
id: 20260808-2352-report-core-decomposition-s2-bead-store-salvage-shipped-p
type: report
title: "core decomposition S2 + bead-store salvage shipped (PRs #438, #439)"
actor: code-claude
session_id: 2026-08-08T23:52:46Z
responding_to: 20260808-1450-brief-decomposition-s2-personal-exile
refs:
  - github:ojfbot/core#438
  - github:ojfbot/core#439
  - bead:20260808-1450-brief-decomposition-s2-personal-exile
  - bead:20260808-2352-brief-core-improvement-queue-after-s2-6-tracked-symlinks
  - file:implementation-notes.md
status: closed
created_at: 2026-08-08T23:52:46Z
labels:
  project: core-decomposition
  slice: S2
---

## What got done

**S2 — `github:ojfbot/core#438`, merged (rebase).** Built on a worktree cut from `origin/main`.

- `core/personal-knowledge/` (16 entries) → `~/selfco/career/`. Never tracked, so no git surgery.
  Dir kept, gitignored, holding only a pointer README.
- **`install-agents.sh` §5 dropped, not retargeted.** The brief offered either. Evidence for
  dropping: it distributed exactly one file (`tbcony-job-target.md`, superseded 2026-02-27) into
  30 repos; no skill or script ever read it at that path; every sibling `personal-knowledge/` dir
  contained nothing else. Retargeting would re-export career material to 30 code repos for zero
  consumers. §6→§5, §6b→§5b.
- `domain-knowledge/frame-os-context.md` career framing stripped (it is symlinked fleet-wide, so
  job-target framing reached every repo); product context kept; the stripped text deposited at
  `~/selfco/career/frame-os-positioning.md`. Five skill references retargeted to `~/selfco/career/`.
- 9 dated audits + `SURVEY.md` → `docs/audits/` via `git mv`, names preserved so existing
  `FILE.md:127` citations still resolve. `CLAUDE-MD-ROLLOUT.md` and `implementation-notes.md`
  stayed (script-read state). Added `docs/audits/README.md`.
- Deleted `skills/`, `packages/cli`, `packages/vscode-extension`; lockfile rebuilt; every
  README/docs/CLAUDE.md CLI-and-VS-Code claim corrected; `skills/` removed from the `/techdebt`
  allowlist in source and docs (the doc had also drifted from `ALLOWED_ROOTS` — now in sync).

Verified: vitest 538 passed / 0 failed; `fleet-manifest` output byte-identical to a pristine
`695bb3c` baseline (zero new drift); installer idempotent (115 created → 0 created / 112
already-linked) with zero dead symlinks and no `personal-knowledge/` created.

**Salvage — `github:ojfbot/core#439`, merged (rebase).** Rescued from the abandoned
`claude/gifted-lamarr-05695a` worktree, where it sat uncommitted. `FilesystemBeadStore` now awaits
`appendEventLog()` instead of firing and forgetting; the `pendingWrites`/`trackWrite`/
`drainPendingWrites()` apparatus is gone (29 lines out, 10 in). Fixes lost-events-on-exit and the
`ENOTEMPTY: rmdir '.../events'` race seen on #103 and #392. Three `event log durability` tests
added; negative control re-run independently (reverting to `void` fails exactly 2 of 3). Both
stale worktrees removed.

## What's open

Four items, carried into `bead:20260808-2352-brief-core-improvement-queue-after-s2-6-tracked-symlinks`:

1. **6 git-tracked `personal-knowledge/tbcony-job-target.md` symlinks** remain in
   `frame-ui-components`, `hailstone`, `lean-canvas`, `mirrorworld`, `seh-study`,
   `workstation-yuri`. The operator cleared the 23 untracked ones. These need a commit each.
2. **`roadmap-l2-ojfbot.md` S27/S28 `check:` lines** still `test -f` the audits at old root paths.
   Both slices merged, so post-hoc not live gates. Left alone — `decisions/northstar/` is fenced.
3. **ADR-0061** references `node packages/cli/dist/index.js`. Self-hedges toward `@core/workflows`,
   so not broken. Needs `/adr revise`.
4. **S3** — `domain-knowledge/` → `universal/` + `apps/` manifest.

## What surprised

- **The brief's stated destination property was false.** It said `~/selfco/career/` was already
  gitignored. `~/selfco` is a *tracked* repo and `career/` was not ignored — moving as specified
  would have taken career material that was gitignored in core and put it somewhere git-visible,
  inverting the seam the slice exists to protect. Added `career/` to `~/selfco/.gitignore` before
  moving. That commit was later rebased by a concurrent session and landed as `50e574a`; content
  verified in the pushed `.gitignore` rather than trusting the SHA.
- **`runs/` is not dead structure.** The brief classed it as an empty dir to delete along with its
  ignore rule. `writeRun()` in `utils/runs.ts` is called by `runner.ts` on every dispatch. Deleted
  the empty dir, kept the ignore rule.
- **The abandoned worktree's 12 commits were redundant but its uncommitted diff was not.** Every
  `.handoff/` file those commits add had already reached main by other routes; the working-tree
  diff was a real unlanded bug fix. Checking the commits alone would have thrown the fix away.
- **The fleet symlink sweep was blocked** by the harness permission classifier (bulk cross-repo
  deletion). Not worked around — handed to the operator, who ran it.
- 6 of 29 sibling symlinks turned out to be **git-tracked**, which is why they could not be swept
  with the rest.

## Decisions made

No standalone decision beads. The one call worth noting is recorded above and in #438: **drop**
`install-agents.sh` §5 rather than retarget it.

## Recommended next session

Take `bead:20260808-2352-brief-core-improvement-queue-after-s2-6-tracked-symlinks`. Do item 1
(cheap, closes S2's last loose end), ask the operator about the northstar edit and about minting a
tracker item for the program, then start S3. All six S2 deviations are logged under
`## Deviations — core decomposition S2 2026-08-08` in `implementation-notes.md`.
