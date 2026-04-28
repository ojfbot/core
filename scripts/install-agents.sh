#!/usr/bin/env bash
# install-agents.sh — install core skills into any ojfbot sibling repo
#
# Usage:
#   ./scripts/install-agents.sh <target-repo-path> [--force]
#   ./scripts/install-agents.sh cv-builder           # relative name (sibling repo)
#   ./scripts/install-agents.sh ../cv-builder
#   ./scripts/install-agents.sh /Users/yuri/ojfbot/cv-builder
#   ./scripts/install-agents.sh cv-builder --force   # overwrite existing symlinks
#
# What it does:
#   1. Creates .claude/skills/ with symlinks to all core skill directories
#      Each skill is a directory: .claude/skills/<name>/ with <name>.md + knowledge/ + scripts/
#      Symlinking the directory gives the target repo the full skill tree automatically.
#      Also creates .claude/commands → skills/ backward-compat symlink.
#   2. Creates domain-knowledge/ with symlinks to the universal context files
#   3. Optionally links the repo-specific architecture file (auto-detected by name)
#   4. Creates decisions/adr/ + decisions/okr/ for repo-local decisions (domain isolation)
#      Adds decisions/core/ → core/decisions/ symlink for cluster-wide access
#   5. Symlinks personal-knowledge/tbcony-job-target.md if present (local file, gitignored)
#   6. Symlinks scripts/hooks/ and merges hook config into .claude/settings.json
#      Also installs user-level suggest-skill hook (once) into ~/.claude/settings.json
#
# Symlinks are relative so they survive path changes. All ojfbot repos are assumed
# to be siblings under the same parent directory.
#
# MIGRATION NOTE: If upgrading from flat *.md symlinks to skill directories,
# run with --force to remove old flat symlinks and replace with directory symlinks.
# If upgrading from .claude/commands/ to .claude/skills/, run with --force to migrate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(dirname "$SCRIPT_DIR")"
OJFBOT_ROOT="$(dirname "$CORE_DIR")"

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

if [[ "$(realpath "$TARGET")" == "$(realpath "$CORE_DIR")" ]]; then
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

# Compute relative path from TARGET back to CORE_DIR
# e.g. from /ojfbot/cv-builder → ../../core is wrong;
# correct: from cv-builder/.claude/commands/ → ../../../core/.claude/commands/
# We compute: TARGET → CORE_DIR as a relative path, then prepend the depth of the link location.
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

# ── 1. Skills ─────────────────────────────────────────────────────────────────
echo "── Skills (.claude/skills/)"
mkdir -p "$TARGET/.claude/skills"

# Remove stale flat *.md symlinks from the old structure (pre-skill-directory migration)
# Also sweep broken directory symlinks (e.g. dangling links from a repo rename)
# Also migrate old .claude/commands/ real directory → .claude/skills/ (commands→skills rename)
if $FORCE; then
  # Migrate: if .claude/commands is a real directory (not a symlink), move entries to skills/
  if [[ -d "$TARGET/.claude/commands" && ! -L "$TARGET/.claude/commands" ]]; then
    for entry in "$TARGET/.claude/commands"/*/; do
      [[ -e "$entry" || -L "${entry%/}" ]] || continue
      name="$(basename "${entry%/}")"
      [[ ! -e "$TARGET/.claude/skills/$name" && ! -L "$TARGET/.claude/skills/$name" ]] && \
        mv "${entry%/}" "$TARGET/.claude/skills/$name" && \
        echo "  migrated: commands/$name → skills/$name"
    done
    # Remove stale flat *.md links
    for old_link in "$TARGET/.claude/commands/"*.md; do
      [[ -L "$old_link" ]] && rm "$old_link" && echo "  removed stale flat link: $(basename "$old_link")"
    done
    rmdir "$TARGET/.claude/commands" 2>/dev/null || rm -rf "$TARGET/.claude/commands"
    echo "  removed: old .claude/commands/ directory"
  fi
  # Remove broken directory symlinks in skills/
  for dir_link in "$TARGET/.claude/skills"/*/; do
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
for src in "$CORE_DIR/.claude/skills"/*/; do
  [[ -d "$src" ]] || continue
  name="$(basename "$src")"
  link_file "$TARGET/.claude/skills/$name" "$src"
done

# Backward-compat: .claude/commands → skills/ so Claude Code and any hardcoded refs still resolve
COMMANDS_LINK="$TARGET/.claude/commands"
if [[ -L "$COMMANDS_LINK" ]]; then
  : # already a symlink — leave it (or update under --force)
  if $FORCE; then
    rm "$COMMANDS_LINK"
    ln -s skills "$COMMANDS_LINK"
    echo "  updated: .claude/commands → skills/"
  fi
elif [[ ! -e "$COMMANDS_LINK" ]]; then
  ln -s skills "$COMMANDS_LINK"
  echo "  linked: .claude/commands → skills/"
fi
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
  src="$CORE_DIR/domain-knowledge/$f"
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
  lean-canvas)  ARCH_FILE="lean-canvas-architecture.md" ;;
  beaverGame|beaver-game) ARCH_FILE="beavergame-architecture.md" ;;
  asset-foundry) ARCH_FILE="asset-foundry-architecture.md" ;;
  shell)        ARCH_FILE="" ;;  # frame-os-context covers the shell
esac

if [[ -n "$ARCH_FILE" ]]; then
  src="$CORE_DIR/domain-knowledge/$ARCH_FILE"
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
  link_file "$DECISIONS_DIR/core" "$CORE_DIR/decisions"
fi
echo ""

# ── 5. Personal context ───────────────────────────────────────────────────────
PERSONAL_SRC="$CORE_DIR/personal-knowledge/tbcony-job-target.md"
if [[ -f "$PERSONAL_SRC" ]]; then
  echo "── Personal context (tbcony-job-target.md)"
  mkdir -p "$TARGET/personal-knowledge"
  link_file "$TARGET/personal-knowledge/tbcony-job-target.md" "$PERSONAL_SRC"
  echo ""
fi

# ── 6. Hooks (scripts/hooks/) ────────────────────────────────────────────────
echo "── Hooks (scripts/hooks/)"
if [[ -d "$CORE_DIR/scripts/hooks" ]]; then
  mkdir -p "$TARGET/scripts/hooks"
  for hook_script in "$CORE_DIR/scripts/hooks"/*.sh "$CORE_DIR/scripts/hooks"/*.mjs; do
    [[ -f "$hook_script" ]] || continue
    name="$(basename "$hook_script")"
    link_file "$TARGET/scripts/hooks/$name" "$hook_script"
  done
  echo ""

  # Merge PostToolUse Skill logger hook into target's .claude/settings.json
  TARGET_SETTINGS="$TARGET/.claude/settings.json"
  if [[ ! -f "$TARGET_SETTINGS" ]]; then
    # Create minimal settings.json with just the hook config
    echo '{"permissions":{},"hooks":{"PostToolUse":[{"matcher":"Skill","hooks":[{"type":"command","command":"\"$CLAUDE_PROJECT_DIR/scripts/hooks/log-skill.sh\"","async":true}]}]}}' \
      | jq '.' > "$TARGET_SETTINGS"
    echo "  Created .claude/settings.json with Skill telemetry hook."
  fi
  if [[ -f "$TARGET_SETTINGS" ]]; then
    # Check if Skill telemetry hook is already configured
    if ! grep -q '"Skill"' "$TARGET_SETTINGS" 2>/dev/null; then
      echo "  Adding Skill telemetry hook to .claude/settings.json..."
      # Use jq to merge the hook (requires existing hooks.PostToolUse array)
      if jq -e '.hooks.PostToolUse' "$TARGET_SETTINGS" >/dev/null 2>&1; then
        # PostToolUse array exists — append to it
        jq '.hooks.PostToolUse += [{"matcher":"Skill","hooks":[{"type":"command","command":"\"$CLAUDE_PROJECT_DIR/scripts/hooks/log-skill.sh\"","async":true}]}]' \
          "$TARGET_SETTINGS" > "${TARGET_SETTINGS}.tmp" && mv "${TARGET_SETTINGS}.tmp" "$TARGET_SETTINGS"
      elif jq -e '.hooks' "$TARGET_SETTINGS" >/dev/null 2>&1; then
        # hooks object exists but no PostToolUse — add it
        jq '.hooks.PostToolUse = [{"matcher":"Skill","hooks":[{"type":"command","command":"\"$CLAUDE_PROJECT_DIR/scripts/hooks/log-skill.sh\"","async":true}]}]' \
          "$TARGET_SETTINGS" > "${TARGET_SETTINGS}.tmp" && mv "${TARGET_SETTINGS}.tmp" "$TARGET_SETTINGS"
      else
        # No hooks at all — add the whole block
        jq '. + {"hooks":{"PostToolUse":[{"matcher":"Skill","hooks":[{"type":"command","command":"\"$CLAUDE_PROJECT_DIR/scripts/hooks/log-skill.sh\"","async":true}]}]}}' \
          "$TARGET_SETTINGS" > "${TARGET_SETTINGS}.tmp" && mv "${TARGET_SETTINGS}.tmp" "$TARGET_SETTINGS"
      fi
      echo "  done."
    else
      echo "  Skill hook already configured."
    fi

    # Merge bead-session hook into target's settings.json (Skill + Bash matchers)
    if ! grep -q 'bead-session.sh' "$TARGET_SETTINGS" 2>/dev/null; then
      echo "  Adding bead-session hook to .claude/settings.json..."
      # Append bead-session.sh to the existing Skill matcher's hooks array
      if jq -e '.hooks.PostToolUse[] | select(.matcher == "Skill")' "$TARGET_SETTINGS" >/dev/null 2>&1; then
        jq '(.hooks.PostToolUse[] | select(.matcher == "Skill") | .hooks) += [{"type":"command","command":"\"$CLAUDE_PROJECT_DIR/scripts/hooks/bead-session.sh\""}]' \
          "$TARGET_SETTINGS" > "${TARGET_SETTINGS}.tmp" && mv "${TARGET_SETTINGS}.tmp" "$TARGET_SETTINGS"
      fi
      # Add Bash matcher for bead-session.sh (commit/PR tracking)
      if jq -e '.hooks.PostToolUse' "$TARGET_SETTINGS" >/dev/null 2>&1; then
        jq '.hooks.PostToolUse += [{"matcher":"Bash","hooks":[{"type":"command","command":"\"$CLAUDE_PROJECT_DIR/scripts/hooks/bead-session.sh\""}]}]' \
          "$TARGET_SETTINGS" > "${TARGET_SETTINGS}.tmp" && mv "${TARGET_SETTINGS}.tmp" "$TARGET_SETTINGS"
      fi
      echo "  done."
    else
      echo "  Bead-session hook already configured."
    fi
  fi
else
  echo "  (no hooks directory in core — skipping)"
fi
echo ""

# Install user-level hooks (once, not per-repo)
USER_SETTINGS="${HOME}/.claude/settings.json"

# session-init.sh — creates session bead on first user message (Tier 0 initializer)
SESSION_INIT_HOOK="$CORE_DIR/scripts/hooks/session-init.sh"
if [[ -f "$SESSION_INIT_HOOK" && -f "$USER_SETTINGS" ]]; then
  if ! grep -q "session-init.sh" "$USER_SETTINGS" 2>/dev/null; then
    echo "── User-level hook (session-init.sh)"
    if jq -e '.hooks.UserPromptSubmit' "$USER_SETTINGS" >/dev/null 2>&1; then
      # Prepend to UserPromptSubmit array (session-init should run first)
      jq --arg cmd "$SESSION_INIT_HOOK" \
        '.hooks.UserPromptSubmit = [{"hooks":[{"type":"command","command":$cmd}]}] + .hooks.UserPromptSubmit' \
        "$USER_SETTINGS" > "${USER_SETTINGS}.tmp" && mv "${USER_SETTINGS}.tmp" "$USER_SETTINGS"
    elif jq -e '.hooks' "$USER_SETTINGS" >/dev/null 2>&1; then
      jq --arg cmd "$SESSION_INIT_HOOK" \
        '.hooks.UserPromptSubmit = [{"hooks":[{"type":"command","command":$cmd}]}]' \
        "$USER_SETTINGS" > "${USER_SETTINGS}.tmp" && mv "${USER_SETTINGS}.tmp" "$USER_SETTINGS"
    else
      jq --arg cmd "$SESSION_INIT_HOOK" \
        '. + {"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":$cmd}]}]}}' \
        "$USER_SETTINGS" > "${USER_SETTINGS}.tmp" && mv "${USER_SETTINGS}.tmp" "$USER_SETTINGS"
    fi
    echo "  Added session-init.sh to ~/.claude/settings.json"
    echo ""
  fi
fi

# suggest-skill.sh — suggests relevant skills based on prompt content
SUGGEST_HOOK="$CORE_DIR/scripts/hooks/suggest-skill.sh"
if [[ -f "$SUGGEST_HOOK" && -f "$USER_SETTINGS" ]]; then
  if ! grep -q "suggest-skill.sh" "$USER_SETTINGS" 2>/dev/null; then
    echo "── User-level hook (suggest-skill.sh)"
    if jq -e '.hooks.UserPromptSubmit' "$USER_SETTINGS" >/dev/null 2>&1; then
      jq --arg cmd "$SUGGEST_HOOK" \
        '.hooks.UserPromptSubmit += [{"hooks":[{"type":"command","command":$cmd}]}]' \
        "$USER_SETTINGS" > "${USER_SETTINGS}.tmp" && mv "${USER_SETTINGS}.tmp" "$USER_SETTINGS"
    elif jq -e '.hooks' "$USER_SETTINGS" >/dev/null 2>&1; then
      jq --arg cmd "$SUGGEST_HOOK" \
        '.hooks.UserPromptSubmit = [{"hooks":[{"type":"command","command":$cmd}]}]' \
        "$USER_SETTINGS" > "${USER_SETTINGS}.tmp" && mv "${USER_SETTINGS}.tmp" "$USER_SETTINGS"
    else
      jq --arg cmd "$SUGGEST_HOOK" \
        '. + {"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":$cmd}]}]}}' \
        "$USER_SETTINGS" > "${USER_SETTINGS}.tmp" && mv "${USER_SETTINGS}.tmp" "$USER_SETTINGS"
    fi
    echo "  Added suggest-skill.sh to ~/.claude/settings.json"
    echo ""
  fi
fi

# ── 6b. GitHub Actions workflow (claude-skill-audit.yml) ─────────────────────
AUDIT_WORKFLOW="$CORE_DIR/.github/workflows/claude-skill-audit.yml"
if [[ -f "$AUDIT_WORKFLOW" ]]; then
  echo "── GitHub Actions workflow"
  mkdir -p "$TARGET/.github/workflows"
  TARGET_WORKFLOW="$TARGET/.github/workflows/claude-skill-audit.yml"
  if [[ ! -f "$TARGET_WORKFLOW" ]]; then
    cp "$AUDIT_WORKFLOW" "$TARGET_WORKFLOW"
    echo "  copied claude-skill-audit.yml"
    CREATED=$((CREATED + 1))
  else
    echo "  claude-skill-audit.yml already exists (not overwritten)"
    SKIPPED=$((SKIPPED + 1))
  fi
  echo ""
fi

# ── 7. Standup extension template ─────────────────────────────────────────────
# Creates a template .claude/standup.md if one does not exist.
# Never overwrites an existing standup.md — each repo owns its own.
STANDUP_FILE="$TARGET/.claude/standup.md"
if [[ ! -f "$STANDUP_FILE" ]]; then
  echo "── Standup extension template"
  cat > "$STANDUP_FILE" << 'STANDUP_EOF'
# Standup Extension — REPO_NAME

## Current blockers
- (none)

## This week's priorities
- P1: (update with this week's priorities)

## Open work
- [ ] (update with current tasks)

## Context for today
(free-form notes for /frame-standup planning context)
STANDUP_EOF
  sed -i '' "s/REPO_NAME/$REPO_NAME/" "$STANDUP_FILE"
  echo "  created: .claude/standup.md (template — edit with app-specific context)"
  CREATED=$((CREATED + 1))
  echo ""
else
  echo "── Standup extension: .claude/standup.md already exists (not overwritten)"
  echo ""
fi

# ── 8. Summary ────────────────────────────────────────────────────────────────
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
