#!/usr/bin/env bash
# bead-session.sh — PostToolUse hook for session bead coordination
#
# Creates/updates session beads when skills are invoked, commits made,
# or PRs created. Enables cross-session awareness (e.g. parallel
# frame-standup runs can see each other's active sessions).
#
# Hook events handled:
#   PostToolUse (Skill)              → create session bead if none exists
#   PostToolUse (Bash: git commit)   → create task bead, link to session
#   PostToolUse (Bash: gh pr create) → create PR bead, link to session
#
# Install: Add to .claude/settings.json PostToolUse hooks
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

BEAD_EMIT="$HOOK_DIR/bead-emit.mjs"

# Bail if Dolt isn't running
if ! lsof -i :${DOLT_PORT:-3307} >/dev/null 2>&1; then
  exit 0
fi

read_hook_input

# Session ID tracking file — persists across tool calls within one session
SESSION_FILE="/tmp/claude-bead-session-${SESSION_ID}"

# ── Skill invocation → create session bead ────────────────────────────────────
if [[ "$TOOL_NAME" == "Skill" && -n "$TOOL_INPUT_SKILL" ]]; then
  if [[ ! -f "$SESSION_FILE" ]]; then
    RESULT=$(node "$BEAD_EMIT" session-start \
      --skill="$TOOL_INPUT_SKILL" \
      --session-id="$SESSION_ID" 2>/dev/null || echo '{}')
    BEAD_ID=$(echo "$RESULT" | jq -r '.id // empty')
    if [[ -n "$BEAD_ID" ]]; then
      echo "$BEAD_ID" > "$SESSION_FILE"
    fi
  fi
  exit 0
fi

# ── git commit → task bead ────────────────────────────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'git commit'; then
  if [[ -f "$SESSION_FILE" ]]; then
    # Extract commit message from the command (best effort)
    TITLE=$(echo "$TOOL_INPUT_COMMAND" | grep -oP '(?<=-m ").*?(?=")' | head -1 || echo "commit")
    node "$BEAD_EMIT" task-done \
      --title="${TITLE:0:200}" \
      --session-id="$SESSION_ID" \
      --repo="$REPO" \
      --prefix="${REPO:0:4}" >/dev/null 2>&1 || true

    # Update session with repo touched
    node "$BEAD_EMIT" session-update \
      --session-id="$SESSION_ID" \
      --repos="$REPO" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# ── gh pr create → PR bead ───────────────────────────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'gh pr create'; then
  if [[ -f "$SESSION_FILE" ]]; then
    # Try to extract PR number from tool output (not available in PostToolUse input)
    node "$BEAD_EMIT" pr-created \
      --repo="$REPO" \
      --pr="pending" \
      --session-id="$SESSION_ID" \
      --prefix="${REPO:0:4}" >/dev/null 2>&1 || true
  fi
  exit 0
fi
