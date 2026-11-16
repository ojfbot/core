# repo-sync — upstream sync for core on each Mac

Loop: `decisions/loops/loops.md` slug `repo-sync`. Script: `scripts/repo-sync.mjs` (logic in
`scripts/lib/repo-sync.mjs`). Connector: `scripts/repo-sync-launchd.plist` (template).

Origin: charter addendum to *Claude duty soak and the FleetRunner bridge, 15 November 2026*
(HelpDesk `cca89987-fda6-433f-999d-f73987025c13`; addendum thread `2d06481b-3b7e-4080-924f-b51dd8f4c791`).
Owner decision, relayed from the parent session on Yuri: "Yes, versioned loop".

## What it does

Every 30 minutes, for the core repository (the main checkout, resolved through
`git-common-dir`, so all its worktrees are covered):

1. **Sync main.** `git fetch --no-prune origin`, then fast-forward local `main` to `origin/main`:
   | Situation | Action |
   |---|---|
   | `main` not checked out in any worktree | ancestry check, then compare-and-swap `git update-ref` — no checkout |
   | `main` checked out in a worktree with clean tracked files | `git merge --ff-only` there; git refuses (`ff-refused`) rather than overwrite an untracked file |
   | `main` checked out in a worktree with uncommitted tracked edits | `skipped-dirty-worktree` — a session may be editing there, so the checkout is not raced |
   | another worktree is rebasing or bisecting `main` (shows as detached HEAD) | `skipped-branch-in-rebase-or-bisect` — moving the ref would make that rebase fail to finish |
   | merge / rebase / cherry-pick / revert in progress in the worktree holding `main` | skipped, reported |
   | local `main` has commits `origin/main` lacks | `diverged` or `local-ahead`, reported, nothing moved |
   | fetch fails (offline, auth) | `fetch-failed`, reported, exit 0 |
2. **Report drift.** Every local branch: ahead/behind `origin/main`, ahead/behind its upstream,
   upstream gone. Every worktree: branch or detached, uncommitted-change count, in-progress op,
   prunable. Status reads use `--no-optional-locks`, so they never take another worktree's index lock.

It **never** rebases, stashes, resets, pushes, deletes branches or prunes worktrees. Concretely:

- **Fetch** uses an explicit refspec, `+refs/heads/*:refs/remotes/origin/*`, with `--refmap=`, so a
  configured refspec can never write a local branch. It runs with `gc.auto=0` and
  `maintenance.auto=false`, because auto-gc would run `git worktree prune`.
- **Writes** (`update-ref`, `merge --ff-only`) run with `core.hooksPath=/dev/null`, so no
  repository hooks run unattended. They also run with `merge.autoStash=false` / `--no-autostash`
  and `--no-overwrite-ignore`, with a 5-minute timeout.
- **Ownership checks:** if the worktree listing fails, ownership counts as unknown and the run
  skips. Ownership is re-checked just before `update-ref`. Before merging, the run confirms that
  the worktree holding `main` is still on `main`.
- **Locking:** there is one lock per repository, at `<git-common-dir>/repo-sync.lock`, holding a
  pid and a token. A run takes over a lock only if it is older than 25 minutes *and* its pid is
  gone. A run releases the lock only while it still holds its own token.
- **Reports** are written 0600 in a 0700 directory. Git stderr is cut to one line, with URL
  credentials redacted.

### Known limits

- The job runs `scripts/repo-sync.mjs` from the main checkout's **current branch**. If that
  checkout is switched to a branch without the script, runs stop. launchd logs the error to
  `~/.claude/repo-sync/launchd.err.log`, and liveness flags `runs.jsonl` silence after 36 h.
- Code merged to `main` reaches each Mac's next run once `main` is fast-forwarded *and* checked
  out there. That is the same trust boundary as pulling `main`: the PR review gate.
- Between the last ownership re-check and `update-ref`, a few milliseconds remain in which a
  session could check `main` out. The compare-and-swap keeps the ref consistent; that worktree's tree
  would then lag its ref. Git offers no atomic "update only if not checked out", so this is not closed.
- When flipping the loops.md entry to `status: live`, add
  `installed_ref: ~/Library/LaunchAgents/com.ojfbot.repo-sync.plist`. It is left out while disabled
  because loops-lint errors on an installed_ref that is absent on disk.
- The installer records the real node binary path (symlinks resolved; refuses fnm per-shell paths).
  Uninstalling that node version breaks the job; re-run the installer after changing node.

## Where to see it

- `~/.claude/repo-sync/latest.md` — human summary (owner and sessions read this).
- `~/.claude/repo-sync/latest.json` — full structured result.
- `~/.claude/repo-sync/runs.jsonl` — one line per run; the loop's `evidence_ref` for liveness.

## Rebasing a branch: explicit, at pickup

repo-sync keeps `main` current and tells you how far each branch has drifted. Rebasing stays a
deliberate step for the session that picks a branch up, never automated:

1. Read `~/.claude/repo-sync/latest.md`; find the branch's `vs main` behind count and uncommitted count.
2. Stop and ask the owner if the branch has uncommitted edits you did not make, has an open PR
   (rebasing rewrites what reviewers saw), or is on the charter's hands-off list.
3. Otherwise, in that branch's worktree: `git rebase origin/main`. On conflict, `git rebase --abort`
   and report; do not resolve someone else's conflict silently.
4. Push only with `--force-with-lease`, and only if the branch is yours to push.

## Install (per Mac, owner's yes required)

```bash
scripts/install-agents.sh --repo-sync-dry-run   # print the rendered plist, change nothing
```

```bash
scripts/install-agents.sh --repo-sync           # write ~/Library/LaunchAgents/com.ojfbot.repo-sync.plist and load it
```

The plist runs the script from the **main checkout**, so that checkout must contain
`scripts/repo-sync.mjs`. The installer refuses otherwise.

Stop: `launchctl bootout gui/$(id -u)/com.ojfbot.repo-sync`.

## Why launchd and not FleetRunner

The owner's rule is that CircusGreen owns scheduled work (loops registry + FleetRunner), with
other automations only as thin connectors. FleetRunner today is a job queue and worker with no
recurring scheduler, so the plist is a thin connector: it only fires the versioned script, and
the loop is registered in `loops.md`. When FleetRunner gains recurring jobs, replace the plist
with a FleetRunner job and retire the connector.

## Per-Mac differences

| | Yojimbo | Yuri |
|---|---|---|
| Before this loop | `~/.claude/hooks/core-main-ff.sh` SessionStart hook (unversioned; ff core `main` only when `main` is checked out) | nothing |
| core main checkout | on `main` | on a feature branch with uncommitted owner edits — the loop fast-forwards the `main` ref without touching it |
| Install prerequisite | main checkout already on `main` (after this merges) | main checkout must carry `scripts/repo-sync.mjs` (owner's choice how) |

## Retiring Yojimbo's hook

After this merges and is installed on Yojimbo, Yojimbo removes the `SessionStart` entry for
`core-main-ff.sh` from its `~/.claude/settings.json` (and the script). The loop covers everything
the hook did, and also fast-forwards `main` when it is not checked out. Two behaviours change:
the hook announced the result in each new Claude session's start message (the loop writes
`latest.md` instead), and the hook fast-forwarded a checked-out `main` with non-overlapping
uncommitted edits (the loop skips any checked-out `main` with uncommitted tracked edits and reports it). That retirement is Yojimbo's change, requested on the addendum thread.
