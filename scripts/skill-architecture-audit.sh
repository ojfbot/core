#!/usr/bin/env bash
# skill-architecture-audit.sh — weekly OPAV Observation pulse for the skill library.
# Runs the deterministic skill-architecture audit, which appends one summary line
# to ~/.claude/skill-architecture-audit.jsonl. Shadow-stage only (ADR-0086):
# observes and records, never gates. Driven by skill-architecture-audit-launchd.plist
# (weekly) or run manually. The deep judgment pass is the /skill-audit skill, not this.
set -euo pipefail

CORE_DIR="${CLAUDE_PROJECT_DIR:-/Users/yuri/ojfbot/core}"
AUDIT="$CORE_DIR/.claude/skills/skill-audit/scripts/audit-architecture.mjs"

# Resolve node. Under launchd the PATH is minimal and this box manages node with
# fnm, whose per-shell shims aren't on it. Prefer the version-stable `default`
# alias so the job survives node upgrades; fall back to homebrew / fnm env.
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.local/share/fnm/aliases/default/bin" "$HOME/.fnm/aliases/default/bin" /opt/homebrew/bin; do
    [ -x "$d/node" ] && { PATH="$d:$PATH"; break; }
  done
  command -v node >/dev/null 2>&1 || { command -v fnm >/dev/null 2>&1 && eval "$(fnm env 2>/dev/null)"; }
fi

if ! command -v node >/dev/null 2>&1; then
  echo "skill-architecture-audit: node not found on PATH or via fnm (non-fatal)" >&2
  exit 0
fi

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

# Loops liveness (rm-l2-ojfbot#S30): dead-loop detection recurs on this rail
# instead of being run-on-demand. Report-only — one JSON line per week into
# the same jsonl; never fails the schedule.
LIVENESS="$CORE_DIR/scripts/loops-liveness.mjs"
if [[ -f "$LIVENESS" ]]; then
  node "$LIVENESS" --json | jq -c '. + {source: "loops-liveness"}' \
    >> "$HOME/.claude/skill-architecture-audit.jsonl" \
    || echo "skill-architecture-audit: loops-liveness errored (non-fatal)" >&2
fi
