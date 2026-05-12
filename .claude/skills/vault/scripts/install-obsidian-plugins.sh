#!/usr/bin/env bash
# install-obsidian-plugins.sh — download the community plugins' code into <vault>/.obsidian/plugins/
#
# Resolves each plugin id -> GitHub repo via the official community plugin registry
# (obsidianmd/obsidian-releases), then downloads that repo's latest-release assets
# (manifest.json, main.js, styles.css) into <vault>/.obsidian/plugins/<id>/.
#
# It does NOT enable any plugin (it never touches .obsidian/community-plugins.json). Enable the ones
# you want from Obsidian → Settings → Community plugins; that path version-checks each plugin against
# your installed Obsidian. This script also warns when a downloaded plugin's `minAppVersion` is newer
# than your installed Obsidian (e.g. Excalidraw needs ≥1.5.7) — enabling such a plugin manually, or
# pre-listing it as enabled, crashes the renderer on vault open.
#
# Idempotent. Env: SELFCO_VAULT (default ~/selfco), PLUGIN_IDS (space-separated; overrides default list).
set -uo pipefail

VAULT="${SELFCO_VAULT:-$HOME/selfco}"
PLUGINS_DIR="$VAULT/.obsidian/plugins"
REGISTRY_URL="https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"

# Excalidraw is intentionally first-class only as a soft dep of Excalibrain — it's large and the most
# version-sensitive plugin here, so it lives in the list but gets the version warning loudest.
DEFAULT_IDS="excalibrain obsidian-excalidraw-plugin enhancing-mindmap obsidian-mind-map graph-analysis persistent-graph"
IDS="${PLUGIN_IDS:-$DEFAULT_IDS}"

for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "install-obsidian-plugins: '$bin' not found — skipping plugin fetch." >&2; exit 0; }
done

# Detect installed Obsidian version (macOS .app); empty if not found → version checks are skipped.
OBS_VER=""
for app in "/Applications/Obsidian.app" "$HOME/Applications/Obsidian.app"; do
  if [[ -f "$app/Contents/Info.plist" ]]; then
    OBS_VER="$(defaults read "$app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || true)"
    [[ -n "$OBS_VER" ]] && break
  fi
done
[[ -n "$OBS_VER" ]] && echo "install-obsidian-plugins: installed Obsidian = $OBS_VER" || echo "install-obsidian-plugins: (Obsidian app not found — skipping version checks)"

# ver_ge A B  → 0 (true) if A >= B, comparing dotted numeric versions (X.Y.Z…)
ver_ge() {
  [[ -z "$1" || -z "$2" ]] && return 0
  local a b IFS=.
  read -ra a <<< "${1%%-*}"; read -ra b <<< "${2%%-*}"
  for i in 0 1 2 3; do
    local x="${a[$i]:-0}" y="${b[$i]:-0}"
    x="${x//[^0-9]/}"; y="${y//[^0-9]/}"
    (( ${x:-0} > ${y:-0} )) && return 0
    (( ${x:-0} < ${y:-0} )) && return 1
  done
  return 0
}

mkdir -p "$PLUGINS_DIR"

echo "install-obsidian-plugins: fetching registry…"
REGISTRY="$(curl -fsSL "$REGISTRY_URL" 2>/dev/null)" || { echo "  ! could not fetch plugin registry — skipping." >&2; exit 0; }

resolve_repo() { echo "$REGISTRY" | jq -r --arg id "$1" '.[] | select(.id==$id) | .repo' | head -n1; }
dl() { curl -fsSL "https://github.com/$1/releases/latest/download/$2" -o "$3" 2>/dev/null; }

ok=0; miss=0; incompat=0
for id in $IDS; do
  repo="$(resolve_repo "$id")"
  if [[ -z "$repo" || "$repo" == "null" ]]; then
    echo "  ? '$id' not in registry — skip (install from Obsidian UI if you want it)."; miss=$((miss+1)); continue
  fi
  dest="$PLUGINS_DIR/$id"
  mkdir -p "$dest"
  if ! dl "$repo" "manifest.json" "$dest/manifest.json"; then
    echo "  ! $id ($repo): no manifest.json in latest release — skip."; miss=$((miss+1)); rmdir "$dest" 2>/dev/null; continue
  fi
  if ! dl "$repo" "main.js" "$dest/main.js"; then
    echo "  ! $id ($repo): no main.js in latest release — skip."; miss=$((miss+1)); rm -f "$dest/manifest.json"; rmdir "$dest" 2>/dev/null; continue
  fi
  dl "$repo" "styles.css" "$dest/styles.css" || true   # optional
  ver="$(jq -r '.version // "?"' "$dest/manifest.json" 2>/dev/null)"
  mav="$(jq -r '.minAppVersion // ""' "$dest/manifest.json" 2>/dev/null)"
  if [[ -n "$OBS_VER" && -n "$mav" ]] && ! ver_ge "$OBS_VER" "$mav"; then
    echo "  ⚠ $id @ $ver  ($repo) — needs Obsidian ≥ $mav, you have $OBS_VER. Downloaded but DO NOT enable until you update Obsidian."
    incompat=$((incompat+1))
  else
    echo "  + $id @ $ver  ($repo)"
  fi
  ok=$((ok+1))
done

echo "install-obsidian-plugins: $ok downloaded ($incompat need a newer Obsidian), $miss skipped → $PLUGINS_DIR"
echo "  Plugins are NOT auto-enabled. Enable the ones you want in Obsidian → Settings → Community plugins."
echo "  (.obsidian/plugins/ is gitignored; re-run this after a fresh clone.)"
exit 0
