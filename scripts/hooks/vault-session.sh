#!/usr/bin/env bash
# vault-session.sh — SessionEnd hook (OPT-IN; not installed by default)
#
# Appends a lightweight `## [YYYY-MM-DD] session | <repo>@<branch>` stub entry to the selfco LLM
# Wiki's append-only ledger (wiki/log.md) so `/vault sync` can fold it into that day's context.
# No LLM, no network. Silently no-ops if the vault/wiki/log.md isn't there.
#
# Install (opt-in): `core/scripts/install-agents.sh --user-scope --with-selfco`
#   (adds this to ~/.claude/settings.json SessionEnd hooks, async), or add it by hand.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

VAULT="${SELFCO_VAULT:-$HOME/selfco}"
LOG="$VAULT/wiki/log.md"

# No-op unless the vault wiki/log.md exists
[[ -f "$LOG" ]] || exit 0

read_hook_input
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')
REASON=$(echo "$HOOK_INPUT" | jq -r '.reason // empty')

BRANCH=""
[[ -n "$CWD" ]] && BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

PROMPTS="?"
if [[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]]; then
  PROMPTS=$(grep -c '"type":[[:space:]]*"user"' "$TRANSCRIPT" 2>/dev/null || echo "?")
fi

TODAY=$(date -u +%Y-%m-%d)
{
  printf '\n## [%s] session | %s @ %s\n' "$TODAY" "${REPO:-?}" "${BRANCH:-?}"
  printf -- '- %s · session=%s · prompts=%s · reason=%s · cwd=%s\n' \
    "$(iso_now)" "${SESSION_ID:-?}" "${PROMPTS}" "${REASON:-?}" "${CWD:-?}"
} >> "$LOG"
