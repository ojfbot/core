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

# Inline skill use (ADR-0092) bypasses the Skill tool, so .tool_input.skill is
# empty for it — the SKILL.md Read IS the usage signal. Derive the skill name
# from the path (same pattern corroborate-follow.mjs matches) so downstream
# consumers (pr-skill-audit, OPAV joins) can see inline use without a second
# detector diverging from the first.
SKILL_FIELD="$TOOL_INPUT_SKILL"
if [[ -z "$SKILL_FIELD" && "$TOOL_NAME" == "Read" && "$FILE_PATH" =~ /skills/([^/]+)/SKILL\.md$ ]]; then
  SKILL_FIELD="${BASH_REMATCH[1]}"
fi

TIMESTAMP=$(iso_now)

LINE=$(jq -nc \
  --arg ts "$TIMESTAMP" \
  --arg event "tool:used" \
  --arg tool "$TOOL_NAME" \
  --arg file "$FILE_PATH" \
  --arg skill "$SKILL_FIELD" \
  --arg repo "$REPO" \
  --arg cwd "$CWD" \
  --arg sid "$SESSION_ID" \
  --arg summary "$TOOL_INPUT_SUMMARY" \
  '{ts:$ts, event:$event, tool_name:$tool, file_path:$file, skill:$skill, repo:$repo, cwd:$cwd, session_id:$sid, input_summary:$summary}')

log_telemetry "$TOOL_TELEMETRY_FILE" "$LINE"
