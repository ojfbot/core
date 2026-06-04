#!/usr/bin/env bash
# claude-md-gate.sh — PreToolUse hook (matcher: Edit|Write) for the CLAUDE.md loading-discipline
# gate (ADR-0081 Slice 2). Thin wrapper: pipes the hook stdin to gate.mjs, which does the work.
#
# Mode is controlled by CLAUDE_MD_GATE_MODE (default "shadow" — observe-only, never blocks).
# Install: .claude/settings.json PreToolUse, matcher "Edit|Write". Runs SYNC before the edit.
# Fails open: if node is missing or anything errors, the edit is allowed.
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="$HOOK_DIR/claude-md-gate/gate.mjs"

# No node, or gate missing → allow (fail open).
command -v node >/dev/null 2>&1 || exit 0
[[ -f "$GATE" ]] || exit 0

exec node "$GATE"
