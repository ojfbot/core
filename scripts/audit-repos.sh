#!/usr/bin/env bash
# audit-repos.sh — Audit ojfbot GitHub repos from an Anthropic interviewer's POV
#
# Clones each repo (shallow), inspects README, tests, CI, linting, types,
# commit patterns, security posture, and documentation. Produces a structured
# report per repo plus a portfolio-level summary.
#
# Usage:
#   bash scripts/audit-repos.sh                    # pinned repos only
#   bash scripts/audit-repos.sh --all              # all public repos
#   bash scripts/audit-repos.sh --repos=core,shell # specific repos
#   bash scripts/audit-repos.sh --json             # JSON output
#   bash scripts/audit-repos.sh --fix              # emit actionable fixes
set -uo pipefail
# Note: -e omitted intentionally — many audit checks use grep/find/test
# whose exit codes (1 = no match) are expected, not errors.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GH_USER="ojfbot"
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

# --- Config ---
MODE="pinned"
OUTPUT_FORMAT="markdown"
SHOW_FIXES=false
SPECIFIC_REPOS=""

for arg in "$@"; do
  case "$arg" in
    --all) MODE="all" ;;
    --json) OUTPUT_FORMAT="json" ;;
    --fix) SHOW_FIXES=true ;;
    --repos=*) MODE="specific"; SPECIFIC_REPOS="${arg#*=}" ;;
  esac
done

# --- Gather repo list ---
get_repos() {
  case "$MODE" in
    pinned)
      gh api graphql -f query='{ user(login:"'"$GH_USER"'") { pinnedItems(first:6) { nodes { ... on Repository { name url isPrivate } } } } }' \
        | jq -r '.data.user.pinnedItems.nodes[] | select(.isPrivate != true) | .name'
      ;;
    all)
      gh repo list "$GH_USER" --public --json name --jq '.[].name'
      ;;
    specific)
      echo "$SPECIFIC_REPOS" | tr ',' '\n'
      ;;
  esac
}

# --- Audit dimensions ---
# Each function takes a repo dir as $1, writes findings to global vars

audit_readme() {
  local dir="$1"
  README_EXISTS=false
  README_LINES=0
  README_HAS_BADGES=false
  README_HAS_INSTALL=false
  README_HAS_USAGE=false
  README_HAS_ARCH=false
  README_HAS_CONTRIBUTING=false
  README_HAS_LICENSE_MENTION=false
  README_HAS_DEMO=false
  README_HAS_SCREENSHOTS=false

  local readme=""
  for f in README.md readme.md README.rst README; do
    if [[ -f "$dir/$f" ]]; then
      readme="$dir/$f"
      break
    fi
  done

  if [[ -z "$readme" ]]; then
    return
  fi

  README_EXISTS=true
  README_LINES=$(wc -l < "$readme" | tr -d ' ')

  local content
  content=$(cat "$readme")
  echo "$content" | grep -qi "badge\|shields\.io" && README_HAS_BADGES=true || true
  echo "$content" | grep -qi "install\|getting started\|setup\|prerequisites" && README_HAS_INSTALL=true || true
  echo "$content" | grep -qi "usage\|how to\|quick start\|running" && README_HAS_USAGE=true || true
  echo "$content" | grep -qi "architect\|design\|overview\|diagram" && README_HAS_ARCH=true || true
  echo "$content" | grep -qi "contribut" && README_HAS_CONTRIBUTING=true || true
  echo "$content" | grep -qi "license" && README_HAS_LICENSE_MENTION=true || true
  echo "$content" | grep -qi "demo\|live\|deployed\|jim\.software\|vercel\|netlify" && README_HAS_DEMO=true || true
  echo "$content" | grep -qi "screenshot\|preview\|\.png\|\.gif\|\.jpg\|\.webp" && README_HAS_SCREENSHOTS=true || true
}

audit_tests() {
  local dir="$1"
  TEST_FILES=0
  TEST_FRAMEWORK=""
  TEST_CONFIG_EXISTS=false
  HAS_COVERAGE_CONFIG=false
  TEST_SCRIPT_EXISTS=false

  # Count test files
  TEST_FILES=$(find "$dir" -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" -o -path "*/__tests__/*" -o -path "*/tests/*" -o -name "test_*.py" \) 2>/dev/null | grep -v node_modules | grep -v .git | wc -l | tr -d ' ')

  # Detect framework
  if [[ -f "$dir/vitest.config.ts" ]] || [[ -f "$dir/vitest.config.js" ]] || [[ -f "$dir/vitest.workspace.ts" ]]; then
    TEST_FRAMEWORK="vitest"
    TEST_CONFIG_EXISTS=true
  elif [[ -f "$dir/jest.config.ts" ]] || [[ -f "$dir/jest.config.js" ]] || [[ -f "$dir/jest.config.json" ]]; then
    TEST_FRAMEWORK="jest"
    TEST_CONFIG_EXISTS=true
  elif [[ -f "$dir/pytest.ini" ]] || [[ -f "$dir/pyproject.toml" ]] || [[ -f "$dir/setup.cfg" ]]; then
    if { grep -q "pytest" "$dir/pyproject.toml" 2>/dev/null || [[ -f "$dir/pytest.ini" ]]; }; then
      TEST_FRAMEWORK="pytest"
      TEST_CONFIG_EXISTS=true
    fi
  fi

  # Check coverage config
  if grep -rq "coverage\|coverageThreshold\|--coverage\|c8\|istanbul\|v8" "$dir/vitest.config.ts" "$dir/jest.config.ts" "$dir/package.json" 2>/dev/null; then
    HAS_COVERAGE_CONFIG=true
  fi

  # Check test script in package.json
  if [[ -f "$dir/package.json" ]]; then
    if jq -e '.scripts.test // empty' "$dir/package.json" >/dev/null 2>&1; then
      TEST_SCRIPT_EXISTS=true
    fi
  fi

  # Check for vitest configs inside packages/
  if [[ -z "$TEST_FRAMEWORK" ]] && find "$dir/packages" -name "vitest.config.*" -maxdepth 3 2>/dev/null | grep -q .; then
    TEST_FRAMEWORK="vitest"
    TEST_CONFIG_EXISTS=true
  fi
}

audit_ci() {
  local dir="$1"
  CI_WORKFLOWS=0
  CI_HAS_TEST=false
  CI_HAS_LINT=false
  CI_HAS_BUILD=false
  CI_HAS_SECURITY=false
  CI_HAS_DEPLOY=false
  CI_FILES=""

  if [[ -d "$dir/.github/workflows" ]]; then
    CI_WORKFLOWS=$(find "$dir/.github/workflows" -maxdepth 1 -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
    CI_FILES=$(find "$dir/.github/workflows" -maxdepth 1 \( -name "*.yml" -o -name "*.yaml" \) -exec basename {} \; 2>/dev/null | tr '\n' ', ' | sed 's/,$//')

    local all_ci
    all_ci=$(find "$dir/.github/workflows" -maxdepth 1 \( -name "*.yml" -o -name "*.yaml" \) -exec cat {} \; 2>/dev/null)
    echo "$all_ci" | grep -qi "test\|vitest\|jest\|pytest" && CI_HAS_TEST=true || true
    echo "$all_ci" | grep -qi "lint\|eslint\|prettier" && CI_HAS_LINT=true || true
    echo "$all_ci" | grep -qi "build\|compile\|tsc" && CI_HAS_BUILD=true || true
    echo "$all_ci" | grep -qi "audit\|security\|trivy\|gitleaks\|snyk\|codeql\|secret" && CI_HAS_SECURITY=true || true
    echo "$all_ci" | grep -qi "deploy\|vercel\|pages\|publish\|release" && CI_HAS_DEPLOY=true || true
  fi
}

audit_types() {
  local dir="$1"
  HAS_TSCONFIG=false
  TS_STRICT=false
  HAS_ZOD=false
  HAS_ESLINT=false
  ESLINT_CONFIG_TYPE=""
  HAS_PRETTIER=false
  PRIMARY_LANG=""

  if [[ -f "$dir/tsconfig.json" ]] || [[ -f "$dir/tsconfig.base.json" ]] || [[ -d "$dir/packages/tsconfig" ]]; then
    HAS_TSCONFIG=true
    if grep -rqE '"strict"\s*:\s*true' "$dir/tsconfig.json" "$dir/tsconfig.base.json" "$dir/packages/tsconfig/" 2>/dev/null; then
      TS_STRICT=true
    fi
  fi

  if [[ -f "$dir/package.json" ]]; then
    grep -q "zod" "$dir/package.json" 2>/dev/null && HAS_ZOD=true || true
  fi
  if [[ -f "$dir/requirements.txt" ]] || [[ -f "$dir/pyproject.toml" ]]; then
    grep -q "pydantic" "$dir/requirements.txt" "$dir/pyproject.toml" 2>/dev/null && HAS_ZOD=true || true  # pydantic = python zod
  fi

  if [[ -f "$dir/eslint.config.mjs" ]] || [[ -f "$dir/eslint.config.js" ]]; then
    HAS_ESLINT=true; ESLINT_CONFIG_TYPE="flat"
  elif [[ -f "$dir/.eslintrc.json" ]] || [[ -f "$dir/.eslintrc.js" ]] || [[ -f "$dir/.eslintrc.cjs" ]]; then
    HAS_ESLINT=true; ESLINT_CONFIG_TYPE="legacy"
  elif [[ -f "$dir/package.json" ]] && jq -e '.eslintConfig // empty' "$dir/package.json" >/dev/null 2>&1; then
    HAS_ESLINT=true; ESLINT_CONFIG_TYPE="pkg-inline"
  fi

  # Detect Python linters (ruff, flake8, pylint) as ESLint equivalents
  if [[ "$HAS_ESLINT" != "true" ]]; then
    if grep -qE "ruff|flake8|pylint" "$dir/pyproject.toml" "$dir/setup.cfg" "$dir/.flake8" 2>/dev/null; then
      HAS_ESLINT=true
      ESLINT_CONFIG_TYPE="python-linter"
    fi
  fi

  { [[ -f "$dir/.prettierrc" ]] || [[ -f "$dir/.prettierrc.json" ]] || [[ -f "$dir/prettier.config.js" ]]; } && HAS_PRETTIER=true || true

  # Detect primary language
  local ts_count js_count py_count go_count
  ts_count=$(find "$dir" \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')
  js_count=$(find "$dir" \( -name "*.js" -o -name "*.jsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')
  py_count=$(find "$dir" -name "*.py" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')
  go_count=$(find "$dir" -name "*.go" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')

  if [[ $ts_count -ge $js_count && $ts_count -ge $py_count && $ts_count -ge $go_count ]]; then
    PRIMARY_LANG="TypeScript ($ts_count files)"
  elif [[ $py_count -ge $js_count && $py_count -ge $go_count ]]; then
    PRIMARY_LANG="Python ($py_count files)"
  elif [[ $go_count -ge $js_count ]]; then
    PRIMARY_LANG="Go ($go_count files)"
  else
    PRIMARY_LANG="JavaScript ($js_count files)"
  fi
}

audit_security() {
  local dir="$1"
  HAS_ENV_EXAMPLE=false
  HAS_GITIGNORE=false
  GITIGNORE_COVERS_SECRETS=false
  HAS_LICENSE=false
  LICENSE_TYPE=""
  HAS_SECURITY_MD=false
  HAS_PRECOMMIT_HOOKS=false

  { [[ -f "$dir/.env.example" ]] || [[ -f "$dir/env.json.example" ]]; } && HAS_ENV_EXAMPLE=true || true

  if [[ -f "$dir/.gitignore" ]]; then
    HAS_GITIGNORE=true
    local gi
    gi=$(cat "$dir/.gitignore")
    if echo "$gi" | grep -q "\.env" && echo "$gi" | grep -q "node_modules"; then
      GITIGNORE_COVERS_SECRETS=true
    fi
  fi

  if [[ -f "$dir/LICENSE" ]] || [[ -f "$dir/LICENSE.md" ]]; then
    HAS_LICENSE=true
    local lic_file=""
    [[ -f "$dir/LICENSE" ]] && lic_file="$dir/LICENSE"
    [[ -f "$dir/LICENSE.md" ]] && lic_file="$dir/LICENSE.md"
    LICENSE_TYPE=$(head -3 "$lic_file" 2>/dev/null | grep -oi "MIT\|Apache\|GPL\|BSD\|ISC\|proprietary" | head -1 || true)
    [[ -z "$LICENSE_TYPE" ]] && LICENSE_TYPE="unknown" || true
  fi

  [[ -f "$dir/SECURITY.md" ]] && HAS_SECURITY_MD=true || true
  { [[ -f "$dir/.husky" ]] || [[ -f "$dir/.pre-commit-config.yaml" ]] || grep -q "pre-commit\|husky\|lint-staged" "$dir/package.json" 2>/dev/null; } && HAS_PRECOMMIT_HOOKS=true || true
}

audit_commits() {
  local dir="$1"
  TOTAL_COMMITS=0
  RECENT_COMMITS_30D=0
  COMMIT_CONVENTION=""
  HAS_CONVENTIONAL_COMMITS=false
  LAST_COMMIT_DATE=""
  AVG_COMMIT_MSG_LEN=0

  cd "$dir"
  TOTAL_COMMITS=$(git rev-list --count HEAD 2>/dev/null || echo 0)
  RECENT_COMMITS_30D=$(git rev-list --count --since="30 days ago" HEAD 2>/dev/null || echo 0)
  LAST_COMMIT_DATE=$(git log -1 --format=%ci 2>/dev/null | cut -d' ' -f1)

  # Check conventional commits (feat:, fix:, docs:, etc.)
  local conv_count
  conv_count=$(git log --oneline -50 2>/dev/null | grep -cE "^[a-f0-9]+ (feat|fix|docs|chore|refactor|test|style|ci|perf|build|clean)\(?.*\)?:" || echo 0)
  if [[ $conv_count -gt 25 ]]; then
    HAS_CONVENTIONAL_COMMITS=true
    COMMIT_CONVENTION="conventional ($conv_count/50 recent)"
  elif [[ $conv_count -gt 10 ]]; then
    COMMIT_CONVENTION="partial ($conv_count/50 recent)"
  else
    COMMIT_CONVENTION="informal"
  fi

  # Average commit message length (first line)
  AVG_COMMIT_MSG_LEN=$(git log --oneline -50 2>/dev/null | awk '{ print length }' | awk '{ sum += $1; n++ } END { if(n>0) print int(sum/n); else print 0 }')

  cd - >/dev/null
}

audit_monorepo() {
  local dir="$1"
  IS_MONOREPO=false
  MONOREPO_TOOL=""
  PACKAGE_COUNT=0

  if [[ -f "$dir/pnpm-workspace.yaml" ]]; then
    IS_MONOREPO=true
    MONOREPO_TOOL="pnpm"
  elif [[ -f "$dir/lerna.json" ]]; then
    IS_MONOREPO=true
    MONOREPO_TOOL="lerna"
  elif [[ -f "$dir/turbo.json" ]]; then
    IS_MONOREPO=true
    MONOREPO_TOOL="turborepo"
  elif [[ -f "$dir/package.json" ]] && jq -e '.workspaces // empty' "$dir/package.json" >/dev/null 2>&1; then
    IS_MONOREPO=true
    MONOREPO_TOOL="yarn/npm workspaces"
  fi

  if [[ -d "$dir/packages" ]]; then
    PACKAGE_COUNT=$(ls -d "$dir/packages/"*/ 2>/dev/null | wc -l | tr -d ' ')
  fi

  # Check for turborepo
  if [[ -f "$dir/turbo.json" ]]; then
    MONOREPO_TOOL="$MONOREPO_TOOL+turborepo"
  fi
}

audit_claude() {
  local dir="$1"
  HAS_CLAUDE_MD=false
  CLAUDE_MD_LINES=0
  HAS_CLAUDE_SKILLS=false
  SKILL_COUNT=0
  HAS_CLAUDE_HOOKS=false
  HAS_CLAUDE_PROMPTS=false
  HAS_MCP_CONFIG=false

  if [[ -f "$dir/CLAUDE.md" ]]; then
    HAS_CLAUDE_MD=true
    CLAUDE_MD_LINES=$(wc -l < "$dir/CLAUDE.md" | tr -d ' ')
  fi

  if [[ -d "$dir/.claude/skills" ]]; then
    HAS_CLAUDE_SKILLS=true
    SKILL_COUNT=$(find "$dir/.claude/skills" -maxdepth 1 -type d | tail -n +2 | wc -l | tr -d ' ')
  fi

  [[ -f "$dir/.claude/settings.json" ]] && grep -q "hooks" "$dir/.claude/settings.json" 2>/dev/null && HAS_CLAUDE_HOOKS=true || true
  [[ -d "$dir/.claude/prompts" ]] && HAS_CLAUDE_PROMPTS=true || true
  [[ -f "$dir/.claude/.mcp.json" ]] && HAS_MCP_CONFIG=true || true
}

audit_docs() {
  local dir="$1"
  HAS_DOCS_DIR=false
  DOC_FILES=0
  HAS_ADR=false
  ADR_COUNT=0
  HAS_CHANGELOG=false
  HAS_ARCHITECTURE_MD=false

  if [[ -d "$dir/docs" ]]; then
    HAS_DOCS_DIR=true
    DOC_FILES=$(find "$dir/docs" -type f | wc -l | tr -d ' ')
  fi

  local adr_dirs=""
  [[ -d "$dir/decisions" ]] && adr_dirs="$dir/decisions "
  [[ -d "$dir/docs/adr" ]] && adr_dirs="$adr_dirs$dir/docs/adr "
  [[ -d "$dir/docs/decisions" ]] && adr_dirs="$adr_dirs$dir/docs/decisions "
  if [[ -n "$adr_dirs" ]]; then
    HAS_ADR=true
    ADR_COUNT=$(find $adr_dirs -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  fi

  [[ -f "$dir/CHANGELOG.md" ]] && HAS_CHANGELOG=true || true
  [[ -f "$dir/ARCHITECTURE.md" ]] && HAS_ARCHITECTURE_MD=true || true
}

# --- Scoring ---
compute_score() {
  local score=0
  local max=100
  local deductions=""

  # README (20 points)
  if [[ "$README_EXISTS" == "true" ]]; then
    score=$((score + 5))
    [[ $README_LINES -gt 50 ]] && score=$((score + 3))
    [[ $README_LINES -gt 150 ]] && score=$((score + 2))
    [[ "$README_HAS_INSTALL" == "true" ]] && score=$((score + 2))
    [[ "$README_HAS_USAGE" == "true" ]] && score=$((score + 2))
    [[ "$README_HAS_ARCH" == "true" ]] && score=$((score + 3))
    [[ "$README_HAS_DEMO" == "true" ]] && score=$((score + 2))
    [[ "$README_HAS_SCREENSHOTS" == "true" ]] && score=$((score + 1))
  else
    deductions="$deductions\n  - No README (-20)"
  fi

  # Tests (20 points)
  if [[ $TEST_FILES -gt 0 ]]; then
    score=$((score + 5))
    [[ $TEST_FILES -gt 5 ]] && score=$((score + 5))
    [[ $TEST_FILES -gt 15 ]] && score=$((score + 3))
    [[ "$TEST_CONFIG_EXISTS" == "true" ]] && score=$((score + 3))
    [[ "$HAS_COVERAGE_CONFIG" == "true" ]] && score=$((score + 2))
    [[ "$TEST_SCRIPT_EXISTS" == "true" ]] && score=$((score + 2))
  else
    deductions="$deductions\n  - No test files (-20)"
  fi

  # CI/CD (15 points)
  if [[ $CI_WORKFLOWS -gt 0 ]]; then
    score=$((score + 3))
    [[ "$CI_HAS_TEST" == "true" ]] && score=$((score + 3))
    [[ "$CI_HAS_LINT" == "true" ]] && score=$((score + 2))
    [[ "$CI_HAS_BUILD" == "true" ]] && score=$((score + 2))
    [[ "$CI_HAS_SECURITY" == "true" ]] && score=$((score + 3))
    [[ "$CI_HAS_DEPLOY" == "true" ]] && score=$((score + 2))
  else
    deductions="$deductions\n  - No CI/CD workflows (-15)"
  fi

  # Type safety & linting (15 points)
  if [[ "$HAS_TSCONFIG" == "true" ]]; then
    score=$((score + 3))
    [[ "$TS_STRICT" == "true" ]] && score=$((score + 4))
  fi
  [[ "$HAS_ESLINT" == "true" ]] && score=$((score + 4))
  [[ "$HAS_PRETTIER" == "true" ]] && score=$((score + 2))
  [[ "$HAS_ZOD" == "true" ]] && score=$((score + 2))

  # Security (10 points)
  [[ "$HAS_LICENSE" == "true" ]] && score=$((score + 3))
  [[ "$HAS_GITIGNORE" == "true" && "$GITIGNORE_COVERS_SECRETS" == "true" ]] && score=$((score + 3))
  [[ "$HAS_ENV_EXAMPLE" == "true" ]] && score=$((score + 2))
  [[ "$HAS_SECURITY_MD" == "true" ]] && score=$((score + 2))

  # Commit quality (10 points)
  [[ "$HAS_CONVENTIONAL_COMMITS" == "true" ]] && score=$((score + 4))
  [[ $RECENT_COMMITS_30D -gt 5 ]] && score=$((score + 3))
  [[ $AVG_COMMIT_MSG_LEN -gt 30 ]] && score=$((score + 3))

  # Documentation (10 points)
  [[ "$HAS_DOCS_DIR" == "true" ]] && score=$((score + 3))
  [[ "$HAS_ADR" == "true" ]] && score=$((score + 3))
  [[ "$HAS_ARCHITECTURE_MD" == "true" ]] && score=$((score + 2))
  [[ "$HAS_CHANGELOG" == "true" ]] && score=$((score + 2))

  # Cap at 100
  [[ $score -gt 100 ]] && score=100

  AUDIT_SCORE=$score
  AUDIT_DEDUCTIONS="$deductions"
}

grade_score() {
  local score=$1
  if [[ $score -ge 85 ]]; then echo "A"
  elif [[ $score -ge 70 ]]; then echo "B"
  elif [[ $score -ge 55 ]]; then echo "C"
  elif [[ $score -ge 40 ]]; then echo "D"
  else echo "F"
  fi
}

# --- Output ---
emit_repo_markdown() {
  local repo="$1"
  local grade
  grade=$(grade_score "$AUDIT_SCORE")

  echo ""
  echo "## $repo — $AUDIT_SCORE/100 ($grade)"
  echo ""
  echo "**Language:** $PRIMARY_LANG | **Commits:** $TOTAL_COMMITS ($RECENT_COMMITS_30D in last 30d) | **Last:** $LAST_COMMIT_DATE"
  [[ "$IS_MONOREPO" == "true" ]] && echo "**Monorepo:** $MONOREPO_TOOL ($PACKAGE_COUNT packages)"
  echo ""

  echo "| Dimension | Status | Detail |"
  echo "|-----------|--------|--------|"

  # README
  if [[ "$README_EXISTS" == "true" ]]; then
    local rm_details=""
    [[ "$README_HAS_INSTALL" == "true" ]] && rm_details="install "
    [[ "$README_HAS_USAGE" == "true" ]] && rm_details="${rm_details}usage "
    [[ "$README_HAS_ARCH" == "true" ]] && rm_details="${rm_details}arch "
    [[ "$README_HAS_DEMO" == "true" ]] && rm_details="${rm_details}demo "
    [[ "$README_HAS_SCREENSHOTS" == "true" ]] && rm_details="${rm_details}screenshots "
    echo "| README | ${README_LINES} lines | ${rm_details:-minimal} |"
  else
    echo "| README | MISSING | -- |"
  fi

  # Tests
  echo "| Tests | ${TEST_FILES} files | ${TEST_FRAMEWORK:-none} ${TEST_CONFIG_EXISTS:+config} ${HAS_COVERAGE_CONFIG:+coverage} |"

  # CI
  echo "| CI/CD | ${CI_WORKFLOWS} workflows | ${CI_FILES:-none} |"

  # Types
  local type_detail=""
  [[ "$HAS_TSCONFIG" == "true" ]] && type_detail="tsconfig "
  [[ "$TS_STRICT" == "true" ]] && type_detail="${type_detail}strict "
  [[ "$HAS_ESLINT" == "true" ]] && type_detail="${type_detail}eslint($ESLINT_CONFIG_TYPE) "
  [[ "$HAS_PRETTIER" == "true" ]] && type_detail="${type_detail}prettier "
  [[ "$HAS_ZOD" == "true" ]] && type_detail="${type_detail}zod "
  echo "| Type Safety | ${type_detail:-none} | |"

  # Security
  local sec_detail=""
  [[ "$HAS_LICENSE" == "true" ]] && sec_detail="$LICENSE_TYPE "
  [[ "$GITIGNORE_COVERS_SECRETS" == "true" ]] && sec_detail="${sec_detail}gitignore "
  [[ "$HAS_ENV_EXAMPLE" == "true" ]] && sec_detail="${sec_detail}env-example "
  [[ "$HAS_SECURITY_MD" == "true" ]] && sec_detail="${sec_detail}SECURITY.md "
  [[ "$HAS_PRECOMMIT_HOOKS" == "true" ]] && sec_detail="${sec_detail}hooks "
  echo "| Security | ${sec_detail:-minimal} | |"

  # Commits
  echo "| Commits | $COMMIT_CONVENTION | avg ${AVG_COMMIT_MSG_LEN} chars |"

  # Docs
  local doc_detail=""
  [[ "$HAS_DOCS_DIR" == "true" ]] && doc_detail="${DOC_FILES} doc files "
  [[ "$HAS_ADR" == "true" ]] && doc_detail="${doc_detail}${ADR_COUNT} ADRs "
  [[ "$HAS_ARCHITECTURE_MD" == "true" ]] && doc_detail="${doc_detail}ARCHITECTURE.md "
  [[ "$HAS_CHANGELOG" == "true" ]] && doc_detail="${doc_detail}CHANGELOG "
  echo "| Docs | ${doc_detail:-none} | |"

  # Claude Code
  local cc_detail=""
  [[ "$HAS_CLAUDE_MD" == "true" ]] && cc_detail="CLAUDE.md(${CLAUDE_MD_LINES}L) "
  [[ "$HAS_CLAUDE_SKILLS" == "true" ]] && cc_detail="${cc_detail}${SKILL_COUNT} skills "
  [[ "$HAS_CLAUDE_HOOKS" == "true" ]] && cc_detail="${cc_detail}hooks "
  [[ "$HAS_CLAUDE_PROMPTS" == "true" ]] && cc_detail="${cc_detail}prompts "
  [[ "$HAS_MCP_CONFIG" == "true" ]] && cc_detail="${cc_detail}mcp "
  [[ -n "$cc_detail" ]] && echo "| Claude Code | ${cc_detail} | |"

  # Fixes
  if [[ "$SHOW_FIXES" == "true" ]]; then
    local fixes=""
    [[ "$README_EXISTS" != "true" ]] && fixes="$fixes\n- Add README.md with project overview, install, usage, architecture"
    [[ "$README_EXISTS" == "true" && "$README_HAS_ARCH" != "true" ]] && fixes="$fixes\n- Add architecture diagram/overview to README"
    [[ "$README_EXISTS" == "true" && "$README_HAS_DEMO" != "true" ]] && fixes="$fixes\n- Add demo link or deployed URL to README"
    [[ "$README_EXISTS" == "true" && "$README_HAS_SCREENSHOTS" != "true" ]] && fixes="$fixes\n- Add screenshots or GIFs to README"
    [[ $TEST_FILES -eq 0 ]] && fixes="$fixes\n- Add tests (vitest recommended for TS projects)"
    [[ "$TEST_CONFIG_EXISTS" != "true" && $TEST_FILES -gt 0 ]] && fixes="$fixes\n- Add test config file (vitest.config.ts)"
    [[ "$HAS_COVERAGE_CONFIG" != "true" && $TEST_FILES -gt 0 ]] && fixes="$fixes\n- Add coverage thresholds to test config"
    [[ $CI_WORKFLOWS -eq 0 ]] && fixes="$fixes\n- Add GitHub Actions CI (build + test + lint)"
    [[ "$CI_HAS_SECURITY" != "true" && $CI_WORKFLOWS -gt 0 ]] && fixes="$fixes\n- Add security scanning to CI (dependency audit, secret scan)"
    [[ "$HAS_TSCONFIG" == "true" && "$TS_STRICT" != "true" ]] && fixes="$fixes\n- Enable strict mode in tsconfig.json"
    [[ "$HAS_ESLINT" != "true" ]] && fixes="$fixes\n- Add ESLint configuration"
    [[ "$HAS_LICENSE" != "true" ]] && fixes="$fixes\n- Add LICENSE file (MIT recommended for OSS)"
    [[ "$HAS_CONVENTIONAL_COMMITS" != "true" ]] && fixes="$fixes\n- Adopt conventional commits (feat:, fix:, docs:, etc.)"
    [[ "$HAS_CLAUDE_MD" != "true" ]] && fixes="$fixes\n- Add CLAUDE.md with project context for Claude Code"

    if [[ -n "$fixes" ]]; then
      echo ""
      echo "**Fixes:**"
      echo -e "$fixes"
    fi
  fi
}

emit_repo_json() {
  local repo="$1"
  local grade
  grade=$(grade_score "$AUDIT_SCORE")

  jq -nc \
    --arg repo "$repo" \
    --arg score "$AUDIT_SCORE" \
    --arg grade "$grade" \
    --arg lang "$PRIMARY_LANG" \
    --arg commits "$TOTAL_COMMITS" \
    --arg recent "$RECENT_COMMITS_30D" \
    --arg last "$LAST_COMMIT_DATE" \
    --arg readme_lines "$README_LINES" \
    --arg test_files "$TEST_FILES" \
    --arg test_fw "$TEST_FRAMEWORK" \
    --arg ci_count "$CI_WORKFLOWS" \
    --arg ci_files "$CI_FILES" \
    --argjson ts_strict "$( [[ "$TS_STRICT" == "true" ]] && echo true || echo false )" \
    --argjson eslint "$( [[ "$HAS_ESLINT" == "true" ]] && echo true || echo false )" \
    --argjson license "$( [[ "$HAS_LICENSE" == "true" ]] && echo true || echo false )" \
    --arg license_type "$LICENSE_TYPE" \
    --argjson conv_commits "$( [[ "$HAS_CONVENTIONAL_COMMITS" == "true" ]] && echo true || echo false )" \
    --argjson monorepo "$( [[ "$IS_MONOREPO" == "true" ]] && echo true || echo false )" \
    --arg mono_tool "$MONOREPO_TOOL" \
    --arg packages "$PACKAGE_COUNT" \
    --argjson claude_md "$( [[ "$HAS_CLAUDE_MD" == "true" ]] && echo true || echo false )" \
    --arg skills "$SKILL_COUNT" \
    --argjson has_adr "$( [[ "$HAS_ADR" == "true" ]] && echo true || echo false )" \
    --arg adr_count "$ADR_COUNT" \
    '{
      repo: $repo, score: ($score|tonumber), grade: $grade,
      language: $lang,
      activity: { total_commits: ($commits|tonumber), last_30d: ($recent|tonumber), last_commit: $last },
      readme: { lines: ($readme_lines|tonumber) },
      tests: { files: ($test_files|tonumber), framework: $test_fw },
      ci: { workflows: ($ci_count|tonumber), files: $ci_files },
      quality: { ts_strict: $ts_strict, eslint: $eslint, conventional_commits: $conv_commits },
      security: { license: $license, license_type: $license_type },
      monorepo: { is_monorepo: $monorepo, tool: $mono_tool, packages: ($packages|tonumber) },
      claude_code: { claude_md: $claude_md, skills: ($skills|tonumber) },
      docs: { has_adr: $has_adr, adr_count: ($adr_count|tonumber) }
    }'
}

# --- Main ---
REPOS=$(get_repos)
REPO_COUNT=$(echo "$REPOS" | wc -l | tr -d ' ')
SCORES=()

if [[ "$OUTPUT_FORMAT" == "markdown" ]]; then
  echo "# Repository Audit — ojfbot"
  echo ""
  echo "**Date:** $(date -u +%Y-%m-%d)"
  echo "**Mode:** $MODE ($REPO_COUNT repos)"
  echo "**Perspective:** Anthropic hiring manager / engineering peer"
  echo ""
  echo "---"
fi

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  echo "["
fi

FIRST_JSON=true

while IFS= read -r repo; do
  [[ -z "$repo" ]] && continue

  # Clone shallow
  REPO_DIR="$WORK_DIR/$repo"
  if ! gh repo clone "$GH_USER/$repo" "$REPO_DIR" -- --depth=50 --quiet 2>/dev/null; then
    echo "# SKIP: $repo (clone failed)" >&2
    continue
  fi

  # Run all audits
  audit_readme "$REPO_DIR"
  audit_tests "$REPO_DIR"
  audit_ci "$REPO_DIR"
  audit_types "$REPO_DIR"
  audit_security "$REPO_DIR"
  audit_commits "$REPO_DIR"
  audit_monorepo "$REPO_DIR"
  audit_claude "$REPO_DIR"
  audit_docs "$REPO_DIR"
  compute_score

  SCORES+=("$repo:$AUDIT_SCORE")

  if [[ "$OUTPUT_FORMAT" == "markdown" ]]; then
    emit_repo_markdown "$repo"
  else
    [[ "$FIRST_JSON" == "true" ]] && FIRST_JSON=false || echo ","
    emit_repo_json "$repo"
  fi

done <<< "$REPOS"

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  echo "]"
  exit 0
fi

# --- Portfolio summary ---
echo ""
echo "---"
echo ""
echo "## Portfolio Summary"
echo ""

# Sort scores
echo "| Repo | Score | Grade |"
echo "|------|-------|-------|"
for entry in "${SCORES[@]}"; do
  repo="${entry%%:*}"
  score="${entry##*:}"
  grade=$(grade_score "$score")
  echo "| $repo | $score/100 | $grade |"
done

# Compute average
total=0
count=0
for entry in "${SCORES[@]}"; do
  score="${entry##*:}"
  total=$((total + score))
  count=$((count + 1))
done
if [[ $count -gt 0 ]]; then
  avg=$((total / count))
  echo ""
  echo "**Portfolio average: $avg/100 ($(grade_score $avg))**"
fi

# Interviewer signals
echo ""
echo "### What an Anthropic interviewer would notice"
echo ""

# Count repos with key signals
test_repos=0; ci_repos=0; strict_repos=0; conv_repos=0; claude_repos=0; license_repos=0
for entry in "${SCORES[@]}"; do
  repo="${entry%%:*}"
  REPO_DIR="$WORK_DIR/$repo"
  # Re-derive quickly from files
  [[ $(find "$REPO_DIR" -type f \( -name "*.test.*" -o -name "*.spec.*" \) 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ') -gt 0 ]] && test_repos=$((test_repos + 1)) || true
  [[ -d "$REPO_DIR/.github/workflows" ]] && ci_repos=$((ci_repos + 1)) || true
  grep -rqE '"strict"\s*:\s*true' "$REPO_DIR/tsconfig.json" "$REPO_DIR/tsconfig.base.json" "$REPO_DIR/packages/tsconfig/" 2>/dev/null && strict_repos=$((strict_repos + 1)) || true
  [[ -f "$REPO_DIR/CLAUDE.md" ]] && claude_repos=$((claude_repos + 1)) || true
  { [[ -f "$REPO_DIR/LICENSE" ]] || [[ -f "$REPO_DIR/LICENSE.md" ]]; } && license_repos=$((license_repos + 1)) || true
done

echo "- **Tests**: $test_repos/$count repos have test files"
echo "- **CI/CD**: $ci_repos/$count repos have GitHub Actions"
echo "- **TypeScript strict**: $strict_repos/$count repos"
echo "- **CLAUDE.md**: $claude_repos/$count repos"
echo "- **Licensed**: $license_repos/$count repos"
echo ""
echo "### Top-priority fixes (highest impact across portfolio)"
echo ""
echo "Run \`bash scripts/audit-repos.sh --fix\` for per-repo fix lists."
