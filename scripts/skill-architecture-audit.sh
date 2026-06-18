#!/usr/bin/env bash
# skill-architecture-audit.sh — weekly OPAV Observation pulse for the skill library.
# Runs the deterministic skill-architecture audit, which appends one summary line
# to ~/.claude/skill-architecture-audit.jsonl. Shadow-stage only (ADR-0086):
# observes and records, never gates. Driven by skill-architecture-audit-launchd.plist
# (weekly) or run manually. The deep judgment pass is the /skill-audit skill, not this.
set -euo pipefail

CORE_DIR="${CLAUDE_PROJECT_DIR:-/Users/yuri/ojfbot/core}"
AUDIT="$CORE_DIR/.claude/skills/skill-audit/scripts/audit-architecture.mjs"

if [[ ! -f "$AUDIT" ]]; then
  echo "skill-architecture-audit: $AUDIT not found" >&2
  exit 0   # never fail the schedule
fi

# Full markdown report to stdout (captured to the launchd log); the script also
# appends the machine-readable summary line to the jsonl on its own.
node "$AUDIT" || {
  echo "skill-architecture-audit: audit script errored (non-fatal)" >&2
  exit 0
}
