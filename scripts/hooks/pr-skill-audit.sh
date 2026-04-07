#!/usr/bin/env bash
# pr-skill-audit.sh — PR skill usage analysis
#
# Two modes:
#   --mode=local      Read ~/.claude/skill-telemetry.jsonl for actual skill usage
#   --mode=heuristic  Analyze PR diff to suggest skills that should have been used
#
# Usage:
#   bash scripts/hooks/pr-skill-audit.sh --pr=48
#   bash scripts/hooks/pr-skill-audit.sh --pr=48 --mode=heuristic
#   bash scripts/hooks/pr-skill-audit.sh --pr=48 --mode=local
set -euo pipefail

# Defaults
MODE="both"
PR_NUMBER=""
REPORT_FILE="/tmp/skill-audit-report.md"
TELEMETRY_FILE="${HOME}/.claude/skill-telemetry.jsonl"

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --pr=*) PR_NUMBER="${arg#*=}" ;;
    --mode=*) MODE="${arg#*=}" ;;
  esac
done

if [[ -z "$PR_NUMBER" ]]; then
  echo "Usage: pr-skill-audit.sh --pr=<number> [--mode=local|heuristic|both]" >&2
  exit 1
fi

# Detect repo name
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")

# ─── Heuristic analysis ──────────────────────────────────────────────────────

heuristic_audit() {
  local diff_stat
  diff_stat=$(gh pr diff "$PR_NUMBER" --stat 2>/dev/null || echo "")
  local pr_body
  pr_body=$(gh pr view "$PR_NUMBER" --json body -q '.body' 2>/dev/null || echo "")
  local pr_title
  pr_title=$(gh pr view "$PR_NUMBER" --json title -q '.title' 2>/dev/null || echo "")
  local files_changed
  files_changed=$(gh pr diff "$PR_NUMBER" --name-only 2>/dev/null || echo "")
  local lines_changed
  lines_changed=$(echo "$diff_stat" | tail -1 | grep -oE '[0-9]+ insertion|[0-9]+ deletion' | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || echo "0")

  SUGGESTED_SKILLS=()
  REASONS=()

  # Rule: CI/CD files changed
  if echo "$files_changed" | grep -q '\.github/workflows/'; then
    SUGGESTED_SKILLS+=("/setup-ci-cd")
    REASONS+=("CI workflow files modified")
  fi

  # Rule: test files changed
  if echo "$files_changed" | grep -qE '__tests__|\.test\.(ts|tsx|js)'; then
    SUGGESTED_SKILLS+=("/test-expand")
    REASONS+=("Test files modified — verify coverage gaps")
  fi

  # Rule: docs changed
  if echo "$files_changed" | grep -qiE 'README|docs/|CLAUDE\.md'; then
    SUGGESTED_SKILLS+=("/doc-refactor")
    REASONS+=("Documentation files modified")
  fi

  # Rule: ADR files changed
  if echo "$files_changed" | grep -q 'decisions/adr/'; then
    SUGGESTED_SKILLS+=("/adr")
    REASONS+=("ADR files modified — verify completeness")
  fi

  # Rule: large changeset
  if [[ "$lines_changed" -gt 500 ]]; then
    SUGGESTED_SKILLS+=("/validate")
    REASONS+=("Large changeset ($lines_changed lines) — quality gate recommended")
  fi

  # Rule: dependency changes
  if echo "$files_changed" | grep -qE 'package\.json|pnpm-lock\.yaml'; then
    SUGGESTED_SKILLS+=("/hardening")
    REASONS+=("Dependencies modified — security review recommended")
  fi

  # Rule: deploy/release in PR description
  if echo "$pr_title $pr_body" | grep -qi 'deploy\|release\|ship'; then
    SUGGESTED_SKILLS+=("/deploy")
    REASONS+=("PR references deployment/release")
  fi

  # Rule: bug fix or debugging
  if echo "$pr_title $pr_body" | grep -qi 'fix\|bug\|debug\|error'; then
    SUGGESTED_SKILLS+=("/investigate")
    REASONS+=("PR references bug fix — was root cause analyzed?")
  fi

  # Rule: new source files (not tests)
  if echo "$files_changed" | grep -qE 'src/.*\.(ts|tsx)$' && ! echo "$files_changed" | grep -qE '__tests__'; then
    SUGGESTED_SKILLS+=("/validate")
    REASONS+=("New source files — quality gate recommended")
  fi

  # Rule: security-sensitive files
  if echo "$files_changed" | grep -qiE 'auth|security|middleware|permission'; then
    SUGGESTED_SKILLS+=("/hardening")
    REASONS+=("Security-sensitive files modified")
  fi

  # Rule: ESLint config or plugin changes
  if echo "$files_changed" | grep -qE 'eslint|lint'; then
    SUGGESTED_SKILLS+=("/lint-audit")
    REASONS+=("ESLint configuration or rules modified — verify with lint audit")
  fi

  # Rule: schema/model changes without test updates
  if echo "$files_changed" | grep -qE 'models/|schemas/' && ! echo "$files_changed" | grep -qE '\.test\.|\.spec\.|__tests__'; then
    SUGGESTED_SKILLS+=("/test-expand")
    REASONS+=("Schema/model files changed without corresponding test updates")
  fi

  # Rule: TECHDEBT.md modified — verify proposed fixes
  if echo "$files_changed" | grep -q 'TECHDEBT.md'; then
    SUGGESTED_SKILLS+=("/techdebt")
    REASONS+=("TECHDEBT.md modified — verify debt items are properly tracked")
  fi
}

# ─── Local telemetry analysis ────────────────────────────────────────────────

local_audit() {
  USED_SKILLS=()

  if [[ ! -f "$TELEMETRY_FILE" ]]; then
    return
  fi

  # Get PR creation time range from commits
  local first_commit_ts
  first_commit_ts=$(gh pr view "$PR_NUMBER" --json commits -q '.commits[0].committedDate' 2>/dev/null || echo "")
  local last_commit_ts
  last_commit_ts=$(gh pr view "$PR_NUMBER" --json commits -q '.commits[-1].committedDate' 2>/dev/null || echo "")

  if [[ -z "$first_commit_ts" || -z "$last_commit_ts" ]]; then
    return
  fi

  # Filter telemetry for this repo within the commit time range
  # Widen window: 1 day before first commit to 1 hour after last commit
  while IFS= read -r line; do
    skill=$(echo "$line" | jq -r '.skill // empty')
    if [[ -n "$skill" ]]; then
      USED_SKILLS+=("/$skill")
    fi
  done < <(jq -c --arg repo "$REPO" --arg from "$first_commit_ts" --arg to "$last_commit_ts" \
    'select(.repo == $repo and .ts >= $from and .ts <= $to)' \
    "$TELEMETRY_FILE" 2>/dev/null || true)

  # Deduplicate
  if [[ ${#USED_SKILLS[@]} -gt 0 ]]; then
    USED_SKILLS=($(printf '%s\n' "${USED_SKILLS[@]}" | sort -u))
  fi
}

# ─── Generate report ─────────────────────────────────────────────────────────

generate_report() {
  {
    echo "## Skill Audit — PR #${PR_NUMBER}"
    echo ""

    if [[ "$MODE" == "local" || "$MODE" == "both" ]]; then
      echo "### Skills used during development"
      echo ""
      if [[ ${#USED_SKILLS[@]} -gt 0 ]]; then
        for skill in "${USED_SKILLS[@]}"; do
          echo "- \`$skill\`"
        done
      else
        echo "_No skill telemetry found for this PR's time range._"
      fi
      echo ""
    fi

    if [[ "$MODE" == "heuristic" || "$MODE" == "both" ]]; then
      echo "### Recommended skills (based on diff analysis)"
      echo ""
      if [[ ${#SUGGESTED_SKILLS[@]} -gt 0 ]]; then
        for i in "${!SUGGESTED_SKILLS[@]}"; do
          echo "- \`${SUGGESTED_SKILLS[$i]}\` — ${REASONS[$i]}"
        done
      else
        echo "_No skill suggestions for this changeset._"
      fi
      echo ""
    fi

    if [[ "$MODE" == "both" && ${#SUGGESTED_SKILLS[@]} -gt 0 && ${#USED_SKILLS[@]} -ge 0 ]]; then
      echo "### Missed opportunities"
      echo ""
      local missed=0
      for suggested in "${SUGGESTED_SKILLS[@]}"; do
        local found=false
        for used in "${USED_SKILLS[@]}"; do
          if [[ "$suggested" == "$used" ]]; then
            found=true
            break
          fi
        done
        if [[ "$found" == "false" ]]; then
          echo "- \`$suggested\` was not used but is recommended"
          missed=$((missed + 1))
        fi
      done
      if [[ $missed -eq 0 ]]; then
        echo "_All recommended skills were used._"
      fi
      echo ""
    fi

    echo "---"
    echo "_Generated by [skill-audit](https://github.com/ojfbot/core/blob/main/scripts/hooks/pr-skill-audit.sh)_"
  } > "$REPORT_FILE"

  cat "$REPORT_FILE"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

SUGGESTED_SKILLS=()
REASONS=()
USED_SKILLS=()

case "$MODE" in
  local)
    local_audit
    ;;
  heuristic)
    heuristic_audit
    ;;
  both)
    heuristic_audit
    local_audit
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 1
    ;;
esac

generate_report
