#!/usr/bin/env bash
# autocommit.sh — watch the selfco vault and auto-commit+push changes.
#
# Useful when something other than the `/vault` skill writes to ~/selfco — e.g. the local
# `mcp-obsidian` server (Claude Desktop on the Mac) editing pages, or you hand-editing in Obsidian.
# (Writes that come via the GitHub connector — claude.ai web / iPhone — are already commits, so
# they don't need this; this just keeps the Mac working tree from drifting out of git.)
#
# Run it as a launchd agent (template below) or in a tmux pane. It debounces: after a change it
# waits QUIET seconds of no further changes, then `git pull --rebase --autostash`, `git add -A`,
# `git commit`, `git push`. Needs `fswatch` (`brew install fswatch`); falls back to a 60s poll loop.
#
# Env: SELFCO_VAULT (default ~/selfco), QUIET (debounce seconds, default 20)
set -uo pipefail

VAULT="${SELFCO_VAULT:-$HOME/selfco}"
QUIET="${QUIET:-20}"

[[ -d "$VAULT/.git" ]] || { echo "autocommit: $VAULT is not a git repo — run /vault init first." >&2; exit 1; }

commit_and_push() {
  cd "$VAULT" || return
  git pull --rebase --autostash -q 2>/dev/null || true
  git add -A
  if ! git diff --cached --quiet; then
    n=$(git diff --cached --name-only | wc -l | tr -d ' ')
    git commit -q -m "vault: autocommit ($n file(s) changed)" || return
    git remote | grep -q . && git push -q 2>/dev/null || true
    echo "autocommit: committed $n file(s) @ $(date -u +%H:%M:%SZ)"
  fi
}

echo "autocommit: watching $VAULT (debounce ${QUIET}s)…"
if command -v fswatch >/dev/null 2>&1; then
  # one commit per burst: fswatch streams paths; we coalesce with a timeout read
  fswatch -o "$VAULT" --exclude '/\.git/' --exclude '/\.obsidian/workspace' | while true; do
    read -r _ || break                       # block until first change
    while read -r -t "$QUIET" _; do :; done  # drain until QUIET seconds of silence
    commit_and_push
  done
else
  echo "autocommit: fswatch not found — falling back to a ${QUIET}0s poll loop. (brew install fswatch for instant.)"
  while sleep "${QUIET}0"; do commit_and_push; done
fi

# ─────────────────────────────────────────────────────────────────────────────
# launchd agent — save as ~/Library/LaunchAgents/com.selfco.autocommit.plist, then
#   launchctl load -w ~/Library/LaunchAgents/com.selfco.autocommit.plist
# ─────────────────────────────────────────────────────────────────────────────
# <?xml version="1.0" encoding="UTF-8"?>
# <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
# <plist version="1.0"><dict>
#   <key>Label</key><string>com.selfco.autocommit</string>
#   <key>ProgramArguments</key><array>
#     <string>/bin/bash</string>
#     <string>/Users/yuri/ojfbot/core/.claude/skills/vault/scripts/autocommit.sh</string>
#   </array>
#   <key>RunAtLoad</key><true/>
#   <key>KeepAlive</key><true/>
#   <key>StandardOutPath</key><string>/tmp/selfco-autocommit.log</string>
#   <key>StandardErrorPath</key><string>/tmp/selfco-autocommit.log</string>
# </dict></plist>
