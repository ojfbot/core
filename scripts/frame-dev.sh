#!/usr/bin/env bash
# frame-dev.sh — Frame OS dev server launcher
#
# Usage:
#   ./scripts/frame-dev.sh           # start all servers (idempotent)
#   ./scripts/frame-dev.sh stop      # kill all servers by port
#   ./scripts/frame-dev.sh status    # check which ports are listening
#
# WHY build+preview for sub-apps (not vite dev):
#   @originjs/vite-plugin-federation remotes MUST serve remoteEntry.js from
#   a built dist/ directory. In vite dev mode, /assets/remoteEntry.js returns
#   the SPA index.html (catch-all fallback) — the shell cannot load the remote
#   component and throws "Failed to fetch dynamically imported module".
#   Fix: build browser-app first (generates dist/assets/remoteEntry.js),
#   then run vite preview which serves from dist/ at the configured port.

set -uo pipefail

CMD="${1:-start}"
REPOS="$(cd "$(dirname "$0")/../.." && pwd)"
LOGDIR="${TMPDIR:-/tmp}/frame-dev-logs"
mkdir -p "$LOGDIR"

port_up() { lsof -i :"$1" -sTCP:LISTEN -t &>/dev/null; }

# ── Shell: dev mode (MF host works fine with vite dev + HMR) ─────────────────
start_shell() {
  if port_up 4000; then
    printf "  ✓  %-14s  :4000 + :4001  already running\n" "shell+agent"
  else
    printf "  ▶  %-14s  :4000 + :4001  starting (dev + HMR)...\n" "shell+agent"
    (cd "$REPOS/shell" && pnpm dev >> "$LOGDIR/shell.log" 2>&1 &)
  fi
}

# ── Sub-apps: build then preview (MF remotes require built remoteEntry.js) ───
# Args: name  repo_dir  pnpm_filter               port  [vite_only]
# Pass vite_only=1 to skip tsc (e.g. tripplanner has pre-existing TS errors)
start_subapp() {
  local name="$1" dir="$2" filter="$3" port="$4" vite_only="${5:-0}"
  if port_up "$port"; then
    printf "  ✓  %-14s  :%-4s  already running\n" "$name" "$port"
  else
    printf "  ▶  %-14s  :%-4s  building (MF)... tail -f %s/%s.log\n" "$name" "$port" "$LOGDIR" "$name"
    if [[ "$vite_only" == "1" ]]; then
      (cd "$REPOS/$dir/packages/browser-app" && npx vite build && npx vite preview \
        >> "$LOGDIR/$name.log" 2>&1 &)
    else
      (cd "$REPOS/$dir" && pnpm --filter "$filter" build && pnpm --filter "$filter" preview \
        >> "$LOGDIR/$name.log" 2>&1 &)
    fi
  fi
}

stop_port() {
  local name="$1" port="$2"
  local pids
  pids=$(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -TERM 2>/dev/null || true
    printf "  ✗  %-14s  :%-4s  stopped\n" "$name" "$port"
  else
    printf "  –  %-14s  :%-4s  not running\n" "$name" "$port"
  fi
}

status_port() {
  local name="$1" port="$2"
  if port_up "$port"; then
    printf "  ✓  %-14s  :%-4s  RUNNING\n" "$name" "$port"
  else
    printf "  ✗  %-14s  :%-4s  stopped\n" "$name" "$port"
  fi
}

case "$CMD" in
  start)
    echo ""
    echo "Frame OS dev servers"
    echo "────────────────────────────────────────────────────────────────"
    start_shell
    start_subapp "cv-builder"  "cv-builder"  "@cv-builder/browser-app"   3000
    start_subapp "blogengine"  "blogengine"  "@blogengine/browser-app"   3005
    start_subapp "tripplanner" "TripPlanner" "@tripplanner/browser-app"  3010 1
    start_subapp "lean-canvas" "lean-canvas" "@lean-canvas/browser-app"  3025
    # core-reader preview needs VITE_CORE_READER_API_URL baked into the build so
    # API calls resolve to :3016 instead of falling through to the shell at :4000.
    if port_up 3015; then
      printf "  ✓  %-14s  :3015  already running\n" "core-reader"
    else
      printf "  ▶  %-14s  :3015  building (MF)... tail -f %s/core-reader.log\n" "core-reader" "$LOGDIR"
      (cd "$REPOS/core-reader" && \
        VITE_CORE_READER_API_URL=http://localhost:3016 pnpm --filter "@core-reader/browser-app" build \
        && pnpm --filter "@core-reader/browser-app" preview \
        >> "$LOGDIR/core-reader.log" 2>&1 &)
    fi
    # CoreReader API — reads from core repo; requires CORE_REPO_PATH
    if port_up 3016; then
      printf "  ✓  %-14s  :3016  already running\n" "core-reader-api"
    else
      printf "  ▶  %-14s  :3016  starting...\n" "core-reader-api"
      (cd "$REPOS/core-reader/packages/api" && \
        CORE_REPO_PATH="$REPOS/core" CORS_ORIGIN="http://localhost:4000" pnpm dev \
        >> "$LOGDIR/core-reader-api.log" 2>&1 &)
    fi
    echo ""
    echo "  Sub-apps build in the background (~30s each). Shell is ready now."
    echo "  Watch builds: tail -f $LOGDIR/<app>.log"
    echo ""
    ;;
  stop)
    echo ""
    echo "Stopping Frame OS dev servers"
    echo "────────────────────────────────────────────────────────────────"
    stop_port "shell"        4000
    stop_port "frame-agent"  4001
    stop_port "cv-builder"   3000
    stop_port "blogengine"   3005
    stop_port "tripplanner"  3010
    stop_port "lean-canvas"  3025
    stop_port "lean-canvas-api" 3026
    stop_port "core-reader"  3015
    stop_port "core-reader-api" 3016
    echo ""
    ;;
  status)
    echo ""
    echo "Frame OS server status"
    echo "────────────────────────────────────────────────────────────────"
    status_port "shell"        4000
    status_port "frame-agent"  4001
    status_port "cv-builder"   3000
    status_port "blogengine"   3005
    status_port "tripplanner"  3010
    status_port "lean-canvas"  3025
    status_port "lean-canvas-api" 3026
    status_port "core-reader"  3015
    status_port "core-reader-api" 3016
    echo ""
    ;;
  *)
    echo "Usage: $0 [start|stop|status]"
    echo "  start   Build sub-apps then start all servers (idempotent)"
    echo "  stop    Kill all servers by port"
    echo "  status  Check which ports are listening"
    exit 1
    ;;
esac
