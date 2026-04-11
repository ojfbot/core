#!/usr/bin/env bash
# bead-session.sh — PostToolUse hook for agent bead coordination
#
# Tracks work within a session by linking task/PR beads to the agent bead,
# and recording skill invocations on the agent. Session-init.sh creates the
# agent bead on first prompt; this hook handles mid-session lifecycle events.
#
# Hook events handled:
#   PostToolUse (Skill)              → record skill on agent, sling task if applicable
#   PostToolUse (Bash: git commit)   → create task bead, sling onto agent hook
#   PostToolUse (Bash: gh pr create) → create PR bead, link to agent
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

# Session ID tracking file — contains agent bead ID (e.g. trip-agent-worker)
SESSION_FILE="/tmp/claude-bead-session-${SESSION_ID}"

# Read agent ID from sentinel (set by session-init.sh)
AGENT_ID=""
if [[ -f "$SESSION_FILE" ]]; then
  AGENT_ID=$(cat "$SESSION_FILE")
fi

# ── Skill invocation → record on agent bead ───────────────────────────────────
if [[ "$TOOL_NAME" == "Skill" && -n "$TOOL_INPUT_SKILL" ]]; then
  if [[ "$AGENT_ID" == "none" || -z "$AGENT_ID" ]]; then
    # No agent bead exists — create one now (defensive fallback)
    RESULT=$(node "$BEAD_EMIT" agent-create \
      --role=worker --app="$REPO" --session-id="$SESSION_ID" 2>/dev/null || echo '{}')
    AGENT_ID=$(echo "$RESULT" | jq -r '.id // empty')
    [[ -n "$AGENT_ID" ]] && echo "$AGENT_ID" > "$SESSION_FILE"
  fi

  # Record the skill invocation on the session (backward-compat with session-update)
  if [[ -n "$AGENT_ID" && "$AGENT_ID" != "none" ]]; then
    node "$BEAD_EMIT" session-update \
      --session-id="$SESSION_ID" \
      --skill="$TOOL_INPUT_SKILL" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# ── git commit → task bead, sling onto agent ──────────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'git commit'; then
  if [[ -n "$AGENT_ID" && "$AGENT_ID" != "none" ]]; then
    # Extract commit message from the command (best effort)
    TITLE=$(echo "$TOOL_INPUT_COMMAND" | grep -oP '(?<=-m ").*?(?=")' | head -1 || echo "commit")
    RESULT=$(node "$BEAD_EMIT" task-done \
      --title="${TITLE:0:200}" \
      --session-id="$SESSION_ID" \
      --repo="$REPO" \
      --prefix="${REPO:0:4}" 2>/dev/null || echo '{}')
    TASK_ID=$(echo "$RESULT" | jq -r '.id // empty')

    # Sling the task onto the agent's hook
    if [[ -n "$TASK_ID" ]]; then
      node "$BEAD_EMIT" agent-sling \
        --agent-id="$AGENT_ID" \
        --bead-id="$TASK_ID" >/dev/null 2>&1 || true
    fi

    # Update session with repo touched
    node "$BEAD_EMIT" session-update \
      --session-id="$SESSION_ID" \
      --repos="$REPO" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# ── gh pr create → PR bead, link to agent ─────────────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'gh pr create'; then
  if [[ -n "$AGENT_ID" && "$AGENT_ID" != "none" ]]; then
    RESULT=$(node "$BEAD_EMIT" pr-created \
      --repo="$REPO" \
      --pr="pending" \
      --session-id="$SESSION_ID" \
      --prefix="${REPO:0:4}" 2>/dev/null || echo '{}')
    PR_BEAD_ID=$(echo "$RESULT" | jq -r '.id // empty')

    # Sling the PR bead onto the agent's hook
    if [[ -n "$PR_BEAD_ID" ]]; then
      node "$BEAD_EMIT" agent-sling \
        --agent-id="$AGENT_ID" \
        --bead-id="$PR_BEAD_ID" >/dev/null 2>&1 || true
    fi
  fi
  exit 0
fi
