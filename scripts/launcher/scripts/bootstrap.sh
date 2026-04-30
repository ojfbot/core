#!/usr/bin/env bash
# core/scripts/launcher/scripts/bootstrap.sh
#
# One-shot setup for the launcher's macOS surface (ADR-0064):
#   1. Symlink ~/.hammerspoon → core/scripts/launcher/hammerspoon
#   2. Install ~/Applications/ojfbot.app (Info.plist + MacOS wrapper)
#   3. Re-import the bundle so Spotlight finds it
#   4. Walk the user through Accessibility / Screen Recording / Automation
#
# Idempotent. Re-running on a configured machine reports the existing state
# and exits 0.

set -euo pipefail

LAUNCHER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HAMMERSPOON_SRC="${LAUNCHER_DIR}/hammerspoon"
HAMMERSPOON_LINK="$HOME/.hammerspoon"
APP_BUNDLE_SRC="${LAUNCHER_DIR}/app-bundle/ojfbot.app"
APP_BUNDLE_DEST="$HOME/Applications/ojfbot.app"

note() { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$*" >&2; }

# ── 1. Hammerspoon symlink ───────────────────────────────────────────────────

note "Wiring Hammerspoon config..."

if [[ -L "$HAMMERSPOON_LINK" ]]; then
  current="$(readlink "$HAMMERSPOON_LINK")"
  if [[ "$current" == "$HAMMERSPOON_SRC" ]]; then
    note "  ~/.hammerspoon already points at $HAMMERSPOON_SRC"
  else
    warn "  ~/.hammerspoon currently → $current; replacing"
    rm "$HAMMERSPOON_LINK"
    ln -s "$HAMMERSPOON_SRC" "$HAMMERSPOON_LINK"
  fi
elif [[ -e "$HAMMERSPOON_LINK" ]]; then
  warn "  ~/.hammerspoon exists and is not a symlink. Backing up to ~/.hammerspoon.backup"
  mv "$HAMMERSPOON_LINK" "$HAMMERSPOON_LINK.backup.$(date +%Y%m%d-%H%M%S)"
  ln -s "$HAMMERSPOON_SRC" "$HAMMERSPOON_LINK"
else
  ln -s "$HAMMERSPOON_SRC" "$HAMMERSPOON_LINK"
  note "  ~/.hammerspoon → $HAMMERSPOON_SRC"
fi

# ── 2. App bundle ────────────────────────────────────────────────────────────

note "Installing app bundle..."

mkdir -p "$HOME/Applications"

if [[ ! -d "$APP_BUNDLE_SRC" ]]; then
  warn "  app-bundle template missing at $APP_BUNDLE_SRC; refusing to install"
  exit 1
fi

# Sync the template to ~/Applications/ojfbot.app. Use rsync for an atomic
# update; a partial install during Spotlight's index scan is the only failure
# mode worth defending against, and Spotlight rescans on directory write.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$APP_BUNDLE_SRC/" "$APP_BUNDLE_DEST/"
else
  rm -rf "$APP_BUNDLE_DEST"
  cp -R "$APP_BUNDLE_SRC" "$APP_BUNDLE_DEST"
fi
chmod +x "$APP_BUNDLE_DEST/Contents/MacOS/ojfbot"
note "  $APP_BUNDLE_DEST installed"

# ── 3. Spotlight reindex ─────────────────────────────────────────────────────

note "Re-importing bundle for Spotlight..."

if [[ -d "$APP_BUNDLE_DEST" ]]; then
  /usr/bin/mdimport "$APP_BUNDLE_DEST" 2>&1 || true
  note "  mdimport requested"
else
  warn "  skipped — bundle missing"
fi

# ── 4. Permissions walkthrough ───────────────────────────────────────────────

note "Permissions check..."

if ! pgrep -x Hammerspoon >/dev/null 2>&1; then
  note "  Hammerspoon is not running. Starting it..."
  /usr/bin/open -a Hammerspoon || warn "  could not start Hammerspoon"
  sleep 2
fi

cat <<'PERMISSIONS'

  Hammerspoon needs three macOS permissions to drive the launcher.
  If any prompt appears, grant access and rerun this script.

    1. Accessibility           — System Settings → Privacy & Security → Accessibility
    2. Screen & System Audio   — System Settings → Privacy & Security → Screen Recording
    3. Automation              — System Settings → Privacy & Security → Automation
                                 (allow Hammerspoon to control Terminal)

  Open the relevant pane:
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

PERMISSIONS

# ── 5. Smoke test ────────────────────────────────────────────────────────────

note "Smoke test:"
if pgrep -x Hammerspoon >/dev/null 2>&1; then
  note "  Hammerspoon: running"
else
  warn "  Hammerspoon: NOT running. Open it manually before testing Spotlight."
fi

if [[ -L "$HAMMERSPOON_LINK" ]]; then
  note "  ~/.hammerspoon symlink: ok"
else
  warn "  ~/.hammerspoon symlink: missing"
fi

if [[ -x "$APP_BUNDLE_DEST/Contents/MacOS/ojfbot" ]]; then
  note "  App bundle: ok"
else
  warn "  App bundle: missing or not executable"
fi

cat <<'NEXT'

Next:
  1. Type "ojfbot" in Spotlight (Cmd-Space). Press Return.
  2. Or test directly:  open ~/Applications/ojfbot.app
  3. Or fire the URL:   open "hammerspoon://ojfbot-launch"

  Tail the launcher log:  tail -f ~/Library/Logs/ojfbot-launcher.log

NEXT
