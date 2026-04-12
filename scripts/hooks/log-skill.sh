#!/usr/bin/env bash
# log-skill.sh — PostToolUse hook (matcher: Skill)
#
# Appends a JSONL telemetry line to ~/.claude/skill-telemetry.jsonl
# every time a skill is invoked interactively via Claude Code.
#
# Install: Add to .claude/settings.json PostToolUse hooks with matcher "Skill"
# Runs async (never blocks the session).
#
# NOTE: The catch-all log-tool-use.sh also captures skill invocations
# in tool-telemetry.jsonl. This script provides skill-specific telemetry
# with richer fields (skill name, args, source).
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

read_hook_input

# Extract skill name — try tool_input.skill first, then tool_input.args
SKILL="$TOOL_INPUT_SKILL"
ARGS="$TOOL_INPUT_ARGS"

# Skip if no skill name
[[ -z "$SKILL" ]] && exit 0

TIMESTAMP=$(iso_now)

LINE=$(jq -nc \
  --arg ts "$TIMESTAMP" \
  --arg event "skill:invoked" \
  --arg skill "$SKILL" \
  --arg args "$ARGS" \
  --arg repo "$REPO" \
  --arg cwd "$CWD" \
  --arg sid "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg source "interactive" \
  '{ts:$ts, event:$event, skill:$skill, args:$args, tool_name:$tool, repo:$repo, cwd:$cwd, session_id:$sid, source:$source}')

log_telemetry "$SKILL_TELEMETRY_FILE" "$LINE"

# Check if this skill was recently suggested in this session → close the funnel
if [[ -f "$SUGGESTION_TELEMETRY_FILE" && -s "$SUGGESTION_TELEMETRY_FILE" ]]; then
  # Look for a skill:suggested event matching this skill + session in the last 30 minutes
  SUGGESTED=$(jq -r --arg sid "$SESSION_ID" --arg skill "$SKILL" \
    'select(.session_id == $sid and .event == "skill:suggested" and .skill == $skill) | .ts' \
    "$SUGGESTION_TELEMETRY_FILE" 2>/dev/null | tail -1)

  if [[ -n "$SUGGESTED" ]]; then
    FOLLOW_LINE=$(jq -nc \
      --arg ts "$TIMESTAMP" \
      --arg event "skill:suggestion-followed" \
      --arg skill "$SKILL" \
      --arg suggested_at "$SUGGESTED" \
      --arg repo "$REPO" \
      --arg sid "$SESSION_ID" \
      '{ts:$ts, event:$event, skill:$skill, suggested_at:$suggested_at, repo:$repo, session_id:$sid}')
    log_telemetry "$SKILL_TELEMETRY_FILE" "$FOLLOW_LINE"
  fi
fi
