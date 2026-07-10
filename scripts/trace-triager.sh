#!/usr/bin/env bash
# trace-triager.sh — weekly proposal-only trace-mining triager (rm-l2-ojfbot#S26).
# Spawns one headless claude session in an isolated worktree with the 4-part
# delegation contract in scripts/trace-triager-brief.md. The session proposes
# (taxonomy deltas + golden-task candidates via a PR) or logs an empty run —
# it NEVER merges, never edits the taxonomy in place (§4 anti-Goodhart contract).
#
# Rollout (S26): first two runs are OPERATOR-TRIGGERED (`bash scripts/trace-triager.sh`)
# under shadow-equivalent supervision; the launchd plist is committed but NOT loaded
# until both runs pass and the loops-registry entry is flipped to live.
#
# Never fails the schedule; one summary line per run to ~/.claude/trace-triager.jsonl.
set -euo pipefail

CORE_DIR="${CLAUDE_PROJECT_DIR:-/Users/yuri/ojfbot/core}"
BRIEF="$CORE_DIR/scripts/trace-triager-brief.md"
TIMEOUT_MINS="${TRIAGER_TIMEOUT_MINS:-30}"
RUN_LOG="$HOME/.claude/trace-triager.jsonl"
DATE_TAG=$(date -u +%Y-%m-%d)
WORKTREE="$HOME/.cache/trace-triager/core-$DATE_TAG"

log_run() { # status detail
  mkdir -p "$(dirname "$RUN_LOG")"
  printf '{"ts":"%s","source":"trace-triager","status":"%s","detail":"%s","worktree":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$WORKTREE" >> "$RUN_LOG"
}

# Resolve node/claude — launchd PATH is minimal (skill-architecture-audit rail pattern).
if ! command -v claude >/dev/null 2>&1; then
  for d in "$HOME/.local/share/fnm/aliases/default/bin" "$HOME/.fnm/aliases/default/bin" /opt/homebrew/bin "$HOME/.local/bin"; do
    [ -x "$d/claude" ] && { PATH="$d:$PATH"; break; }
  done
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "trace-triager: claude not found on PATH (non-fatal)" >&2
  log_run "skipped" "claude-not-found"
  exit 0
fi
[[ -f "$BRIEF" ]] || { echo "trace-triager: brief missing at $BRIEF" >&2; log_run "skipped" "brief-missing"; exit 0; }

# Fresh isolated worktree off origin/main (day-runner trust envelope: worktree +
# branch-only + human merge gate). Re-fetch at the last moment — concurrent agents
# move branches.
git -C "$CORE_DIR" fetch origin main --quiet || { log_run "skipped" "fetch-failed"; exit 0; }
git -C "$CORE_DIR" worktree remove --force "$WORKTREE" 2>/dev/null || true
git -C "$CORE_DIR" worktree add --detach "$WORKTREE" origin/main --quiet || {
  log_run "skipped" "worktree-failed"; exit 0;
}

log_run "started" "timeout-mins=$TIMEOUT_MINS"

# Run headless with a wall-clock watchdog (macOS has no GNU timeout by default).
(
  cd "$WORKTREE"
  claude -p "$(cat "$BRIEF")" --permission-mode bypassPermissions
) &
CLAUDE_PID=$!
SECS=0
MAX_SECS=$((TIMEOUT_MINS * 60))
while kill -0 "$CLAUDE_PID" 2>/dev/null; do
  if (( SECS >= MAX_SECS )); then
    kill -TERM "$CLAUDE_PID" 2>/dev/null || true
    sleep 5
    kill -KILL "$CLAUDE_PID" 2>/dev/null || true
    log_run "timeout" "killed-after-${TIMEOUT_MINS}m"
    break
  fi
  sleep 10
  SECS=$((SECS + 10))
done
wait "$CLAUDE_PID" 2>/dev/null && EXIT_CODE=0 || EXIT_CODE=$?

if (( SECS < MAX_SECS )); then
  log_run "finished" "exit=$EXIT_CODE"
fi

# Cleanup the worktree; the session's branch (if any) lives on origin.
git -C "$CORE_DIR" worktree remove --force "$WORKTREE" 2>/dev/null || true
exit 0
