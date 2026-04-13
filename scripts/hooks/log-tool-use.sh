#!/usr/bin/env bash
# log-tool-use.sh — PostToolUse hook (no matcher — captures ALL tool calls)
#
# Appends a JSONL telemetry line to ~/.claude/tool-telemetry.jsonl
# for every tool invocation in a Claude Code session.
#
# Install: Add to ~/.claude/settings.json PostToolUse hooks (no matcher, async).
# Runs async — never blocks the session.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

read_hook_input

# Skip if no tool name (shouldn't happen)
[[ -z "$TOOL_NAME" ]] && exit 0

# Truncate tool input summary to avoid giant JSONL lines
TOOL_INPUT_SUMMARY=$(echo "$HOOK_INPUT" | jq -c '.tool_input | tostring | .[0:300]' 2>/dev/null || echo '""')

TIMESTAMP=$(iso_now)

LINE=$(jq -nc \
  --arg ts "$TIMESTAMP" \
  --arg event "tool:used" \
  --arg tool "$TOOL_NAME" \
  --arg file "$FILE_PATH" \
  --arg skill "$TOOL_INPUT_SKILL" \
  --arg repo "$REPO" \
  --arg cwd "$CWD" \
  --arg sid "$SESSION_ID" \
  --arg summary "$TOOL_INPUT_SUMMARY" \
  '{ts:$ts, event:$event, tool_name:$tool, file_path:$file, skill:$skill, repo:$repo, cwd:$cwd, session_id:$sid, input_summary:$summary}')

log_telemetry "$TOOL_TELEMETRY_FILE" "$LINE"
