#!/usr/bin/env bash
# audit-ci-health.sh — read-only CI health audit across the ojfbot cluster.
#
# Walks each sibling repo and reports:
#   1. Which GitHub Actions workflows exist
#   2. Non-blocking steps (|| true on test/lint/build commands, continue-on-error: true)
#   3. Workflow steps that reference scripts not tracked in git (the skill-audit drift pattern)
#   4. Repos lacking required-check branch protection on default branch
#
# Output: markdown table to stdout. Pipe to file or read inline.
#
# Usage:
#   ./scripts/audit-ci-health.sh                    # audit all sibling repos
#   ./scripts/audit-ci-health.sh --repo <name>       # audit one repo only
#   ./scripts/audit-ci-health.sh --no-protection     # skip branch-protection check (no gh token needed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(dirname "$SCRIPT_DIR")"
OJFBOT_ROOT="$(dirname "$CORE_DIR")"

CHECK_PROTECTION=true
SINGLE_REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-protection) CHECK_PROTECTION=false; shift ;;
    --repo) SINGLE_REPO="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ── Discover repos ────────────────────────────────────────────────────────────
REPOS=()
if [[ -n "$SINGLE_REPO" ]]; then
  REPOS=("$SINGLE_REPO")
else
  for d in "$OJFBOT_ROOT"/*/; do
    name="$(basename "$d")"
    [[ -d "$d/.git" ]] || continue
    REPOS+=("$name")
  done
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

# List workflow files in a repo
list_workflows() {
  local repo_dir="$1"
  if [[ -d "$repo_dir/.github/workflows" ]]; then
    find "$repo_dir/.github/workflows" -maxdepth 1 -type f \( -name "*.yml" -o -name "*.yaml" \) 2>/dev/null | sort
  fi
}

# Find non-blocking patterns in a workflow file
non_blocking_in_workflow() {
  local wf="$1"
  local hits=()
  # `|| true` on test/lint/build/typecheck lines
  while IFS=: read -r lineno line; do
    [[ -z "$line" ]] && continue
    hits+=("L${lineno}: $(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')")
  done < <(grep -n -E '(pnpm|npm|yarn|bash).*((test|lint|build|typecheck|audit)).*\|\|[[:space:]]+true' "$wf" 2>/dev/null || true)
  # `continue-on-error: true`
  while IFS=: read -r lineno line; do
    [[ -z "$line" ]] && continue
    hits+=("L${lineno}: $(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')")
  done < <(grep -n -E '^\s*continue-on-error:\s*true' "$wf" 2>/dev/null || true)
  if [[ ${#hits[@]} -gt 0 ]]; then
    printf '%s\n' "${hits[@]}"
  fi
}

# Find scripts referenced in a workflow that don't exist as tracked files
drift_in_workflow() {
  local repo_dir="$1"
  local wf="$2"
  local hits=()
  # Extract `bash scripts/...` and `./scripts/...` invocations
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    # Resolve relative to repo root
    local target="$repo_dir/$ref"
    # Tracked-file check: is this in git's index?
    if ! git -C "$repo_dir" ls-files --error-unmatch "$ref" >/dev/null 2>&1; then
      # Distinguish: missing entirely vs. exists locally but untracked (still drift for CI)
      if [[ -e "$target" || -L "$target" ]]; then
        hits+=("UNTRACKED: $ref (exists locally as symlink/file but not in git)")
      else
        hits+=("MISSING:   $ref (not present at all)")
      fi
    fi
  done < <(grep -hoE '(bash[[:space:]]+|\./)scripts/[a-zA-Z0-9_/.-]+\.(sh|mjs|js|ts|py)' "$wf" 2>/dev/null \
            | sed -E 's|^bash[[:space:]]+||; s|^\./||' \
            | sort -u)
  if [[ ${#hits[@]} -gt 0 ]]; then
    printf '%s\n' "${hits[@]}"
  fi
}

# Get branch protection state for default branch
branch_protection_state() {
  local owner_repo="$1"
  if ! command -v gh >/dev/null 2>&1; then
    echo "NO-GH-CLI"
    return
  fi
  # Default branch
  local default
  default=$(gh -R "$owner_repo" repo view --json defaultBranchRef --jq .defaultBranchRef.name 2>/dev/null || echo "")
  [[ -z "$default" ]] && { echo "NO-DEFAULT-BRANCH"; return; }
  # Branch protection (may 404 if not set)
  local protection
  protection=$(gh -R "$owner_repo" api "repos/$owner_repo/branches/$default/protection" 2>/dev/null || echo "")
  if [[ -z "$protection" ]]; then
    echo "NO-PROTECTION"
    return
  fi
  # Required status checks (contexts)
  local checks
  checks=$(echo "$protection" | jq -r '.required_status_checks.contexts // [] | join(",")' 2>/dev/null || echo "")
  if [[ -z "$checks" ]]; then
    echo "PROTECTED-NO-CHECKS"
  else
    echo "REQUIRED: $checks"
  fi
}

# Get owner/repo for gh
gh_repo_slug() {
  local repo_dir="$1"
  local url
  url=$(git -C "$repo_dir" remote get-url origin 2>/dev/null || echo "")
  [[ -z "$url" ]] && return
  # Convert git@github.com:owner/repo.git or https://github.com/owner/repo.git → owner/repo
  echo "$url" | sed -E 's|^git@github.com:||; s|^https?://github.com/||; s|\.git$||'
}

# ── Per-repo audit ────────────────────────────────────────────────────────────

audit_repo() {
  local repo="$1"
  local repo_dir="$OJFBOT_ROOT/$repo"

  if [[ ! -d "$repo_dir/.git" ]]; then
    echo "## $repo"
    echo ""
    echo "_Not a git repository — skipped._"
    echo ""
    return
  fi

  local workflows
  workflows=$(list_workflows "$repo_dir")
  local wf_count
  wf_count=$(printf '%s\n' "$workflows" | grep -c . 2>/dev/null || true)
  wf_count=${wf_count:-0}

  echo "## $repo"
  echo ""
  if [[ "$wf_count" -eq 0 ]]; then
    echo "- **Workflows:** _none_"
  else
    echo "- **Workflows ($wf_count):**"
    while IFS= read -r wf; do
      [[ -z "$wf" ]] && continue
      echo "  - \`$(basename "$wf")\`"
    done <<< "$workflows"
  fi

  # Non-blocking steps
  local has_nonblocking=false
  echo ""
  echo "- **Non-blocking steps:**"
  while IFS= read -r wf; do
    [[ -z "$wf" ]] && continue
    local nb
    nb=$(non_blocking_in_workflow "$wf")
    if [[ -n "$nb" ]]; then
      has_nonblocking=true
      echo "  - \`$(basename "$wf")\`"
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        echo "    - $line"
      done <<< "$nb"
    fi
  done <<< "$workflows"
  $has_nonblocking || echo "  - _none_"

  # Drift (workflow references untracked scripts)
  local has_drift=false
  echo ""
  echo "- **Workflow → script drift:**"
  while IFS= read -r wf; do
    [[ -z "$wf" ]] && continue
    local d
    d=$(drift_in_workflow "$repo_dir" "$wf")
    if [[ -n "$d" ]]; then
      has_drift=true
      echo "  - \`$(basename "$wf")\`"
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        echo "    - $line"
      done <<< "$d"
    fi
  done <<< "$workflows"
  $has_drift || echo "  - _none_"

  # Branch protection
  if $CHECK_PROTECTION; then
    local slug
    slug=$(gh_repo_slug "$repo_dir")
    echo ""
    if [[ -n "$slug" ]]; then
      echo "- **Branch protection ($slug):** $(branch_protection_state "$slug")"
    else
      echo "- **Branch protection:** _no remote_"
    fi
  fi

  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

echo "# CI Health Audit"
echo ""
echo "_Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ) — $(uname -s)/$(uname -m)_"
echo ""
echo "Total repos audited: ${#REPOS[@]}"
echo ""

for repo in "${REPOS[@]}"; do
  audit_repo "$repo"
done

# Summary
echo "---"
echo ""
echo "## Cluster summary"
echo ""

# Count repos with each problem
total_with_workflows=0
total_with_nonblocking=0
total_with_drift=0
total_protected=0
total_required_checks=0

for repo in "${REPOS[@]}"; do
  repo_dir="$OJFBOT_ROOT/$repo"
  [[ -d "$repo_dir/.git" ]] || continue

  workflows=$(list_workflows "$repo_dir")
  wf_count=$(printf '%s\n' "$workflows" | grep -c . 2>/dev/null || true)
  wf_count=${wf_count:-0}
  [[ "$wf_count" -gt 0 ]] && total_with_workflows=$((total_with_workflows + 1))

  has_nb=false
  has_dr=false
  while IFS= read -r wf; do
    [[ -z "$wf" ]] && continue
    [[ -n "$(non_blocking_in_workflow "$wf")" ]] && has_nb=true
    [[ -n "$(drift_in_workflow "$repo_dir" "$wf")" ]] && has_dr=true
  done <<< "$workflows"
  $has_nb && total_with_nonblocking=$((total_with_nonblocking + 1))
  $has_dr && total_with_drift=$((total_with_drift + 1))

  if $CHECK_PROTECTION; then
    slug=$(gh_repo_slug "$repo_dir")
    if [[ -n "$slug" ]]; then
      state=$(branch_protection_state "$slug")
      case "$state" in
        REQUIRED:*) total_protected=$((total_protected + 1)); total_required_checks=$((total_required_checks + 1)) ;;
        PROTECTED-NO-CHECKS) total_protected=$((total_protected + 1)) ;;
      esac
    fi
  fi
done

echo "- Repos with workflows: $total_with_workflows / ${#REPOS[@]}"
echo "- Repos with non-blocking steps: $total_with_nonblocking / ${#REPOS[@]}"
echo "- Repos with workflow → script drift: $total_with_drift / ${#REPOS[@]}"
if $CHECK_PROTECTION; then
  echo "- Repos with branch protection: $total_protected / ${#REPOS[@]}"
  echo "- Repos with required status checks: $total_required_checks / ${#REPOS[@]}"
fi
echo ""
