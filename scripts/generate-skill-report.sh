#!/usr/bin/env bash
# generate-skill-report.sh — Skill adoption report
#
# Reads all telemetry JSONL files + skill-catalog.json to produce a
# comprehensive skill adoption report with adoption rate, dead skills,
# suggestion funnel, quality gate coverage, and per-repo breakdown.
#
# Usage:
#   bash scripts/generate-skill-report.sh                      # markdown, last 24h
#   bash scripts/generate-skill-report.sh --since=7d           # last 7 days
#   bash scripts/generate-skill-report.sh --format=json        # machine-readable
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts/hooks" 2>/dev/null && pwd)" || true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TELEMETRY_DIR="${HOME}/.claude"
SKILL_FILE="$TELEMETRY_DIR/skill-telemetry.jsonl"
TOOL_FILE="$TELEMETRY_DIR/tool-telemetry.jsonl"
SUGGESTION_FILE="$TELEMETRY_DIR/suggestion-telemetry.jsonl"
SESSION_FILE="$TELEMETRY_DIR/session-telemetry.jsonl"
CATALOG="$CORE_DIR/.claude/skills/skill-loader/knowledge/skill-catalog.json"
SKILLS_DIR="$CORE_DIR/.claude/skills"

FORMAT="markdown"
SINCE="24h"

for arg in "$@"; do
  case "$arg" in
    --format=*) FORMAT="${arg#*=}" ;;
    --since=*)  SINCE="${arg#*=}" ;;
  esac
done

# Compute cutoff timestamp
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

# ── Helpers ──────────────────────────────────────────────────────────────────

filter() {
  local file="$1"
  [[ -f "$file" && -s "$file" ]] || return 0
  jq -c --arg cutoff "$CUTOFF" 'select(.ts >= $cutoff)' "$file"
}

filter_all() {
  local file="$1"
  [[ -f "$file" && -s "$file" ]] || return 0
  cat "$file"
}

# ── Data collection ──────────────────────────────────────────────────────────

# Catalog skills
CATALOG_COUNT=0
CATALOG_SKILLS=""
if [[ -f "$CATALOG" ]]; then
  CATALOG_COUNT=$(jq '.skills | length' "$CATALOG")
  CATALOG_SKILLS=$(jq -r '.skills[].name' "$CATALOG" | sort)
fi

# Skill directories
DIR_SKILLS=$(ls -d "$SKILLS_DIR"/*/ 2>/dev/null | xargs -I{} basename {} | sort)
DIR_COUNT=$(echo "$DIR_SKILLS" | wc -l | tr -d ' ')

# Skills invoked in window
INVOKED_SKILLS=""
INVOKED_COUNT=0
if [[ -f "$SKILL_FILE" && -s "$SKILL_FILE" ]]; then
  # Normalize skill names: "frame-standup:frame-standup" → "frame-standup"
  INVOKED_SKILLS=$(filter "$SKILL_FILE" | jq -r 'select(.event == "skill:invoked") | .skill | split(":")[0]' | sort -u || true)
  INVOKED_COUNT=$(echo "$INVOKED_SKILLS" | grep -c '[a-z]' 2>/dev/null || echo 0)
fi

# All-time invoked skills (for dead detection) — normalize colon-scoped names
EVER_INVOKED=""
if [[ -f "$SKILL_FILE" && -s "$SKILL_FILE" ]]; then
  EVER_INVOKED=$(filter_all "$SKILL_FILE" | jq -r 'select(.event == "skill:invoked") | .skill | split(":")[0]' | sort -u)
fi

# Suggestion funnel
SUGGESTIONS_GIVEN=0
SUGGESTIONS_FOLLOWED=0
if [[ -f "$SUGGESTION_FILE" && -s "$SUGGESTION_FILE" ]]; then
  SUGGESTIONS_GIVEN=$(filter "$SUGGESTION_FILE" | jq -r 'select(.event == "skill:suggested") | .ts' | wc -l | tr -d ' ')
fi
if [[ -f "$SKILL_FILE" && -s "$SKILL_FILE" ]]; then
  SUGGESTIONS_FOLLOWED=$(filter "$SKILL_FILE" | jq -r 'select(.event == "skill:suggestion-followed") | .ts' | wc -l | tr -d ' ')
fi
SUGGESTIONS_IGNORED=0
if [[ -f "$SUGGESTION_FILE" && -s "$SUGGESTION_FILE" ]]; then
  SUGGESTIONS_IGNORED=$(filter "$SUGGESTION_FILE" | jq -r 'select(.event == "skill:suggestion-ignored") | .ts' | wc -l | tr -d ' ')
fi
CONVERSION=0
if [[ "$SUGGESTIONS_GIVEN" -gt 0 ]]; then
  CONVERSION=$(( (SUGGESTIONS_FOLLOWED * 100) / SUGGESTIONS_GIVEN ))
fi

# Quality gate coverage
EDIT_SESSIONS=0
QUALITY_SESSIONS=0
if [[ -f "$TOOL_FILE" && -s "$TOOL_FILE" ]]; then
  EDIT_SESSIONS=$(filter "$TOOL_FILE" | jq -r 'select(.tool_name == "Edit" or .tool_name == "Write") | .session_id' | sort -u | grep -c '[a-z0-9]' 2>/dev/null || echo 0)
fi
QUALITY_SKILL_RE="validate|hardening|lint-audit|test-expand"
if [[ -f "$SKILL_FILE" && -s "$SKILL_FILE" ]]; then
  QUALITY_SESSIONS=$(filter "$SKILL_FILE" | jq -r "select(.event == \"skill:invoked\" and (.skill | test(\"$QUALITY_SKILL_RE\"))) | .session_id" | sort -u | grep -c '[a-z0-9]' 2>/dev/null || echo 0)
fi
# Clean up variables for arithmetic (strip any whitespace/newlines)
EDIT_SESSIONS=$(echo "$EDIT_SESSIONS" | tr -d '[:space:]')
QUALITY_SESSIONS=$(echo "$QUALITY_SESSIONS" | tr -d '[:space:]')
QUALITY_COVERAGE=100
if [[ "$EDIT_SESSIONS" -gt 0 ]]; then
  QUALITY_COVERAGE=$(( (QUALITY_SESSIONS * 100) / EDIT_SESSIONS ))
fi

# Per-repo skill usage
REPO_SKILL_BREAKDOWN=""
if [[ -f "$SKILL_FILE" && -s "$SKILL_FILE" ]]; then
  REPO_SKILL_BREAKDOWN=$(filter "$SKILL_FILE" | jq -r 'select(.event == "skill:invoked") | "\(.repo) /\(.skill)"' | sort | uniq -c | sort -rn)
fi

# PR skill comments
PR_COMMENTS=0
if [[ -f "$SKILL_FILE" && -s "$SKILL_FILE" ]]; then
  PR_COMMENTS=$(filter "$SKILL_FILE" | jq -r 'select(.event == "skill:pr-commented") | .ts' | wc -l | tr -d ' ')
fi

# Sessions
TOTAL_SESSIONS=0
if [[ -f "$SESSION_FILE" && -s "$SESSION_FILE" ]]; then
  TOTAL_SESSIONS=$(filter "$SESSION_FILE" | jq -r '.session_id' | sort -u | wc -l | tr -d ' ')
fi

# ── Dead skill detection ─────────────────────────────────────────────────────

DEAD_SKILLS=""
DORMANT_SKILLS=""
UNCATALOGUED_SKILLS=""

# Dead: in catalog but never invoked
while IFS= read -r skill; do
  [[ -z "$skill" ]] && continue
  if ! echo "$EVER_INVOKED" | grep -qx "$skill"; then
    DEAD_SKILLS="${DEAD_SKILLS}${skill}\n"
  fi
done <<< "$CATALOG_SKILLS"

# Uncatalogued: directory exists but not in catalog
while IFS= read -r skill; do
  [[ -z "$skill" ]] && continue
  if ! echo "$CATALOG_SKILLS" | grep -qx "$skill"; then
    UNCATALOGUED_SKILLS="${UNCATALOGUED_SKILLS}${skill}\n"
  fi
done <<< "$DIR_SKILLS"

DEAD_COUNT=$(echo -e "$DEAD_SKILLS" | grep -c '[a-z]' 2>/dev/null || echo 0)
UNCATALOGUED_COUNT=$(echo -e "$UNCATALOGUED_SKILLS" | grep -c '[a-z]' 2>/dev/null || echo 0)
ADOPTION_RATE=0
if [[ "$CATALOG_COUNT" -gt 0 ]]; then
  ADOPTION_RATE=$(( (INVOKED_COUNT * 100) / CATALOG_COUNT ))
fi

# ── Output ───────────────────────────────────────────────────────────────────

if [[ "$FORMAT" == "json" ]]; then
  jq -nc \
    --arg since "$SINCE" \
    --arg cutoff "$CUTOFF" \
    --argjson catalog_count "$CATALOG_COUNT" \
    --argjson dir_count "$DIR_COUNT" \
    --argjson invoked_count "$INVOKED_COUNT" \
    --argjson adoption_rate "$ADOPTION_RATE" \
    --argjson dead_count "$DEAD_COUNT" \
    --argjson uncatalogued_count "$UNCATALOGUED_COUNT" \
    --argjson suggestions_given "$SUGGESTIONS_GIVEN" \
    --argjson suggestions_followed "$SUGGESTIONS_FOLLOWED" \
    --argjson suggestions_ignored "$SUGGESTIONS_IGNORED" \
    --argjson conversion "$CONVERSION" \
    --argjson quality_coverage "$QUALITY_COVERAGE" \
    --argjson edit_sessions "$EDIT_SESSIONS" \
    --argjson quality_sessions "$QUALITY_SESSIONS" \
    --argjson pr_comments "$PR_COMMENTS" \
    --argjson total_sessions "$TOTAL_SESSIONS" \
    --argjson dead_skills "$(echo -e "$DEAD_SKILLS" | grep -v '^$' | jq -R . | jq -s .)" \
    --argjson invoked_skills "$(echo "$INVOKED_SKILLS" | grep -v '^$' | jq -R . | jq -s .)" \
    '{
      window: $since,
      cutoff: $cutoff,
      catalog_skills: $catalog_count,
      skill_directories: $dir_count,
      skills_invoked: $invoked_count,
      adoption_rate_pct: $adoption_rate,
      dead_skills: $dead_skills,
      dead_count: $dead_count,
      uncatalogued_count: $uncatalogued_count,
      invoked_skills: $invoked_skills,
      suggestions_given: $suggestions_given,
      suggestions_followed: $suggestions_followed,
      suggestions_ignored: $suggestions_ignored,
      suggestion_conversion_pct: $conversion,
      quality_coverage_pct: $quality_coverage,
      edit_sessions: $edit_sessions,
      quality_sessions: $quality_sessions,
      pr_skill_comments: $pr_comments,
      total_sessions: $total_sessions
    }'
  exit 0
fi

# Markdown output
echo "# Skill Adoption Report"
echo ""
echo "_Window: last $SINCE (since $CUTOFF)_"
echo ""

echo "## Adoption"
echo ""
echo "- **Catalog skills:** $CATALOG_COUNT"
echo "- **Skill directories:** $DIR_COUNT"
echo "- **Skills invoked (window):** $INVOKED_COUNT"
echo "- **Adoption rate:** ${ADOPTION_RATE}%"
echo "- **Sessions:** $TOTAL_SESSIONS"
echo ""

if [[ "$INVOKED_COUNT" -gt 0 ]]; then
  echo "### Skills used"
  echo ""
  echo "$INVOKED_SKILLS" | grep -v '^$' | while IFS= read -r skill; do
    echo "- \`/$skill\`"
  done
  echo ""
fi

echo "## Suggestion Funnel"
echo ""
echo "- **Suggestions offered:** $SUGGESTIONS_GIVEN"
echo "- **Suggestions followed:** $SUGGESTIONS_FOLLOWED"
echo "- **Suggestions ignored:** $SUGGESTIONS_IGNORED"
echo "- **Conversion rate:** ${CONVERSION}%"
echo ""

echo "## Quality Gate Coverage"
echo ""
echo "- **Edit sessions:** $EDIT_SESSIONS"
echo "- **Sessions with quality skills:** $QUALITY_SESSIONS"
echo "- **Coverage:** ${QUALITY_COVERAGE}%"
if [[ "$QUALITY_COVERAGE" -lt 50 && "$EDIT_SESSIONS" -gt 0 ]]; then
  echo "- **WARNING:** Quality coverage below 50%"
fi
echo ""

echo "## PR Skill Comments"
echo ""
echo "- **Comments posted:** $PR_COMMENTS"
echo ""

if [[ -n "$REPO_SKILL_BREAKDOWN" ]]; then
  echo "## Per-Repo Skill Usage"
  echo ""
  echo "$REPO_SKILL_BREAKDOWN" | awk '{printf "  %-4s %s\n", $1, $2" "$3}'
  echo ""
fi

echo "## Dead Skills ($DEAD_COUNT never invoked)"
echo ""
if [[ "$DEAD_COUNT" -gt 0 ]]; then
  echo -e "$DEAD_SKILLS" | grep -v '^$' | while IFS= read -r skill; do
    echo "- \`/$skill\`"
  done
else
  echo "_All catalog skills have been invoked at least once._"
fi
echo ""

if [[ "$UNCATALOGUED_COUNT" -gt 0 ]]; then
  echo "## Uncatalogued Skills ($UNCATALOGUED_COUNT directories without catalog entries)"
  echo ""
  echo -e "$UNCATALOGUED_SKILLS" | grep -v '^$' | while IFS= read -r skill; do
    echo "- \`/$skill\`"
  done
  echo ""
fi

echo "---"
echo "_Generated by [generate-skill-report](https://github.com/ojfbot/core/blob/main/scripts/generate-skill-report.sh) at $(date -u +"%Y-%m-%dT%H:%M:%SZ")_"
