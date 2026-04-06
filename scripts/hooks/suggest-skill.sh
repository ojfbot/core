#!/usr/bin/env bash
# suggest-skill.sh — UserPromptSubmit hook
#
# Matches the user's prompt against skill-catalog.json trigger phrases.
# If a skill matches, injects a suggestion into Claude's context via
# additionalContext JSON output.
#
# Install at USER level (~/.claude/settings.json) so it works from any repo.
# Chains with other UserPromptSubmit hooks (e.g., mrplug-inject.sh).
set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

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

# No match found
if [[ $BEST_COUNT -eq 0 || -z "$BEST_SKILL" ]]; then
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

# Write dedup state
echo "$BEST_SKILL" > "$DEDUP_FILE"
date +%s >> "$DEDUP_FILE"

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
