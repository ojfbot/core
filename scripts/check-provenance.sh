#!/usr/bin/env bash
# check-provenance.sh — verify Provenance SHAs in core/decisions/adr/*.md
#
# ADR-0065 contract:
#   Walk every ADR in decisions/adr/, parse its Provenance table, and verify
#   that each non-`_pending_` SHA exists in the matching rig's git history.
#   A Provenance SHA that does not resolve fails the check.
#
# Cross-rig handling:
#   When an ADR's `Repos affected:` frontmatter line names any rig other than
#   `core`, unresolvable SHAs are warnings (the script can't see other rigs'
#   git history). Otherwise unresolvable SHAs are errors.
#
# Bash 3.2 compatible (macOS default): no associative arrays, no `mapfile`,
# no `local` outside functions.
#
# Exit codes:
#   0 = all core-side SHAs resolved (warnings allowed)
#   1 = at least one core-only ADR has an unresolvable Provenance SHA
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

# Counters live as plain integers; bash 3.2 has no associative arrays.
TOTAL_ADRS=0
TOTAL_SHAS=0
TOTAL_RESOLVED=0
TOTAL_SKIPPED=0
TOTAL_NO_PROVENANCE=0
TOTAL_WARNINGS=0
TOTAL_ERRORS=0
VERBOSE=${CHECK_PROVENANCE_VERBOSE:-0}

# Returns 0 if "Repos affected:" mentions any rig other than core, else 1.
# Reads the frontmatter (lines before the first `---` separator or the first
# blank line followed by `## `) — for ADR format we just scan the whole top.
adr_has_non_core_rig() {
  # $1 = path to ADR
  awk '
    /^Repos affected:/ {
      line = $0
      sub(/^Repos affected:[[:space:]]*/, "", line)
      # Replace parenthesized clauses with single space so `core (foo, bar)`
      # collapses to `core`.
      gsub(/\([^)]*\)/, "", line)
      # Split on commas.
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

# Print the Provenance section (lines from `## Provenance` up to but not
# including the next `## ` heading or end of file).
extract_provenance_section() {
  # $1 = path to ADR
  awk '
    /^## Provenance/ { in_section = 1; print; next }
    in_section && /^## / { exit }
    in_section { print }
  ' "$1"
}

# Extract SHA-like tokens (7-40 lowercase hex chars) from stdin. The regex
# uses word boundaries so PR numbers like `#100` and dates like `2026-04-30`
# do not match.
extract_sha_candidates() {
  # macOS grep supports -E and -o; -w would over-match because backticks
  # are not word boundaries. Use a manual pre-pass to drop backticks and
  # other punctuation first.
  tr -c 'a-zA-Z0-9' '\n' | grep -E '^[0-9a-f]{7,40}$' | sort -u
}

# Sanity check: a token must be ALL lowercase hex AND contain at least one
# letter or be at least 7 hex digits — already guaranteed by the regex.
# Reject tokens that are obvious non-SHA hex (e.g. version-component-like).
# In practice the regex `^[0-9a-f]{7,40}$` already excludes things like
# `1.0.0` and `2026-04-30`; nothing more to filter.

run_check() {
  ADR_PATH="$1"
  ADR_BASENAME=$(basename "$ADR_PATH")

  # Skip the template.
  case "$ADR_BASENAME" in
    template.md) return 0 ;;
  esac

  TOTAL_ADRS=$((TOTAL_ADRS + 1))

  RIG_MODE=$(adr_has_non_core_rig "$ADR_PATH")
  if [ -z "$RIG_MODE" ]; then
    # No `Repos affected:` line found. Treat as core-only (strict).
    RIG_MODE="core-only"
  fi

  PROV_SECTION=$(extract_provenance_section "$ADR_PATH")
  if [ -z "$PROV_SECTION" ]; then
    # ADRs predating ADR-0065 have no Provenance section. The convention is
    # forward-going (per ADR-0065 Acceptance criteria), so treat as a
    # silent skip; surface only in verbose mode.
    TOTAL_NO_PROVENANCE=$((TOTAL_NO_PROVENANCE + 1))
    if [ "$VERBOSE" = "1" ]; then
      echo "INFO  $ADR_BASENAME: no Provenance section (predates ADR-0065)"
    fi
    return 0
  fi

  # Strip the heading itself; we only want table/body lines.
  TABLE_BODY=$(printf '%s\n' "$PROV_SECTION" | tail -n +2)

  # Quick skip: if the entire section is `_pending_` markers with no SHAs,
  # extract_sha_candidates returns empty.
  CANDIDATES=$(printf '%s\n' "$TABLE_BODY" | extract_sha_candidates)

  if [ -z "$CANDIDATES" ]; then
    echo "OK    $ADR_BASENAME: no SHAs to verify (all _pending_ or non-applicable)"
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
    return 0
  fi

  ADR_HAD_ERROR=0
  ADR_HAD_WARNING=0

  for sha in $CANDIDATES; do
    TOTAL_SHAS=$((TOTAL_SHAS + 1))
    if git -C "$REPO_ROOT" cat-file -e "${sha}^{commit}" 2>/dev/null; then
      TOTAL_RESOLVED=$((TOTAL_RESOLVED + 1))
      continue
    fi

    if [ "$RIG_MODE" = "non-core" ]; then
      echo "WARN  $ADR_BASENAME: SHA $sha not found in core/ (cross-rig — Repos affected names non-core rigs)"
      TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
      ADR_HAD_WARNING=1
    else
      echo "ERROR $ADR_BASENAME: SHA $sha does not resolve in core/ (Repos affected: core only)"
      TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
      ADR_HAD_ERROR=1
    fi
  done

  if [ "$ADR_HAD_ERROR" = "0" ] && [ "$ADR_HAD_WARNING" = "0" ]; then
    SHA_COUNT=$(printf '%s\n' "$CANDIDATES" | wc -l | tr -d '[:space:]')
    echo "OK    $ADR_BASENAME: $SHA_COUNT SHA(s) resolved"
  fi
}

echo "check-provenance: scanning $ADR_DIR"
echo "check-provenance: repo root $REPO_ROOT"
echo ""

# `for f in "$DIR"/*` keeps bash 3.2 happy and globs deterministically.
for adr_file in "$ADR_DIR"/*.md; do
  [ -f "$adr_file" ] || continue
  run_check "$adr_file"
done

echo ""
echo "check-provenance: summary"
echo "  ADRs scanned          : $TOTAL_ADRS"
echo "  ADRs without Provenance: $TOTAL_NO_PROVENANCE (predate ADR-0065; skipped)"
echo "  ADRs with no SHAs     : $TOTAL_SKIPPED (all _pending_ or non-applicable)"
echo "  SHAs verified         : $TOTAL_SHAS"
echo "  resolved              : $TOTAL_RESOLVED"
echo "  warnings              : $TOTAL_WARNINGS (cross-rig SHAs not present in core/)"
echo "  errors                : $TOTAL_ERRORS (core-only ADRs with unresolved SHAs)"

if [ "$TOTAL_ERRORS" -gt 0 ]; then
  echo ""
  echo "check-provenance: FAILED — $TOTAL_ERRORS unresolved SHA(s) in core-only ADRs"
  exit 1
fi

echo ""
echo "check-provenance: PASSED"
exit 0
