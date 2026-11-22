# Shared helpers for scripts/fleet-stage.sh and scripts/fleet-stage-setup.sh (ojfbot/core#647,
# slices 2 and 3). Sourced, not run. Every machine-specific value (SSH alias, folders, port, keys)
# comes from a private config file outside this repository, so nothing here names a host, address
# or folder. Bash 3 compatible (macOS /bin/bash): no associative arrays, no mapfile.
#
# Config: $FLEET_STAGE_CONF, default ~/.fleet-runner-stage/stage.conf, mode 0600, sourced as shell:
#   NAS_SSH=<ssh alias of the server>
#   NAS_STAGE_DIR=<deploy folder of the test copy: compose.yaml, fleet-staging.env, releases/>
#   NAS_STAGE_ROOT=<service root of the test copy: state/ output/ public-keys/ tls/, on a local disk>
#   STAGE_LAN_IP=<the server's LAN address the test copy publishes on>
#   STAGE_PORT=<the test copy's own host port>
#   STAGE_HOST=<the name clients use for the test copy; the TLS certificate must name it>
#   STAGE_KEYS_DIR=<private folder on this Mac: owner.token, stage-worker.token, ca.crt>
#   PROD_PORT=<production's host port>             PROD_CONTAINER=<production's container name>
# Optional: NAS_PROD_ROOT (production's service root, to check it is not the test copy's),
#   STAGE_PROJECT (default fleet-runner-staging), FLEET_REPO (default ojfbot/core),
#   STAGE_CA_DIR (this Mac's private CA folder, only for fleet-stage-setup.sh --tls).

set -euo pipefail

say() { printf '%s\n' "$*"; }
die() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

STAGE_WORKFLOW="fleet-runner-release.yml"

load_conf() {
  local conf="${FLEET_STAGE_CONF:-$HOME/.fleet-runner-stage/stage.conf}"
  [ -f "$conf" ] || die "no config at $conf (see the header of scripts/lib/fleet-stage-lib.sh)"
  # The config decides where commands run, so a file others can change is refused.
  [ -z "$(find "$conf" -perm -020 -o -perm -002 2>/dev/null)" ] || die "$conf must not be writable by group or others"
  # shellcheck disable=SC1090
  . "$conf"
  : "${NAS_SSH:?config must set NAS_SSH}" "${NAS_STAGE_DIR:?config must set NAS_STAGE_DIR}"
  : "${NAS_STAGE_ROOT:?config must set NAS_STAGE_ROOT}" "${STAGE_LAN_IP:?config must set STAGE_LAN_IP}"
  : "${STAGE_PORT:?config must set STAGE_PORT}" "${STAGE_HOST:?config must set STAGE_HOST}"
  : "${STAGE_KEYS_DIR:?config must set STAGE_KEYS_DIR}" "${PROD_PORT:?config must set PROD_PORT}"
  : "${PROD_CONTAINER:?config must set PROD_CONTAINER}"
  STAGE_PROJECT="${STAGE_PROJECT:-fleet-runner-staging}"
  FLEET_REPO="${FLEET_REPO:-ojfbot/core}"
  NAS_PROD_ROOT="${NAS_PROD_ROOT:-}"
  [[ "$STAGE_PORT" =~ ^[0-9]+$ && "$PROD_PORT" =~ ^[0-9]+$ ]] || die "STAGE_PORT and PROD_PORT must be numbers"
  [ "$STAGE_PORT" != "$PROD_PORT" ] || die "the test copy and production must use different ports"
  [[ "$STAGE_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "STAGE_PROJECT is not a valid Compose project name"
  [ "$PROD_CONTAINER" != "$STAGE_PROJECT" ] && [ "$PROD_CONTAINER" != "$STAGE_PROJECT-fleet-runner-1" ] ||
    die "the test copy must not share production's name"
  [ "$NAS_STAGE_DIR" != "$NAS_STAGE_ROOT" ] || die "the deploy folder and the service root must differ"
  [ -d "$STAGE_KEYS_DIR" ] || die "STAGE_KEYS_DIR is not a folder"
  [ -z "$(find "$STAGE_KEYS_DIR" -maxdepth 0 -perm -077 2>/dev/null)" ] || die "$STAGE_KEYS_DIR must be private (mode 0700)"
}

# Run a POSIX sh script on the server: nas 'script' arg1 arg2 ... ($1, $2 ... inside the script).
nas() {
  local script="$1"
  shift
  local quoted=() a
  for a in "$@"; do quoted+=("$(printf '%q' "$a")"); done
  # shellcheck disable=SC2029
  ssh -o BatchMode=yes "$NAS_SSH" "sh -s -- ${quoted[*]-}" <<<"set -eu
$script"
}

# Copy local files into an existing folder on the server: nas_put <remote folder> <file>...
# Over the SSH shell, not scp: the server's SFTP view of the file system can differ from its shell's.
nas_put() {
  local dest="$1" f
  shift
  for f in "$@"; do
    # shellcheck disable=SC2029
    ssh -o BatchMode=yes "$NAS_SSH" "umask 077 && cat > $(printf '%q' "$dest/$(basename "$f")")" <"$f"
  done
}

# Resolve a revision to the full commit ID (fetching origin if it is not known yet).
full_revision() {
  local rev="$1"
  [[ "$rev" =~ ^[0-9a-f]{7,40}$ ]] || die "revision must be a commit ID (7-40 hex characters)"
  git rev-parse --verify --quiet "$rev^{commit}" 2>/dev/null ||
    { git fetch --quiet origin && git rev-parse --verify --quiet "$rev^{commit}"; } ||
    die "unknown commit $rev"
}

# Read one field from JSON on stdin: json_field <dotted.path>. Uses node, which the repo requires.
json_field() {
  node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let v = JSON.parse(s);
      for (const k of process.argv[1].split(".")) v = v?.[k];
      process.stdout.write(v === undefined || v === null ? "" : String(v));
    });' "$1"
}

# Pick the CI run whose artifact may be trusted for <full revision>, never by artifact name alone
# (a fork's pull request can publish an artifact with a real release's name). Prints
# "<run id> <kind>" for the first run that satisfies one of the two rules of deployment.md, all with
# workflow file fleet-runner-release.yml, head repository $FLEET_REPO, branch main, a success
# conclusion:
#   push:      event push, head SHA equal to the full revision
#   rebuild:   event workflow_dispatch (its head SHA is main's tip, so it cannot be used); the
#              caller must then check release.json's revision. Newest run first.
# Prints one candidate per line, push runs first; the caller tries them in order.
select_runs() {
  local rev="$1" listing
  listing="$(gh api "repos/$FLEET_REPO/actions/workflows/$STAGE_WORKFLOW/runs?branch=main&status=success&per_page=100" \
    --jq '.workflow_runs[] | [.id, .event, .head_branch, .head_sha, (.head_repository.full_name // ""), (.path // ""), .conclusion, .created_at] | @tsv')" ||
    die "could not list the release runs (is gh signed in?)"
  printf '%s\n' "$listing" | awk -F'\t' -v rev="$rev" -v repo="$FLEET_REPO" -v wf=".github/workflows/$STAGE_WORKFLOW" '
    $3 == "main" && $5 == repo && $7 == "success" && index($6, wf) == 1 {
      if ($2 == "push" && $4 == rev) print "0 " $8 " " $1 " push"
      else if ($2 == "workflow_dispatch") print "1 " $8 " " $1 " rebuild"
    }' | sort -k1,1n -k2,2r | awk '{print $3, $4}'
}

# Refuse unless the test copy is its own: its folders carry the marker that fleet-stage-setup.sh
# writes (so no run can target a folder setup did not create for this purpose), differ from
# production's declared root, and its port and name are not production's or another container's.
# This reads nothing of production; it only compares the values the private config declares.
# Run before anything changes.
ISOLATION='
deploy="$1" root="$2" prod_root="$3" port="$4" prod_port="$5" project="$6" prod_container="$7"
bad=0
[ -f "$root/.fleet-runner-staging" ] || { echo "FAIL $root is not marked as the test copy: run fleet-stage-setup.sh"; bad=1; }
[ -f "$deploy/.fleet-runner-staging" ] || { echo "FAIL $deploy is not marked as the test copy: run fleet-stage-setup.sh"; bad=1; }
real() {
  d="${1%/}" rest=""
  while [ -n "$d" ] && [ ! -d "$d" ]; do rest="/${d##*/}$rest"; d="${d%/*}"; done
  [ -n "$d" ] && d="$(cd "$d" && pwd -P)"
  printf "%s%s" "$d" "$rest"
}
if [ -n "$prod_root" ]; then
  s="$(real "$root")"; p="$(real "$prod_root")"
  case "$s/" in "$p"/*) echo "FAIL the test copy root is production root or inside it"; bad=1 ;; esac
  case "$p/" in "$s"/*) echo "FAIL production root is inside the test copy root"; bad=1 ;; esac
  d="$(real "$deploy")"
  case "$d/" in "$p"/*) echo "FAIL the test copy deploy folder is inside production root"; bad=1 ;; esac
fi
[ "$port" != "$prod_port" ] || { echo "FAIL the test copy and production share a port"; bad=1; }
# A port some other container already publishes would fail at start, or worse; compose projects
# other than ours are other containers. docker ps lists names and ports only.
others="$(docker ps --format "{{.Names}} {{.Ports}}" 2>/dev/null | awk -v p=":$port->" -v mine="$project-" "index(\$0, p) && index(\$1, mine) != 1 {print \$1}")"
[ -z "$others" ] || { echo "FAIL port $port is already published by another container"; bad=1; }
[ "$prod_container" != "$project-fleet-runner-1" ] || { echo "FAIL the test copy would share production container name"; bad=1; }
[ "$bad" -eq 0 ] && echo "PASS the test copy has its own folders, port and name"
exit "$bad"
'
check_isolation() {
  nas "$ISOLATION" "$NAS_STAGE_DIR" "$NAS_STAGE_ROOT" "$NAS_PROD_ROOT" "$STAGE_PORT" "$PROD_PORT" "$STAGE_PROJECT" "$PROD_CONTAINER" ||
    die "the test copy is not isolated from production; nothing was changed"
}
