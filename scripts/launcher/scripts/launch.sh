#!/usr/bin/env bash
# core/scripts/launcher/scripts/launch.sh
#
# The /workbench skill's implementation. Reads JSON registrations under
# core/scripts/launcher/registrations/, validates them, and brings up a
# tmux session with one window per registration.
#
# See ADR-0057 (decisions/adr/0057-launcher-mechanism-core-scripts-launcher.md)
# and the master at ADR-0056.
#
# Usage:
#   launch.sh                          # default session name 'ojfbot'
#   launch.sh my-session               # custom session name
#   launch.sh --dry-run                # print the plan, do not execute
#   launch.sh --include-dormant        # also launch dormant registrations
#   launch.sh --window <id>            # (re)create just one window in an existing session
#
# After launch:
#   tmux attach -t ojfbot

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export LAUNCHER_ROOT

# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

SESSION_NAME=""
DRY_RUN=0
INCLUDE_DORMANT=0
SINGLE_WINDOW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --include-dormant) INCLUDE_DORMANT=1; shift ;;
    --window) SINGLE_WINDOW="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    --*)
      echo "launcher: unknown flag: $1" >&2
      exit 64
      ;;
    *)
      if [[ -z "$SESSION_NAME" ]]; then
        SESSION_NAME="$1"
      else
        echo "launcher: too many positional args" >&2
        exit 64
      fi
      shift
      ;;
  esac
done

SESSION_NAME="${SESSION_NAME:-ojfbot}"

# ── Prereqs ──────────────────────────────────────────────────────────────────
check_prereqs

# ── Validate ─────────────────────────────────────────────────────────────────
if ! validate_all "$INCLUDE_DORMANT"; then
  echo "launcher: validation failed; refusing to launch" >&2
  exit 65
fi

# ── Plan ─────────────────────────────────────────────────────────────────────
REGISTRATIONS=()
while IFS= read -r line; do REGISTRATIONS+=("$line"); done < <(list_registrations "$INCLUDE_DORMANT")
if [[ ${#REGISTRATIONS[@]} -eq 0 ]]; then
  echo "launcher: no registrations matched (priority_tier filter)" >&2
  exit 0
fi

SORTED=()
while IFS= read -r line; do SORTED+=("$line"); done < <(sort_registrations "${REGISTRATIONS[@]}")

if [[ -n "$SINGLE_WINDOW" ]]; then
  # Filter to just the named id.
  declare -a FILTERED
  for f in "${SORTED[@]}"; do
    id="$(jq -r '.id' "$f")"
    if [[ "$id" == "$SINGLE_WINDOW" ]]; then
      FILTERED+=("$f")
    fi
  done
  if [[ ${#FILTERED[@]} -eq 0 ]]; then
    echo "launcher: no registration matches --window $SINGLE_WINDOW" >&2
    exit 66
  fi
  SORTED=("${FILTERED[@]}")
fi

echo "launcher: session=$SESSION_NAME"
echo "launcher: registrations to launch (${#SORTED[@]}):"
for f in "${SORTED[@]}"; do
  id="$(jq -r '.id' "$f")"
  tier="$(jq -r '.priority_tier' "$f")"
  state="$(initial_state_for_tier "$tier")"
  glyph="$(state_glyph "$state")"
  panes="$(jq -r '.panes | length' "$f")"
  echo "  $glyph $id  ($tier, $panes pane(s))"
done

if [[ "$DRY_RUN" == "1" ]]; then
  echo
  echo "launcher: --dry-run set; not creating tmux session"
  exit 0
fi

# ── Build ────────────────────────────────────────────────────────────────────

# If session exists and we're not in --window mode, refuse.
if [[ -z "$SINGLE_WINDOW" ]] && tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  cat >&2 <<EOF
launcher: tmux session '$SESSION_NAME' already exists.
  - To attach:        tmux attach -t $SESSION_NAME
  - To restart fresh: tmux kill-session -t $SESSION_NAME && launch.sh
  - To rebuild one window: launch.sh --window <id>
EOF
  exit 67
fi

if [[ -n "$SINGLE_WINDOW" ]]; then
  if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "launcher: --window requires an existing session named '$SESSION_NAME'" >&2
    exit 68
  fi
  # Kill the existing window for this id (if any), then rebuild.
  WIN_TARGET="$SESSION_NAME:$SINGLE_WINDOW"
  if tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' | grep -q "^${SINGLE_WINDOW}$\|: ${SINGLE_WINDOW}:"; then
    tmux kill-window -t "$WIN_TARGET" 2>/dev/null || true
  fi
fi

# Bring up the tmux server with our base config.
"${TMUX_DIR}/builder.sh" --session "$SESSION_NAME" "${SORTED[@]}"

# Apply initial status glyphs.
"${TMUX_DIR}/status.sh" --session "$SESSION_NAME" --apply-initial "${SORTED[@]}"

# Wire interactive-attach key bindings (ADR-0060: prefix + a, plus per-registration M-N).
"${TMUX_DIR}/builder.sh" --session "$SESSION_NAME" --bindings "${SORTED[@]}"

cat <<EOF

launcher: tmux session '$SESSION_NAME' is up.

  Attach:               tmux attach -t $SESSION_NAME
  Cycle needs-attention: prefix + n
  Interactive Claude:    prefix + a (in the focused window)
  Per-rig switch:        Alt-1 .. Alt-9 (per registration's claude_sessions.interactive.key_binding)

EOF
