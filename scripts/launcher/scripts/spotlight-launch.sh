#!/usr/bin/env bash
# core/scripts/launcher/scripts/spotlight-launch.sh
#
# Idempotent attach-or-create wrapper invoked by:
#   - ~/Applications/ojfbot.app (Spotlight: type "ojfbot")
#   - Hammerspoon's launcher.run() (URL handler hammerspoon://ojfbot-launch)
#
# Behavior:
#   1. If tmux session 'ojfbot' exists, skip launch.
#   2. Otherwise, run launch.sh to bring it up.
#   3. Open Terminal.app and run `tmux attach -t ojfbot`.
#
# See ADR-0057, ADR-0064.

set -euo pipefail

SESSION="${1:-ojfbot}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/ojfbot-launcher.log"
mkdir -p "$LOG_DIR"

# Ensure tmux + jq + node are reachable when invoked from launchd / Spotlight.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 1. Create the session if it doesn't exist.
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  "$LAUNCHER_DIR/scripts/launch.sh" "$SESSION" >>"$LOG_FILE" 2>&1 || {
    osascript -e 'display notification "launch.sh failed; see ~/Library/Logs/ojfbot-launcher.log" with title "ojfbot"'
    exit 1
  }
fi

# 2. Open Terminal.app and attach.
#    `do script` opens a new window if Terminal is not running, or a new
#    tab if it is. Either way, the user lands on the tmux session.
osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "exec tmux attach -t $SESSION"
end tell
APPLESCRIPT
