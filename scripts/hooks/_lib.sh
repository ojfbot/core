#!/usr/bin/env bash
# _lib.sh — Shared utilities for Claude Code hook scripts.
#
# Source this at the top of every hook:
#   HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$HOOK_DIR/_lib.sh"
#
# Provides:
#   read_hook_input   — parse stdin JSON, set global vars
#   output_context    — emit additionalContext JSON to stdout
#   output_block      — emit decision to block with reason
#   log_telemetry     — append a JSONL line to a telemetry file
#   detect_repo       — derive repo name from a directory path

# ── Parse hook stdin ──────────────────────────────────────────────────────────
#
# Sets globals: HOOK_INPUT, TOOL_NAME, FILE_PATH, SESSION_ID, CWD, REPO,
#               HOOK_EVENT, PROMPT (UserPromptSubmit only)

read_hook_input() {
  HOOK_INPUT=$(cat)

  TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // empty')
  FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
  SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')
  CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty')
  HOOK_EVENT=$(echo "$HOOK_INPUT" | jq -r '.hook_event_name // empty')
  PROMPT=$(echo "$HOOK_INPUT" | jq -r '.prompt // empty')

  # Tool-specific extractions
  TOOL_INPUT_SKILL=$(echo "$HOOK_INPUT" | jq -r '.tool_input.skill // empty')
  TOOL_INPUT_ARGS=$(echo "$HOOK_INPUT" | jq -r '.tool_input.args // empty')
  TOOL_INPUT_COMMAND=$(echo "$HOOK_INPUT" | jq -r '.tool_input.command // empty')

  # Derive repo name
  REPO=""
  if [[ -n "$CWD" ]]; then
    REPO=$(detect_repo "$CWD")
  fi
}

# ── Repo detection ────────────────────────────────────────────────────────────

detect_repo() {
  local dir="$1"
  basename "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || echo "$dir")"
}

# ── Output helpers ────────────────────────────────────────────────────────────

output_context() {
  local msg="$1"
  jq -nc --arg ctx "$msg" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
}

output_user_prompt_context() {
  local msg="$1"
  jq -nc --arg ctx "$msg" \
    '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
}

output_block() {
  local reason="$1"
  echo "$reason" >&2
  exit 2
}

# ── Telemetry ─────────────────────────────────────────────────────────────────

TELEMETRY_DIR="${HOME}/.claude"
SKILL_TELEMETRY_FILE="${TELEMETRY_DIR}/skill-telemetry.jsonl"
TOOL_TELEMETRY_FILE="${TELEMETRY_DIR}/tool-telemetry.jsonl"
SESSION_TELEMETRY_FILE="${TELEMETRY_DIR}/session-telemetry.jsonl"

log_telemetry() {
  local file="$1"
  local json_line="$2"
  # Atomic append — single echo below PIPE_BUF (safe on all POSIX systems)
  echo "$json_line" >> "$file"
}

# ── Timestamp ─────────────────────────────────────────────────────────────────

iso_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}
