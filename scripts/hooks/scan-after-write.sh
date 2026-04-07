#!/usr/bin/env bash
# scan-after-write.sh — PostToolUse hook (matcher: Write)
#
# When Claude writes a file to a dist/ or build output directory,
# runs the artifact scanner to check for source maps, API keys,
# or debugger statements.
#
# Install: Add to .claude/settings.json PostToolUse hooks, matcher "Write"
# Runs ASYNC — does not block the session.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

read_hook_input

[[ -z "$FILE_PATH" ]] && exit 0

# Only scan files in build output directories
case "$FILE_PATH" in
  */dist/*|*/build/*|*/out/*) ;;
  *) exit 0 ;;
esac

# Quick inline checks (faster than invoking the full scanner)
VIOLATIONS=()

# Check for .map files
if [[ "$FILE_PATH" == *.js.map ]]; then
  VIOLATIONS+=("Source map file written to build output: $(basename "$FILE_PATH")")
fi

# Check file contents for embedded issues
if [[ -f "$FILE_PATH" ]]; then
  # sourceMappingURL
  if grep -q 'sourceMappingURL=' "$FILE_PATH" 2>/dev/null; then
    # Skip .d.ts files (declaration maps are safe)
    if [[ "$FILE_PATH" != *.d.ts ]]; then
      VIOLATIONS+=("sourceMappingURL directive found in $(basename "$FILE_PATH")")
    fi
  fi

  # API key patterns
  if grep -qE 'sk-ant-[a-zA-Z0-9_-]{20,}|ANTHROPIC_API_KEY|dangerouslyAllowBrowser:\s*true' "$FILE_PATH" 2>/dev/null; then
    VIOLATIONS+=("Potential API key or dangerouslyAllowBrowser found in $(basename "$FILE_PATH")")
  fi

  # Debugger statements
  if grep -q '\bdebugger\b' "$FILE_PATH" 2>/dev/null; then
    VIOLATIONS+=("debugger statement found in $(basename "$FILE_PATH")")
  fi
fi

# No violations — exit silently
if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
  exit 0
fi

# Format and inject warning
CONTEXT="[Artifact scan] Build output file has ${#VIOLATIONS[@]} issue(s):"
for v in "${VIOLATIONS[@]}"; do
  CONTEXT="$CONTEXT
  - $v"
done
CONTEXT="$CONTEXT
Production builds must not contain source maps, API keys, or debug artifacts."

# Log to telemetry
LINE=$(jq -nc \
  --arg ts "$(iso_now)" \
  --arg event "artifact:violation" \
  --arg file "$FILE_PATH" \
  --arg count "${#VIOLATIONS[@]}" \
  --arg repo "$REPO" \
  --arg sid "$SESSION_ID" \
  '{ts:$ts, event:$event, file:$file, violation_count:($count|tonumber), repo:$repo, session_id:$sid}')
log_telemetry "$TOOL_TELEMETRY_FILE" "$LINE"

output_context "$CONTEXT"
