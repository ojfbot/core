#!/usr/bin/env bash
# lint-after-edit.sh — PostToolUse hook (matcher: Edit|Write)
#
# After Claude edits a file, re-runs ESLint and compares against the
# pre-edit violation count cached by lint-before-edit.sh. If the edit
# INTRODUCED new violations (delta > 0), injects a warning as
# additionalContext so Claude self-corrects on the next turn.
#
# Only reports regressions (new violations), not pre-existing ones.
#
# Install: Add to .claude/settings.json PostToolUse hooks, matcher "Edit|Write"
# Runs ASYNC — does not block the session.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

read_hook_input

# Only lint TypeScript/JavaScript files
[[ -z "$FILE_PATH" ]] && exit 0
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.mjs|*.jsx) ;;
  *) exit 0 ;;
esac

# Skip ignored directories
case "$FILE_PATH" in
  */node_modules/*|*/dist/*|*/build/*|*/.git/*) exit 0 ;;
  */personal/*|*/dev/*|*/scripts/*|*/docs/*) exit 0 ;;
esac

[[ -z "$CWD" ]] && exit 0

# Find project root
PROJECT_ROOT="$CWD"
while [[ "$PROJECT_ROOT" != "/" ]]; do
  [[ -f "$PROJECT_ROOT/eslint.config.js" ]] && break
  [[ -f "$PROJECT_ROOT/eslint.config.mjs" ]] && break
  PROJECT_ROOT=$(dirname "$PROJECT_ROOT")
done
[[ "$PROJECT_ROOT" == "/" ]] && exit 0

# Run ESLint on the edited file
LINT_OUTPUT=$(cd "$PROJECT_ROOT" && npx eslint --format json "$FILE_PATH" 2>/dev/null || true)
[[ -z "$LINT_OUTPUT" ]] && exit 0

POST_COUNT=$(echo "$LINT_OUTPUT" | jq '[.[].messages | length] | add // 0')

# Read pre-edit count from cache
CACHE_DIR="/tmp/claude-lint-cache-${SESSION_ID:-default}"
if command -v md5sum &>/dev/null; then
  CACHE_KEY=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
else
  CACHE_KEY=$(echo "$FILE_PATH" | md5 -q 2>/dev/null || echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
fi
PRE_COUNT=0
if [[ -f "$CACHE_DIR/$CACHE_KEY" ]]; then
  PRE_COUNT=$(cat "$CACHE_DIR/$CACHE_KEY")
fi

# Update cache with new count (for subsequent edits)
mkdir -p "$CACHE_DIR"
echo "$POST_COUNT" > "$CACHE_DIR/$CACHE_KEY"

# Only report if the edit introduced NEW violations
DELTA=$((POST_COUNT - PRE_COUNT))
if [[ "$DELTA" -le 0 ]]; then
  # Log improvement to telemetry if violations were fixed
  if [[ "$DELTA" -lt 0 ]]; then
    FIXED=$(( -1 * DELTA ))
    LINE=$(jq -nc \
      --arg ts "$(iso_now)" \
      --arg event "lint:fixed" \
      --arg file "$FILE_PATH" \
      --arg count "$FIXED" \
      --arg repo "$REPO" \
      --arg sid "$SESSION_ID" \
      '{ts:$ts, event:$event, file:$file, violations_fixed:($count|tonumber), repo:$repo, session_id:$sid}')
    log_telemetry "$TOOL_TELEMETRY_FILE" "$LINE"
  fi
  exit 0
fi

# Format the new violations
NEW_VIOLATIONS=$(echo "$LINT_OUTPUT" | jq -r '
  .[].messages[] |
  "  - L\(.line): \(.ruleId // "unknown") — \(.message)"
' | tail -"$DELTA")

CONTEXT="[Lint regression] Your last edit introduced $DELTA new violation(s) in $(basename "$FILE_PATH"):
$NEW_VIOLATIONS
Fix these before continuing."

# Log regression to telemetry
LINE=$(jq -nc \
  --arg ts "$(iso_now)" \
  --arg event "lint:regression" \
  --arg file "$FILE_PATH" \
  --arg delta "$DELTA" \
  --arg repo "$REPO" \
  --arg sid "$SESSION_ID" \
  '{ts:$ts, event:$event, file:$file, new_violations:($delta|tonumber), repo:$repo, session_id:$sid}')
log_telemetry "$TOOL_TELEMETRY_FILE" "$LINE"

# Inject warning — async hooks can still provide additionalContext
output_context "$CONTEXT"
