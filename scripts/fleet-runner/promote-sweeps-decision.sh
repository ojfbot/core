#!/usr/bin/env bash
# promote-sweeps-decision.sh: should this CI run run the FleetRunner promote's kill sweeps?
#
# The sweeps (packages/fleet-runner/src/__tests__/*.sweep_test.ts, about 360 sandboxes) take far
# longer than everything else in CI together, and only a change to the promote can break them. So
# CI's "Build & Test" job runs them:
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

# The paths a change to which can break the sweeps: the promote's scripts and deploy files, its
# tests and fakes, how CI runs them, and what they are built and run with.
touches() {
  case "$1" in
    packages/fleet-runner/scripts/* | packages/fleet-runner/deploy/* | packages/fleet-runner/src/__tests__/*) return 0 ;;
    .github/workflows/ci.yml | scripts/fleet-runner/promote-sweeps-decision.sh | scripts/check-test-wiring.mjs) return 0 ;;
    vitest*.config.* | */vitest*.config.*) return 0 ;;
    package.json | pnpm-lock.yaml | packages/fleet-runner/package.json | packages/fleet-runner/pnpm-lock.yaml) return 0 ;;
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

changed="$(git diff --name-only "$from" HEAD 2>/dev/null)" ||
  decide true "run, because the changed files could not be listed"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  if touches "$file"; then decide true "run, because $file changed"; fi
done <<EOF_CHANGED
$changed
EOF_CHANGED

decide false "skip, no promote path changed"
