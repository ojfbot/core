#!/usr/bin/env bash
# install-agents.sh — install core slash commands into any ojfbot sibling repo
#
# Usage:
#   ./scripts/install-agents.sh <target-repo-path> [--force]
#   ./scripts/install-agents.sh cv-builder           # relative name (sibling repo)
#   ./scripts/install-agents.sh ../cv-builder
#   ./scripts/install-agents.sh /Users/yuri/ojfbot/cv-builder
#   ./scripts/install-agents.sh cv-builder --force   # overwrite existing symlinks
#
# What it does:
#   1. Creates .claude/commands/ with symlinks to all core skill directories
#      Each skill is a directory: .claude/commands/<name>/ with <name>.md + knowledge/ + scripts/
#      Symlinking the directory gives the target repo the full skill tree automatically.
#   2. Creates domain-knowledge/ with symlinks to the universal context files
#   3. Optionally links the repo-specific architecture file (auto-detected by name)
#   4. Creates decisions/adr/ + decisions/okr/ for repo-local decisions (domain isolation)
#      Adds decisions/core/ → core/decisions/ symlink for cluster-wide access
#   5. Symlinks personal-knowledge/tbcony-job-target.md if present (local file, gitignored)
#
# Symlinks are relative so they survive path changes. All ojfbot repos are assumed
# to be siblings under the same parent directory.
#
# MIGRATION NOTE: If upgrading from flat *.md symlinks to skill directories,
# run with --force to remove old flat symlinks and replace with directory symlinks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_TEMPLATE="$(dirname "$SCRIPT_DIR")"
OJFBOT_ROOT="$(dirname "$NODE_TEMPLATE")"

FORCE=false
TARGET_ARG=""

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    *) TARGET_ARG="$arg" ;;
  esac
done

if [[ -z "$TARGET_ARG" ]]; then
  echo "Usage: $0 <target-repo> [--force]"
  echo ""
  echo "Available sibling repos:"
  for d in "$OJFBOT_ROOT"/*/; do
    name="$(basename "$d")"
    [[ "$name" == "core" ]] && continue
    [[ -d "$d/.git" ]] && echo "  $name"
  done
  exit 1
fi

# Resolve target path
if [[ -d "$TARGET_ARG" ]]; then
  TARGET="$(cd "$TARGET_ARG" && pwd)"
elif [[ -d "$OJFBOT_ROOT/$TARGET_ARG" ]]; then
  TARGET="$(cd "$OJFBOT_ROOT/$TARGET_ARG" && pwd)"
else
  echo "Error: cannot find repo '$TARGET_ARG' (checked . and $OJFBOT_ROOT/)"
  exit 1
fi

if [[ "$(realpath "$TARGET")" == "$(realpath "$NODE_TEMPLATE")" ]]; then
  echo "Error: cannot install into core itself"
  exit 1
fi

if [[ ! -d "$TARGET/.git" ]]; then
  echo "Warning: $TARGET has no .git directory — is this really a repo?"
  read -r -p "Continue anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

REPO_NAME="$(basename "$TARGET")"
echo "Installing core agents into: $TARGET ($REPO_NAME)"
echo ""

# Compute relative path from TARGET back to NODE_TEMPLATE
# e.g. from /ojfbot/cv-builder → ../../core is wrong;
# correct: from cv-builder/.claude/commands/ → ../../../core/.claude/commands/
# We compute: TARGET → NODE_TEMPLATE as a relative path, then prepend the depth of the link location.
#
# Helper: relative path from $1 to $2 (both absolute)
rel_path() {
  python3 -c "import os; print(os.path.relpath('$2', '$1'))"
}

CREATED=0
SKIPPED=0
WARNED=0

link_file() {
  local link="$1"     # absolute path where the symlink should be created
  local target="$2"   # absolute path of what the symlink should point to

  local link_dir
  link_dir="$(dirname "$link")"
  local rel_target
  rel_target="$(rel_path "$link_dir" "$target")"

  if [[ -L "$link" ]]; then
    if $FORCE; then
      rm "$link"
      ln -s "$rel_target" "$link"
      echo "  updated: $(basename "$link")"
      CREATED=$((CREATED + 1))
    else
      SKIPPED=$((SKIPPED + 1))
    fi
  elif [[ -e "$link" ]]; then
    echo "  warn: real file exists (not a symlink), skipping: $(basename "$link")"
    WARNED=$((WARNED + 1))
  else
    ln -s "$rel_target" "$link"
    echo "  linked: $(basename "$link")"
    CREATED=$((CREATED + 1))
  fi
}

# ── 1. Commands ───────────────────────────────────────────────────────────────
echo "── Commands (.claude/commands/)"
mkdir -p "$TARGET/.claude/commands"

# Remove stale flat *.md symlinks from the old structure (pre-skill-directory migration)
# Also sweep broken directory symlinks (e.g. dangling links from a repo rename)
if $FORCE; then
  for old_link in "$TARGET/.claude/commands/"*.md; do
    [[ -L "$old_link" ]] && rm "$old_link" && echo "  removed stale flat link: $(basename "$old_link")"
  done
  # Remove broken directory symlinks (dead targets — dangling after a rename)
  for dir_link in "$TARGET/.claude/commands"/*/; do
    real="${dir_link%/}"
    if [[ -L "$real" && ! -e "$real" ]]; then
      rm "$real"
      echo "  removed broken dir link: $(basename "$real")"
    fi
  done
  # Same sweep for domain-knowledge/
  for dk_link in "$TARGET/domain-knowledge"/*; do
    if [[ -L "$dk_link" && ! -e "$dk_link" ]]; then
      rm "$dk_link"
      echo "  removed broken dk link: $(basename "$dk_link")"
    fi
  done
fi

# Symlink each skill directory (the directory contains <name>.md + knowledge/ + scripts/)
for src in "$NODE_TEMPLATE/.claude/commands"/*/; do
  [[ -d "$src" ]] || continue
  name="$(basename "$src")"
  link_file "$TARGET/.claude/commands/$name" "$src"
done
echo ""

# ── 2. Universal domain-knowledge files ──────────────────────────────────────
echo "── Universal domain-knowledge files"
mkdir -p "$TARGET/domain-knowledge"

UNIVERSAL=(
  frame-os-context.md
  app-templates.md
  shared-stack.md
  langgraph-patterns.md
  workbench-architecture.md
  tbcony-dia-context.md
)

for f in "${UNIVERSAL[@]}"; do
  src="$NODE_TEMPLATE/domain-knowledge/$f"
  if [[ ! -f "$src" ]]; then
    echo "  warn: source not found, skipping: $f"
    WARNED=$((WARNED + 1))
    continue
  fi
  link_file "$TARGET/domain-knowledge/$f" "$src"
done
echo ""

# ── 3. Repo-specific architecture file (auto-detected) ───────────────────────
ARCH_FILE=""
case "$REPO_NAME" in
  cv-builder)   ARCH_FILE="cv-builder-architecture.md" ;;
  blogengine)   ARCH_FILE="blogengine-architecture.md" ;;
  TripPlanner|tripplanner) ARCH_FILE="tripplanner-architecture.md" ;;
  mrplug|MrPlug) ARCH_FILE="mrplug-architecture.md" ;;
  purefoy)      ARCH_FILE="purefoy-architecture.md" ;;
  daily-logger) ARCH_FILE="daily-logger-architecture.md" ;;
  shell)        ARCH_FILE="" ;;  # frame-os-context covers the shell
esac

if [[ -n "$ARCH_FILE" ]]; then
  src="$NODE_TEMPLATE/domain-knowledge/$ARCH_FILE"
  if [[ -f "$src" ]]; then
    echo "── Repo-specific architecture file"
    link_file "$TARGET/domain-knowledge/$ARCH_FILE" "$src"
    echo ""
  fi
fi

# ── 4. Decisions ─────────────────────────────────────────────────────────────
# Structure: decisions/adr/ + decisions/okr/ for repo-local decisions (domain isolation)
#            decisions/core/ → symlink to core/decisions/ for cluster-wide ADRs + OKRs
#
# Migration: if decisions was previously a flat symlink to core (old approach), convert it
# to a real directory under --force. The core/ sub-symlink gives the same access.
echo "── Decisions (local + core/)"
DECISIONS_DIR="$TARGET/decisions"

# Migrate flat symlink → real dir (rename recovery or old-style install)
if [[ -L "$DECISIONS_DIR" ]]; then
  if $FORCE; then
    rm "$DECISIONS_DIR"
    mkdir -p "$DECISIONS_DIR/adr" "$DECISIONS_DIR/okr"
    echo "  migrated: decisions/ (flat symlink → real dir with adr/ okr/)"
    CREATED=$((CREATED + 1))
  else
    echo "  warn: decisions/ is a flat symlink to core — run with --force to migrate to nested structure"
    WARNED=$((WARNED + 1))
  fi
elif [[ ! -d "$DECISIONS_DIR" ]]; then
  mkdir -p "$DECISIONS_DIR/adr" "$DECISIONS_DIR/okr"
  echo "  created: decisions/adr/ decisions/okr/"
  CREATED=$((CREATED + 2))
fi

# Add decisions/core/ → core/decisions/ symlink (cluster-wide decisions, read-only by convention)
if [[ -d "$DECISIONS_DIR" && ! -L "$DECISIONS_DIR" ]]; then
  link_file "$DECISIONS_DIR/core" "$NODE_TEMPLATE/decisions"
fi
echo ""

# ── 5. Personal context ───────────────────────────────────────────────────────
PERSONAL_SRC="$NODE_TEMPLATE/personal-knowledge/tbcony-job-target.md"
if [[ -f "$PERSONAL_SRC" ]]; then
  echo "── Personal context (tbcony-job-target.md)"
  mkdir -p "$TARGET/personal-knowledge"
  link_file "$TARGET/personal-knowledge/tbcony-job-target.md" "$PERSONAL_SRC"
  echo ""
fi

# ── 6. Summary ────────────────────────────────────────────────────────────────
echo "Done."
echo "  Created/updated: $CREATED"
echo "  Skipped (already linked): $SKIPPED"
[[ $WARNED -gt 0 ]] && echo "  Warnings: $WARNED"
echo ""

# Remind about CLAUDE.md if missing
if [[ ! -f "$TARGET/CLAUDE.md" ]]; then
  echo "Note: $REPO_NAME has no CLAUDE.md."
  echo "      Add one referencing domain-knowledge/frame-os-context.md as the first read."
fi
