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
# For fleet-promote.sh only (load_prod_conf), in the same file:
#   NAS_PROD_DIR=<production's control folder: promote-runs/<run>/ (each run's inputs and its
#                journal, the only authority on what production is) and promote-records/ (reports);
#                the first promote creates it, with a marker. The folder itself is the promote's
#                lock (fleet-promote-decider.sh).>
#   NAS_PROD_ROOT=<production's service root: state/ output/ inputs/ public-keys/ tls/> (required)
#   PROD_KEYS_DIR=<private folder on this Mac: <PROD_STATUS_ID>.token and production's ca.crt>
# Optional: PROD_PROJECT (production's Compose project, default fleet-runner-production),
#   PROD_HOST and PROD_LAN_IP (the name clients use and the address it publishes on; default
#   STAGE_HOST and STAGE_LAN_IP), PROD_STATUS_ID (the read-only identity whose signed status the
#   promote reads, default observer; never owner).
#   PROD_KEY_IDS="<id> <id> ..." (required: exactly the identities whose public keys production has
#   enrolled; checked before the switch and again in the new container).

set -euo pipefail

# say and die can never fail: a closed or broken stdout (the terminal gone, a reader that quit)
# must not turn a message into an error that skips a rollback. They print from a subshell: bash 3.2
# keeps the text of a failed printf in its output buffer and emits it inside the NEXT command
# substitution (into a computed number, or a remote command line), so a failed write must die with
# a throwaway process. With FLEET_LOG set, every line is also appended to that durable local log.
say() {
  (printf '%s\n' "$*" 2>/dev/null) || true
  if [ -n "${FLEET_LOG:-}" ]; then (printf '%s\n' "$*" >>"$FLEET_LOG" 2>/dev/null) || true; fi
}
die() {
  # Left to right: the message goes to stderr, and only printf's own complaint goes to /dev/null.
  (printf 'FAIL %s\n' "$*" >&2 2>/dev/null) || true
  if [ -n "${FLEET_LOG:-}" ]; then (printf 'FAIL %s\n' "$*" >>"$FLEET_LOG" 2>/dev/null) || true; fi
  exit 1
}

STAGE_WORKFLOW="fleet-runner-release.yml"

load_conf() {
  local conf="${FLEET_STAGE_CONF:-$HOME/.fleet-runner-stage/stage.conf}"
  FLEET_CONF_FILE="$conf"
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

load_prod_conf() {
  : "${NAS_PROD_DIR:?config must set NAS_PROD_DIR}" "${NAS_PROD_ROOT:?config must set NAS_PROD_ROOT}"
  : "${PROD_KEYS_DIR:?config must set PROD_KEYS_DIR}"
  PROD_PROJECT="${PROD_PROJECT:-fleet-runner-production}"
  PROD_HOST="${PROD_HOST:-$STAGE_HOST}"
  PROD_LAN_IP="${PROD_LAN_IP:-$STAGE_LAN_IP}"
  PROD_STATUS_ID="${PROD_STATUS_ID:-observer}"
  : "${PROD_KEY_IDS:?config must set PROD_KEY_IDS (the identities whose public keys production must have enrolled)}"
  [[ "$PROD_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "PROD_PROJECT is not a valid Compose project name"
  [ "$PROD_PROJECT" != "$STAGE_PROJECT" ] || die "production and the test copy must be different Compose projects"
  [ "$PROD_CONTAINER" != "$PROD_PROJECT-fleet-runner-1" ] || die "PROD_CONTAINER is the hand-started container, not the Compose one"
  [[ "$PROD_STATUS_ID" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || die "PROD_STATUS_ID is not an identity name"
  # Agents never use production's owner key: the promote reads status as a read-only identity.
  [ "$PROD_STATUS_ID" != owner ] || die "the promote never signs as production's owner: set PROD_STATUS_ID to a read-only identity"
  local id
  for id in $PROD_KEY_IDS; do [[ "$id" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || die "PROD_KEY_IDS holds a name that is not an identity"; done
  [ -d "$PROD_KEYS_DIR" ] || die "PROD_KEYS_DIR is not a folder"
  [ -z "$(find "$PROD_KEYS_DIR" -maxdepth 0 -perm -077 2>/dev/null)" ] || die "$PROD_KEYS_DIR must be private (mode 0700)"
  [ -f "$PROD_KEYS_DIR/$PROD_STATUS_ID.token" ] && [ -f "$PROD_KEYS_DIR/ca.crt" ] ||
    die "PROD_KEYS_DIR needs $PROD_STATUS_ID.token and ca.crt"
  local a b
  for a in "$NAS_PROD_DIR" "$NAS_PROD_ROOT"; do
    for b in "$NAS_STAGE_DIR" "$NAS_STAGE_ROOT"; do [ "${a%/}" != "${b%/}" ] || die "production and the test copy must not share a folder"; done
  done
  [ "$NAS_PROD_DIR" != "$NAS_PROD_ROOT" ] || die "production's deploy folder and service root must differ"
}

# Run a POSIX sh script on the server: nas 'script' arg1 arg2 ... ($1, $2 ... inside the script).
nas() {
  local script="$1"
  shift
  # Quoted with printf -v, never through a command substitution, so no stray output of this shell can
  # end up in the remote command line.
  # An argument is ONE plain line, always: for a line break, a tab or any other character it cannot
  # write plainly, printf %q falls back to the $'..' form, which only some shells read (bash does,
  # dash does not), so such an argument would arrive as different text depending on the server's
  # sh. Anything else travels on stdin: in the script, or as a file (nas_put).
  local quoted=() a q
  for a in "$@"; do
    printf -v q '%q' "$a"
    case "$q" in "\$'"*) (printf 'FAIL nas: an argument holds a line break or another character that cannot be sent as plain text; send it on stdin\n' >&2 2>/dev/null) || true; return 2 ;; esac
    quoted+=("$q")
  done
  # The script travels on ssh's stdin. Wrapping it in { ...; } </dev/null makes sh read the whole
  # script before running any of it, and gives every command an empty stdin, so a command that
  # reads stdin (docker, a helper script) cannot swallow the rest of the script. (HelpDesk's first
  # promote failed safely on exactly that.)
  # The promote keeps its terminal on descriptors 7 and 8; ssh does not need them.
  # shellcheck disable=SC2029
  ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
    "$NAS_SSH" "sh -s -- ${quoted[*]-}" 7>&- 8>&- <<<"set -eu
{
$script
} </dev/null"
}

# Copy local files into an existing folder on the server: nas_put <remote folder> <file>...
# Over the SSH shell, not scp: the server's SFTP view of the file system can differ from its shell's.
nas_put() {
  local dest="$1" f q
  shift
  for f in "$@"; do
    printf -v q '%q' "$dest/${f##*/}"
    case "$q" in "\$'"*) return 2 ;; esac
    # shellcheck disable=SC2029
    ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
      "$NAS_SSH" "umask 077 && cat > $q" <"$f" 7>&- 8>&- || return 1
  done
}

# Put one local file at an exact path on the server, whole or not at all (a .part beside it, then one
# rename): nas_write <remote file> <local file>. The decider only ever reads complete files.
nas_write() {
  local q
  printf -v q '%q' "$1"
  case "$q" in "\$'"*) return 2 ;; esac
  # shellcheck disable=SC2029
  ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
    "$NAS_SSH" "umask 077 && cat > $q.part && mv $q.part $q" <"$2" 7>&- 8>&-
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
# The env file is what Compose reads, and Compose's dotenv parser accepts more than KEY=value:
# `export KEY=...`, quotes, and a later duplicate that wins. Rather than re-implement that parser,
# only the plainest form is accepted: one KEY=value per line, no export, no quotes, no duplicates,
# nothing that could be interpolated. fleet-stage-setup.sh writes exactly that, and so does the
# stage script.
ENV_PLAIN_FN='
env_is_plain() {
  if grep -v -e "^\$" "$1" | grep -qv -e "^[A-Z][A-Z0-9_]*=[A-Za-z0-9_.,/:@+-]*\$"; then return 1; fi
  [ -z "$(sed -n "s/^\([A-Z][A-Z0-9_]*\)=.*/\1/p" "$1" | sort | uniq -d)" ]
}
'
ISOLATION="$ENV_PLAIN_FN"'
deploy="$1" root="$2" prod_root="$3" port="$4" prod_port="$5" project="$6" prod_container="$7" lan="$8"
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
# The container is configured by the server env file, the checks by the private config: they must
# say the same thing, or the checks would be about a different test copy than the one that runs.
envv() { sed -n "s/^$1=//p" "$deploy/fleet-staging.env" 2>/dev/null | tail -n 1; }
if [ -f "$deploy/fleet-staging.env" ] && ! env_is_plain "$deploy/fleet-staging.env"; then
  echo "FAIL fleet-staging.env is not one plain KEY=value per line (no export, quotes or duplicate keys)"; bad=1
elif [ -f "$deploy/fleet-staging.env" ]; then
  for pair in "FLEET_STAGE_ROOT=$root" "FLEET_HOST_PORT=$port" "FLEET_LAN_IP=$lan" "FLEET_COMPOSE_PROJECT=$project"; do
    k="${pair%%=*}"; v="${pair#*=}"
    [ "$(envv "$k")" = "$v" ] || { echo "FAIL fleet-staging.env $k differs from the private config"; bad=1; }
  done
else
  echo "FAIL $deploy/fleet-staging.env is missing: run fleet-stage-setup.sh"; bad=1
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
  nas "$ISOLATION" "$NAS_STAGE_DIR" "$NAS_STAGE_ROOT" "$NAS_PROD_ROOT" "$STAGE_PORT" "$PROD_PORT" "$STAGE_PROJECT" "$PROD_CONTAINER" "$STAGE_LAN_IP" ||
    die "the test copy is not isolated from production; nothing was changed"
}

# ---- Shared by fleet-stage.sh and fleet-promote.sh: run lock, fenced server steps, stop by label.

# stage-state, in the test copy's deploy folder: ONE file naming the last revision that passed and
# the one staged now (promotable), always written together by one rename. fleet-promote.sh only
# reads it.
STATE_FN='
read_state() { sed -n "s/^$2=//p" "$1/stage-state" 2>/dev/null | tail -n 1; }
write_state() { printf "last_passed=%s\nstaged_ok=%s\n" "$2" "$3" > "$1/stage-state.new" && mv "$1/stage-state.new" "$1/stage-state"; }
'

# One STAGE run at a time: mkdir is atomic. A crashed run's lock is left for a person to remove.
# (The promote does not use this: its lock is a kernel lock held by its server-side decider.)
#   nas "$LOCK" <deploy folder> <run ID> <lock name> <what runs, for the message>
LOCK='
dir="$1" id="$2" name="$3" what="$4"
if mkdir "$dir/$name" 2>/dev/null; then
  echo "$id" > "$dir/$name/owner"
else
  echo "FAIL another $what run holds the lock ($(cat "$dir/$name/owner" 2>/dev/null)); if none is running, remove $dir/$name"
  exit 1
fi
'
#   nas "$UNLOCK" <deploy folder> <run ID> <lock name>
UNLOCK='
dir="$1" id="$2" name="$3"
[ "$(cat "$dir/$name/owner" 2>/dev/null)" = "$id" ] && rm -rf "$dir/$name"
true
'

# Stop every container of a Compose project by its label. Compose itself would first interpolate
# the whole file, which fails when the env file lacks a revision; the label does not care.
STOP_FN='
stop_project() {
  ids="$(docker ps -q --filter "label=com.docker.compose.project=$1")" || return 1
  if [ -n "$ids" ]; then docker stop -t 30 $ids >/dev/null || return 1; fi
  left="$(docker ps -q --filter "label=com.docker.compose.project=$1")" || return 1
  [ -z "$left" ]
}
'
STOP="$STOP_FN"'stop_project "$1"'

# Compose prefers a variable in the calling shell over the --env-file, so a server profile that
# exports FLEET_HOST_PORT or FLEET_STAGE_ROOT would silently change what runs. None is inherited.
CLEAN_ENV='
for v in $(env | sed -n -E "s/^((FLEET|COMPOSE)_[A-Za-z0-9_]*)=.*/\1/p"); do unset "$v"; done
'

# A server-side script that must be fenced: fenced <lock name> <body>. It runs in its OWN process
# group, recorded in the lock folder, so that a rollback can wait for everything it started (a
# Compose child outlives a shell that is hung up). Convention: $1 is the deploy folder and $2 this
# run's ID; the body sees the rest. Before each step it checks, with step, that the run still owns
# the lock and was not told to stop. Fails closed when it cannot get a group of its own (setsid,
# else job control).
fenced() {
  [[ "$1" =~ ^\.[a-z-]+$ ]] || die "fenced: bad lock name"
  printf 'lockname=%s\n' "$1"
  cat <<'EOF_HEAD'
dir="$1" runid="$2"
lock="$dir/$lockname"
[ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] || { echo "FAIL this run does not own the lock"; exit 1; }
{ printf 'lockname=%s\n' "$lockname"; cat <<'BODY_EOF'
# The body fails on any error: the wrapper has -eu, but a script run as its own process does not
# inherit it, and an unchecked write must never be followed by a PASS.
set -eu
dir="$1" runid="$2"
shift 2
lock="$dir/$lockname"
pgid="$(ps -o pgid= -p $$ | tr -d ' ')"
[ "$pgid" = "$$" ] || { echo "FAIL could not run in its own process group"; exit 1; }
# The group record is NOT removed from here: bash runs an EXIT trap when HUP or TERM ends the shell
# while a child it started keeps running, and that would erase the only thing a rollback can wait
# on. It is removed only once the whole group is confirmed gone (by the wrapper, or the rollback).
echo "$$" > "$lock/fenced.pid"
# Its output goes to a file in the lock folder, never to the connection: a dropped channel (and the
# SIGPIPE it would bring) cannot kill it between steps.
trap "" PIPE HUP
step() { [ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] && [ ! -e "$lock/abort" ] || { echo "FAIL the run was aborted"; exit 1; }; }
EOF_HEAD
  printf '%s\n' "$2"
  cat <<'EOF_TAIL'
BODY_EOF
} > "$lock/body.sh"
: > "$lock/progress.log"
if command -v setsid >/dev/null 2>&1; then
  setsid sh "$lock/body.sh" "$@" > "$lock/progress.log" 2>&1 < /dev/null &
else
  set -m
  sh "$lock/body.sh" "$@" > "$lock/progress.log" 2>&1 < /dev/null &
fi
child=$!
# Stream the progress file to the caller while the body runs; if this connection is gone, only
# this loop dies, not the body.
shown=0
show() {
  n="$(wc -l < "$lock/progress.log" | tr -d " ")"
  if [ "$n" -gt "$shown" ]; then sed -n "$((shown + 1)),${n}p" "$lock/progress.log"; shown="$n"; fi
}
while kill -0 "$child" 2>/dev/null; do show; sleep 1; done
rc=0
wait "$child" || rc=$?
sed -n "$((shown + 1)),\$p" "$lock/progress.log"
i=0
while kill -0 "-$child" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -lt 900 ] || break
  sleep 1
done
kill -0 "-$child" 2>/dev/null || rm -f "$lock/fenced.pid"
exit "$rc"
EOF_TAIL
}

# The first act of every rollback: fence_wait <lock folder> <run ID> <seconds>. Tells anything
# fenced that is still running on the server (its connection may be long gone) to stop, and waits
# until its whole process group has ended. Never kills (a stale ID could belong to someone else):
# if the group does not end in time it fails, and the caller keeps the lock.
FENCE_WAIT_FN='
fence_wait() {
  lock="$1"
  [ "$(cat "$lock/owner" 2>/dev/null)" = "$2" ] || { echo "FAIL this run no longer owns the lock; nothing was changed"; return 1; }
  : > "$lock/abort"
  pid="$(cat "$lock/fenced.pid" 2>/dev/null)"
  if [ -n "$pid" ]; then
    i=0
    while kill -0 "-$pid" 2>/dev/null || kill -0 "$pid" 2>/dev/null; do
      i=$((i + 1))
      [ "$i" -le "$3" ] || { echo "FAIL the server-side step (process group $pid) is still running after $3 seconds; the lock is kept"; return 1; }
      sleep 1
    done
    rm -f "$lock/fenced.pid"
  fi
}
'

# Node, as one service's client: client_node <host> <port> <keys dir> <status identity> <script>
# [args]. What must not leak in from the caller's shell (a stray FLEET_* setting, another CA,
# another endpoint) is unset; the values are taken as arguments FIRST, because the private config
# may well export STAGE_HOST or STAGE_KEYS_DIR. The keys folder holds <identity>.token and ca.crt.
# CLIENT_TIMEOUT_MS, when set, becomes the script's STAGE_TIMEOUT_MS (the bound of each call).
client_node() {
  local host="$1" port="$2" keys="$3" sid="$4" script="$5" tmo="${CLIENT_TIMEOUT_MS:-}"
  shift 5
  (
    for v in $(env | grep -oE '^(FLEET_[A-Z_]*|NODE_EXTRA_CA_CERTS|NODE_OPTIONS|STAGE_[A-Z_]*)=' | tr -d =); do unset "$v"; done
    export STAGE_URL="https://$host:$port" STAGE_KEYS_DIR="$keys" STAGE_STATUS_ID="$sid"
    if [ -n "$tmo" ]; then export STAGE_TIMEOUT_MS="$tmo"; fi
    export NODE_EXTRA_CA_CERTS="$keys/ca.crt"
    node "$script" "$@"
  )
}

# Refuse unless production's folders are not the test copy's (nor inside each other), its deploy
# folder is production's own (it carries the marker only PROD_MKDIR writes, or is new or empty), and
# its service root carries no test copy marker. Changes nothing (the deploy folder and its marker
# are created by PROD_MKDIR, only once every refusal has had its say). Reads nothing of production's
# data. That the RUNNING production uses the declared root, address and port is the decider's check.
PROD_ISOLATION='
deploy="$1" root="$2" stage_deploy="$3" stage_root="$4" project="$5" lan="$6" port="$7"
mark=.fleet-runner-production
bad=0
real() {
  d="${1%/}" rest=""
  while [ -n "$d" ] && [ ! -d "$d" ]; do rest="/${d##*/}$rest"; d="${d%/*}"; done
  [ -n "$d" ] && d="$(cd "$d" && pwd -P)"
  printf "%s%s" "$d" "$rest"
}
for a in "$deploy" "$root"; do
  for b in "$stage_deploy" "$stage_root"; do
    x="$(real "$a")"; y="$(real "$b")"
    case "$x/" in "$y"/*) echo "FAIL a production folder is a test copy folder or inside one"; bad=1 ;; esac
    case "$y/" in "$x"/*) echo "FAIL a test copy folder is inside a production folder"; bad=1 ;; esac
  done
done
[ ! -e "$root/.fleet-runner-staging" ] || { echo "FAIL the production root carries the test copy marker"; bad=1; }
for d in state output inputs public-keys tls; do [ -d "$root/$d" ] || { echo "FAIL production has no $d folder under the declared root"; bad=1; }; done
if [ -d "$deploy" ] && [ ! -f "$deploy/$mark" ] && [ -n "$(ls -A "$deploy" 2>/dev/null)" ]; then
  echo "FAIL the production deploy folder already holds files and is not marked as production deploy folder"; bad=1
fi
[ "$bad" -eq 0 ] || exit 1
echo "PASS production has its own folders, port and name"
'
check_prod_isolation() {
  nas "$PROD_ISOLATION" "$NAS_PROD_DIR" "$NAS_PROD_ROOT" "$NAS_STAGE_DIR" "$NAS_STAGE_ROOT" "$PROD_PROJECT" "$PROD_LAN_IP" "$PROD_PORT" ||
    die "production is not isolated from the test copy; nothing was changed"
}

# Create production's deploy folder and its marker (the first promote), right before the lock.
PROD_MKDIR='
umask 077
mkdir -p "$1" && : > "$1/.fleet-runner-production" || { echo "FAIL could not create the production deploy folder"; exit 1; }
'

# ---- Receipts: what this Mac verified when a revision passed in the test copy.
# fleet-stage.sh writes one per passing revision, from the release.json it verified HERE (never the
# server's copy), beside the private config: receipts/<revision>.receipt, plain KEY=value lines.
# fleet-promote.sh requires it, and requires the server's release and image to match it, so the
# server's account cannot forge the evidence that a revision passed.
receipt_file() { printf '%s/receipts/%s.receipt' "$(dirname "$FLEET_CONF_FILE")" "$1"; }
write_receipt() {
  local json="$1" stagerun="$2" rev dir file
  rev="$(json_field revision <"$json")"
  [[ "$rev" =~ ^[0-9a-f]{40}$ ]] || return 1
  file="$(receipt_file "$rev")"
  dir="$(dirname "$file")"
  (umask 077 && mkdir -p "$dir") || return 1
  {
    echo "revision=$rev"
    echo "tag=$(json_field tag <"$json")"
    echo "image_id=$(json_field image_id <"$json")"
    echo "manifest_digest=$(json_field manifest_digest <"$json")"
    echo "archive_sha256=$(json_field archive_sha256 <"$json")"
    echo "release_json_sha256=$(shasum -a 256 "$json" | cut -d' ' -f1)"
    echo "stage_run=$stagerun"
  } >"$file.part" && chmod 0600 "$file.part" && mv "$file.part" "$file"
}
receipt_value() { sed -n "s/^$2=//p" "$1" | tail -n 1; }

# ---- Run a script's main function with ALL its output mirrored to a durable local log, so that a
# closed or broken terminal can neither stop it nor lose what it did:
#   run_logged <log file> <function> [args]
# The function runs in the background in its own process group, writing into a FIFO read by a
# logger that ignores INT, TERM, HUP and PIPE, appends every line to the log and copies it to the
# terminal while that still works. INT, TERM and HUP sent to this shell are passed on to the
# function's whole process group (its ssh too), as a terminal's Ctrl-C would. Returns its status.
run_logged() {
  local log="$1" fifo lpid mpid rc
  shift
  (umask 077 && mkdir -p "$(dirname "$log")" && : >>"$log") || die "cannot write the log $log"
  fifo="$log.fifo.$$"
  rm -f "$fifo"
  mkfifo -m 600 "$fifo" || die "cannot make a FIFO beside $log"
  (
    trap '' INT TERM HUP PIPE
    while IFS= read -r line || [ -n "$line" ]; do
      printf '%s\n' "$line" >>"$log" 2>/dev/null || true
      printf '%s\n' "$line" 2>/dev/null || true
    done <"$fifo"
  ) &
  lpid=$!
  set -m
  ( set +m; FLEET_LOG="" "$@" ) >"$fifo" 2>&1 &
  mpid=$!
  set +m
  trap 'kill -INT -- -'"$mpid"' 2>/dev/null' INT
  trap 'kill -TERM -- -'"$mpid"' 2>/dev/null' TERM
  trap 'kill -HUP -- -'"$mpid"' 2>/dev/null' HUP
  while :; do
    rc=0
    wait "$mpid" || rc=$?
    kill -0 "$mpid" 2>/dev/null || break
  done
  trap - INT TERM HUP
  wait "$lpid" 2>/dev/null || true
  rm -f "$fifo"
  return "$rc"
}
