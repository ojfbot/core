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

# Check if this skill was recently suggested in this session → close the funnel.
# rm:rm-l1-core#S5: BOTH populations count (skill:suggested + skill:suggested-uninstalled),
# and the invoked name is segment-normalized — `core:adr` and `adr:knowledge:x` both close a
# suggestion for `adr` (same rule as corroborate-follow.mjs matchesSkillName).
# Deliberately NO skill:acted emission here: an invocation is not an artifact; acted stays
# evidence-mandatory (skill-acted-emit.mjs / the reconciler's artifact proxy, ADR-0095).
if [[ -f "$SUGGESTION_TELEMETRY_FILE" && -s "$SUGGESTION_TELEMETRY_FILE" ]]; then
  # Most recent matching suggestion event (skill + session). Capture both its
  # ts and SUGGESTION_ID so the follow joins back to its originating suggestion.
  MATCH=$(jq -rc --arg sid "$SESSION_ID" --arg skill "$SKILL" \
    'select(.session_id == $sid
            and (.event == "skill:suggested" or .event == "skill:suggested-uninstalled")
            and (.skill as $s | ($skill == $s) or (($skill | split(":")) | index($s) != null)))
     | {ts, suggestion_id}' \
    "$SUGGESTION_TELEMETRY_FILE" 2>/dev/null | tail -1)
  SUGGESTED=$(echo "$MATCH" | jq -r '.ts // empty' 2>/dev/null || echo "")
  SUGGESTION_ID=$(echo "$MATCH" | jq -r '.suggestion_id // empty' 2>/dev/null || echo "")

  if [[ -n "$SUGGESTED" ]]; then
    FOLLOW_LINE=$(jq -nc \
      --arg ts "$TIMESTAMP" \
      --arg event "skill:suggestion-followed" \
      --arg skill "$SKILL" \
      --arg suggested_at "$SUGGESTED" \
      --arg repo "$REPO" \
      --arg sid "$SESSION_ID" \
      --arg suggestion_id "$SUGGESTION_ID" \
      '{ts:$ts, event:$event, skill:$skill, suggested_at:$suggested_at, repo:$repo, session_id:$sid, suggestion_id:$suggestion_id}')
    log_telemetry "$SKILL_TELEMETRY_FILE" "$FOLLOW_LINE"
  fi
fi
