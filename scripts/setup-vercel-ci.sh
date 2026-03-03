#!/usr/bin/env bash
# setup-vercel-ci.sh — Create Vercel projects via API and push secrets to GitHub
#
# What this does (no browser, no manual deploy):
#   1. Reads VERCEL_TOKEN from env
#   2. Creates a Vercel project for each repo via REST API (idempotent)
#   3. Fetches your orgId from the token
#   4. Runs `gh secret set` to write VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID
#      into each GitHub repo
#
# Prerequisites:
#   export VERCEL_TOKEN=<your token from vercel.com/account/tokens>
#   gh auth login  (if not already authenticated)
#
# Usage:
#   ./scripts/setup-vercel-ci.sh

set -euo pipefail

# ── token check ──────────────────────────────────────────────────────────────
if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: VERCEL_TOKEN is not set."
  echo "  1. Go to https://vercel.com/account/tokens"
  echo "  2. Create a token (Full Account scope)"
  echo "  3. export VERCEL_TOKEN=<token>"
  exit 1
fi

# ── gh auth check ─────────────────────────────────────────────────────────────
if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI is not authenticated. Run: gh auth login"
  exit 1
fi

VERCEL_API="https://api.vercel.com"

# ── fetch org ID from token ───────────────────────────────────────────────────
echo "Fetching Vercel org ID..."
ORG_ID=$(curl -sf \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$VERCEL_API/v2/user" | \
  python3 -c "import sys,json; u=json.load(sys.stdin)['user']; print(u.get('defaultTeamId') or u['id'])")

echo "  orgId: $ORG_ID"

# ── project definitions ───────────────────────────────────────────────────────
# format: "vercel-project-name:github-org/repo"
declare -a PROJECTS=(
  "ojf-shell:ojfbot/shell"
  "ojf-tripplanner:ojfbot/TripPlanner"
  "ojf-cv-builder:ojfbot/cv-builder"
  "ojf-blogengine:ojfbot/BlogEngine"
)

# ── create / fetch each project ───────────────────────────────────────────────
for entry in "${PROJECTS[@]}"; do
  project_name="${entry%%:*}"
  gh_repo="${entry##*:}"

  echo ""
  echo "── $project_name ($gh_repo) ──"

  # Try to fetch existing project first
  existing=$(curl -sf \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    "$VERCEL_API/v9/projects/$project_name" 2>/dev/null || true)

  if [[ -n "$existing" && "$existing" != "null" ]]; then
    project_id=$(echo "$existing" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    echo "  Already exists — projectId: $project_id"
  else
    echo "  Creating project..."
    response=$(curl -sf -X POST \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$project_name\", \"framework\": \"vite\"}" \
      "$VERCEL_API/v10/projects")
    project_id=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    echo "  Created — projectId: $project_id"
  fi

  # Set GitHub secrets
  echo "  Setting GitHub secrets on $gh_repo..."
  gh secret set VERCEL_TOKEN      --body "$VERCEL_TOKEN" --repo "$gh_repo"
  gh secret set VERCEL_ORG_ID     --body "$ORG_ID"       --repo "$gh_repo"
  gh secret set VERCEL_PROJECT_ID --body "$project_id"   --repo "$gh_repo"
  echo "  Done."
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All projects created and secrets pushed."
echo ""
echo "Next steps:"
echo "  1. Merge the open PRs — CI will trigger first deploys automatically"
echo "  2. Assign custom domains in Vercel dashboard (https://vercel.com/dashboard):"
echo "       ojf-shell       → frame.jim.software"
echo "       ojf-tripplanner → trips.jim.software"
echo "       ojf-cv-builder  → cv.jim.software"
echo "       ojf-blogengine  → blog.jim.software"
echo "  3. Add DNS CNAMEs in Squarespace:"
echo "       frame  CNAME  cname.vercel-dns.com"
echo "       trips  CNAME  cname.vercel-dns.com"
echo "       cv     CNAME  cname.vercel-dns.com"
echo "       blog   CNAME  cname.vercel-dns.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
