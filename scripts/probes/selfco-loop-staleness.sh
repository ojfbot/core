#!/bin/sh
# selfco-loop-staleness.sh — days since each selfco-generated surface was last written.
#
# truth_probe for defect `selfco-loops-no-verifier`. These four files are the observable
# output of selfco's loops; their mtime IS the evidence_ref the registry entries are
# missing. If a loop is alive, its surface is young.
#
# Prints one `name=<days>` pair per surface, or `name=MISSING`. Exit 0 always — this is a
# measurement, and a measurement never blocks (ADR-0086).
set -u

VAULT="${SELFCO_VAULT:-$HOME/selfco}"
NOW=$(date +%s)
OUT=""

for pair in \
  "lint-report:$VAULT/wiki/_lint-report.md" \
  "hot:$VAULT/wiki/_hot.md" \
  "suggested-links:$VAULT/wiki/_suggested-links.md" \
  "run-canvas:$VAULT/canvas/runs/experience-plane.canvas"
do
  name=${pair%%:*}
  file=${pair#*:}
  if [ -f "$file" ]; then
    # stat -f is BSD/macOS; -c is GNU. Try both so this survives a Linux runner.
    mtime=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null || echo "")
    if [ -n "$mtime" ]; then
      OUT="$OUT $name=$(( (NOW - mtime) / 86400 ))d"
    else
      OUT="$OUT $name=UNKNOWN"
    fi
  else
    OUT="$OUT $name=MISSING"
  fi
done

echo "${OUT# }"
