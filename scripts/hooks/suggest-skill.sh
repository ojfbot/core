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

# Deduplication: don't suggest the same skill twice within 5 minutes
DEDUP_FILE="/tmp/claude-skill-suggest-${SESSION_ID:-default}"
DEDUP_WINDOW=300  # seconds

# Lowercase the prompt for case-insensitive matching
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Truncate prompt for telemetry (first 120 chars, no newlines)
PROMPT_PREFIX=$(echo "$PROMPT" | tr '\n' ' ' | cut -c1-120)

# Find best matching skill by checking trigger phrases
BEST_SKILL=""
BEST_TRIGGERS=""
BEST_COUNT=0

# Extract skills and their triggers from catalog
while IFS= read -r skill_json; do
  SKILL_NAME=$(echo "$skill_json" | jq -r '.name')
  MATCH_COUNT=0
  MATCHED_TRIGGERS=""

  # Check each trigger phrase
  while IFS= read -r trigger; do
    trigger_lower=$(echo "$trigger" | tr '[:upper:]' '[:lower:]')
    if [[ "$PROMPT_LOWER" == *"$trigger_lower"* ]]; then
      MATCH_COUNT=$((MATCH_COUNT + 1))
      if [[ -n "$MATCHED_TRIGGERS" ]]; then
        MATCHED_TRIGGERS="$MATCHED_TRIGGERS, '$trigger'"
      else
        MATCHED_TRIGGERS="'$trigger'"
      fi
    fi
  done < <(echo "$skill_json" | jq -r '.triggers[]')

  if [[ $MATCH_COUNT -gt $BEST_COUNT ]]; then
    BEST_COUNT=$MATCH_COUNT
    BEST_SKILL="$SKILL_NAME"
    BEST_TRIGGERS="$MATCHED_TRIGGERS"
  fi
done < <(jq -c '.skills[]' "$CATALOG")

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
  --arg triggers "$BEST_TRIGGERS" \
  --arg prompt_prefix "$PROMPT_PREFIX" \
  --arg repo "$REPO" \
  --arg sid "$SESSION_ID" \
  '{ts:$ts, event:$event, skill:$skill, triggers:$triggers, prompt_prefix:$prompt_prefix, repo:$repo, session_id:$sid}')
log_telemetry "$SUGGESTION_TELEMETRY_FILE" "$LINE"

# Output suggestion as additionalContext
jq -nc \
  --arg skill "$BEST_SKILL" \
  --arg triggers "$BEST_TRIGGERS" \
  '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ("[Skill suggestion] Your request matches /\($skill) (triggers: \($triggers)). Consider invoking it for structured, repeatable output.")
    }
  }'
