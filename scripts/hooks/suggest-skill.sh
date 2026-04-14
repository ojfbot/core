#!/usr/bin/env bash
# suggest-skill.sh — UserPromptSubmit hook
#
# Matches the user's prompt against skill-catalog.json trigger phrases.
# If a skill matches, injects a suggestion into Claude's context via
# additionalContext JSON output.
#
# Logs all outcomes to suggestion-telemetry.jsonl for observability:
#   skill:suggested       — a skill matched the prompt
#   skill:suggested-init  — no match, suggested /init on first prompt
#   skill:no-match        — no match found (and not first prompt)
#
# Install at USER level (~/.claude/settings.json) so it works from any repo.
# Chains with other UserPromptSubmit hooks (e.g., mrplug-inject.sh).
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

# Read hook input via _lib.sh shared parser
read_hook_input

# Skip if no prompt or prompt is a slash command (user already invoking a skill)
if [[ -z "$PROMPT" || "$PROMPT" =~ ^/ ]]; then
  exit 0
fi

# Resolve skill catalog path — works from any repo via symlinked skills
CATALOG=""
CORE_DIR="/Users/yuri/ojfbot/core"

# Try project-local first (works if skills are symlinked)
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  CANDIDATE="$CLAUDE_PROJECT_DIR/.claude/skills/skill-loader/knowledge/skill-catalog.json"
  if [[ -f "$CANDIDATE" ]]; then
    # Resolve symlink to get the real path
    CATALOG=$(readlink -f "$CANDIDATE" 2>/dev/null || echo "$CANDIDATE")
  fi
fi

# Fallback to core's absolute path
if [[ -z "$CATALOG" || ! -f "$CATALOG" ]]; then
  CATALOG="$CORE_DIR/.claude/skills/skill-loader/knowledge/skill-catalog.json"
fi

if [[ ! -f "$CATALOG" ]]; then
  exit 0
fi

# ── Check if previous suggestion was ignored ────────────────────────────────
# If we suggested a skill last prompt and it wasn't followed by a
# skill:suggestion-followed event, log skill:suggestion-ignored.

DEDUP_FILE="/tmp/claude-skill-suggest-${SESSION_ID:-default}"
DEDUP_WINDOW=300  # seconds

if [[ -f "$DEDUP_FILE" && -f "$SKILL_TELEMETRY_FILE" ]]; then
  PREV_SKILL=$(head -1 "$DEDUP_FILE" 2>/dev/null || echo "")
  PREV_TS=$(tail -1 "$DEDUP_FILE" 2>/dev/null || echo "0")

  if [[ -n "$PREV_SKILL" && "$PREV_SKILL" != "init" ]]; then
    # Check if suggestion-followed was logged for this skill+session since PREV_TS
    PREV_ISO=$(date -u -r "$PREV_TS" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
    if [[ -n "$PREV_ISO" ]]; then
      FOLLOWED=$(jq -r --arg sid "${SESSION_ID:-}" --arg skill "$PREV_SKILL" --arg since "$PREV_ISO" \
        'select(.session_id == $sid and .event == "skill:suggestion-followed" and .skill == $skill and .ts >= $since) | .ts' \
        "$SKILL_TELEMETRY_FILE" 2>/dev/null | head -1)

      if [[ -z "$FOLLOWED" ]]; then
        # Suggestion was ignored — log it
        IGN_TS=$(iso_now)
        IGN_LINE=$(jq -nc \
          --arg ts "$IGN_TS" \
          --arg event "skill:suggestion-ignored" \
          --arg skill "$PREV_SKILL" \
          --arg suggested_at "$PREV_ISO" \
          --arg repo "$REPO" \
          --arg sid "${SESSION_ID:-}" \
          '{ts:$ts, event:$event, skill:$skill, suggested_at:$suggested_at, repo:$repo, session_id:$sid}')
        log_telemetry "$SUGGESTION_TELEMETRY_FILE" "$IGN_LINE"
      fi
    fi
  fi
fi

# Lowercase the prompt for case-insensitive matching
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Truncate prompt for telemetry (first 120 chars, no newlines)
PROMPT_PREFIX=$(echo "$PROMPT" | tr '\n' ' ' | cut -c1-120)

# Use the suggest-skills.mjs engine for word-overlap matching
SUGGESTIONS=$(node "$HOOK_DIR/suggest-skills.mjs" --query="$PROMPT_LOWER" --limit=1 --format=json 2>/dev/null || echo "[]")
BEST_SKILL=$(echo "$SUGGESTIONS" | jq -r '.[0].name // empty')
BEST_REASON=$(echo "$SUGGESTIONS" | jq -r '.[0].reason // empty')
BEST_COUNT=0
if [[ -n "$BEST_SKILL" ]]; then
  BEST_COUNT=1
fi

TIMESTAMP=$(iso_now)

# No match found — suggest /init if this is the first prompt in the session
if [[ $BEST_COUNT -eq 0 || -z "$BEST_SKILL" ]]; then
  if [[ ! -f "$DEDUP_FILE" ]]; then
    # First prompt, no match — suggest /init
    printf '%s\n%s\n' "init" "$(date +%s)" > "$DEDUP_FILE"

    # Log suggestion-init event
    LINE=$(jq -nc \
      --arg ts "$TIMESTAMP" \
      --arg event "skill:suggested-init" \
      --arg prompt_prefix "$PROMPT_PREFIX" \
      --arg repo "$REPO" \
      --arg sid "$SESSION_ID" \
      '{ts:$ts, event:$event, skill:"init", prompt_prefix:$prompt_prefix, repo:$repo, session_id:$sid}')
    log_telemetry "$SUGGESTION_TELEMETRY_FILE" "$LINE"

    jq -nc '{
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "[Skill suggestion] No specific skill matched. Consider running /init to load environment context, check services, and see active sessions."
      }
    }'
  else
    # Subsequent prompt, no match — log silently
    LINE=$(jq -nc \
      --arg ts "$TIMESTAMP" \
      --arg event "skill:no-match" \
      --arg prompt_prefix "$PROMPT_PREFIX" \
      --arg repo "$REPO" \
      --arg sid "$SESSION_ID" \
      '{ts:$ts, event:$event, prompt_prefix:$prompt_prefix, repo:$repo, session_id:$sid}')
    log_telemetry "$SUGGESTION_TELEMETRY_FILE" "$LINE"
  fi
  exit 0
fi

# Check deduplication
if [[ -f "$DEDUP_FILE" ]]; then
  LAST_SKILL=$(head -1 "$DEDUP_FILE" 2>/dev/null || echo "")
  LAST_TS=$(tail -1 "$DEDUP_FILE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  ELAPSED=$((NOW - LAST_TS))

  if [[ "$LAST_SKILL" == "$BEST_SKILL" && $ELAPSED -lt $DEDUP_WINDOW ]]; then
    exit 0
  fi
fi

# Write dedup state (atomic: single write to avoid race conditions)
printf '%s\n%s\n' "$BEST_SKILL" "$(date +%s)" > "$DEDUP_FILE"

# Log skill:suggested event
LINE=$(jq -nc \
  --arg ts "$TIMESTAMP" \
  --arg event "skill:suggested" \
  --arg skill "$BEST_SKILL" \
  --arg reason "$BEST_REASON" \
  --arg prompt_prefix "$PROMPT_PREFIX" \
  --arg repo "$REPO" \
  --arg sid "$SESSION_ID" \
  '{ts:$ts, event:$event, skill:$skill, reason:$reason, prompt_prefix:$prompt_prefix, repo:$repo, session_id:$sid}')
log_telemetry "$SUGGESTION_TELEMETRY_FILE" "$LINE"

# Output suggestion as additionalContext
jq -nc \
  --arg skill "$BEST_SKILL" \
  --arg reason "$BEST_REASON" \
  '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ("[Skill suggestion] Your request matches /\($skill) (\($reason)). Consider invoking it for structured, repeatable output.")
    }
  }'
