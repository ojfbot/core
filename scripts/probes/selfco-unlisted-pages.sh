#!/bin/sh
# selfco-unlisted-pages.sh — count wiki pages not listed in index.md.
#
# truth_probe for defect `selfco-index-reachability-invariant`. Lives here rather than
# inline in the defect frontmatter because the comparison needs two sorted sets, and
# process substitution `<(...)` is bash-only — `defects-lint.mjs --sweep` runs probes
# under `sh -c`, where it is a syntax error. An inline probe that silently fails is worse
# than no probe, so anything beyond a one-liner belongs in a file.
#
# Distinct from lint.py's orphan check: that counts inbound links from ANYWHERE, so a page
# linked only by a sibling passes. This counts index membership specifically, which is
# what CLAUDE.md:106 and index.md:7 actually assert.
set -eu

VAULT="${SELFCO_VAULT:-$HOME/selfco}"
WIKI="$VAULT/wiki"
[ -d "$WIKI" ] || { echo "no wiki at $WIKI" >&2; exit 2; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Every page slug in the four content folders.
find "$WIKI/sources" "$WIKI/entities" "$WIKI/concepts" "$WIKI/synthesis" \
  -name '*.md' -type f 2>/dev/null \
  | sed 's|.*/||; s|\.md$||' | sort -u > "$TMP/pages"

# Every wikilink target named in index.md, folder prefix stripped so `[[sources/foo]]`
# and `[[foo]]` both resolve to `foo`.
grep -oE '\[\[[^]|#]+' "$WIKI/index.md" \
  | sed 's|^\[\[||; s|.*/||' | sort -u > "$TMP/listed"

comm -23 "$TMP/pages" "$TMP/listed" | wc -l | tr -d ' '
