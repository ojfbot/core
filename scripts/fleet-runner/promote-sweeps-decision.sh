#!/usr/bin/env bash
# promote-sweeps-decision.sh: should this CI run run the FleetRunner promote's kill sweeps?
#
# The sweeps and the promote tests that sit through real waits
# (packages/fleet-runner/src/__tests__/*.sweep_test.ts and *.slow_test.ts) take far longer than
# everything else in CI together, and only a change to fleet-runner can break them. So CI's
# "Build & Test" job runs them:
#   - on every push to main;
#   - otherwise when the change touches one of the paths in touches() below, compared with the pull
#     request's base branch (pull_request events: the merge base of the checked-out commit and
#     origin/<base branch>) or with the merge base with origin/main (branch pushes);
#   - and whenever that comparison cannot be made, for any reason. It never skips on an error.
#
# Prints one line, "promote sweeps: run, because <reason>" or "promote sweeps: skip, no promote
# path changed", and writes run=true or run=false to $GITHUB_OUTPUT when that is set.
# Reads what GitHub sets for every step: GITHUB_EVENT_NAME, GITHUB_REF and, on a pull request,
# GITHUB_BASE_REF (the base branch's name). Plain git, in the checked-out repository (the job
# checks out full history, so origin's branches are there).
set -u

decide() {
  printf 'promote sweeps: %s\n' "$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then printf 'run=%s\n' "$1" >>"$GITHUB_OUTPUT"; fi
  exit 0
}

# The paths a change to which can break them: the whole fleet-runner package (the promote's scripts,
# deploy files, tests and fakes, and the sources its tests build and run a real server from), how
# CI runs them, and what they are built and run with.
touches() {
  case "$1" in
    packages/fleet-runner/*) return 0 ;;
    .github/workflows/ci.yml | scripts/fleet-runner/promote-sweeps-decision.sh | scripts/check-test-wiring.mjs) return 0 ;;
    vitest*.config.* | */vitest*.config.*) return 0 ;;
    package.json | pnpm-lock.yaml | pnpm-workspace.yaml | tsconfig*.json) return 0 ;;
    .nvmrc | .node-version | .tool-versions) return 0 ;;
  esac
  return 1
}

event="${GITHUB_EVENT_NAME:-}"
if [ "$event" = push ] && [ "${GITHUB_REF:-}" = refs/heads/main ]; then
  decide true "run, because this is a push to main"
fi

if [ "$event" = pull_request ]; then
  [ -n "${GITHUB_BASE_REF:-}" ] || decide true "run, because the pull request's base branch is not known"
  case "$GITHUB_BASE_REF" in *[!A-Za-z0-9._/-]* | -*) decide true "run, because the pull request's base branch has an unexpected name" ;; esac
  from="$(git merge-base "refs/remotes/origin/$GITHUB_BASE_REF" HEAD 2>/dev/null)" ||
    decide true "run, because this change could not be compared with the pull request's base"
else
  from="$(git merge-base refs/remotes/origin/main HEAD 2>/dev/null)" ||
    decide true "run, because this change could not be compared with origin/main"
fi
[ -n "$from" ] || decide true "run, because the comparison found no common commit"

# Every path the change touches, old names and new: a file moved OUT of a watched folder shows up
# under its old name only with rename detection off. Paths are read NUL-delimited and unquoted, so
# a name with a space, a line break or a non-ASCII letter is the name itself, not an escaped form.
list="$(mktemp)" || decide true "run, because the changed files could not be listed"
trap 'rm -f "$list"' EXIT
git -c core.quotePath=false diff --no-renames --name-only -z "$from" HEAD >"$list" 2>/dev/null ||
  decide true "run, because the changed files could not be listed"

while IFS= read -r -d '' file; do
  if touches "$file"; then decide true "run, because $(printf '%s' "$file" | tr -c '[:alnum:]._/@+-' '?') changed"; fi
done <"$list"

decide false "skip, no promote path changed"
