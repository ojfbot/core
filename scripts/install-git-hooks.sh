#!/bin/sh
# Points this clone at the tracked hooks in .githooks/ (adr:deterministic-fleet-versioning).
# Runs from the root `prepare` script on every `pnpm install`. The setting lives in the shared git
# config, so one install activates the hooks in the main checkout and every worktree of it, and
# because the hooks are tracked files there is nothing to regenerate per worktree.
# Outside a git checkout (a Docker build context, a tarball install) it does nothing.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -d .githooks ] || exit 0
git config core.hooksPath .githooks
