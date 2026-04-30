#!/usr/bin/env bash
# core/scripts/launcher/tmux/status.sh
#
# Apply visual status (glyph + color) to tmux windows per ADR-0059.
#
# Modes:
#   --session NAME --apply-initial REG...   Set every window's initial glyph based on priority_tier.
#   --session NAME --set ID STATE           Transition one window to STATE (one of: healthy_infra,
#                                           healthy_active, idle_active, needs_attention, broken).
#   --session NAME --next-attention         Focus the next window in needs_attention state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=../scripts/lib.sh
source "${LAUNCHER_ROOT}/scripts/lib.sh"

SESSION_NAME=""
MODE=""
TARGET_ID=""
TARGET_STATE=""
declare -a REGS

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session) SESSION_NAME="$2"; shift 2 ;;
    --apply-initial) MODE="apply-initial"; shift ;;
    --set) MODE="set"; TARGET_ID="$2"; TARGET_STATE="$3"; shift 3 ;;
    --next-attention) MODE="next-attention"; shift ;;
    *) REGS+=("$1"); shift ;;
  esac
done

if [[ -z "$SESSION_NAME" ]]; then
  echo "status: --session NAME required" >&2
  exit 64
fi

# Find the window whose @rig_id matches.
window_for_id() {
  local id="$1"
  tmux list-windows -t "$SESSION_NAME" -F '#{window_id} #{@rig_id}' 2>/dev/null \
    | awk -v id="$id" '$2 == id { print $1; exit }'
}

set_window_state() {
  local win_id="$1"
  local id="$2"
  local tier="$3"
  local state="$4"
  local color
  color="$(state_color "$state")"

  tmux rename-window -t "$win_id" "$(window_name_for "$id" "$tier" "$state")"
  tmux set-option -t "$win_id" -w @rig_state "$state" >/dev/null
  tmux set-option -t "$win_id" -w pane-active-border-style "fg=${color}"
}

case "$MODE" in
  apply-initial)
    for f in "${REGS[@]}"; do
      id="$(jq -r '.id' "$f")"
      tier="$(jq -r '.priority_tier' "$f")"
      state="$(initial_state_for_tier "$tier")"
      win_id="$(window_for_id "$id")"
      [[ -z "$win_id" ]] && continue
      set_window_state "$win_id" "$id" "$tier" "$state"
    done
    ;;

  set)
    if [[ -z "$TARGET_ID" || -z "$TARGET_STATE" ]]; then
      echo "status: --set requires ID STATE" >&2
      exit 64
    fi
    if ! state_known "$TARGET_STATE"; then
      echo "status: unknown state: $TARGET_STATE" >&2
      echo "       valid: healthy_infra healthy_active idle_active needs_attention broken" >&2
      exit 65
    fi
    win_id="$(window_for_id "$TARGET_ID")"
    if [[ -z "$win_id" ]]; then
      echo "status: no window found for id: $TARGET_ID" >&2
      exit 66
    fi
    tier="$(tmux show-options -t "$win_id" -wv @rig_tier 2>/dev/null || echo active)"
    set_window_state "$win_id" "$TARGET_ID" "$tier" "$TARGET_STATE"
    ;;

  next-attention)
    # Find first window with @rig_state == needs_attention; select it.
    next="$(tmux list-windows -t "$SESSION_NAME" -F '#{window_id} #{@rig_state}' 2>/dev/null \
      | awk '$2 == "needs_attention" { print $1; exit }')"
    if [[ -n "$next" ]]; then
      tmux select-window -t "$next"
    else
      tmux display-message "no windows in needs_attention"
    fi
    ;;

  *)
    echo "status: unknown mode" >&2
    exit 64
    ;;
esac
