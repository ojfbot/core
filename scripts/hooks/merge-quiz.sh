#!/usr/bin/env bash
# merge-quiz.sh — PreToolUse hook (matcher: Bash) for H8 Stage A.
#
# Thin, FAST prefilter in front of merge-quiz.mjs. This runs SYNCHRONOUSLY before every
# single Bash tool call in every session, so the common case must cost effectively nothing:
# spawning node on every `ls` would tax the whole fleet for a signal we only need on merges.
# So we grep the command in bash first and only hand off to node on an actual match.
#
# SHADOW-FIRST (ADR-0086): observe-only. Emits no permission decision and always exits 0 —
# it can slow a merge down by a few ms, but it can never stop one.
#
# Install: .claude/settings.json PreToolUse, matcher "Bash". Fails open on every error path.
set -uo pipefail

HOOK_INPUT=$(cat)

# Fast reject: no merge verb anywhere in the payload → done, without spawning anything.
case "$HOOK_INPUT" in
  *"pr merge"*|*"git merge"*) ;;
  *) exit 0 ;;
esac

command -v node >/dev/null 2>&1 || exit 0

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBSERVER="$HOOK_DIR/merge-quiz.mjs"
[[ -f "$OBSERVER" ]] || exit 0

# The observer does the precise classification (the bash grep above is deliberately loose;
# `git merge --abort` and `git merge-base` are rejected there, not here).
printf '%s' "$HOOK_INPUT" | node "$OBSERVER" >/dev/null 2>&1 || true
exit 0
