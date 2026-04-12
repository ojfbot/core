#!/usr/bin/env bash
# bead-session.sh — PostToolUse hook for agent bead coordination
#
# Tracks work within a session by linking task/PR beads to the agent bead,
# recording skill invocations on the agent, and posting skill usage comments
# on PRs when they are created or pushed to.
#
# Hook events handled:
#   PostToolUse (Skill)              → record skill on agent, sling task if applicable
#   PostToolUse (Bash: git commit)   → create task bead, sling onto agent hook
#   PostToolUse (Bash: gh pr create) → create PR bead, link to agent, post skill comment
#   PostToolUse (Bash: git push)     → post skill update comment on PR
#
# Install: Add to .claude/settings.json PostToolUse hooks
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/_lib.sh"

BEAD_EMIT="$HOOK_DIR/bead-emit.mjs"

# Bail if Dolt isn't running
if ! lsof -i :${DOLT_PORT:-3307} >/dev/null 2>&1; then
  # Still allow PR skill comments even without Dolt
  DOLT_AVAILABLE=false
else
  DOLT_AVAILABLE=true
fi

read_hook_input

# Session ID tracking file — contains agent bead ID (e.g. trip-agent-worker)
SESSION_FILE="/tmp/claude-bead-session-${SESSION_ID}"

# Read agent ID from sentinel (set by session-init.sh)
AGENT_ID=""
if [[ -f "$SESSION_FILE" ]]; then
  AGENT_ID=$(cat "$SESSION_FILE")
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

# Generate a skill usage comment for the current session.
# Reads skill-telemetry, suggestion-telemetry, and tool-telemetry filtered by session_id.
# Args: $1 = "initial" or "update"
generate_skill_comment() {
  local comment_type="${1:-initial}"
  local marker="<!-- skill-usage-report -->"
  local last_comment_ts=""

  if [[ "$comment_type" == "update" ]]; then
    marker="<!-- skill-usage-update $(iso_now) -->"
    # Find the most recent skill:pr-commented event for this session
    if [[ -f "$SKILL_TELEMETRY_FILE" && -s "$SKILL_TELEMETRY_FILE" ]]; then
      last_comment_ts=$(jq -r --arg sid "$SESSION_ID" \
        'select(.session_id == $sid and .event == "skill:pr-commented") | .ts' \
        "$SKILL_TELEMETRY_FILE" 2>/dev/null | tail -1)
    fi
  fi

  # Collect skills invoked this session (or since last comment for updates)
  local skills_json="[]"
  if [[ -f "$SKILL_TELEMETRY_FILE" && -s "$SKILL_TELEMETRY_FILE" ]]; then
    if [[ -n "$last_comment_ts" ]]; then
      skills_json=$(jq -sc --arg sid "$SESSION_ID" --arg since "$last_comment_ts" \
        '[.[] | select(.session_id == $sid and .event == "skill:invoked" and .ts > $since)]' \
        "$SKILL_TELEMETRY_FILE" 2>/dev/null || echo "[]")
    else
      skills_json=$(jq -sc --arg sid "$SESSION_ID" \
        '[.[] | select(.session_id == $sid and .event == "skill:invoked")]' \
        "$SKILL_TELEMETRY_FILE" 2>/dev/null || echo "[]")
    fi
  fi

  local skill_count
  skill_count=$(echo "$skills_json" | jq 'length')

  # For updates, skip if no new skills since last comment
  if [[ "$comment_type" == "update" && "$skill_count" -eq 0 ]]; then
    echo ""
    return
  fi

  # Build skill usage lines
  local skill_lines=""
  if [[ "$skill_count" -gt 0 ]]; then
    skill_lines=$(echo "$skills_json" | jq -r \
      '[group_by(.skill)[] | {name: .[0].skill, count: length}] | sort_by(-.count)[] | "- `/" + .name + "` (" + (.count | tostring) + "x)"')
  fi

  # Collect suggestion funnel
  local suggestions_given=0
  local suggestions_followed=0
  if [[ -f "$SUGGESTION_TELEMETRY_FILE" && -s "$SUGGESTION_TELEMETRY_FILE" ]]; then
    suggestions_given=$(jq -sc --arg sid "$SESSION_ID" \
      '[.[] | select(.session_id == $sid and .event == "skill:suggested")] | length' \
      "$SUGGESTION_TELEMETRY_FILE" 2>/dev/null || echo "0")
  fi
  if [[ -f "$SKILL_TELEMETRY_FILE" && -s "$SKILL_TELEMETRY_FILE" ]]; then
    suggestions_followed=$(jq -sc --arg sid "$SESSION_ID" \
      '[.[] | select(.session_id == $sid and .event == "skill:suggestion-followed")] | length' \
      "$SKILL_TELEMETRY_FILE" 2>/dev/null || echo "0")
  fi

  # Quality gate check
  local quality_skills="validate|hardening|lint-audit|test-expand"
  local quality_used=""
  if [[ "$skill_count" -gt 0 ]]; then
    quality_used=$(echo "$skills_json" | jq -r \
      --arg re "$quality_skills" \
      '[.[] | select(.skill | test($re))] | [.[].skill] | unique | .[]' 2>/dev/null || echo "")
  fi

  # Tool breakdown for this session
  local tool_breakdown=""
  if [[ -f "$TOOL_TELEMETRY_FILE" && -s "$TOOL_TELEMETRY_FILE" ]]; then
    tool_breakdown=$(jq -r --arg sid "$SESSION_ID" \
      'select(.session_id == $sid) | .tool_name' \
      "$TOOL_TELEMETRY_FILE" 2>/dev/null | sort | uniq -c | sort -rn | head -5 | \
      awk '{printf "| %s | %s |\n", $2, $1}')
  fi

  # Build the comment
  local body=""
  if [[ "$comment_type" == "initial" ]]; then
    body="$marker
## Skill Usage Report

**Session:** \`${SESSION_ID:0:8}\` | **Repo:** \`$REPO\`
"
  else
    body="$marker
### Skill Usage Update

**Push at:** $(iso_now)
"
  fi

  if [[ "$skill_count" -gt 0 ]]; then
    body+="
**Skills invoked${comment_type:+ ($comment_type)}:**
$skill_lines
"
  else
    body+="
_No skills were invoked during this ${comment_type}._
"
  fi

  # Suggestion funnel (only on initial)
  if [[ "$comment_type" == "initial" && "$suggestions_given" -gt 0 ]]; then
    local conversion=0
    if [[ "$suggestions_given" -gt 0 ]]; then
      conversion=$(( (suggestions_followed * 100) / suggestions_given ))
    fi
    body+="
**Suggestion funnel:** $suggestions_given offered, $suggestions_followed followed (${conversion}% conversion)
"
  fi

  # Quality gate status
  if [[ "$comment_type" == "initial" ]]; then
    body+="
**Quality gates:**"
    for gate in validate hardening lint-audit test-expand; do
      if echo "$quality_used" | grep -q "^${gate}$" 2>/dev/null; then
        body+=" \`/$gate\` ran |"
      else
        body+=" \`/$gate\` skipped |"
      fi
    done
    body="${body%|}"  # remove trailing pipe
    body+="
"
  fi

  # Tool breakdown (only on initial)
  if [[ "$comment_type" == "initial" && -n "$tool_breakdown" ]]; then
    body+="
<details>
<summary>Tool breakdown</summary>

| Tool | Calls |
|------|-------|
$tool_breakdown

</details>
"
  fi

  body+="
---
_Auto-generated by [skill-telemetry](https://github.com/ojfbot/core) hooks_"

  echo "$body"
}

# Post a comment on a PR and log the event.
# Args: $1 = PR number, $2 = comment body
post_pr_skill_comment() {
  local pr_number="$1"
  local body="$2"

  if [[ -z "$body" || -z "$pr_number" ]]; then
    return
  fi

  # Post the comment (run in background to avoid blocking)
  gh pr comment "$pr_number" --body "$body" >/dev/null 2>&1 || true

  # Log the event
  local ts
  ts=$(iso_now)
  local line
  line=$(jq -nc \
    --arg ts "$ts" \
    --arg event "skill:pr-commented" \
    --arg repo "$REPO" \
    --arg pr "$pr_number" \
    --arg sid "$SESSION_ID" \
    '{ts:$ts, event:$event, repo:$repo, pr:$pr, session_id:$sid}')
  log_telemetry "$SKILL_TELEMETRY_FILE" "$line"
}

# ── Skill invocation → record on agent bead ───────────────────────────────────
if [[ "$TOOL_NAME" == "Skill" && -n "$TOOL_INPUT_SKILL" ]]; then
  if [[ "$DOLT_AVAILABLE" == "true" ]]; then
    if [[ "$AGENT_ID" == "none" || -z "$AGENT_ID" ]]; then
      # No agent bead exists — create one now (defensive fallback)
      RESULT=$(node "$BEAD_EMIT" agent-create \
        --role=worker --app="$REPO" --session-id="$SESSION_ID" 2>/dev/null || echo '{}')
      AGENT_ID=$(echo "$RESULT" | jq -r '.id // empty')
      [[ -n "$AGENT_ID" ]] && echo "$AGENT_ID" > "$SESSION_FILE"
    fi

    # Record the skill invocation on the session (backward-compat with session-update)
    if [[ -n "$AGENT_ID" && "$AGENT_ID" != "none" ]]; then
      node "$BEAD_EMIT" session-update \
        --session-id="$SESSION_ID" \
        --skill="$TOOL_INPUT_SKILL" >/dev/null 2>&1 || true
    fi
  fi
  exit 0
fi

# ── git commit → task bead, sling onto agent ──────────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'git commit'; then
  if [[ "$DOLT_AVAILABLE" == "true" && -n "$AGENT_ID" && "$AGENT_ID" != "none" ]]; then
    # Extract commit message from the command (best effort)
    TITLE=$(echo "$TOOL_INPUT_COMMAND" | grep -oP '(?<=-m ").*?(?=")' | head -1 || echo "commit")
    RESULT=$(node "$BEAD_EMIT" task-done \
      --title="${TITLE:0:200}" \
      --session-id="$SESSION_ID" \
      --repo="$REPO" \
      --prefix="${REPO:0:4}" 2>/dev/null || echo '{}')
    TASK_ID=$(echo "$RESULT" | jq -r '.id // empty')

    # Sling the task onto the agent's hook
    if [[ -n "$TASK_ID" ]]; then
      node "$BEAD_EMIT" agent-sling \
        --agent-id="$AGENT_ID" \
        --bead-id="$TASK_ID" >/dev/null 2>&1 || true
    fi

    # Update session with repo touched
    node "$BEAD_EMIT" session-update \
      --session-id="$SESSION_ID" \
      --repos="$REPO" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# ── gh pr create → PR bead, skill usage comment ──────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'gh pr create'; then
  # Resolve PR number from the current branch (gh pr create just ran)
  PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null || echo "")

  if [[ "$DOLT_AVAILABLE" == "true" && -n "$AGENT_ID" && "$AGENT_ID" != "none" ]]; then
    RESULT=$(node "$BEAD_EMIT" pr-created \
      --repo="$REPO" \
      --pr="${PR_NUMBER:-pending}" \
      --session-id="$SESSION_ID" \
      --prefix="${REPO:0:4}" 2>/dev/null || echo '{}')
    PR_BEAD_ID=$(echo "$RESULT" | jq -r '.id // empty')

    # Sling the PR bead onto the agent's hook
    if [[ -n "$PR_BEAD_ID" ]]; then
      node "$BEAD_EMIT" agent-sling \
        --agent-id="$AGENT_ID" \
        --bead-id="$PR_BEAD_ID" >/dev/null 2>&1 || true
    fi
  fi

  # Post skill usage comment on the PR
  if [[ -n "$PR_NUMBER" ]]; then
    # Store PR number for push handler
    echo "$PR_NUMBER" > "/tmp/claude-pr-${SESSION_ID}"

    COMMENT_BODY=$(generate_skill_comment "initial")
    post_pr_skill_comment "$PR_NUMBER" "$COMMENT_BODY"
  fi
  exit 0
fi

# ── git push → skill usage update comment on PR ──────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$TOOL_INPUT_COMMAND" | grep -q 'git push'; then
  # Resolve PR number: check session cache first, then query gh
  PR_NUMBER=""
  if [[ -f "/tmp/claude-pr-${SESSION_ID}" ]]; then
    PR_NUMBER=$(cat "/tmp/claude-pr-${SESSION_ID}")
  fi
  if [[ -z "$PR_NUMBER" ]]; then
    PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null || echo "")
  fi

  if [[ -n "$PR_NUMBER" ]]; then
    # Cache for next push
    echo "$PR_NUMBER" > "/tmp/claude-pr-${SESSION_ID}"

    COMMENT_BODY=$(generate_skill_comment "update")
    # generate_skill_comment returns "" if no new skills — skip posting
    if [[ -n "$COMMENT_BODY" ]]; then
      post_pr_skill_comment "$PR_NUMBER" "$COMMENT_BODY"
    fi
  fi
  exit 0
fi
