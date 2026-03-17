#!/usr/bin/env bash
# deploy-demo.sh — Deploy Frame OS demo to Vercel (frame.jim.software)
# See ADR-0013 for architecture and risk decisions.
#
# Prerequisites:
#   npx vercel login       ← run once before this script
#
# Usage:
#   ./scripts/deploy-demo.sh [shell|tripplanner|cv-builder|blogengine|all]
#   Default: all

set -euo pipefail

TARGET="${1:-all}"

REPOS=(
  "shell:/Users/yuri/ojfbot/shell:ojf-shell"
  "tripplanner:/Users/yuri/ojfbot/TripPlanner:ojf-tripplanner"
  "cv-builder:/Users/yuri/ojfbot/cv-builder:ojf-cv-builder"
  "blogengine:/Users/yuri/ojfbot/blogengine:ojf-blogengine"
  "core-reader:/Users/yuri/ojfbot/core-reader:ojf-core-reader"
)

DOMAINS=(
  "ojf-shell:frame.jim.software"
  "ojf-tripplanner:trips.jim.software"
  "ojf-cv-builder:cv.jim.software"
  "ojf-blogengine:blog.jim.software"
  "ojf-core-reader:reader.jim.software"
)

deploy_app() {
  local name="$1"
  local dir="$2"
  local project="$3"

  echo ""
  echo "▶ Deploying $name → $dir"
  cd "$dir"

  # --yes accepts all default prompts; vercel.json provides build settings
  # On first run this creates a new Vercel project — subsequent runs update it
  npx vercel --prod --yes --name "$project" 2>&1

  echo "✓ $name deployed"
}

check_login() {
  if ! npx vercel whoami &>/dev/null; then
    echo "ERROR: Not logged into Vercel."
    echo "Run: npx vercel login"
    exit 1
  fi
  echo "Logged in as: $(npx vercel whoami 2>/dev/null)"
}

check_login

for entry in "${REPOS[@]}"; do
  name="${entry%%:*}"
  rest="${entry#*:}"
  dir="${rest%%:*}"
  project="${rest##*:}"

  if [[ "$TARGET" == "all" || "$TARGET" == "$name" ]]; then
    deploy_app "$name" "$dir" "$project"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All deployments complete."
echo ""
echo "Next: assign custom domains in Vercel dashboard"
echo "  https://vercel.com/dashboard"
echo ""
echo "  ojf-shell       → frame.jim.software"
echo "  ojf-tripplanner → trips.jim.software"
echo "  ojf-cv-builder  → cv.jim.software"
echo "  ojf-blogengine  → blog.jim.software"
echo "  ojf-core-reader → reader.jim.software"
echo ""
echo "DNS CNAME records required at your registrar:"
echo "  frame   CNAME  cname.vercel-dns.com"
echo "  trips   CNAME  cname.vercel-dns.com"
echo "  cv      CNAME  cname.vercel-dns.com"
echo "  blog    CNAME  cname.vercel-dns.com"
echo "  reader  CNAME  cname.vercel-dns.com"
echo ""
echo "Smoke test checklist (ADR-0013 Checkpoint 4):"
echo "  [ ] frame.jim.software loads shell"
echo "  [ ] Shell shows 'Agent offline — demo mode' badge"
echo "  [ ] TripPlanner tab renders without crash"
echo "  [ ] Resume Builder tab renders without crash"
echo "  [ ] No CORS errors in DevTools Network tab"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
