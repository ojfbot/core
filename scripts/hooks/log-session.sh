#!/usr/bin/env bash
# log-session.sh — SessionStart hook
#
# Appends a JSONL line to ~/.claude/session-telemetry.jsonl
# when a Claude Code session begins or resumes.
#
# Install: Add to ~/.claude/settings.json SessionStart hooks (async).
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

read_hook_input

SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty')
SOURCE=$(echo "$HOOK_INPUT" | jq -r '.source // empty')
MODEL=$(echo "$HOOK_INPUT" | jq -r '.model // empty')

REPO=""
BRANCH=""
if [[ -n "$CWD" ]]; then
  REPO=$(detect_repo "$CWD")
  BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
fi

TIMESTAMP=$(iso_now)

LINE=$(jq -nc \
  --arg ts "$TIMESTAMP" \
  --arg event "session:start" \
  --arg sid "$SESSION_ID" \
  --arg source "$SOURCE" \
  --arg model "$MODEL" \
  --arg repo "$REPO" \
  --arg branch "$BRANCH" \
  --arg cwd "$CWD" \
  '{ts:$ts, event:$event, session_id:$sid, source:$source, model:$model, repo:$repo, branch:$branch, cwd:$cwd}')

log_telemetry "$SESSION_TELEMETRY_FILE" "$LINE"
