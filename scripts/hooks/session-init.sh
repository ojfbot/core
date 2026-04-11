#!/usr/bin/env bash
# session-init.sh — UserPromptSubmit hook for universal AgentBead creation
#
# Creates or resumes an AgentBead on the first user message in any Claude Code
# session. Agent beads persist across sessions (sessions are cattle, agents
# are pets). If an idle agent exists for this app+role, it is resumed.
#
# Tier 0 of the two-tier initializer (ADR-0042):
#   Tier 0: This hook — free, silent, universal agent bead creation
#   Tier 1: /init skill — interactive, token-costly, rich context loading
#
# Install: Add to ~/.claude/settings.json UserPromptSubmit hooks (user level)
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

BEAD_EMIT="$HOOK_DIR/bead-emit.mjs"

read_hook_input

SESSION_FILE="/tmp/claude-bead-session-${SESSION_ID}"

# Idempotent — only fires on first user message per session
[[ -f "$SESSION_FILE" ]] && exit 0

# Map repo directory name to canonical app name for agent identity
repo_to_app() {
  case "$1" in
    core)           echo "core" ;;
    cv-builder)     echo "cv-builder" ;;
    blogengine)     echo "blogengine" ;;
    TripPlanner)    echo "TripPlanner" ;;
    purefoy)        echo "purefoy" ;;
    seh-study)      echo "seh-study" ;;
    lean-canvas)    echo "lean-canvas" ;;
    gastown-pilot)  echo "gastown-pilot" ;;
    shell)          echo "shell" ;;
    core-reader)    echo "core-reader" ;;
    *)              echo "$1" ;;
  esac
}

# Create or resume agent bead if Dolt is running
if lsof -i :${DOLT_PORT:-3307} >/dev/null 2>&1; then
  APP=$(repo_to_app "$REPO")

  RESULT=$(node "$BEAD_EMIT" agent-create \
    --role=worker --app="$APP" --session-id="$SESSION_ID" 2>/dev/null || echo '{}')
  AGENT_ID=$(echo "$RESULT" | jq -r '.id // empty')
  AGENT_STATUS=$(echo "$RESULT" | jq -r '.status // empty')
  echo "${AGENT_ID:-none}" > "$SESSION_FILE"

  # Parallel session awareness
  ACTIVE=$(node "$BEAD_EMIT" active-sessions 2>/dev/null || echo '{"sessions":[]}')
  COUNT=$(echo "$ACTIVE" | jq '.sessions | length')
  if [[ "$COUNT" -gt 1 ]]; then
    OTHERS=$(echo "$ACTIVE" | jq -r --arg sid "$SESSION_ID" \
      '.sessions[] | select(.labels.session_id != $sid) | "  - \(.title) (\(.id))"')
    output_user_prompt_context "[Agent ${AGENT_STATUS}: ${AGENT_ID:-unknown}] $COUNT active agents. Others:
$OTHERS
[Run /init for full environment context]"
  else
    output_user_prompt_context "[Agent ${AGENT_STATUS}: ${AGENT_ID:-unknown} — run /init for full environment context]"
  fi
else
  echo "none" > "$SESSION_FILE"
fi
