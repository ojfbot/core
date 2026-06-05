#!/usr/bin/env bash
# adr-slugs.sh — read-only resolver for the /adr skill (ADR-0087).
# Prints one row per ADR (and draft): slug <TAB> serial <TAB> file
# Used by every /adr mode to resolve slug <-> serial <-> file uniformly,
# and to uniqueness-check a new slug / lint trace targets.
#
# Usage:
#   scripts/adr-slugs.sh [adr-dir]      # default dir: decisions/adr relative to repo root
set -u

# Resolve the ADR dir: explicit arg, else walk up to a decisions/adr.
ADR_DIR="${1:-}"
if [ -z "$ADR_DIR" ]; then
  d=$(pwd)
  while [ "$d" != "/" ]; do
    [ -d "$d/decisions/adr" ] && { ADR_DIR="$d/decisions/adr"; break; }
    d=$(dirname "$d")
  done
fi
[ -z "$ADR_DIR" ] && ADR_DIR="decisions/adr"

if [ ! -d "$ADR_DIR" ]; then
  echo "adr-slugs: not found: $ADR_DIR" >&2
  exit 2
fi

for f in "$ADR_DIR"/[0-9]*.md "$ADR_DIR"/draft-*.md; do
  [ -e "$f" ] || continue
  # slug/serial come from frontmatter if present, else inferred from filename.
  slug=$(grep -m1 '^slug:' "$f" 2>/dev/null | sed 's/^slug:[[:space:]]*//')
  serial=$(grep -m1 '^serial:' "$f" 2>/dev/null | sed 's/^serial:[[:space:]]*//')
  base=$(basename "$f" .md)
  if [ -z "$slug" ]; then slug=$(printf '%s' "$base" | sed -E 's/^[0-9]{4}-//; s/^draft-//'); fi
  if [ -z "$serial" ]; then
    case "$base" in draft-*) serial="draft";; *) serial=$(printf '%s' "$base" | grep -oE '^[0-9]{4}');; esac
  fi
  printf '%s\t%s\t%s\n' "$slug" "$serial" "$f"
done
