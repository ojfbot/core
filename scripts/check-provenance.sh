#!/usr/bin/env bash
# check-provenance.sh — verify Provenance SHAs in core/decisions/adr/*.md
#
# ADR-0065 contract:
#   Walk every ADR in decisions/adr/, parse its Provenance table, and verify
#   that each non-`_pending_` SHA exists in the matching rig's git history.
#   A Provenance SHA that does not resolve fails the check.
#
# Severity tiers (refines the contract for the rebase-merge reality):
#
#   ERROR   — unresolved SHA in a row whose field name is "implementation
#             start", "implementation end", "inspection commit", or
#             "notable follow-up", AND `Repos affected:` lists only core.
#             These are the SHAs that MUST land on main; if they don't
#             resolve, somebody typo'd or the merge strategy lost them.
#
#   WARN    — unresolved SHA in a "zero-point" or "parent" row (these can
#             legitimately disappear from main's ancestry after a `--rebase`
#             merge, per ADR-0056's PR #100 notes); OR any unresolved SHA
#             in an ADR whose `Repos affected:` names a non-core rig (the
#             script can't see other rigs' git history).
#
#   OK      — SHA resolves via `git cat-file -e <sha>^{commit}`.
#
# Bash 3.2 compatible (macOS default): no associative arrays, no `mapfile`,
# no `local` outside functions.
#
# Exit codes:
#   0 = no errors (warnings allowed)
#   1 = at least one ERROR (typo'd or lost SHA in a strict row)
#   2 = invocation / environment problem

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ADR_DIR="$REPO_ROOT/decisions/adr"

if [ ! -d "$ADR_DIR" ]; then
  echo "check-provenance: ADR directory not found: $ADR_DIR" >&2
  exit 2
fi

if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "check-provenance: $REPO_ROOT is not a git repo" >&2
  exit 2
fi

TOTAL_ADRS=0
TOTAL_SHAS=0
TOTAL_RESOLVED=0
TOTAL_SKIPPED=0
TOTAL_NO_PROVENANCE=0
TOTAL_WARNINGS=0
TOTAL_ERRORS=0
VERBOSE=${CHECK_PROVENANCE_VERBOSE:-0}

# Returns "non-core" if `Repos affected:` mentions any rig other than core,
# else "core-only". Empty if no such line.
adr_has_non_core_rig() {
  awk '
    /^Repos affected:/ {
      line = $0
      sub(/^Repos affected:[[:space:]]*/, "", line)
      gsub(/\([^)]*\)/, "", line)
      n = split(line, parts, ",")
      for (i = 1; i <= n; i++) {
        token = parts[i]
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", token)
        if (token == "") continue
        if (token != "core") {
          print "non-core"
          exit
        }
      }
      print "core-only"
      exit
    }
  ' "$1"
}

# Print every Provenance-table row (lines starting with `|`) between the
# `## Provenance` heading and the next `## ` heading. Skips the header
# row (`| Field | Value |`) and the separator (`| --- | --- |`).
extract_provenance_rows() {
  awk '
    /^## Provenance/ { in_section = 1; next }
    in_section && /^## / { exit }
    in_section && /^\|/ {
      if ($0 ~ /^\|[[:space:]]*Field[[:space:]]*\|/) next
      if ($0 ~ /^\|[[:space:]]*-+[[:space:]]*\|/) next
      print
    }
  ' "$1"
}

# From a single row, extract the field name (first cell), lowercase, with
# leading `|` and surrounding whitespace stripped.
row_field_name() {
  printf '%s' "$1" | awk -F'\\|' '{
    name = $2
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
    print tolower(name)
  }'
}

# Extract SHA-like tokens (7-40 lowercase hex chars) from stdin.
extract_sha_candidates() {
  tr -c 'a-zA-Z0-9' '\n' | grep -E '^[0-9a-f]{7,40}$' | sort -u
}

# Classify a row by its field name. Returns "strict" or "documentary".
# Strict rows MUST resolve in core's history (assuming Repos affected is
# core-only). Documentary rows are pre-rebase / parent / cross-reference
# pointers that may legitimately not survive a `--rebase` merge.
row_severity_class() {
  case "$1" in
    *"implementation start"*|*"implementation end"*) echo "strict" ;;
    *"inspection commit"*|*"notable follow-up"*)     echo "strict" ;;
    *"merge commit"*)                                echo "strict" ;;
    *"zero-point"*|*"parent"*)                       echo "documentary" ;;
    *"originally drafted"*|*"first adr"*)            echo "documentary" ;;
    *"master"*|*"manifest"*|*"renderer"*)            echo "documentary" ;;
    *"source-of-truth"*|*"slice branch"*)            echo "documentary" ;;
    *"schema version"*|*"version"*)                  echo "documentary" ;;
    *"ci check"*|*"convoy"*|*"pr"*)                  echo "documentary" ;;
    *)                                               echo "documentary" ;;
  esac
}

run_check() {
  ADR_PATH="$1"
  ADR_BASENAME=$(basename "$ADR_PATH")

  case "$ADR_BASENAME" in
    template.md) return 0 ;;
  esac

  TOTAL_ADRS=$((TOTAL_ADRS + 1))

  RIG_MODE=$(adr_has_non_core_rig "$ADR_PATH")
  if [ -z "$RIG_MODE" ]; then
    RIG_MODE="core-only"
  fi

  ROWS=$(extract_provenance_rows "$ADR_PATH")
  if [ -z "$ROWS" ]; then
    TOTAL_NO_PROVENANCE=$((TOTAL_NO_PROVENANCE + 1))
    if [ "$VERBOSE" = "1" ]; then
      echo "INFO  $ADR_BASENAME: no Provenance section (predates ADR-0065)"
    fi
    return 0
  fi

  ADR_HAD_ERROR=0
  ADR_HAD_WARNING=0
  ADR_RESOLVED_COUNT=0

  # Iterate row-by-row. Use IFS=newline so each row stays one line.
  OLD_IFS="$IFS"
  IFS='
'
  for row in $ROWS; do
    IFS="$OLD_IFS"
    FIELD=$(row_field_name "$row")
    SEVERITY=$(row_severity_class "$FIELD")

    # SHA candidates from the value cells of this row.
    ROW_SHAS=$(printf '%s' "$row" | extract_sha_candidates)
    [ -z "$ROW_SHAS" ] && { IFS='
'; continue; }

    for sha in $ROW_SHAS; do
      TOTAL_SHAS=$((TOTAL_SHAS + 1))
      if git -C "$REPO_ROOT" cat-file -e "${sha}^{commit}" 2>/dev/null; then
        TOTAL_RESOLVED=$((TOTAL_RESOLVED + 1))
        ADR_RESOLVED_COUNT=$((ADR_RESOLVED_COUNT + 1))
        continue
      fi

      # Unresolved. Decide severity.
      if [ "$RIG_MODE" = "non-core" ]; then
        echo "WARN  $ADR_BASENAME [$FIELD]: SHA $sha not in core/ (cross-rig)"
        TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
        ADR_HAD_WARNING=1
      elif [ "$SEVERITY" = "documentary" ]; then
        echo "WARN  $ADR_BASENAME [$FIELD]: SHA $sha not in core/ (documentary row — may be pre-rebase)"
        TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
        ADR_HAD_WARNING=1
      else
        echo "ERROR $ADR_BASENAME [$FIELD]: SHA $sha does not resolve in core/"
        TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
        ADR_HAD_ERROR=1
      fi
    done
    IFS='
'
  done
  IFS="$OLD_IFS"

  if [ "$ADR_HAD_ERROR" = "0" ] && [ "$ADR_HAD_WARNING" = "0" ]; then
    echo "OK    $ADR_BASENAME: $ADR_RESOLVED_COUNT SHA(s) resolved"
  elif [ "$ADR_HAD_ERROR" = "0" ]; then
    echo "OK    $ADR_BASENAME: $ADR_RESOLVED_COUNT SHA(s) resolved (with warnings above)"
  fi
}

echo "check-provenance: scanning $ADR_DIR"
echo "check-provenance: repo root $REPO_ROOT"
echo ""

for adr_file in "$ADR_DIR"/*.md; do
  [ -f "$adr_file" ] || continue
  run_check "$adr_file"
done

echo ""
echo "check-provenance: summary"
echo "  ADRs scanned           : $TOTAL_ADRS"
echo "  ADRs without Provenance: $TOTAL_NO_PROVENANCE (predate ADR-0065; skipped)"
echo "  SHAs verified          : $TOTAL_SHAS"
echo "  resolved               : $TOTAL_RESOLVED"
echo "  warnings               : $TOTAL_WARNINGS (documentary or cross-rig)"
echo "  errors                 : $TOTAL_ERRORS (strict rows in core-only ADRs)"

if [ "$TOTAL_ERRORS" -gt 0 ]; then
  echo ""
  echo "check-provenance: FAILED — $TOTAL_ERRORS unresolved SHA(s) in strict rows"
  exit 1
fi

echo ""
echo "check-provenance: PASSED"
exit 0
