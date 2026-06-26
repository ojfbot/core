#!/usr/bin/env bash
# verify-session-state.sh — preflight ground-truth check for /resume.
#
# Before a session picks up work in a repo/worktree, assert that the ground is
# trustworthy. Adapted from TeamBot's verify-session-state.sh to ojfbot's worktree +
# Dolt conventions. The point is the same: you cannot reason honestly about "what a
# prior session finished" if the working state is itself ambiguous (uncommitted edits,
# half-pruned worktrees that will silently lose work on a checkout).
#
# Checks (FAIL = STOP, exit 1 · WARN = advisory, exit 0):
#   1. is a git repo                                   FAIL if not
#   2. no prunable/stale worktrees                     FAIL on prunable; WARN on already-merged
#   3. HEAD not unexpectedly detached                  WARN
#   4. working tree committed                          FAIL on tracked edits; WARN on untracked
#   5. Dolt reachable on :$DOLT_PORT                    WARN (advisory — [DOLT] tier degrades)
#   6. no other live session in this repo              WARN (best-effort, needs Dolt)
#
# Flags:
#   --repo PATH      repo to check (default: cwd)
#   --allow-dirty    downgrade tracked-edit FAIL to WARN (you accept a dirty tree)
#   --strict         upgrade untracked-file WARN to FAIL (TeamBot-strict, pre-worktree-surgery)
#   --quiet          only print the verdict line
#
# Exit: 0 = clear to proceed (warnings allowed) · 1 = STOP, resolve failures first.
set -euo pipefail

REPO="$(pwd)"
ALLOW_DIRTY=0
STRICT=0
QUIET=0
DOLT_PORT="${DOLT_PORT:-3307}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --strict) STRICT=1; shift ;;
    --quiet) QUIET=1; shift ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [[ -t 1 ]]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; DIM=''; RST=''
fi

FAILURES=0
WARNINGS=0
fail() { FAILURES=$((FAILURES + 1)); [[ $QUIET -eq 1 ]] || echo "${RED}✗ FAIL${RST}  $1"; [[ -n "${2:-}" ]] && [[ $QUIET -eq 0 ]] && echo "         ${DIM}↳ $2${RST}"; return 0; }
warn() { WARNINGS=$((WARNINGS + 1)); [[ $QUIET -eq 1 ]] || echo "${YEL}! WARN${RST}  $1"; [[ -n "${2:-}" ]] && [[ $QUIET -eq 0 ]] && echo "         ${DIM}↳ $2${RST}"; return 0; }
ok()   { [[ $QUIET -eq 1 ]] || echo "${GRN}✓ OK${RST}    $1"; return 0; }

g() { git -C "$REPO" "$@"; }

[[ $QUIET -eq 1 ]] || echo "# Preflight — $REPO"

# 1. git repo --------------------------------------------------------------
if ! g rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "not a git repository: $REPO" "run /resume only inside a repo with a .git"
  echo "${RED}STOP${RST} — $FAILURES failure(s)."
  exit 1
fi

# 2. prunable / stale worktrees -------------------------------------------
# `git worktree list --porcelain` emits a `prunable` line for worktrees whose path is
# gone — checking those out elsewhere can silently lose uncommitted work.
WT_PORCELAIN="$(g worktree list --porcelain 2>/dev/null || true)"
PRUNABLE=$(printf '%s\n' "$WT_PORCELAIN" | grep -c '^prunable' || true)
if [[ "$PRUNABLE" -gt 0 ]]; then
  PRUNABLE_PATHS=$(printf '%s\n' "$WT_PORCELAIN" | awk '/^worktree /{p=$2} /^prunable/{print p}' | tr '\n' ' ')
  fail "$PRUNABLE prunable worktree(s) present" "git worktree prune  →  $PRUNABLE_PATHS"
else
  ok "no prunable worktrees"
fi

# Worktrees whose branch is already an ancestor of main → stale (mergeable, can be removed)
MAINREF=""
if g rev-parse --verify -q origin/main >/dev/null 2>&1; then MAINREF="origin/main";
elif g rev-parse --verify -q main >/dev/null 2>&1; then MAINREF="main"; fi
if [[ -n "$MAINREF" ]]; then
  while IFS= read -r br; do
    [[ -z "$br" ]] && continue
    [[ "$br" == "$MAINREF" || "$br" == "main" ]] && continue
    if g merge-base --is-ancestor "$br" "$MAINREF" 2>/dev/null; then
      warn "branch '$br' already merged into $MAINREF" "stale; safe to delete"
    fi
  done < <(printf '%s\n' "$WT_PORCELAIN" | awk '/^branch /{sub("refs/heads/","",$2); print $2}')
fi

# 3. detached HEAD ---------------------------------------------------------
if ! g symbolic-ref -q HEAD >/dev/null 2>&1; then
  warn "HEAD is detached @ $(g rev-parse --short HEAD)" "checkout a branch unless this worktree is intentionally detached"
else
  ok "on branch $(g rev-parse --abbrev-ref HEAD)"
fi

# 4. working tree committed -----------------------------------------------
PORCELAIN="$(g status --porcelain 2>/dev/null || true)"
TRACKED_DIRTY=$(printf '%s\n' "$PORCELAIN" | grep -cE '^ ?[MADRC]' || true)
UNTRACKED=$(printf '%s\n' "$PORCELAIN" | grep -c '^??' || true)
if [[ "$TRACKED_DIRTY" -gt 0 ]]; then
  if [[ $ALLOW_DIRTY -eq 1 ]]; then
    warn "$TRACKED_DIRTY tracked file(s) uncommitted (--allow-dirty)" "state is ambiguous; verified claims only"
  else
    fail "$TRACKED_DIRTY tracked file(s) uncommitted" "commit or stash, or re-run with --allow-dirty"
  fi
else
  ok "no uncommitted tracked changes"
fi
if [[ "$UNTRACKED" -gt 0 ]]; then
  if [[ $STRICT -eq 1 ]]; then
    fail "$UNTRACKED untracked file(s) (--strict)" "these are lost on a checkout; commit or clean"
  else
    warn "$UNTRACKED untracked file(s)" "not committed — would be lost on a checkout"
  fi
fi

# 5. Dolt reachable (advisory) --------------------------------------------
if lsof -i ":$DOLT_PORT" >/dev/null 2>&1 || nc -z localhost "$DOLT_PORT" >/dev/null 2>&1; then
  ok "Dolt reachable on :$DOLT_PORT"
  DOLT_UP=1
else
  warn "Dolt not reachable on :$DOLT_PORT" "[DOLT] provenance tier will degrade; git/PR tiers still ground-truth"
  DOLT_UP=0
fi

# 6. conflicting live session (best-effort) -------------------------------
if [[ "${DOLT_UP:-0}" -eq 1 ]]; then
  CORE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
  BEAD_EMIT="$CORE_ROOT/scripts/hooks/bead-emit.mjs"
  REPO_NAME="$(basename "$REPO")"
  if [[ -f "$BEAD_EMIT" ]]; then
    ACTIVE="$(node "$BEAD_EMIT" active-sessions 2>/dev/null || true)"
    if printf '%s' "$ACTIVE" | grep -qi "$REPO_NAME"; then
      warn "another live session references '$REPO_NAME'" "coordinate before claiming overlapping work"
    fi
  fi
fi

# Verdict ------------------------------------------------------------------
[[ $QUIET -eq 1 ]] || echo ""
if [[ $FAILURES -gt 0 ]]; then
  echo "${RED}STOP${RST} — $FAILURES failure(s), $WARNINGS warning(s). Resolve failures before picking up the session."
  exit 1
fi
echo "${GRN}CLEAR${RST} — 0 failures, $WARNINGS warning(s). Safe to proceed (treat warnings as context)."
exit 0
