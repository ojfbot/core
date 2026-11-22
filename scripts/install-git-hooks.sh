#!/bin/sh
# Points this clone at the tracked hooks in .githooks/ (adr:deterministic-fleet-versioning).
# Runs from the root `prepare` script on every `pnpm install`. The setting lives in the shared git
# config, so one install activates the hooks in the main checkout and every worktree of it, and
# because the hooks are tracked files there is nothing to regenerate per worktree.
#
# It never replaces hooks that are already in use, because replacing them silently drops checks
# (a pre-commit secret scan, say). Instead it stops with the reason, so the install fails loudly:
#   - core.hooksPath already points somewhere else: put the commitlint call in that hook directory
#     (the one line in .githooks/commit-msg) or move its hooks into .githooks/.
#   - the repo uses Husky (.husky/): Husky owns core.hooksPath, so do not use .githooks/ here; add
#     .husky/commit-msg containing `pnpm exec commitlint --edit "$1"` (this script checks it is there).
#   - executable hooks sit in the clone's own .git/hooks: git ignores them once core.hooksPath is set,
#     so move them into .githooks/ first.
# Outside a git checkout (a Docker build context, a tarball install) it does nothing.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

if [ -d .husky ]; then
  if grep -qs 'commitlint' .husky/commit-msg; then
    exit 0
  fi
  echo "install-git-hooks: this repo uses Husky, and .husky/commit-msg does not run commitlint." >&2
  echo "  Add .husky/commit-msg containing: pnpm exec commitlint --edit \"\$1\"" >&2
  echo "  (do not point core.hooksPath at .githooks: that would switch off Husky's hooks)." >&2
  exit 1
fi

[ -d .githooks ] || exit 0

current=$(git config --get core.hooksPath || true)
case "$current" in
  '' | .githooks | .githooks/) ;;
  *)
    echo "install-git-hooks: core.hooksPath is already \"$current\"; not replacing it, because that would switch off the hooks there." >&2
    echo "  Put the commitlint call in that directory's commit-msg hook (see .githooks/commit-msg), or move its hooks into .githooks/ and unset core.hooksPath." >&2
    exit 1
    ;;
esac

hooks_dir="$(git rev-parse --git-common-dir)/hooks"
if [ -d "$hooks_dir" ]; then
  for hook in "$hooks_dir"/*; do
    [ -f "$hook" ] || continue
    case "$hook" in *.sample) continue ;; esac
    if [ -x "$hook" ]; then
      echo "install-git-hooks: $hook is an active hook that git would stop running once core.hooksPath is set." >&2
      echo "  Move it into .githooks/ (or fold it into the matching hook there), then install again." >&2
      exit 1
    fi
  done
fi

git config core.hooksPath .githooks
