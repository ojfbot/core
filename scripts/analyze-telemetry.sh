#!/usr/bin/env bash
# analyze-telemetry.sh — Analyze Claude Code hook telemetry
#
# Reads JSONL files from ~/.claude/ and produces usage reports:
#   - Tool usage distribution
#   - Skill invocation counts and discovery rate
#   - Most-edited files
#   - Session activity per repo
#   - Quality skill coverage (sessions without /validate or /hardening)
#
# Usage:
#   bash scripts/analyze-telemetry.sh                    # full report
#   bash scripts/analyze-telemetry.sh --section=skills   # skills only
#   bash scripts/analyze-telemetry.sh --since=7d         # last 7 days
set -euo pipefail

TOOL_FILE="${HOME}/.claude/tool-telemetry.jsonl"
SKILL_FILE="${HOME}/.claude/skill-telemetry.jsonl"
SESSION_FILE="${HOME}/.claude/session-telemetry.jsonl"

SECTION="all"
SINCE=""

for arg in "$@"; do
  case "$arg" in
    --section=*) SECTION="${arg#*=}" ;;
    --since=*)   SINCE="${arg#*=}" ;;
  esac
done

# Compute cutoff timestamp if --since is provided
CUTOFF=""
if [[ -n "$SINCE" ]]; then
  # Parse duration: 7d, 24h, 30d
  NUM=$(echo "$SINCE" | grep -oE '[0-9]+')
  UNIT=$(echo "$SINCE" | grep -oE '[dhm]$')
  case "$UNIT" in
    d) SECS=$((NUM * 86400)) ;;
    h) SECS=$((NUM * 3600)) ;;
    m) SECS=$((NUM * 60)) ;;
    *) SECS=$((NUM * 86400)) ;;
  esac
  if [[ "$(uname)" == "Darwin" ]]; then
    CUTOFF=$(date -u -v-${SECS}S +"%Y-%m-%dT%H:%M:%SZ")
  else
    CUTOFF=$(date -u -d "$SECS seconds ago" +"%Y-%m-%dT%H:%M:%SZ")
  fi
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

filter_since() {
  local file="$1"
  if [[ -z "$CUTOFF" ]]; then
    cat "$file"
  else
    jq -c --arg cutoff "$CUTOFF" 'select(.ts >= $cutoff)' "$file"
  fi
}

file_exists_with_data() {
  [[ -f "$1" ]] && [[ -s "$1" ]]
}

# ── Tool Usage ────────────────────────────────────────────────────────────────

report_tools() {
  echo "## Tool Usage Distribution"
  echo ""

  if ! file_exists_with_data "$TOOL_FILE"; then
    echo "_No tool telemetry data yet. Use Claude Code with hooks enabled to start collecting._"
    echo ""
    return
  fi

  echo "### By tool type"
  filter_since "$TOOL_FILE" | jq -r '.tool_name' | sort | uniq -c | sort -rn | head -15 | \
    awk '{printf "  %-6s %s\n", $1, $2}'
  echo ""

  echo "### Most-edited files (Edit/Write)"
  filter_since "$TOOL_FILE" | \
    jq -r 'select(.tool_name == "Edit" or .tool_name == "Write") | .file_path // empty' | \
    grep -v '^$' | sort | uniq -c | sort -rn | head -10 | \
    awk '{printf "  %-4s %s\n", $1, $2}'
  echo ""

  echo "### By repo"
  filter_since "$TOOL_FILE" | jq -r '.repo // "unknown"' | sort | uniq -c | sort -rn | \
    awk '{printf "  %-6s %s\n", $1, $2}'
  echo ""

  TOTAL=$(filter_since "$TOOL_FILE" | wc -l | tr -d ' ')
  SESSIONS=$(filter_since "$TOOL_FILE" | jq -r '.session_id' | sort -u | wc -l | tr -d ' ')
  echo "**Total tool calls:** $TOTAL across $SESSIONS session(s)"
  echo ""
}

# ── Skill Usage ───────────────────────────────────────────────────────────────

report_skills() {
  echo "## Skill Usage"
  echo ""

  if ! file_exists_with_data "$SKILL_FILE"; then
    echo "_No skill telemetry data yet._"
    echo ""

    # Check if tool telemetry has Skill tool calls (diagnostic)
    if file_exists_with_data "$TOOL_FILE"; then
      SKILL_TOOL_CALLS=$(filter_since "$TOOL_FILE" | jq -r 'select(.skill != "") | .skill' 2>/dev/null | wc -l | tr -d ' ')
      if [[ "$SKILL_TOOL_CALLS" -gt 0 ]]; then
        echo "### Diagnostic: Skills detected in tool telemetry"
        echo "_The catch-all tool logger found $SKILL_TOOL_CALLS skill invocations._"
        echo "_This means the Skill-specific hook (log-skill.sh) isn't triggering — check the matcher._"
        echo ""
        filter_since "$TOOL_FILE" | jq -r 'select(.skill != "") | .skill' | sort | uniq -c | sort -rn | \
          awk '{printf "  %-4s /%s\n", $1, $2}'
        echo ""
      fi
    fi
    return
  fi

  echo "### Top skills by invocation"
  filter_since "$SKILL_FILE" | jq -r '.skill' | sort | uniq -c | sort -rn | head -15 | \
    awk '{printf "  %-4s /%s\n", $1, $2}'
  echo ""

  echo "### Skill usage by repo"
  filter_since "$SKILL_FILE" | jq -r '"\(.repo) \(.skill)"' | sort | uniq -c | sort -rn | head -15 | \
    awk '{printf "  %-4s %s\n", $1, $2}'
  echo ""
}

# ── Session Activity ──────────────────────────────────────────────────────────

report_sessions() {
  echo "## Session Activity"
  echo ""

  if ! file_exists_with_data "$SESSION_FILE"; then
    echo "_No session telemetry data yet._"
    echo ""
    return
  fi

  echo "### Sessions by repo"
  filter_since "$SESSION_FILE" | jq -r '.repo // "unknown"' | sort | uniq -c | sort -rn | \
    awk '{printf "  %-4s %s\n", $1, $2}'
  echo ""

  echo "### Sessions by model"
  filter_since "$SESSION_FILE" | jq -r '.model // "unknown"' | sort | uniq -c | sort -rn | \
    awk '{printf "  %-4s %s\n", $1, $2}'
  echo ""

  TOTAL_SESSIONS=$(filter_since "$SESSION_FILE" | wc -l | tr -d ' ')
  echo "**Total sessions:** $TOTAL_SESSIONS"
  echo ""
}

# ── Quality Coverage ──────────────────────────────────────────────────────────

report_quality() {
  echo "## Quality Skill Coverage"
  echo ""

  if ! file_exists_with_data "$TOOL_FILE"; then
    echo "_No telemetry data to analyze._"
    echo ""
    return
  fi

  # Find sessions that had edits but no quality skill invocation
  ALL_EDIT_SESSIONS=$(filter_since "$TOOL_FILE" | \
    jq -r 'select(.tool_name == "Edit" or .tool_name == "Write") | .session_id' | sort -u)

  QUALITY_SKILLS="validate|hardening|lint-audit|test-expand"
  QUALITY_SESSIONS=""

  if file_exists_with_data "$SKILL_FILE"; then
    QUALITY_SESSIONS=$(filter_since "$SKILL_FILE" | \
      jq -r "select(.skill | test(\"$QUALITY_SKILLS\")) | .session_id" | sort -u)
  fi

  # Also check tool telemetry for skill field
  QUALITY_FROM_TOOLS=$(filter_since "$TOOL_FILE" | \
    jq -r "select(.skill != \"\" and (.skill | test(\"$QUALITY_SKILLS\"))) | .session_id" 2>/dev/null | sort -u)

  ALL_QUALITY=$(echo -e "${QUALITY_SESSIONS}\n${QUALITY_FROM_TOOLS}" | sort -u | grep -v '^$')

  EDIT_COUNT=$(echo "$ALL_EDIT_SESSIONS" | grep -v '^$' | wc -l | tr -d ' ')
  QUALITY_COUNT=$(echo "$ALL_QUALITY" | grep -v '^$' | wc -l | tr -d ' ')

  if [[ "$EDIT_COUNT" -gt 0 ]]; then
    COVERAGE=$(( (QUALITY_COUNT * 100) / EDIT_COUNT ))
    echo "Sessions with code edits: **$EDIT_COUNT**"
    echo "Sessions with quality skills (/validate, /hardening, /lint-audit): **$QUALITY_COUNT**"
    echo "Quality coverage: **${COVERAGE}%**"
    echo ""

    UNCOVERED=$((EDIT_COUNT - QUALITY_COUNT))
    if [[ $UNCOVERED -gt 0 ]]; then
      echo "_$UNCOVERED session(s) had code edits without any quality skill invocation._"
    fi
  else
    echo "_No sessions with code edits found._"
  fi
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

echo "# Claude Code Telemetry Report"
echo ""
if [[ -n "$SINCE" ]]; then
  echo "_Filtered to last $SINCE (since $CUTOFF)_"
  echo ""
fi

case "$SECTION" in
  tools)    report_tools ;;
  skills)   report_skills ;;
  sessions) report_sessions ;;
  quality)  report_quality ;;
  all)
    report_tools
    report_skills
    report_sessions
    report_quality
    ;;
  *)
    echo "Unknown section: $SECTION"
    echo "Valid: tools, skills, sessions, quality, all"
    exit 1
    ;;
esac

echo "---"
echo "_Generated by [analyze-telemetry](https://github.com/ojfbot/core/blob/main/scripts/analyze-telemetry.sh) at $(date -u +"%Y-%m-%dT%H:%M:%SZ")_"
