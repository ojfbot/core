#!/usr/bin/env bash
# core/scripts/launcher/scripts/lib.sh
#
# Shared helpers for launch.sh, tmux/builder.sh, tmux/status.sh.
# See ADR-0057, ADR-0058, ADR-0059, ADR-0060.
#
# Compatible with bash 3.2 (the system bash on macOS) — no associative arrays.

set -euo pipefail

# Resolve the launcher root regardless of where this is sourced from.
LAUNCHER_ROOT="${LAUNCHER_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export LAUNCHER_ROOT

REGISTRATIONS_DIR="${LAUNCHER_ROOT}/registrations"
SCHEMA_PATH="${LAUNCHER_ROOT}/schema/registration.schema.json"
TMUX_DIR="${LAUNCHER_ROOT}/tmux"

# ── Status language (ADR-0059) ───────────────────────────────────────────────
# Five states. Lookups via case statements to stay compatible with bash 3.2.
#
# States: healthy_infra | healthy_active | idle_active | needs_attention | broken

state_glyph() {
  case "$1" in
    healthy_infra)   echo "▪" ;;
    healthy_active)  echo "●" ;;
    idle_active)     echo "○" ;;
    needs_attention) echo "!" ;;
    broken)          echo "✗" ;;
    *)               echo "?" ;;
  esac
}

state_color() {
  case "$1" in
    healthy_infra)   echo "colour240" ;;
    healthy_active)  echo "colour33"  ;;
    idle_active)     echo "colour39"  ;;
    needs_attention) echo "colour220" ;;
    broken)          echo "colour196" ;;
    *)               echo "colour240" ;;
  esac
}

state_known() {
  case "$1" in
    healthy_infra|healthy_active|idle_active|needs_attention|broken) return 0 ;;
    *) return 1 ;;
  esac
}

initial_state_for_tier() {
  case "$1" in
    infrastructure) echo "healthy_infra" ;;
    active)         echo "idle_active"   ;;
    dormant)        echo "idle_active"   ;;
    *)              echo "idle_active"   ;;
  esac
}

# ── Prereq checks ─────────────────────────────────────────────────────────────

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "launcher: missing required command: $cmd" >&2
    return 1
  fi
}

check_prereqs() {
  require_cmd tmux
  require_cmd jq
  require_cmd node
}

# ── Registration discovery and validation ────────────────────────────────────

# List registration JSON paths (top-level only — _examples/ is sub-directory).
# Filters by priority_tier:
#   $1: include_dormant (1 = include all; 0 = skip dormant)
list_registrations() {
  local include_dormant="${1:-0}"
  local f tier
  for f in "${REGISTRATIONS_DIR}"/*.json; do
    [[ -e "$f" ]] || continue
    tier="$(jq -r '.priority_tier // "active"' "$f")"
    if [[ "$tier" == "dormant" && "$include_dormant" != "1" ]]; then
      continue
    fi
    echo "$f"
  done
}

# Sort registrations by `order` ascending.
sort_registrations() {
  local f order
  for f in "$@"; do
    order="$(jq -r '.order // 100' "$f")"
    printf '%s\t%s\n' "$order" "$f"
  done | sort -n -k1,1 | cut -f2
}

# Basic structural validation using jq. Full JSON-Schema validation lives in
# tests/registrations.test.mjs.
validate_registration() {
  local f="$1"
  local errs=0

  jq -e 'has("schema_version") and .schema_version == "1.0.0"' "$f" >/dev/null \
    || { echo "  - schema_version missing or != 1.0.0" >&2; errs=$((errs+1)); }
  jq -e 'has("id") and (.id | test("^[a-z][a-z0-9-]{0,31}$"))' "$f" >/dev/null \
    || { echo "  - id missing or not kebab-case" >&2; errs=$((errs+1)); }
  jq -e '.repo.local_path | type == "string"' "$f" >/dev/null \
    || { echo "  - repo.local_path missing" >&2; errs=$((errs+1)); }
  jq -e '.priority_tier | IN("infrastructure","active","dormant")' "$f" >/dev/null \
    || { echo "  - priority_tier missing or invalid" >&2; errs=$((errs+1)); }
  jq -e '(.panes | type == "array") and (.panes | length >= 1) and (.panes | length <= 4)' "$f" >/dev/null \
    || { echo "  - panes missing or wrong length (1..4)" >&2; errs=$((errs+1)); }

  local local_path
  local_path="$(jq -r '.repo.local_path' "$f")"
  if [[ ! -d "$local_path" ]]; then
    echo "  - WARNING: repo.local_path does not exist on disk: $local_path" >&2
  fi

  return $errs
}

validate_all() {
  local include_dormant="${1:-0}"
  local fail=0
  local f id
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    id="$(jq -r '.id // "(unknown)"' "$f" 2>/dev/null || echo "(unknown)")"
    if ! validate_registration "$f"; then
      echo "launcher: invalid registration: $id ($f)" >&2
      fail=$((fail+1))
    fi
  done < <(list_registrations "$include_dormant")
  return $fail
}

# ── Glyph + window-name helpers ──────────────────────────────────────────────

window_name_for() {
  local id="$1"
  local tier="$2"
  local state="$3"
  local glyph
  glyph="$(state_glyph "$state")"
  printf '[%s] %s:%s' "$glyph" "$id" "$tier"
}

# ── Bead-emit shim ──────────────────────────────────────────────────────────

BEAD_EMIT="${BEAD_EMIT:-/Users/yuri/ojfbot/core/scripts/hooks/bead-emit.mjs}"
export BEAD_EMIT
