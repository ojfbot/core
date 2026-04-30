#!/usr/bin/env bash
# core/scripts/launcher/tmux/builder.sh
#
# Two modes:
#   --session NAME REGISTRATION...                  Create the session and
#                                                   one window per registration.
#   --session NAME --bindings REGISTRATION...       Wire key bindings derived
#                                                   from each registration's
#                                                   claude_sessions.interactive.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=../scripts/lib.sh
source "${LAUNCHER_ROOT}/scripts/lib.sh"

SESSION_NAME=""
MODE="create"
declare -a REGS

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session) SESSION_NAME="$2"; shift 2 ;;
    --bindings) MODE="bindings"; shift ;;
    *) REGS+=("$1"); shift ;;
  esac
done

if [[ -z "$SESSION_NAME" ]]; then
  echo "builder: --session NAME required" >&2
  exit 64
fi

# ── Mode: create ─────────────────────────────────────────────────────────────

build_window_for() {
  local f="$1"
  local first_window="${2:-0}"

  local id tier state cwd color
  id="$(jq -r '.id' "$f")"
  tier="$(jq -r '.priority_tier' "$f")"
  state="$(initial_state_for_tier "$tier")"
  color="$(state_color "$state")"
  cwd="$(jq -r '.repo.local_path' "$f")"

  # Initial window name has the glyph + id:tier.
  local wname
  wname="$(window_name_for "$id" "$tier" "$state")"

  if [[ "$first_window" == "1" ]]; then
    # Bootstrap session with the first window.
    tmux new-session -d -s "$SESSION_NAME" -n "$wname" -c "$cwd"
    tmux set-option -t "$SESSION_NAME" -g status-left-length 30
    tmux set-option -t "$SESSION_NAME" -g status-right-length 80
    tmux set-option -t "$SESSION_NAME" -g pane-border-style "fg=colour240"
  else
    tmux new-window -t "$SESSION_NAME" -n "$wname" -c "$cwd"
  fi

  # Tag the window with state for status.sh to pick up later.
  tmux set-option -t "${SESSION_NAME}:${wname}" -w @rig_id "$id" >/dev/null
  tmux set-option -t "${SESSION_NAME}:${wname}" -w @rig_tier "$tier" >/dev/null
  tmux set-option -t "${SESSION_NAME}:${wname}" -w @rig_state "$state" >/dev/null

  # Apply pane border color for the window.
  tmux set-option -t "${SESSION_NAME}:${wname}" -w pane-active-border-style "fg=${color}"

  # Build panes. The first pane already exists from new-window/new-session;
  # send it the first pane's command.
  local pane_count
  pane_count="$(jq -r '.panes | length' "$f")"

  local i
  for ((i = 0; i < pane_count; i++)); do
    local pane_name pane_cmd pane_size pane_split
    pane_name="$(jq -r ".panes[$i].name" "$f")"
    pane_cmd="$(jq -r ".panes[$i].command" "$f")"
    pane_size="$(jq -r ".panes[$i].size // \"50%\"" "$f")"
    pane_split="$(jq -r ".panes[$i].split // \"horizontal\"" "$f")"

    if [[ "$i" -gt 0 ]]; then
      local split_flag
      case "$pane_split" in
        horizontal) split_flag="-v" ;;  # tmux: -v stacks below (horizontal divider)
        vertical) split_flag="-h" ;;    # tmux: -h splits to the right (vertical divider)
        *) split_flag="-v" ;;
      esac
      # tmux 'split-window -p N' wants a percentage of the parent pane.
      local pct="${pane_size%%%}"
      tmux split-window -t "${SESSION_NAME}:${wname}" "$split_flag" -l "${pct}%" -c "$cwd"
    fi

    # The newly-created pane has the focus; tag it and send the command.
    tmux select-pane -T "$pane_name" -t "${SESSION_NAME}:${wname}"
    # send-keys to the active pane in this window.
    tmux send-keys -t "${SESSION_NAME}:${wname}" "$pane_cmd" C-m
  done

  # Run pre_launch if declared (after panes start, since pre_launch is a one-shot).
  local pre
  pre="$(jq -r '.pre_launch // empty' "$f")"
  if [[ -n "$pre" ]]; then
    ( cd "$cwd" && bash -c "$pre" >/dev/null 2>&1 || true )
  fi
}

if [[ "$MODE" == "create" ]]; then
  if [[ ${#REGS[@]} -eq 0 ]]; then
    echo "builder: no registrations passed" >&2
    exit 64
  fi

  # If session exists already (e.g. from --window mode), append.
  local_first=1
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    local_first=0
  fi

  i=0
  for f in "${REGS[@]}"; do
    if [[ "$local_first" == "1" && "$i" == "0" ]]; then
      build_window_for "$f" 1
    else
      build_window_for "$f" 0
    fi
    i=$((i+1))
  done
fi

# ── Mode: bindings ───────────────────────────────────────────────────────────

if [[ "$MODE" == "bindings" ]]; then
  # prefix + a — open an interactive Claude session in a new pane in the current window.
  tmux bind-key -T prefix a run-shell "tmux split-window -h -p 40 -c \"#{pane_current_path}\" 'claude'"

  # prefix + n — cycle to next window in needs_attention state.
  tmux bind-key -T prefix n run-shell "${LAUNCHER_ROOT}/tmux/status.sh --session ${SESSION_NAME} --next-attention"

  # Per-registration Meta-N bindings (no-prefix Alt-N to switch directly to a rig's window).
  for f in "${REGS[@]}"; do
    binding_id="$(jq -r '.id' "$f")"
    binding_key="$(jq -r '.claude_sessions.interactive.key_binding // empty' "$f")"
    if [[ -n "$binding_key" ]]; then
      binding_tier="$(jq -r '.priority_tier' "$f")"
      binding_state="$(initial_state_for_tier "$binding_tier")"
      binding_wname="$(window_name_for "$binding_id" "$binding_tier" "$binding_state")"
      tmux bind-key -n "$binding_key" select-window -t "${SESSION_NAME}:${binding_wname}" 2>/dev/null || true
    fi
  done
fi
