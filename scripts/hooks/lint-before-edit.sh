#!/usr/bin/env bash
# lint-before-edit.sh — PreToolUse hook (matcher: Edit|Write)
#
# Runs ESLint on the file Claude is about to edit and injects existing
# violations as additionalContext. This turns ESLint rules into LLM
# instructions — Claude sees the violations and fixes them alongside
# its intended edit.
#
# Also caches the pre-edit violation count so lint-after-edit.sh can
# compute the delta (new violations introduced by the edit).
#
# Install: Add to .claude/settings.json PreToolUse hooks, matcher "Edit|Write"
# Runs SYNC — must complete before the edit executes.
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

# Skip files in ignored directories
case "$FILE_PATH" in
  */node_modules/*|*/dist/*|*/build/*|*/.git/*) exit 0 ;;
  */personal/*|*/dev/*|*/scripts/*|*/docs/*) exit 0 ;;
esac

# Skip if eslint isn't available in this project
if [[ -z "$CWD" ]]; then
  exit 0
fi

# Find project root (look for eslint.config.js)
PROJECT_ROOT="$CWD"
while [[ "$PROJECT_ROOT" != "/" ]]; do
  [[ -f "$PROJECT_ROOT/eslint.config.js" ]] && break
  [[ -f "$PROJECT_ROOT/eslint.config.mjs" ]] && break
  [[ -f "$PROJECT_ROOT/.eslintrc.js" ]] && break
  [[ -f "$PROJECT_ROOT/.eslintrc.json" ]] && break
  PROJECT_ROOT=$(dirname "$PROJECT_ROOT")
done

# No ESLint config found — skip silently
if [[ "$PROJECT_ROOT" == "/" ]]; then
  exit 0
fi

# Run ESLint on the single file (fast: ~200-500ms)
LINT_OUTPUT=$(cd "$PROJECT_ROOT" && npx eslint --format json "$FILE_PATH" 2>/dev/null || true)

# Parse violations
if [[ -z "$LINT_OUTPUT" ]]; then
  exit 0
fi

VIOLATION_COUNT=$(echo "$LINT_OUTPUT" | jq '[.[].messages | length] | add // 0')

# Cache pre-edit count for delta check in lint-after-edit.sh
CACHE_DIR="/tmp/claude-lint-cache-${SESSION_ID:-default}"
mkdir -p "$CACHE_DIR"
if command -v md5sum &>/dev/null; then
  CACHE_KEY=$(echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
else
  # macOS: md5 outputs "MD5 (...) = hash" or with -q just the hash
  CACHE_KEY=$(echo "$FILE_PATH" | md5 -q 2>/dev/null || echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
fi
echo "$VIOLATION_COUNT" > "$CACHE_DIR/$CACHE_KEY"

# No violations — nothing to inject
if [[ "$VIOLATION_COUNT" -eq 0 ]]; then
  exit 0
fi

# Format violations as actionable context for Claude
FORMATTED=$(echo "$LINT_OUTPUT" | jq -r '
  .[].messages[] |
  "  - L\(.line): \(.ruleId // "unknown") — \(.message)"
' | head -10)

EXTRA_COUNT=0
TOTAL_MSGS=$(echo "$LINT_OUTPUT" | jq '[.[].messages | length] | add // 0')
if [[ "$TOTAL_MSGS" -gt 10 ]]; then
  EXTRA_COUNT=$((TOTAL_MSGS - 10))
fi

CONTEXT="[Lint] File has $VIOLATION_COUNT existing violation(s):
$FORMATTED"

if [[ "$EXTRA_COUNT" -gt 0 ]]; then
  CONTEXT="$CONTEXT
  ... and $EXTRA_COUNT more. Run \`pnpm lint\` for full list."
fi

CONTEXT="$CONTEXT
Fix these while editing if they overlap with your changes."

# Inject as additionalContext (does NOT block the edit)
output_context "$CONTEXT"
