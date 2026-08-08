#!/usr/bin/env bash
#
# wizard-template.sh — stage library for /wizard-generated interactive setup
# scripts. Re-authored locally against the mattpocock/skills wizard contract
# (pin 84fdeff); no upstream file is vendored (ADR-0083, D39 in
# decisions/adopt-stack/pocock-skills-v1-2.md).
#
# Usage: copy this file to the target path, then author the STAGES section at
# the bottom. Everything above the STAGES marker is the shared library and is
# identical in every wizard — that consistency is the UX. Never hand-edit it.
#
# Helper contract:
#   banner · stage · say · step · note · warn · open_url · ask · ask_secret ·
#   write_env · set_secret · set_var · pause · confirm · finish
#
# Behavior guarantees:
#   - one stage on screen at a time (clears per stage; no-op when piped)
#   - TOTAL_STAGES progress in every stage header
#   - idempotent re-runs: saved .env values are offered as Enter-to-keep
#     defaults, and write_env upserts rather than appends
#   - secret entry is hidden and never echoed
#   - Ctrl-C prints a partial summary; a re-run resumes from saved values
#   - runs on stock macOS bash 3.2 (empty arrays guarded under set -u)

set -euo pipefail

# ── styling (degrades to plain text when stdout is not a terminal) ─────────
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 \
  && [[ "$(tput colors 2>/dev/null || printf 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2)
  YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD='' DIM='' RESET='' BLUE='' GREEN='' YELLOW='' RED=''
fi

ENV_FILE="${ENV_FILE:-.env}" # override before banner for a non-default path
TOTAL_STAGES=0               # author: set in the STAGES section
_STAGE=0
_ENV_WRITES=()    # keys upserted into ENV_FILE this run
_SECRET_WRITES=() # GitHub secret names set this run
_TODO=()          # actions the wizard could not complete; shown at the end

_clear() {
  [[ -t 1 ]] || return 0
  tput clear 2>/dev/null || printf '\033[2J\033[H'
}

_summary() {
  local item
  if [[ ${#_ENV_WRITES[@]} -gt 0 ]]; then
    note "saved to $ENV_FILE: ${_ENV_WRITES[*]}"
  fi
  if [[ ${#_SECRET_WRITES[@]} -gt 0 ]]; then
    note "GitHub secrets set: ${_SECRET_WRITES[*]}"
  fi
  if [[ ${#_TODO[@]} -gt 0 ]]; then
    warn "still to do by hand:"
    for item in ${_TODO[@]+"${_TODO[@]}"}; do note "  - $item"; done
  fi
}

_interrupted() {
  printf '\n\n%s✗ interrupted%s at stage %s/%s\n' "$RED" "$RESET" "$_STAGE" "$TOTAL_STAGES"
  _summary
  printf '%sRe-run the wizard to resume — saved values are offered as defaults.%s\n\n' \
    "$DIM" "$RESET"
  exit 130
}
trap _interrupted INT

# banner "Title" — opening frame. Call once, after TOTAL_STAGES is set.
banner() {
  _clear
  printf '\n%s%s%s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s%s stages · env file: %s%s\n\n' "$DIM" "$TOTAL_STAGES" "$ENV_FILE" "$RESET"
  printf '%sYou drive the browser; the wizard says exactly what to click and saves\n' "$DIM"
  printf 'what you copy back. Ctrl-C stops safely; a re-run resumes with saved values.%s\n\n' "$RESET"
  pause "Press Enter to begin"
}

# stage "Name" — clear the screen, advance and show the progress counter.
stage() {
  _clear
  _STAGE=$((_STAGE + 1))
  if [[ $_STAGE -gt $TOTAL_STAGES ]]; then
    warn "stage count exceeds TOTAL_STAGES=$TOTAL_STAGES — fix the STAGES section"
  fi
  printf '\n%s%s[%s/%s] %s%s\n\n' "$BOLD" "$BLUE" "$_STAGE" "$TOTAL_STAGES" "$1" "$RESET"
}

say() { printf '  %s\n' "$1"; }                          # plain instruction line
step() { printf '  %s→%s %s\n' "$BLUE" "$RESET" "$1"; }  # concrete action the human takes
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }     # de-emphasized aside
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL — open in the human's browser: WSL (wslview/explorer.exe),
# Linux (xdg-open), macOS (open). Falls back to asking the human to open it.
open_url() {
  local url=$1 opener='' cand
  for cand in wslview explorer.exe xdg-open open; do
    if command -v "$cand" >/dev/null 2>&1; then
      opener=$cand
      break
    fi
  done
  printf '  %s↗%s %s\n' "$GREEN" "$RESET" "$url"
  if [[ -z "$opener" ]] || ! "$opener" "$url" >/dev/null 2>&1; then
    warn "could not open a browser — open it manually: $url"
  fi
}

# pause ["msg"] — wait for the human to press Enter.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  IFS= read -r _ || true
}

# confirm "Question?" — y/N gate; succeeds only on yes. Use inside an `if`
# (a bare `confirm` answered "no" exits the wizard under set -e — that is the
# correct behavior for an abort gate before an irreversible action).
confirm() {
  local reply=''
  printf '  %s?%s %s %s[y/N]%s ' "$YELLOW" "$RESET" "$1" "$DIM" "$RESET"
  IFS= read -r reply || true
  [[ $reply == [Yy]* ]]
}

# _env_get KEY — print KEY's saved value from ENV_FILE (one layer of double
# quotes stripped, escaped quotes restored); status 1 when absent.
_env_get() {
  local line
  [[ -f "$ENV_FILE" ]] || return 1
  line=$(grep "^${1}=" "$ENV_FILE" | tail -n 1) || return 1
  [[ -n "$line" ]] || return 1
  line=${line#*=}
  if [[ $line == \"*\" ]]; then
    line=${line#\"}
    line=${line%\"}
    line=${line//\\\"/\"}
  fi
  printf '%s' "$line"
}

# ask VAR "Prompt" — read a visible value into $VAR. On re-runs the saved
# ENV_FILE value becomes the default (Enter keeps it).
ask() {
  local var=$1 prompt=$2 saved reply=''
  saved=$(_env_get "$var") || saved=''
  if [[ -n "$saved" ]]; then
    printf '  %s%s%s %s[Enter = keep saved value]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  IFS= read -r reply || true
  if [[ -z "$reply" && -n "$saved" ]]; then reply=$saved; fi
  printf -v "$var" '%s' "$reply"
}

# ask_secret VAR "Prompt" — like ask, but input is hidden and never echoed.
ask_secret() {
  local var=$1 prompt=$2 saved reply=''
  saved=$(_env_get "$var") || saved=''
  if [[ -n "$saved" ]]; then
    printf '  %s%s%s %s[Enter = keep saved value]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  IFS= read -rs reply || true
  printf '\n'
  if [[ -z "$reply" && -n "$saved" ]]; then reply=$saved; fi
  printf -v "$var" '%s' "$reply"
}

# write_env KEY VALUE — upsert KEY=VALUE into ENV_FILE (creates the file,
# replaces any existing line). Values with whitespace or '#' are quoted so
# dotenv parsers read them back intact. Idempotent.
write_env() {
  local key=$1 value=$2 stored tmp
  case $value in
    *[[:space:]#]*) stored="\"${value//\"/\\\"}\"" ;;
    *) stored=$value ;;
  esac
  tmp=$(mktemp "${TMPDIR:-/tmp}/wizard.XXXXXX")
  if [[ -f "$ENV_FILE" ]]; then
    grep -v "^${key}=" "$ENV_FILE" >"$tmp" || true
  fi
  printf '%s=%s\n' "$key" "$stored" >>"$tmp"
  mv "$tmp" "$ENV_FILE"
  _ENV_WRITES+=("$key")
  printf '  %s✓%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

_gh_ready() { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }

# set_secret NAME VALUE — set a GitHub Actions repo secret via gh. Records a
# manual to-do (shown by finish) when gh is missing, unauthenticated, or fails.
set_secret() {
  local name=$1 value=$2
  if _gh_ready && printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
    _SECRET_WRITES+=("$name")
    printf '  %s✓%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
  else
    _TODO+=("gh secret set $name")
    warn "could not set GitHub secret $name — run: gh secret set $name"
  fi
}

# set_var NAME VALUE — set a GitHub Actions repo variable (non-secret).
set_var() {
  local name=$1 value=$2
  if _gh_ready && gh variable set "$name" --body "$value" >/dev/null 2>&1; then
    printf '  %s✓%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
  else
    _TODO+=("gh variable set $name --body '<value>'")
    warn "could not set GitHub variable $name — set it later"
  fi
}

# finish — closing summary of everything configured. Call last.
finish() {
  _clear
  printf '\n%s%s✓ Done%s\n\n' "$BOLD" "$GREEN" "$RESET"
  _summary
  printf '\n'
}

# ══════════════════════════════════════════════════════════════════════════
# STAGES — author below this line only. One stage per human step, in
# dependency order. Set TOTAL_STAGES to the number of stage calls, then
# replace the example stage with the real procedure.
# ══════════════════════════════════════════════════════════════════════════

TOTAL_STAGES=1

banner "Example service setup"

# ── example stage: replace with the real steps ────────────────────────────
stage "Example — API key"
say "Grab the service API key for local dev and CI."
open_url "https://dashboard.example.com/settings/api-keys"
step "Click 'Create key', name it 'dev', and copy the value (shown once)."
ask_secret EXAMPLE_API_KEY "Paste the API key:"
write_env EXAMPLE_API_KEY "$EXAMPLE_API_KEY"
set_secret EXAMPLE_API_KEY "$EXAMPLE_API_KEY" # only if CI references it
# ──────────────────────────────────────────────────────────────────────────

finish
