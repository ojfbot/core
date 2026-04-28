#!/usr/bin/env bash
# heuristic-analysis.sh — Shared heuristic skill recommendation engine
#
# Analyzes changed files, PR title/body, and changeset size to recommend
# skills with tiered urgency:
#   Tier 1 (required)     — quality gates for large/sensitive changes
#   Tier 2 (recommended)  — contextual skills for specific file patterns
#   Tier 3 (passive)      — nice-to-have suggestions
#
# Usage (source, don't execute):
#   source "$HOOK_DIR/heuristic-analysis.sh"
#   heuristic_audit "$files_changed" "$pr_title" "$pr_body" "$lines_changed"
#   # Sets: SUGGESTED_SKILLS[], REASONS[], TIERS[]

# Guard against double-sourcing
[[ -n "${_HEURISTIC_ANALYSIS_LOADED:-}" ]] && return 0
_HEURISTIC_ANALYSIS_LOADED=1

# heuristic_audit — analyze changeset and populate suggestion arrays
#
# Args:
#   $1 = files_changed (newline-delimited list of file paths)
#   $2 = pr_title (or commit subject)
#   $3 = pr_body (or empty string)
#   $4 = lines_changed (integer, total insertions + deletions)
#
# Sets globals:
#   SUGGESTED_SKILLS[] — skill names (e.g. "/validate")
#   REASONS[]          — human-readable reason for each suggestion
#   TIERS[]            — 1, 2, or 3 for each suggestion
heuristic_audit() {
  local files_changed="$1"
  local pr_title="${2:-}"
  local pr_body="${3:-}"
  local lines_changed="${4:-0}"

  SUGGESTED_SKILLS=()
  REASONS=()
  TIERS=()

  # Rule: CI/CD files changed
  if echo "$files_changed" | grep -q '\.github/workflows/'; then
    SUGGESTED_SKILLS+=("/setup-ci-cd")
    REASONS+=("CI workflow files modified")
    TIERS+=(3)
  fi

  # Rule: test files changed
  if echo "$files_changed" | grep -qE '__tests__|\.test\.(ts|tsx|js)'; then
    SUGGESTED_SKILLS+=("/test-expand")
    REASONS+=("Test files modified — verify coverage gaps")
    TIERS+=(2)
  fi

  # Rule: docs changed
  if echo "$files_changed" | grep -qiE 'README|docs/|CLAUDE\.md'; then
    SUGGESTED_SKILLS+=("/doc-refactor")
    REASONS+=("Documentation files modified")
    TIERS+=(3)
  fi

  # Rule: ADR files changed
  if echo "$files_changed" | grep -q 'decisions/adr/'; then
    SUGGESTED_SKILLS+=("/adr")
    REASONS+=("ADR files modified — verify completeness")
    TIERS+=(3)
  fi

  # Rule: large changeset
  if [[ "$lines_changed" -gt 500 ]]; then
    SUGGESTED_SKILLS+=("/validate")
    REASONS+=("Large changeset ($lines_changed lines) — quality gate required")
    TIERS+=(1)
  fi

  # Rule: dependency changes
  if echo "$files_changed" | grep -qE 'package\.json|pnpm-lock\.yaml'; then
    SUGGESTED_SKILLS+=("/hardening")
    REASONS+=("Dependencies modified — security review required")
    TIERS+=(1)
  fi

  # Rule: deploy/release in PR description
  if echo "$pr_title $pr_body" | grep -qi 'deploy\|release\|ship'; then
    SUGGESTED_SKILLS+=("/deploy")
    REASONS+=("PR references deployment/release")
    TIERS+=(3)
  fi

  # Rule: bug fix or debugging
  if echo "$pr_title $pr_body" | grep -qi 'fix\|bug\|debug\|error'; then
    SUGGESTED_SKILLS+=("/investigate")
    REASONS+=("PR references bug fix — was root cause analyzed?")
    TIERS+=(3)
  fi

  # Rule: new source files (not tests)
  if echo "$files_changed" | grep -qE 'src/.*\.(ts|tsx)$' && ! echo "$files_changed" | grep -qE '__tests__'; then
    # Only tier 1 if not already suggested by large changeset rule
    local already_has_validate=false
    for s in "${SUGGESTED_SKILLS[@]:-}"; do
      [[ "$s" == "/validate" ]] && already_has_validate=true && break
    done
    if [[ "$already_has_validate" == "false" ]]; then
      SUGGESTED_SKILLS+=("/validate")
      REASONS+=("New source files — quality gate recommended")
      TIERS+=(2)
    fi
  fi

  # Rule: security-sensitive files
  if echo "$files_changed" | grep -qiE 'auth|security|middleware|permission'; then
    # Only add if not already suggested by dependency rule
    local already_has_hardening=false
    for s in "${SUGGESTED_SKILLS[@]:-}"; do
      [[ "$s" == "/hardening" ]] && already_has_hardening=true && break
    done
    if [[ "$already_has_hardening" == "false" ]]; then
      SUGGESTED_SKILLS+=("/hardening")
      REASONS+=("Security-sensitive files modified")
      TIERS+=(1)
    fi
  fi

  # Rule: ESLint config or plugin changes
  if echo "$files_changed" | grep -qE 'eslint|lint'; then
    SUGGESTED_SKILLS+=("/lint-audit")
    REASONS+=("ESLint configuration or rules modified — verify with lint audit")
    TIERS+=(2)
  fi

  # Rule: schema/model changes without test updates
  if echo "$files_changed" | grep -qE 'models/|schemas/' && ! echo "$files_changed" | grep -qE '\.test\.|\.spec\.|__tests__'; then
    SUGGESTED_SKILLS+=("/test-expand")
    REASONS+=("Schema/model files changed without corresponding test updates")
    TIERS+=(2)
  fi

  # Rule: TECHDEBT.md modified
  if echo "$files_changed" | grep -q 'TECHDEBT.md'; then
    SUGGESTED_SKILLS+=("/techdebt")
    REASONS+=("TECHDEBT.md modified — verify debt items are properly tracked")
    TIERS+=(3)
  fi

  # Rule: CONTEXT.md drift — ADR added without CONTEXT.md update (Pocock skills, ADR-0044)
  if echo "$files_changed" | grep -q 'decisions/adr/' && ! echo "$files_changed" | grep -q 'domain-knowledge/CONTEXT\.md'; then
    SUGGESTED_SKILLS+=("/grill-with-docs")
    REASONS+=("ADR added without CONTEXT.md update — likely new term needs definition")
    TIERS+=(1)
  fi

  # Rule: shallow-module sprawl — many new files added (Pocock /deepen, ADR-0047)
  local new_ts_files
  new_ts_files=$(echo "$files_changed" | grep -cE '\.tsx?$' || true)
  if [[ "$new_ts_files" -gt 5 ]]; then
    SUGGESTED_SKILLS+=("/deepen")
    REASONS+=("$new_ts_files TypeScript files changed — depth audit recommended")
    TIERS+=(2)
  fi

  # Rule: source changes without tests — TDD opportunity missed (Pocock /tdd, ADR-0046)
  if echo "$files_changed" | grep -qE 'src/.*\.(ts|tsx)$' && ! echo "$files_changed" | grep -qE '\.(test|spec)\.(ts|tsx)$|__tests__'; then
    SUGGESTED_SKILLS+=("/tdd")
    REASONS+=("Source-only change without tests — TDD opportunity")
    TIERS+=(3)
  fi
}

# tier_label — convert tier number to human-readable label
tier_label() {
  case "$1" in
    1) echo "required" ;;
    2) echo "recommended" ;;
    3) echo "suggestion" ;;
    *) echo "suggestion" ;;
  esac
}
