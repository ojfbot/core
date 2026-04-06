#!/usr/bin/env bash
# log-skill.sh — PostToolUse hook (matcher: Skill)
#
# Appends a JSONL telemetry line to ~/.claude/skill-telemetry.jsonl
# every time a skill is invoked interactively via Claude Code.
#
# Install: Add to .claude/settings.json PostToolUse hooks with matcher "Skill"
# Runs async (never blocks the session).
set -euo pipefail

TELEMETRY_FILE="${HOME}/.claude/skill-telemetry.jsonl"

# Read hook input from stdin
INPUT=$(cat)

# Extract fields from hook JSON
SKILL=$(echo "$INPUT" | jq -r '.tool_input.skill // empty')
ARGS=$(echo "$INPUT" | jq -r '.tool_input.args // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Skip if no skill name (shouldn't happen but be safe)
if [[ -z "$SKILL" ]]; then
  exit 0
fi

# Derive repo name from git toplevel, fallback to directory basename
REPO=""
if [[ -n "$CWD" ]]; then
  REPO=$(basename "$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || echo "$CWD")")
fi

# Build JSONL line and append atomically (single echo < PIPE_BUF = safe)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LINE=$(jq -nc \
  --arg ts "$TIMESTAMP" \
  --arg event "skill:invoked" \
  --arg skill "$SKILL" \
  --arg args "$ARGS" \
  --arg repo "$REPO" \
  --arg cwd "$CWD" \
  --arg session_id "$SESSION_ID" \
  --arg source "interactive" \
  '{ts: $ts, event: $event, skill: $skill, args: $args, repo: $repo, cwd: $cwd, session_id: $session_id, source: $source}')

echo "$LINE" >> "$TELEMETRY_FILE"
