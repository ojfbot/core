#!/usr/bin/env bash
# sync-telemetry.sh — Push local Claude Code telemetry to a git branch
#
# Filters ~/.claude/*.jsonl to a configurable window (default 48h),
# commits the filtered snapshots to a telemetry/daily orphan branch
# in the core repo. CI workflows (skill-audit, daily-logger) fetch
# this branch to access telemetry data that only exists locally.
#
# Usage:
#   bash scripts/sync-telemetry.sh              # last 48h
#   bash scripts/sync-telemetry.sh --since=24h  # last 24h
#   bash scripts/sync-telemetry.sh --since=7d   # last 7 days
#   bash scripts/sync-telemetry.sh --dry-run    # show what would be pushed
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TELEMETRY_DIR="${HOME}/.claude"
BRANCH="telemetry/daily"
SINCE="48h"
DRY_RUN=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --since=*) SINCE="${arg#*=}" ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# Convert --since to a cutoff timestamp
case "$SINCE" in
  *h)
    HOURS="${SINCE%h}"
    if [[ "$(uname)" == "Darwin" ]]; then
      CUTOFF=$(date -u -v-${HOURS}H +"%Y-%m-%dT%H:%M:%SZ")
    else
      CUTOFF=$(date -u -d "${HOURS} hours ago" +"%Y-%m-%dT%H:%M:%SZ")
    fi
    ;;
  *d)
    DAYS="${SINCE%d}"
    if [[ "$(uname)" == "Darwin" ]]; then
      CUTOFF=$(date -u -v-${DAYS}d +"%Y-%m-%dT%H:%M:%SZ")
    else
      CUTOFF=$(date -u -d "${DAYS} days ago" +"%Y-%m-%dT%H:%M:%SZ")
    fi
    ;;
  *)
    echo "Invalid --since format. Use Nh (hours) or Nd (days)." >&2
    exit 1
    ;;
esac

echo "Syncing telemetry since $CUTOFF (--since=$SINCE)"

# Check telemetry files exist
TOOL_FILE="$TELEMETRY_DIR/tool-telemetry.jsonl"
SKILL_FILE="$TELEMETRY_DIR/skill-telemetry.jsonl"
SESSION_FILE="$TELEMETRY_DIR/session-telemetry.jsonl"

has_data=false
for f in "$TOOL_FILE" "$SKILL_FILE" "$SESSION_FILE"; do
  if [[ -f "$f" && -s "$f" ]]; then
    has_data=true
    break
  fi
done

if [[ "$has_data" == "false" ]]; then
  echo "No telemetry data found in $TELEMETRY_DIR — nothing to sync."
  exit 0
fi

# Create temp dir for filtered files
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Filter each file by timestamp
filter_jsonl() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" && -s "$src" ]]; then
    jq -c --arg cutoff "$CUTOFF" 'select(.ts >= $cutoff)' "$src" > "$dst" 2>/dev/null || true
    local count
    count=$(wc -l < "$dst" | tr -d ' ')
    echo "  $(basename "$src"): $count entries (after filtering)"
  else
    touch "$dst"
    echo "  $(basename "$src"): empty/missing — skipped"
  fi
}

filter_jsonl "$TOOL_FILE"    "$TMPDIR/tool-telemetry.jsonl"
filter_jsonl "$SKILL_FILE"   "$TMPDIR/skill-telemetry.jsonl"
filter_jsonl "$SESSION_FILE" "$TMPDIR/session-telemetry.jsonl"

# Add metadata
jq -nc \
  --arg synced_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg since "$SINCE" \
  --arg cutoff "$CUTOFF" \
  --arg hostname "$(hostname)" \
  '{synced_at: $synced_at, since: $since, cutoff: $cutoff, hostname: $hostname}' \
  > "$TMPDIR/sync-metadata.json"

# Check if anything to push
total_lines=0
for f in "$TMPDIR"/*.jsonl; do
  lines=$(wc -l < "$f" | tr -d ' ')
  total_lines=$((total_lines + lines))
done

if [[ "$total_lines" -eq 0 ]]; then
  echo "No telemetry entries in the $SINCE window — nothing to push."
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "[dry-run] Would push $total_lines entries to $BRANCH"
  echo "[dry-run] Files:"
  ls -la "$TMPDIR"
  exit 0
fi

# Use a worktree for the orphan branch
WORKTREE="$TMPDIR/worktree"

cd "$CORE_ROOT"

# Ensure the remote branch exists (create orphan if not)
if ! git ls-remote --heads origin "$BRANCH" | grep -q "$BRANCH"; then
  echo "Creating orphan branch $BRANCH..."
  git worktree add --detach "$WORKTREE"
  cd "$WORKTREE"
  git checkout --orphan "$BRANCH"
  git rm -rf . 2>/dev/null || true
else
  git fetch origin "$BRANCH"
  git worktree add "$WORKTREE" "origin/$BRANCH" 2>/dev/null || {
    # Worktree may already exist from a failed run
    git worktree remove "$WORKTREE" 2>/dev/null || true
    git worktree add "$WORKTREE" "origin/$BRANCH"
  }
  cd "$WORKTREE"
  git checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null || true
fi

# Copy filtered files
cp "$TMPDIR"/tool-telemetry.jsonl .
cp "$TMPDIR"/skill-telemetry.jsonl .
cp "$TMPDIR"/session-telemetry.jsonl .
cp "$TMPDIR"/sync-metadata.json .

# Commit and push
git add -A
if git diff --cached --quiet; then
  echo "No changes to push (telemetry unchanged)."
else
  git commit -m "telemetry: sync $(date -u +%Y-%m-%d) ($total_lines entries, since $SINCE)"
  git push origin "$BRANCH" --force
  echo ""
  echo "Pushed $total_lines entries to origin/$BRANCH"
fi

# Clean up worktree
cd "$CORE_ROOT"
git worktree remove "$WORKTREE" 2>/dev/null || true
