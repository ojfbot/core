#!/usr/bin/env bash
# fleet-promote: put a FleetRunner revision that passed in the TEST COPY onto PRODUCTION, with an
# undo (ojfbot/core#647, slice 4). It refuses without the owner's yes, given as a flag:
#
#   scripts/fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>'
#
# Refuses, before anything changes, unless:
#   - the approval is given, is one line, and EVERY hex string of 7 or more characters in it names
#     exactly this revision (each must resolve, unambiguously, to it; at least one must be there);
#   - it runs from a clean checkout at origin/main (--rehearsal, for a throwaway production only,
#     lifts this; it is refused unless production's deploy folder carries the rehearsal marker);
#   - stage-state says this exact revision is both the last that passed and the one staged;
#   - this Mac holds the receipt fleet-stage.sh wrote when the revision passed, and the server's
#     release.json and image match it (so the server's account cannot forge the evidence);
#   - the approval was never used (each yes covers one promotion; its SHA-256 goes into promote.log
#     when production is about to change);
#   - production's folders, port and name are not the test copy's, and production runs now in one
#     of two forms: the hand-started container PROD_CONTAINER (the first promote: it must be exactly
#     what the Compose file reproduces), or the Compose project PROD_PROJECT of an earlier promote.
# Then, still without changing production: take the promote lock; load-check the staged image on
# the server with THIS checkout's committed load-release.sh and the receipt's values; read
# production's signed status build (as the read-only identity PROD_STATUS_ID, never the owner key),
# its TLS certificate, its enrolled public keys (exactly PROD_KEY_IDS) and its identity lists; have
# Compose resolve the new config ONCE into a frozen file under the lock, and check that file here
# against an exact allowlist (compose-check.mjs), including the identity lists, by hash.
# The switch: arm a server-side dead-man that undoes everything unless this Mac commits a pass in
# time (FLEET_DEADMAN_SECS, default DEADMAN_DEFAULT_SECS, longer than every bounded phase after
# arming together: see "The watchdog window" below); then, fenced on the server: back up the files, stop the
# previous production, snapshot its state folder (a .part copy until SQLite's integrity check of it,
# opened read-only, passes), install exactly the frozen config (its hash is checked again) and start
# it with nothing re-read. Health check from this Mac: the signed status answers with exactly this
# revision, the same TLS certificate, the same keys by hash, no fewer jobs. Then the success record
# is written and the pass committed, which disarms the dead-man.
# On ANY failure, Ctrl-C, SIGTERM, SIGHUP or lost connection after the switch began, the undo runs
# (from this Mac, retried for FLEET_UNDO_RETRY_SECS, default 180; or by the dead-man if this Mac is
# gone; whichever claims it first under the lock): it fences, stops the new revision, puts the
# verified snapshot back only if the new revision was started, restores the files, starts the
# previous production (for the first promote, that very container, by ID and image) and writes an
# undo record. Never PASS for a promote that did not pass. All output also goes to a durable log
# beside the private config (logs/promote-<run>.log). Config: the lib's header (load_prod_conf).
here="$(cd "$(dirname "$0")" && pwd)"
# A closed or broken stdout must never kill this run, least of all inside its undo.
trap '' PIPE
# shellcheck source=lib/fleet-stage-lib.sh
. "$here/lib/fleet-stage-lib.sh"

usage() {
  echo "usage: fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>' [--rehearsal]" >&2
  exit 2
}
[ "$#" -ge 1 ] || usage
rev_arg="$1"
shift
approval=""
rehearsal=no
while [ "$#" -gt 0 ]; do
  case "$1" in
    --owner-approved) [ "$#" -ge 2 ] || usage; approval="$2"; shift 2 ;;
    --rehearsal) rehearsal=yes; shift ;;
    *) usage ;;
  esac
done
if [ -z "${approval//[[:space:]]/}" ]; then
  (echo "REFUSED promote changes production and needs the owner's yes." >&2 2>/dev/null) || true
  (echo "Ask the owner, then pass their answer, which names the revision: --owner-approved '<their words>'" >&2 2>/dev/null) || true
  exit 3
fi
case "$approval" in *$'\n'* | *$'\r'*) die "--owner-approved must be one line" ;; esac
# A rehearsal against a throwaway production can force the health check to fail; never production.
fault="${FLEET_PROMOTE_FAULT:-}"
case "$fault" in "" | health) ;; *) die "FLEET_PROMOTE_FAULT may only be health" ;; esac
[ -z "$fault" ] || [ "$rehearsal" = yes ] || die "FLEET_PROMOTE_FAULT needs --rehearsal (a throwaway production)"

load_conf
load_prod_conf
repo="$(git -C "$here" rev-parse --show-toplevel)"
cd "$repo"
rev="$(full_revision "$rev_arg")"
short="${rev:0:7}"
# The revision argument must be the start of the commit ID it resolved to: a branch or tag named like
# a short commit ID must not redirect the promote to another commit.
rev_lc="$(printf '%s' "$rev_arg" | tr 'A-F' 'a-f')"
case "$rev" in "$rev_lc"*) ;; *) die "$rev_arg resolves to ${rev:0:12}, which does not start with it (a branch or tag of that name?); name the commit ID; nothing was changed" ;; esac

# One yes, one revision. The rule: the approval must hold a hex string of 7 to 40 characters (bounded
# by non-hex, any case) that is the start of exactly this revision's commit ID, matched against commit
# IDs only (never branch or tag names). A hex-looking word that is the start of no commit (a date,
# "deadbeef") is ignored. One that is the start of another commit, or of more than one commit, refuses.
approval_rule="the approval must hold the start (7 to 40 hex characters) of $short's commit ID; hex words that are the start of no commit are ignored, one that names another commit or more than one refuses"
tokens="$(printf '%s' "$approval" | tr -c '0-9a-fA-F' '\n' | tr 'A-F' 'a-f' | grep -E '^[0-9a-f]{7,}$' || true)"
named=no
for tok in $tokens; do
  [ "${#tok}" -le 40 ] || continue
  commits="$(git rev-parse --disambiguate="$tok" 2>/dev/null | while read -r o; do [ "$(git cat-file -t "$o" 2>/dev/null)" = commit ] && echo "$o"; done || true)"
  n="$(printf '%s' "$commits" | grep -c . || true)"
  case "$n" in
    0) continue ;;
    1) [ "$commits" = "$rev" ] || die "the approval names $tok, which is ${commits:0:12}, not $short ($approval_rule); nothing was changed"
       named=yes ;;
    *) die "the approval names $tok, which is the start of more than one commit ($approval_rule); nothing was changed" ;;
  esac
done
[ "$named" = yes ] || die "the owner's approval must name the revision it approves ($approval_rule); nothing was changed"
# The promote runs only what main holds: a clean checkout at origin/main (the Compose allowlist,
# the smoke client and load-release.sh all come from here).
if [ "$rehearsal" = no ]; then
  [ -z "$(git status --porcelain 2>/dev/null)" ] || die "this checkout has uncommitted changes; promote from a clean checkout of origin/main"
  git fetch --quiet origin main 2>/dev/null || die "could not fetch origin main"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
    die "this checkout is not at origin/main ($(git rev-parse --short=7 HEAD)); promote from origin/main"
fi
# The same words with other spacing or case are the same yes.
approval_sha="$(printf '%s' "$approval" | tr '[:upper:]' '[:lower:]' | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//' |
  shasum -a 256 | cut -d' ' -f1)"
runid="$(date -u +%Y%m%dT%H%M%SZ)-$$"
logfile="$(dirname "$FLEET_CONF_FILE")/logs/promote-$runid.log"
lockdir="$NAS_PROD_DIR/.promote-lock"

# ---- The watchdog window. Every phase after arming has a bound, and the dead-man's deadline must
# be longer than their sum plus a margin, or nothing starts. Bounds in seconds (environment, default):
#   FLEET_STOP_SECS 45             stopping the previous production (docker stop -t 30)
#   FLEET_SNAPSHOT_COPY_SECS 300   copying the state folder (and naming the verified copy, again)
#   FLEET_INTEGRITY_SECS 120       the snapshot's read-only integrity check
#   FLEET_START_SECS 120           starting the new revision
#   health: FLEET_READY_TRIES 30 x (FLEET_STATUS_TIMEOUT_SECS 30 + FLEET_READY_SLEEP 3, rounded up)
#   FLEET_TLS_SECS 30              reading the TLS certificate
#   FLEET_VERIFY_SECS 30           each of the two checks in the new container (keys, jobs)
#   FLEET_RECORD_SECS 60           writing the success record and committing (an allowance: these two
#                                  ssh calls are bounded only by ssh's keep-alive, not by a timer)
#   FLEET_DEADMAN_MARGIN_SECS 300
# With the defaults the sum is 1725 and sum + margin 2025, so the default deadline is 2100 seconds
# (DEADMAN_DEFAULT_SECS: how long production may stay down if this Mac dies mid-promote).
DEADMAN_DEFAULT_SECS=2100
whole() { [[ "$2" =~ ^[0-9]+$ ]] && [ "$2" -ge 1 ] || die "$1 must be a whole number of seconds (1 or more)"; printf '%s' "$2"; }
b_stop="$(whole FLEET_STOP_SECS "${FLEET_STOP_SECS:-45}")"
b_copy="$(whole FLEET_SNAPSHOT_COPY_SECS "${FLEET_SNAPSHOT_COPY_SECS:-300}")"
b_check="$(whole FLEET_INTEGRITY_SECS "${FLEET_INTEGRITY_SECS:-120}")"
b_start="$(whole FLEET_START_SECS "${FLEET_START_SECS:-120}")"
ready_tries="$(whole FLEET_READY_TRIES "${FLEET_READY_TRIES:-30}")"
b_status="$(whole FLEET_STATUS_TIMEOUT_SECS "${FLEET_STATUS_TIMEOUT_SECS:-30}")"
ready_sleep="${FLEET_READY_SLEEP:-3}"
[[ "$ready_sleep" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "FLEET_READY_SLEEP must be a number of seconds"
sleep_up="${ready_sleep%.*}"
[ "$sleep_up" = "$ready_sleep" ] || sleep_up=$((sleep_up + 1))
b_health=$((ready_tries * (b_status + sleep_up)))
b_tls="$(whole FLEET_TLS_SECS "${FLEET_TLS_SECS:-30}")"
b_verify="$(whole FLEET_VERIFY_SECS "${FLEET_VERIFY_SECS:-30}")"
b_record="$(whole FLEET_RECORD_SECS "${FLEET_RECORD_SECS:-60}")"
b_margin="$(whole FLEET_DEADMAN_MARGIN_SECS "${FLEET_DEADMAN_MARGIN_SECS:-300}")"
b_switch=$((b_stop + 2 * b_copy + b_check + b_start))
b_sum=$((b_switch + b_health + b_tls + 2 * b_verify + b_record))
deadman_secs="$(whole FLEET_DEADMAN_SECS "${FLEET_DEADMAN_SECS:-$DEADMAN_DEFAULT_SECS}")"
[ "$deadman_secs" -gt $((b_sum + b_margin)) ] ||
  die "the dead-man's deadline ($deadman_secs s) must be longer than the bounded phases after arming ($b_sum s) plus the margin ($b_margin s); nothing was changed"
# The undo waits for the fenced switch up to its own bound plus the margin, then undoes anyway.
fence_wait="$(whole FLEET_FENCE_WAIT "${FLEET_FENCE_WAIT:-$((b_switch + b_margin))}")"
undo_health_wait="$(whole FLEET_UNDO_HEALTH_WAIT "${FLEET_UNDO_HEALTH_WAIT:-120}")"
# The Mac waits for its undo long enough for that fence wait and the engine's health check.
undo_retry="$(whole FLEET_UNDO_RETRY_SECS "${FLEET_UNDO_RETRY_SECS:-$((fence_wait + undo_health_wait + 120))}")"

# ---- Server-side scripts (POSIX sh, run with nas; $1 is production's deploy folder) ----

# Which form production is in now. Exactly one must be running: both would be two queues.
INSPECT='
c="$1" project="$2" dir="$3"
running="$(docker inspect --format "{{.State.Running}}" "$c" 2>/dev/null)" || running=absent
ids="$(docker ps -q --filter "label=com.docker.compose.project=$project")"
echo "container=$running"
if [ -n "$ids" ]; then echo "compose=running"; else echo "compose=stopped"; fi
echo "revision=$(sed -n "s/^FLEET_REVISION=//p" "$dir/fleet-production.env" 2>/dev/null | tail -n 1)"
'
# The first promote replaces a hand-started container. Its port, mounts and settings must be exactly
# what compose.production.yaml reproduces from the private config, or the new revision would run
# with something different. Only names and same/differs are printed, never a setting's value.
FIRST_CHECK='
c="$1" root="$2" lan="$3" port="$4"
bad=0
f() { docker inspect --format "$1" "$c"; }
[ "$(f "{{json .HostConfig.PortBindings}}")" = "{\"8787/tcp\":[{\"HostIp\":\"$lan\",\"HostPort\":\"$port\"}]}" ] ||
  { echo "FAIL its published address and port are not the ones the private config declares"; bad=1; }
have="$(f "{{range .Mounts}}{{.Type}} {{.Source}} {{.Destination}} {{.RW}}{{println}}{{end}}" | grep -v "^\$" | sort)"
want="$(printf "bind %s/%s %s %s\n" \
  "$root" state /var/lib/fleet-runner/state true "$root" output /var/lib/fleet-runner/output true \
  "$root" inputs /var/lib/fleet-runner/inputs true "$root" public-keys /run/fleet-runner/public-keys false \
  "$root" tls /run/fleet-runner/tls false | sort)"
[ "$have" = "$want" ] || { echo "FAIL its mounts are not the five service folders under the declared root (state, output, inputs rw; public-keys, tls ro)"; bad=1; }
[ "$(f "{{.HostConfig.Privileged}} {{len .HostConfig.CapAdd}} {{len .HostConfig.Devices}} {{.HostConfig.NetworkMode}} {{.HostConfig.AutoRemove}}")" = "false 0 0 bridge false" ] ||
  { echo "FAIL it runs with privileges, devices, a network or an auto-remove the Compose file does not give"; bad=1; }
envs="$(f "{{range .Config.Env}}{{println .}}{{end}}")"
img="$(f "{{.Image}}")"
ienv="$(docker image inspect --format "{{range .Config.Env}}{{println .}}{{end}}" "$img")"
for k in $(printf "%s\n" "$envs" | sed -n "s/=.*//p"); do
  v="$(printf "%s\n" "$envs" | sed -n "s|^$k=||p" | tail -n 1)"
  case "$k" in
    FLEET_BUILD_REF) ;;
    FLEET_WORKERS | FLEET_OBSERVERS)
      case "$v" in "" | *[!a-z0-9,-]*) echo "FAIL $k is not a plain list of identity names"; bad=1 ;; esac ;;
    FLEET_DB) [ "$v" = /var/lib/fleet-runner/state/fleet.sqlite ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    FLEET_OUT_DIR) [ "$v" = /var/lib/fleet-runner/output ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    FLEET_INPUT_DIR) [ "$v" = /var/lib/fleet-runner/inputs ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    FLEET_PUBLIC_KEYS_DIR) [ "$v" = /run/fleet-runner/public-keys ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    FLEET_PORT) [ "$v" = 8787 ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    FLEET_TLS_CERT) [ "$v" = /run/fleet-runner/tls/server.crt ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    FLEET_TLS_KEY) [ "$v" = /run/fleet-runner/tls/server.key ] || { echo "FAIL $k differs from the standard one"; bad=1; } ;;
    *) printf "%s\n" "$ienv" | grep -qxF -- "$k=$v" || { echo "FAIL $k is set on the container and would not carry over"; bad=1; } ;;
  esac
done
for k in FLEET_WORKERS FLEET_OBSERVERS FLEET_INPUT_DIR FLEET_TLS_CERT FLEET_TLS_KEY; do
  printf "%s\n" "$envs" | grep -q "^$k=" || { echo "FAIL $k is not set on the container"; bad=1; }
done
for d in state output inputs public-keys tls; do [ -d "$root/$d" ] || { echo "FAIL $d is missing under the declared root"; bad=1; }; done
[ "$bad" -eq 0 ] || exit 1
echo "PASS the hand-started container is exactly what the Compose file reproduces (port, five mounts, settings)"
echo "id=$(f "{{.Id}}") image=$img"
'
# The running Compose production: its container ID and image.
COMPOSE_NOW='
id="$(docker ps -q --no-trunc --filter "label=com.docker.compose.project=$1" | head -n 1)"
[ -n "$id" ] || exit 1
echo "id=$id image=$(docker inspect --format "{{.Image}}" "$id")"
'
# The next env file, written beside the live one, and the config Compose resolves from it, captured
# ONCE (its exit status checked) into a frozen file under the lock. Also: the owner of the state
# folder, and the SHA-256 of production's current identity lists (never the lists themselves).
PREPARE="$CLEAN_ENV$ENV_PLAIN_FN"'
dir="$1" runid="$2" kind="$3" project="$4" rev="$5" root="$6" port="$7" lan="$8" container="$9"
lock="$dir/.promote-lock"
cd "$dir"
[ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] || { echo "FAIL this run does not own the lock"; exit 1; }
owner="$(stat -c %u:%g "$root/state")"
case "$owner" in *[!0-9:]* | 0:* | "") echo "FAIL the state folder has no service account owner"; exit 1 ;; esac
if [ "$kind" = container ]; then
  cur="$container"
else
  cur="$(docker ps -q --filter "label=com.docker.compose.project=$project" | head -n 1)"
fi
envs="$(docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" "$cur")"
for k in FLEET_WORKERS FLEET_OBSERVERS; do
  v="$(printf "%s\n" "$envs" | sed -n "s/^$k=//p" | tail -n 1)"
  [ -n "$v" ] || { echo "FAIL production has no $k"; exit 1; }
  echo "$k=$(printf "%s" "$v" | sha256sum | cut -d" " -f1)"
done
next="fleet-production.env.next-$runid"
if [ "$kind" = container ]; then
  {
    echo "FLEET_COMPOSE_PROJECT=$project"
    echo "FLEET_PROD_ROOT=$root"
    echo "FLEET_LAN_IP=$lan"
    echo "FLEET_HOST_PORT=$port"
    echo "FLEET_UID=${owner%:*}"
    echo "FLEET_GID=${owner#*:}"
    printf "%s\n" "$envs" | grep -e "^FLEET_WORKERS=" -e "^FLEET_OBSERVERS="
  } > "$next.part"
else
  grep -v -e "^FLEET_REVISION=" -e "^FLEET_IMAGE=" fleet-production.env > "$next.part" || true
fi
printf "FLEET_REVISION=%s\nFLEET_IMAGE=fleet-runner:%s\n" "$rev" "$rev" >> "$next.part"
env_is_plain "$next.part" || { echo "FAIL the new env file is not one plain KEY=value per line"; exit 1; }
chmod 0600 "$next.part" && mv "$next.part" "$next"
rc=0
cfg="$(docker compose -p "$project" --env-file "$next" -f "compose.yaml.next-$runid" config --format json 2>/dev/null)" || rc=$?
[ "$rc" -eq 0 ] && [ -n "$cfg" ] || { echo "FAIL compose could not resolve the new config (status $rc)"; exit 1; }
printf "%s\n" "$cfg" > "$lock/resolved.json.part" && mv "$lock/resolved.json.part" "$lock/resolved.json"
echo "uidgid=$owner"
'
# The decision: which of the Mac's undo, the dead-man's undo, a committed pass or a person's manual
# undo owns this run. Everything it needs is written at arming, BEFORE production is stopped: one
# file per side (claim.<who>, holding its own name). Claiming is one hard link of that file to
# "decided", which no other side can then take (link fails if the name exists) and which needs no
# new data, so a full disk cannot leave half a decision. A decision exists only when "decided" is a
# file holding one of the four names; anything else (no file, an empty folder someone made, a
# failed link) is no decision, and the dead-man stays responsible.
#   claim <who>   0: this side decided; 1: already decided (the decision is printed); 2: no decision
#                 could be taken and none is readable.
#   decided_now   0 and the decision printed if one exists.
DECIDE_FN='
decided_now() {
  [ -f "$lock/decided" ] || return 1
  d="$(cat "$lock/decided" 2>/dev/null)" || return 1
  case "$d" in mac | deadman | pass | manual) echo "$d"; return 0 ;; esac
  return 1
}
claim() {
  [ ! -d "$lock/decided" ] || return 2
  if ln "$lock/claim.$1" "$lock/decided" 2>/dev/null; then return 0; fi
  decided_now && return 1
  return 2
}
'
# The undo, written into the lock at arming time and run by whichever side claims it. Its settings
# are files in the lock (v.<name>), never re-parsed shell text. It fences first: it waits for the
# fenced switch to end, up to its bound; past that it undoes anyway, since every step of the switch
# is bounded and checks for the abort before the next. Then it works from markers the switch
# wrote: stopping (before production was stopped) and started (before the new revision started).
# The state folder is swapped only if the new revision started AND a verified snapshot exists;
# otherwise the live state is left alone.
UNDO_BODY="$CLEAN_ENV$STOP_FN$FENCE_WAIT_FN"'
set +e
trap "" PIPE HUP INT TERM
lock="$1"
v() { cat "$lock/v.$1"; }
dir="$(v dir)" runid="$(v runid)" kind="$(v kind)" project="$(v project)" root="$(v root)"
container="$(v container)" old_cid="$(v old_cid)" old_image="$(v old_image)" img="$(v img_ref)"
bad=0
cd "$dir" || exit 1
[ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] || { echo "FAIL this run no longer owns the lock; nothing was changed"; exit 1; }
fence_wait "$lock" "$runid" "$(v fence_wait)" ||
  echo "the fenced switch did not end within $(v fence_wait) seconds; undoing anyway (each of its steps is bounded and checks for the abort first)"
if [ ! -e "$lock/stopping" ]; then
  echo "production was never stopped: nothing to undo"
  exit 0
fi
stop_project "$project" || { echo "FAIL could not stop the new revision; nothing else was changed"; exit 1; }
echo "the new revision is stopped"
for f in fleet-production.env compose.yaml compose.resolved.json; do
  if [ -f "$f.pre-$runid" ]; then
    cp -p "$f.pre-$runid" "$f" || { echo "FAIL could not restore $f"; bad=1; }
  elif [ "$kind" = container ] && [ -f "$f" ]; then
    mv "$f" "$f.failed-$runid" || { echo "FAIL could not set $f aside"; bad=1; }
  fi
done
started=no
[ -e "$lock/started" ] && started=yes
where="$(docker run --rm --network none --user 0:0 --entrypoint sh -v "$root:/srv" "$img" -c "
  cd /srv || exit 1
  if [ $started = yes ]; then
    if [ -d state.pre-$runid ]; then mv state state.failed-$runid && mv state.pre-$runid state && echo restored; else echo no-snapshot; fi
  else
    [ ! -d state.pre-$runid.part ] || mv state.pre-$runid.part state.partial-$runid
    [ ! -d state.pre-$runid ] || mv state.pre-$runid state.unused-$runid
    echo untouched
  fi")"
case "$where" in
  restored) echo "put the verified snapshot back as the state folder; the failed state is state.failed-$runid" ;;
  untouched) echo "the new revision never started, so the live state folder was left as it was" ;;
  no-snapshot) echo "FAIL the new revision started but there is no verified snapshot to put back"; bad=1 ;;
  *) echo "FAIL could not put the state folder back"; bad=1 ;;
esac
if [ "$bad" -eq 0 ]; then
  if [ "$kind" = container ]; then
    docker start "$container" >/dev/null || { echo "FAIL could not start the previous production"; bad=1; }
    id="$container"
    [ "$(docker inspect --format "{{.Id}} {{.Image}} {{.State.Running}}" "$container")" = "$old_cid $old_image true" ] ||
      { echo "FAIL the running container is not the one that ran before"; bad=1; }
  else
    # The previous frozen config, read once and given to Compose on stdin.
    prev_cfg="$(cat compose.resolved.json)" || { echo "FAIL could not read the previous compose config"; bad=1; }
    if [ "$bad" -eq 0 ]; then
      printf "%s\n" "$prev_cfg" | docker compose -p "$project" --env-file /dev/null -f - up -d --pull never >/dev/null 2>&1 ||
        { echo "FAIL could not start the previous revision"; bad=1; }
      id="$(docker ps -q --filter "label=com.docker.compose.project=$project" | head -n 1)"
      [ -n "$id" ] && [ "$(docker inspect --format "{{.Image}}" "$id")" = "$old_image" ] ||
        { echo "FAIL the previous revision is not running its own image"; bad=1; }
    fi
  fi
fi
if [ "$bad" -eq 0 ]; then
  i=0
  while :; do
    h="$(docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" "$id" 2>/dev/null)"
    [ "$h" = healthy ] || [ "$h" = none ] && break
    i=$((i + 1))
    [ "$i" -le "$(v health_wait)" ] || { echo "FAIL the previous production is not healthy after $i seconds"; bad=1; break; }
    sleep 1
  done
  [ "$bad" -eq 0 ] && echo "started the previous production again (engine health: $h)"
fi
exit "$bad"
'
# Runs the undo once, recording its status as undo.rc.
RUN_UNDO='lock="$1"; sh "$lock/undo.sh" "$lock" > "$lock/undo.log" 2>&1; echo $? > "$lock/undo.rc.part"; mv "$lock/undo.rc.part" "$lock/undo.rc"'
# The dead-man: unless a decision exists before the deadline, it claims the undo, runs it, and writes
# the undo record and a promote.log line (each write checked). If it cannot claim and no decision is
# readable, it stays responsible and undoes anyway. If the lock vanishes under it (removed by hand),
# it says so in promote.log before it stops. It keeps the lock: nobody has checked the signed status.
DEADMAN_BODY="$DECIDE_FN"'
trap "" HUP PIPE INT TERM
lock="$1"
v() { cat "$lock/v.$1"; }
dir="$(v dir)" runid="$(v runid)"
deadline=$(( $(date +%s) + $(v deadman_secs) ))
logline() { printf "%s %s %s -> %s approval_sha256=%s approval: %s\n" "$runid" "$1" "$(v from)" "$(v short)" "$(v approval_sha)" "$(v approval)" >> "$dir/promote.log"; }
echo "armed at $(date -u +%H:%M:%SZ), deadline in $(v deadman_secs) seconds"
while :; do
  if [ "$(cat "$lock/owner" 2>/dev/null)" != "$runid" ]; then
    echo "the lock is gone: this dead-man can no longer act"
    printf "%s deadman-stopped-lock-removed (nothing was undone by the server; check production by hand)\n" "$runid" >> "$dir/promote.log" ||
      echo "FAIL could not write promote.log"
    exit 0
  fi
  if d="$(decided_now)"; then echo "decided ($d): disarmed"; exit 0; fi
  [ "$(date +%s)" -lt "$deadline" ] || break
  sleep 2
done
c=0
claim deadman || c=$?
case "$c" in
  0) echo "no pass from the Mac by the deadline: undoing" ;;
  1) echo "decided at the deadline ($(decided_now)): disarmed"; exit 0 ;;
  *) echo "no pass from the Mac by the deadline, and no decision could be recorded: this dead-man stays responsible and undoes" ;;
esac
sh "$lock/run-undo.sh" "$lock"
rc="$(cat "$lock/undo.rc" 2>/dev/null)"
audit=ok
mkdir -p "$dir/promote-records" || audit=failed
{
  echo "undo of promote $runid by the server-side dead-man: the Mac did not commit a pass within $(v deadman_secs) seconds"
  echo "from $(v from) to $(v short); approval_sha256: $(v approval_sha)"
  echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "server steps:"
  sed "s/^/  /" "$lock/undo.log"
  if [ "$rc" = 0 ]; then echo "result: the previous production runs again (engine health checked); its signed status was not checked from here"
  else echo "result: FAILED (status ${rc:-none}); production may be down"; fi
} > "$dir/promote-records/undo-$runid.txt" || audit=failed
if [ "$rc" = 0 ]; then logline undone-by-server || audit=failed; else logline undo-failed-on-server || audit=failed; fi
[ "$audit" = ok ] || echo "FAIL could not write the undo record or the promote.log line"
echo "$audit" > "$lock/deadman.done" || echo "FAIL could not write deadman.done"
echo "undo finished with status ${rc:-none} (records: $audit); the lock is kept for a person to look"
'
# Write the undo, its settings, the claim files and the dead-man into the lock, and start the
# dead-man in a session of its own (it outlives this connection). Fails closed if any of it cannot
# be written or the dead-man is not running a second later.
ARM='
dir="$1" runid="$2"
shift 2
lock="$dir/.promote-lock"
[ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] || { echo "FAIL this run does not own the lock"; exit 1; }
printf "%s\n" "$1" > "$lock/undo.sh"
printf "%s\n" "$2" > "$lock/run-undo.sh"
printf "%s\n" "$3" > "$lock/deadman.sh"
shift 3
for who in mac deadman pass manual; do
  printf "%s\n" "$who" > "$lock/claim.$who" && [ "$(cat "$lock/claim.$who")" = "$who" ] || { echo "FAIL could not write the claim files"; exit 1; }
done
printf "%s" "$dir" > "$lock/v.dir"
printf "%s" "$runid" > "$lock/v.runid"
while [ "$#" -ge 2 ]; do printf "%s" "$2" > "$lock/v.$1"; shift 2; done
if command -v setsid >/dev/null 2>&1; then
  setsid sh "$lock/deadman.sh" "$lock" >> "$lock/deadman.log" 2>&1 < /dev/null &
else
  set -m
  sh "$lock/deadman.sh" "$lock" >> "$lock/deadman.log" 2>&1 < /dev/null &
fi
echo "$!" > "$lock/deadman.pid"
sleep 1
kill -0 "$(cat "$lock/deadman.pid")" 2>/dev/null || { echo "FAIL the dead-man is not running"; exit 1; }
echo "PASS the server-side dead-man is armed: it undoes the switch unless this Mac commits a pass by $(cat "$lock/v.deadline_utc")"
'
# Claim the undo for this Mac and start it in a session of its own, so a dropped connection cannot
# cut it short. Safe to repeat. If no decision can be taken and none is readable, nothing is started:
# the dead-man stays responsible.
UNDO_START="$DECIDE_FN"'
dir="$1" runid="$2"
lock="$dir/.promote-lock"
[ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] || { echo "FAIL this run no longer owns the lock"; exit 1; }
[ -f "$lock/run-undo.sh" ] || { echo "decided=unarmed"; exit 0; }
c=0
claim mac || c=$?
case "$c" in
  0)
    if command -v setsid >/dev/null 2>&1; then
      setsid sh "$lock/run-undo.sh" "$lock" > /dev/null 2>&1 < /dev/null &
    else
      set -m
      sh "$lock/run-undo.sh" "$lock" > /dev/null 2>&1 < /dev/null &
    fi
    echo "decided=mac" ;;
  1) echo "decided=$(decided_now)" ;;
  *) echo "decided=unclaimable" ;;
esac
'
# Wait up to $3 seconds for the undo to finish; print its log; exit with its status (124: not yet).
UNDO_WAIT='
lock="$1/.promote-lock" i=0
while [ ! -f "$lock/undo.rc" ]; do
  i=$((i + 1))
  [ "$i" -le "$3" ] || exit 124
  sleep 1
done
cat "$lock/undo.log"
exit "$(cat "$lock/undo.rc")"
'
# COMMIT the pass. Its prerequisites come first, each checked: no decision taken yet, the record
# published, the promote.log line written. Only then the claim, which makes the pass durable (and
# disarms the dead-man). 3: the dead-man claimed the undo first. 4: a prerequisite or the claim
# failed: nothing is committed, so the undo stays available and runs.
COMMIT="$DECIDE_FN"'
dir="$1" runid="$2" from="$3" short="$4" sha="$5" approval="$6"
lock="$dir/.promote-lock"
rec="$dir/promote-records/promote-$runid.txt"
[ "$(cat "$lock/owner" 2>/dev/null)" = "$runid" ] || { echo "FAIL this run no longer owns the lock"; exit 5; }
if d="$(decided_now)"; then echo "decided=$d"; exit 3; fi
mv "$rec.part" "$rec" || { echo "FAIL could not publish the record"; exit 4; }
printf "%s promoted %s -> %s approval_sha256=%s approval: %s\n" "$runid" "$from" "$short" "$sha" "$approval" >> "$dir/promote.log" ||
  { mv "$rec" "$rec.part"; echo "FAIL could not write the promote.log line"; exit 4; }
c=0
claim pass || c=$?
case "$c" in
  0) exit 0 ;;
  1) mv "$rec" "$rec.superseded" || true
     printf "%s superseded-by-%s (the line above did not take effect)\n" "$runid" "$(decided_now)" >> "$dir/promote.log" || true
     echo "decided=$(decided_now)"; exit 3 ;;
  *) mv "$rec" "$rec.part" || true
     printf "%s commit-failed (the line above did not take effect)\n" "$runid" >> "$dir/promote.log" || true
     echo "FAIL could not record the pass decision"; exit 4 ;;
esac
'
# Whether the dead-man has stopped (it polls every 2 seconds).
DISARMED='
lock="$1/.promote-lock" i=0
pid="$(cat "$lock/deadman.pid" 2>/dev/null)"
[ -n "$pid" ] || exit 0
while kill -0 "$pid" 2>/dev/null; do i=$((i + 1)); [ "$i" -le 15 ] || exit 1; sleep 1; done
'
SNAP_JS='const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const check = db.prepare("PRAGMA integrity_check").all().map((r) => Object.values(r)[0]);
const version = db.prepare("PRAGMA user_version").get().user_version;
const jobs = db.prepare("SELECT count(*) AS n FROM jobs").get().n;
db.close();
if (check.length !== 1 || check[0] !== "ok") { console.log("integrity-failed"); process.exit(1); }
console.log("ok " + version + " " + jobs);'
# The switch, fenced. Every step is bounded (bounded, in the lib). Backups first (counted once
# renamed from .part); then the stopping marker and the stop; the snapshot, a .part copy until its
# read-only integrity check passes; then the frozen config, read ONCE into this shell, its hash
# checked, and those same bytes given to Compose on stdin (no file is opened again between check
# and use); the started marker before the start.
SWITCH_BODY="$CLEAN_ENV$STOP_FN$BOUND_FN"'
kind="$1" project="$2" rev="$3" root="$4" img="$5" container="$6" js="$7" resolved_sha="$8" b_stop="$9"
shift 9
b_copy="$1" b_check="$2" b_start="$3"
hname="fleet-promote-$runid"
cd "$dir"
step
[ "$(docker image inspect --format "{{.Id}}" "fleet-runner:$rev")" = "$img" ] || { echo "FAIL fleet-runner:$rev is not the checked image"; exit 1; }
for f in fleet-production.env compose.yaml compose.resolved.json; do
  if [ -f "$f" ]; then
    { cp -p "$f" "$f.pre-$runid.part" && mv "$f.pre-$runid.part" "$f.pre-$runid"; } || { echo "FAIL backing up $f"; exit 1; }
  fi
done
step
: > "$lock/stopping"
stop_old() { docker stop -t 30 "$container" >/dev/null; }
if [ "$kind" = container ]; then
  bounded "$b_stop" "stopping the previous production" - stop_old || { echo "FAIL could not stop the previous production"; exit 1; }
  [ "$(docker inspect --format "{{.State.Running}}" "$container")" = false ] || { echo "FAIL the previous production is still running"; exit 1; }
else
  bounded "$b_stop" "stopping the previous production" - stop_project "$project" || { echo "FAIL could not stop the previous production"; exit 1; }
fi
echo "stopped the previous production"
step
copy_state() { docker run --rm --name "$hname-copy" --network none --user 0:0 --entrypoint sh -v "$root:/srv" "$img" -c "
  rm -rf /srv/state.pre-$runid.part && cp -a /srv/state /srv/state.pre-$runid.part"; }
bounded "$b_copy" "the snapshot copy" "$hname-copy" copy_state || { echo "FAIL could not copy the state folder"; exit 1; }
owner="$(stat -c %u:%g "$root/state")"
case "$owner" in *[!0-9:]* | 0:* | "") echo "FAIL the state folder has no service account owner"; exit 1 ;; esac
check_snap() { docker run --rm --name "$hname-check" --network none --user "$owner" --entrypoint node -v "$root/state.pre-$runid.part:/snap" "$img" -e "$js" /snap/fleet.sqlite 2>/dev/null; }
snap="$(bounded "$b_check" "the snapshot integrity check" "$hname-check" check_snap)" ||
  { [ -z "$snap" ] || echo "$snap"; echo "FAIL the snapshot does not open read-only or fails its integrity check"; exit 1; }
set -- $snap
[ "$1" = ok ] || { echo "FAIL the snapshot check said: $snap"; exit 1; }
name_snap() { docker run --rm --name "$hname-name" --network none --user 0:0 --entrypoint sh -v "$root:/srv" "$img" -c "mv /srv/state.pre-$runid.part /srv/state.pre-$runid"; }
bounded "$b_copy" "naming the verified snapshot" "$hname-name" name_snap || { echo "FAIL could not name the verified snapshot"; exit 1; }
echo "SNAPSHOT state.pre-$runid integrity=ok schema=$2 jobs=$3"
step
cfg="$(cat "$lock/resolved.json")" || { echo "FAIL could not read the frozen compose config"; exit 1; }
[ "$(printf "%s\n" "$cfg" | sha256sum | cut -d" " -f1)" = "$resolved_sha" ] ||
  { echo "FAIL the compose config to start is not the one that was checked"; exit 1; }
# The deploy folder keeps a copy for later undos and records; it is not what starts.
{ printf "%s\n" "$cfg" > compose.resolved.json.new && mv compose.resolved.json.new compose.resolved.json; } || exit 1
{ cp -p "fleet-production.env.next-$runid" fleet-production.env.new && mv fleet-production.env.new fleet-production.env; } || exit 1
{ cp "compose.yaml.next-$runid" compose.yaml.new && mv compose.yaml.new compose.yaml; } || exit 1
start_new() { printf "%s\n" "$cfg" | docker compose -p "$project" --env-file /dev/null -f - up -d --pull never >/dev/null 2>&1; }
step
: > "$lock/started"
bounded "$b_start" "starting the new revision" - start_new || { echo "FAIL compose up"; exit 1; }
id="$(docker ps -q --filter "label=com.docker.compose.project=$project" | head -n 1)"
[ -n "$id" ] || { echo "FAIL the new production container is not running"; exit 1; }
running="$(docker inspect --format "{{.Image}}" "$id")"
[ "$running" = "$img" ] || { echo "FAIL running image $running is not the checked release"; exit 1; }
echo "PASS running image $running"
'
SWITCH="$(fenced .promote-lock "$SWITCH_BODY")"

# ---- This Mac ----

# The signed status and the TLS fingerprint, each call bounded (STAGE_TIMEOUT_MS in stage-smoke.mjs).
prod_node() { CLIENT_TIMEOUT_MS="$1" client_node "$PROD_HOST" "$PROD_PORT" "$PROD_KEYS_DIR" "$PROD_STATUS_ID" "$here/stage-smoke.mjs" "${@:2}"; }
read_build() {
  local out
  out="$(prod_node $((b_status * 1000)) build 2>/dev/null)" || return 1
  printf '%s' "$out" | json_field build
}
# Only a revision-shaped build is printed.
build_label() { if [[ "$1" =~ ^[0-9a-f]{7,40}$ ]]; then printf 'build %s' "${1:0:12}"; else printf 'its non-revision build label'; fi; }
# Wait for the signed status to answer ready with exactly <build>: FLEET_READY_TRIES tries, each
# bounded by FLEET_STATUS_TIMEOUT_SECS, FLEET_READY_SLEEP seconds apart. The undo's own checks say
# CHECKED, not PASS.
wait_build() {
  local want="$1" word="${2:-PASS}" got="" i
  for i in $(seq 1 "$ready_tries"); do
    if got="$(read_build)" && [ "$got" = "$want" ]; then
      say "$word signed status ready, $(build_label "$want")"
      return 0
    fi
    [ "$i" -eq "$ready_tries" ] || sleep "$ready_sleep"
  done
  say "FAIL signed status is not ready on $(build_label "$want") after $ready_tries tries"
  return 1
}
tls_fingerprint() { prod_node $((b_tls * 1000)) fingerprint 2>/dev/null; }
key_ids_of() { sed -n 's/^[0-9a-f]\{64\}  \(.*\)\.pub$/\1/p' "$1" | sort | tr '\n' ' ' | sed 's/ $//'; }
want_key_ids="$(printf '%s\n' $PROD_KEY_IDS | sort | tr '\n' ' ' | sed 's/ $//')"
log_event() {
  nas 'printf "%s %s %s -> %s approval_sha256=%s approval: %s\n" "$2" "$3" "$4" "$5" "$6" "$7" >> "$1/promote.log"' \
    "$NAS_PROD_DIR" "$runid" "$1" "$prev_from" "$short" "$approval_sha" "$approval"
}
# The manual undo. With "claim", it begins by claiming the decision, so the dead-man stands down and
# cannot undo a second time after a person did (the lock still exists then); after a pass the lock
# is gone and there is nothing to claim.
manual_undo() {
  local helper="docker run --rm --network none --user 0:0 --entrypoint sh -v $NAS_PROD_ROOT:/srv $img_ref" n=1
  if [ "${1:-}" = claim ]; then
    say "  0. claim the decision first, so the server-side dead-man stands down:"
    say "     ssh $NAS_SSH 'cd $lockdir && ln claim.manual decided && echo claimed || { echo already decided:; cat decided; }'"
    say "     If it says deadman, the dead-man is undoing: wait for promote-records/undo-$runid.txt instead of the steps below."
    say "     If it says mac, this Mac's undo ran: read promote-records/undo-$runid-mac.txt first. If it says pass, the promote passed."
  fi
  say "  $n. stop the new revision:  ssh $NAS_SSH 'docker stop -t 30 \$(docker ps -q --filter label=com.docker.compose.project=$PROD_PROJECT)'"
  n=$((n + 1))
  [ "${1:-}" != claim ] || say "  $n. ONLY if $lockdir/started exists (the new revision was started); without it the live state was never changed: skip this step."
  say "  $n. put the pre-promote snapshot back (this LOSES every job accepted since the promote; they stay in state.undone-$runid):"
  say "     ssh $NAS_SSH '$helper -c \"cd /srv && mv state state.undone-$runid && cp -a state.pre-$runid state\"'"
  n=$((n + 1))
  if [ "$kind" = container ]; then
    say "  $n. set the new files aside and start the hand-started container again:"
    say "     ssh $NAS_SSH 'cd $NAS_PROD_DIR && for f in fleet-production.env compose.yaml compose.resolved.json; do mv \$f \$f.undone-$runid; done && docker start $PROD_CONTAINER'"
  else
    say "  $n. put the previous files back and start ${prev_rev:0:7} from its frozen config:"
    say "     ssh $NAS_SSH 'cd $NAS_PROD_DIR && for f in fleet-production.env compose.yaml compose.resolved.json; do cp -p \$f.pre-$runid \$f; done && docker compose -p $PROD_PROJECT --env-file /dev/null -f - up -d --pull never < compose.resolved.json'"
  fi
  n=$((n + 1))
  say "  $n. check it answers as before: $(build_label "$prev_build")"
}
# What to tell a person while the dead-man may still be armed: never to remove the lock, and where to look.
deadman_advice() {
  say "  A server-side dead-man may be armed until $deadline_utc: wait until then for promote-records/undo-$runid.txt"
  say "  (or promote-records/promote-$runid.txt) before touching production, and never remove $lockdir while it may run."
}
# A record is copied into promote-records/ on the server under its own name; a failure is returned.
record() { nas_put "$NAS_PROD_DIR/promote-records" "$1" || { say "FAIL could not write the record ${1##*/}"; return 1; }; }

# The Mac's undo: claim it (or find the dead-man's), wait for it, both retried with backoff within
# undo_retry seconds ($SECONDS, never a command substitution), then check the signed status and
# record what happened. Never prints PASS.
do_undo() {
  local ok=yes out="" rc=0 decided="" pause=2 until_t
  undone=yes
  until_t=$((SECONDS + undo_retry))
  while :; do
    out="$(nas "$UNDO_START" "$NAS_PROD_DIR" "$runid" 2>&1)" && break
    [ "$SECONDS" -lt "$until_t" ] || { say "$out"; out=""; break; }
    say "could not reach the server to start the undo; retrying in $pause seconds"
    sleep "$pause"; pause=$((pause * 2)); [ "$pause" -le 30 ] || pause=30
  done
  decided="$(printf '%s\n' "$out" | sed -n 's/^decided=//p' | tail -n 1)"
  case "$decided" in
    mac) say "this Mac runs the undo" ;;
    deadman) say "the server-side dead-man had already claimed the undo; waiting for it" ;;
    unarmed) say "the switch never began on the server: production was not changed" ;;
    pass) say "FAIL the pass was already committed on the server; nothing was undone"; return 1 ;;
    manual) say "FAIL a person claimed the decision on the server: the undo is theirs"; return 1 ;;
    unclaimable) say "FAIL the undo could not be claimed on the server and no decision is recorded: the dead-man stays responsible"; ok=no ;;
    *) say "FAIL could not start the undo on the server${out:+: $out}"; ok=no ;;
  esac
  out=""
  if [ "$ok" = yes ] && { [ "$decided" = mac ] || [ "$decided" = deadman ]; }; then
    pause=2
    while :; do
      rc=0
      out="$(nas "$UNDO_WAIT" "$NAS_PROD_DIR" "$runid" 60 2>&1)" || rc=$?
      case "$rc" in
        0) break ;;
        124 | 255) ;;
        *) ok=no; break ;;
      esac
      [ "$SECONDS" -lt "$until_t" ] || { ok=no; out="${out:+$out
}FAIL the undo did not report back within the retry window"; break; }
      [ "$rc" -eq 124 ] || { say "lost the connection while waiting for the undo; retrying in $pause seconds"; sleep "$pause"; pause=$((pause * 2)); [ "$pause" -le 30 ] || pause=30; }
    done
    say "$out"
  fi
  if [ "$ok" = yes ]; then wait_build "$prev_build" CHECKED || ok=no; fi
  {
    echo "undo of promote $runid: $prev_label -> $short (undo run by: ${decided:-nobody})"
    echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "approval_sha256: $approval_sha"
    echo "server steps:"
    printf '%s\n' "$out" | sed 's/^/  /'
    if [ "$ok" = yes ]; then echo "result: production is back on $prev_label and answers as before"; else echo "result: FAILED, production may be down or on the wrong revision"; fi
  } >"$tmp/undo-$runid-mac.txt"
  record "$tmp/undo-$runid-mac.txt" || ok=no
  if [ "$decided" = mac ]; then log_event "$([ "$ok" = yes ] && echo undone || echo undo-failed)" || { say "FAIL could not log the undo"; ok=no; }; fi
  if [ "$ok" = yes ]; then
    say "UNDONE production is back on $prev_label and answers as before; $short was NOT promoted (record: promote-records/undo-$runid-mac.txt)"
    return 0
  fi
  say "FAIL the undo did not complete: production may be down."
  deadman_advice
  say "  To put it back by hand instead:"
  manual_undo claim
  return 1
}

promote_main() {
  # The real terminal and log, kept so that cleanup can write to them whatever redirection was in
  # force when it was called (a trap can fire inside "nas ... >file").
  exec 7>&1 8>&2
  say "== promote $short to production ($runid)$([ "$rehearsal" = yes ] && printf ', REHEARSAL against a throwaway production')"
  say "log: $logfile"
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/fleet-promote-$short.XXXXXX")"
  have_lock=no armed=no switching=no passed=no undone=no keep_lock=no deadline_utc=""
  kind="" prev_label="" prev_build="" prev_rev="" prev_from="" old_cid="" old_image="" img_ref=""

  # What this run does on every way out: undo a switch that did not pass, then let go of the lock.
  # Its output goes back to the real terminal and log first. Nothing in here may end it early: no
  # errexit, and say cannot fail. While it undoes, Ctrl-C and hangups are ignored (by its ssh too),
  # so the undo is never cut short by the key that started it.
  cleanup() {
    local rc=$?
    exec 1>&7 2>&8
    set +e +o pipefail
    trap '' INT TERM HUP PIPE
    trap - EXIT
    if [ "$switching" = yes ] && [ "$passed" != yes ] && [ "$undone" != yes ]; then
      say "FAIL $short did not pass in production; undoing the switch back to $prev_label"
      do_undo || keep_lock=yes
      [ "$rc" -ne 0 ] || rc=1
    fi
    if [ "$armed" = yes ] && [ "$keep_lock" != yes ]; then
      nas "$DISARMED" "$NAS_PROD_DIR" || { say "FAIL the server-side dead-man is still running"; keep_lock=yes; }
    fi
    if [ "$have_lock" = yes ] && [ "$keep_lock" = yes ]; then
      say "the promote lock is kept because production may not be at rest."
      if [ "$armed" = yes ]; then deadman_advice; fi
    elif [ "$have_lock" = yes ]; then
      nas "$UNLOCK" "$NAS_PROD_DIR" "$runid" .promote-lock || say "FAIL could not release the promote lock on the server"
    fi
    rm -rf "$tmp"
    exit "$rc"
  }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP

  # 1. Refusals that read the server and change nothing.
  check_prod_isolation
  if [ "$rehearsal" = yes ]; then
    nas '[ -f "$1/.fleet-runner-promote-rehearsal" ]' "$NAS_PROD_DIR" ||
      die "--rehearsal is only for a throwaway production (its deploy folder carries .fleet-runner-promote-rehearsal); nothing was changed"
    [ -z "$fault" ] || say "REHEARSAL: the health check will be made to fail ($fault)"
  fi
  local last staged
  last="$(nas "$STATE_FN"'read_state "$1" last_passed' "$NAS_STAGE_DIR")"
  staged="$(nas "$STATE_FN"'read_state "$1" staged_ok' "$NAS_STAGE_DIR")"
  [ "$last" = "$rev" ] && [ "$staged" = "$rev" ] ||
    die "$short is not staged: stage-state does not name it as both the last that passed and the one staged (run scripts/fleet-stage.sh $short); nothing was changed"
  local receipt
  receipt="$(receipt_file "$rev")"
  [ -f "$receipt" ] && [ "$(receipt_value "$receipt" revision)" = "$rev" ] ||
    die "this Mac has no receipt for $short (fleet-stage.sh writes one when a revision passes); stage it from here first; nothing was changed"
  local image_id manifest_digest archive_sha tag
  image_id="$(receipt_value "$receipt" image_id)"
  manifest_digest="$(receipt_value "$receipt" manifest_digest)"
  archive_sha="$(receipt_value "$receipt" archive_sha256)"
  tag="$(receipt_value "$receipt" tag)"
  [ "$tag" = "fleet-runner:$rev" ] || die "the receipt names an unexpected image tag"
  nas 'cat "$1/releases/$2/release.json"' "$NAS_STAGE_DIR" "$rev" >"$tmp/release.json" ||
    die "the test copy has no release of $short; nothing was changed"
  [ "$(shasum -a 256 "$tmp/release.json" | cut -d' ' -f1)" = "$(receipt_value "$receipt" release_json_sha256)" ] ||
    die "the server's release.json of $short is not the one this Mac verified (receipt); nothing was changed"
  say "PASS stage-state and this Mac's receipt: $short passed in the test copy and is promotable"
  approval_used() {
    [ "$(nas 'if [ -f "$1/promote.log" ] && grep -q "approval_sha256=$2 " "$1/promote.log"; then echo used; else echo new; fi' \
      "$NAS_PROD_DIR" "$approval_sha")" = used ]
  }
  ! approval_used || die "this approval was already used (promote.log): each yes covers one promotion; nothing was changed"

  # 2. The lock (the deploy folder and its marker are made only now), and the approval again under it.
  nas "$PROD_MKDIR" "$NAS_PROD_DIR" || die "could not create production's deploy folder"
  nas "$LOCK" "$NAS_PROD_DIR" "$runid" .promote-lock promote || die "could not take the promote lock"
  have_lock=yes
  ! approval_used || die "this approval was already used (promote.log): each yes covers one promotion; nothing was changed"

  # 3. The staged image, checked where it will run by THIS checkout's committed load-release.sh with
  # the receipt's values (the archive is re-hashed; the loaded image's ID must be the receipt's).
  nas "$(git show HEAD:packages/fleet-runner/scripts/load-release.sh)" "$NAS_STAGE_DIR/releases/$rev/fleet-runner-image.tar" \
    "$archive_sha" "$image_id" "$tag" "$manifest_digest" ||
    die "the staged image of $short does not match this Mac's receipt on the server; nothing was changed"
  img_ref="$(nas 'docker image inspect --format "{{.Id}}" "$1"' "$tag")"
  [ "$img_ref" = "$image_id" ] || { [ -n "$manifest_digest" ] && [ "$img_ref" = "$manifest_digest" ]; } ||
    die "the server's $tag is not the receipt's image; nothing was changed"

  # 4. Which form production is in, and the first promote's exact-reproduction check.
  local form_container form_compose form_rev
  nas "$INSPECT" "$PROD_CONTAINER" "$PROD_PROJECT" "$NAS_PROD_DIR" >"$tmp/form"
  form_container="$(sed -n 's/^container=//p' "$tmp/form")"
  form_compose="$(sed -n 's/^compose=//p' "$tmp/form")"
  form_rev="$(sed -n 's/^revision=//p' "$tmp/form")"
  if [ "$form_container" = true ] && [ "$form_compose" = stopped ]; then
    kind=container
    prev_from="$PROD_CONTAINER"
    nas "$FIRST_CHECK" "$PROD_CONTAINER" "$NAS_PROD_ROOT" "$PROD_LAN_IP" "$PROD_PORT" >"$tmp/first" ||
      { grep '^FAIL' "$tmp/first" || true; die "the first promote cannot reproduce the hand-started container; nothing was changed (an owner decision)"; }
    grep '^PASS' "$tmp/first" || true
  elif [ "$form_container" != true ] && [ "$form_compose" = running ] && [[ "$form_rev" =~ ^[0-9a-f]{40}$ ]]; then
    kind=compose
    prev_rev="$form_rev"
    prev_from="${prev_rev:0:7}"
    [ "$prev_rev" != "$rev" ] || { say "production already runs $short; nothing to do"; exit 0; }
    nas "$COMPOSE_NOW" "$PROD_PROJECT" >"$tmp/first" || die "could not read the running production container"
  else
    die "production is not running in a form this script knows (hand-started container: $form_container, Compose project: $form_compose); nothing was changed"
  fi
  old_cid="$(sed -n 's/^id=\([0-9a-f]*\) image=.*/\1/p' "$tmp/first")"
  old_image="$(sed -n 's/^id=.* image=\(sha256:[0-9a-f]*\)$/\1/p' "$tmp/first")"
  [ -n "$old_cid" ] && [ -n "$old_image" ] || die "could not read the running production's container ID and image"

  # 5. While production still runs: what it answers as, its certificate, its enrolled keys.
  prev_build="$(read_build)" || die "production does not answer a signed status now; the promote will not replace a service it could not prove it brought back"
  [ -n "$prev_build" ] || die "production's signed status names no build"
  if [ "$kind" = container ]; then
    prev_label="the hand-started container $PROD_CONTAINER ($(build_label "$prev_build"))"
  else
    [ "$prev_build" = "$prev_rev" ] || die "production answers as $(build_label "$prev_build"), not the ${prev_rev:0:7} its env file names"
    prev_label="${prev_rev:0:7}"
  fi
  say "production now: $prev_label"
  local tls_before
  tls_before="$(tls_fingerprint)"
  [ -n "$tls_before" ] || die "could not read production's TLS certificate"
  # Every enrolled public key by its hash, read through a throwaway container of the checked image (by
  # its ID; the folder may belong to the service account). The new container is asked the same later.
  nas 'docker run --rm --network none --user 0:0 --entrypoint sh -v "$1/public-keys:/k:ro" "$2" -c "cd /k && sha256sum -- *.pub"' \
    "$NAS_PROD_ROOT" "$img_ref" >"$tmp/keys-before" || die "could not list production's enrolled keys"
  [ "$(key_ids_of "$tmp/keys-before")" = "$want_key_ids" ] ||
    die "production's enrolled keys are not exactly the ones PROD_KEY_IDS names; nothing was changed"
  say "PASS the $(wc -l <"$tmp/keys-before" | tr -d ' ') enrolled keys PROD_KEY_IDS names ($want_key_ids)"

  # 6. The Compose file: the promoted revision's own if it has one, else this checkout's. Resolved
  # ONCE on the server into a frozen file, which is checked here and is exactly what will start.
  local compose_from
  if git cat-file -e "$rev:packages/fleet-runner/deploy/compose.production.yaml" 2>/dev/null; then
    git show "$rev:packages/fleet-runner/deploy/compose.production.yaml" >"$tmp/compose.yaml"
    compose_from="$short's own"
  else
    git show "HEAD:packages/fleet-runner/deploy/compose.production.yaml" >"$tmp/compose.yaml" ||
      die "this checkout has no committed deploy/compose.production.yaml"
    compose_from="this checkout's ($(git rev-parse --short=7 HEAD); $short predates it)"
  fi
  nas 'mkdir -p "$1/promote-records"' "$NAS_PROD_DIR"
  nas_put "$NAS_PROD_DIR/promote-records" "$tmp/compose.yaml" || die "could not copy the compose file"
  nas 'mv "$1/promote-records/compose.yaml" "$1/compose.yaml.next-$2"' "$NAS_PROD_DIR" "$runid"
  nas "$PREPARE" "$NAS_PROD_DIR" "$runid" "$kind" "$PROD_PROJECT" "$rev" "$NAS_PROD_ROOT" "$PROD_PORT" "$PROD_LAN_IP" \
    "$PROD_CONTAINER" >"$tmp/prepare" || { grep '^FAIL' "$tmp/prepare" || true; die "could not prepare the new compose config; nothing was changed"; }
  nas 'cat "$1/.promote-lock/resolved.json"' "$NAS_PROD_DIR" >"$tmp/resolved.json" || die "could not read the frozen compose config"
  local uidgid
  uidgid="$(sed -n 's/^uidgid=//p' "$tmp/prepare")"
  node "$here/compose-check.mjs" "$tmp/resolved.json" "$PROD_PROJECT" "$NAS_PROD_ROOT" "$PROD_LAN_IP" "$PROD_PORT" "$uidgid" "$rev" \
    "$(sed -n 's/^FLEET_WORKERS=//p' "$tmp/prepare")" "$(sed -n 's/^FLEET_OBSERVERS=//p' "$tmp/prepare")" ||
    die "the compose config $short would run with is not production's allowlisted shape; nothing was changed"
  local resolved_sha
  resolved_sha="$(shasum -a 256 "$tmp/resolved.json" | cut -d' ' -f1)"

  say "approved by the owner: $approval"
  say "changes: production goes from $prev_label to $short under the Compose project $PROD_PROJECT, with $compose_from compose.production.yaml"
  say "         (same folders, enrolled keys, certificate, address, port and identities); it is offline for the switch"
  say "undo: from here on any failure is undone, by this Mac or, if it is gone, by a server-side dead-man"

  # 7. Save the manual undo where a person will find it (a reboot of the server ends the dead-man:
  # deployment.md), arm the dead-man, spend the approval, switch.
  deadline_utc="$(node -e 'console.log(new Date(Date.now() + Number(process.argv[1]) * 1000).toISOString().replace(/\.\d+Z$/, "Z"))' "$deadman_secs")"
  {
    echo "promote $runid: $prev_label -> $rev, started $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "The server-side dead-man undoes this promote by itself unless this Mac commits a pass by about $deadline_utc."
    echo "It does not survive a reboot of the server. If the server rebooted, or neither promote-$runid.txt nor"
    echo "undo-$runid.txt appears in promote-records/ after that time, put production back by hand:"
    FLEET_LOG="" manual_undo claim
  } >"$tmp/manual-undo-$runid.txt"
  record "$tmp/manual-undo-$runid.txt" || die "could not save the manual undo on the server; nothing was changed"
  switching=yes
  nas "$ARM" "$NAS_PROD_DIR" "$runid" "$UNDO_BODY" "$RUN_UNDO" "$DEADMAN_BODY" \
    kind "$kind" project "$PROD_PROJECT" root "$NAS_PROD_ROOT" container "$PROD_CONTAINER" old_cid "$old_cid" \
    old_image "$old_image" img_ref "$img_ref" fence_wait "$fence_wait" health_wait "$undo_health_wait" \
    deadman_secs "$deadman_secs" deadline_utc "$deadline_utc" from "$prev_from" short "$short" approval_sha "$approval_sha" \
    approval "$approval" || { say "FAIL could not arm the server-side dead-man"; exit 1; }
  armed=yes
  log_event started || { say "FAIL could not record the approval as spent"; exit 1; }
  nas "$SWITCH" "$NAS_PROD_DIR" "$runid" "$kind" "$PROD_PROJECT" "$rev" "$NAS_PROD_ROOT" "$img_ref" "$PROD_CONTAINER" \
    "$SNAP_JS" "$resolved_sha" "$b_stop" "$b_copy" "$b_check" "$b_start" >"$tmp/switch.out" || { cat "$tmp/switch.out"; exit 1; }
  cat "$tmp/switch.out"
  local jobs_before
  jobs_before="$(sed -n 's/^SNAPSHOT .* jobs=\([0-9][0-9]*\)$/\1/p' "$tmp/switch.out")"
  [ -n "$jobs_before" ] || { say "FAIL the snapshot's job count is missing"; exit 1; }

  # 8. The health check, from this Mac and in the new container.
  local want="$rev"
  [ "$fault" != health ] || want="0000000000000000000000000000000000000000"
  wait_build "$want" || exit 1
  [ "$(tls_fingerprint)" = "$tls_before" ] || { say "FAIL production's TLS certificate changed"; exit 1; }
  say "PASS the same TLS certificate"
  nas "$BOUND_FN"'keys() { docker exec "$(docker ps -q --filter "label=com.docker.compose.project=$1" | head -n 1)" sh -c "cd /run/fleet-runner/public-keys && sha256sum -- *.pub"; }
bounded "$2" "listing the keys in the new container" - keys "$1"' \
    "$PROD_PROJECT" "$b_verify" >"$tmp/keys-after" || { say "FAIL could not list the enrolled keys in the new container"; exit 1; }
  cmp -s "$tmp/keys-before" "$tmp/keys-after" && [ "$(key_ids_of "$tmp/keys-after")" = "$want_key_ids" ] ||
    { say "FAIL the new container does not see exactly the same enrolled keys"; exit 1; }
  say "PASS the same $(wc -l <"$tmp/keys-after" | tr -d ' ') enrolled keys, by hash"
  local after jobs_after
  after="$(nas "$BOUND_FN"'jobs() { docker exec "$(docker ps -q --filter "label=com.docker.compose.project=$1" | head -n 1)" node -e "$2" /var/lib/fleet-runner/state/fleet.sqlite 2>/dev/null; }
bounded "$3" "counting the jobs in the new container" - jobs "$1" "$2"' \
    "$PROD_PROJECT" "$SNAP_JS" "$b_verify")" || { say "FAIL could not count the jobs in the new container"; exit 1; }
  jobs_after="$(printf '%s' "$after" | sed -n 's/^ok [0-9]* \([0-9][0-9]*\)$/\1/p')"
  [ -n "$jobs_after" ] && [ "$jobs_after" -ge "$jobs_before" ] ||
    { say "FAIL the job count fell from $jobs_before to ${jobs_after:-unknown}"; exit 1; }
  say "PASS $jobs_after jobs (the snapshot had $jobs_before)"

  # 9. The success record first (a failure to write it undoes the switch), then the commit: it
  # publishes the record and writes the log line (both prerequisites), then claims the pass, which
  # makes it durable and disarms the dead-man. Only then PASS.
  {
    echo "promote $runid: $prev_label -> $rev"
    echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "approval_sha256: $approval_sha"
    echo "snapshot: state.pre-$runid ($jobs_before jobs)"
    echo "compose.production.yaml: $compose_from; resolved config sha256 $resolved_sha"
    echo "manual undo:"
    FLEET_LOG="" manual_undo
  } >"$tmp/promote-$runid.txt.part"
  record "$tmp/promote-$runid.txt.part" || exit 1
  local crc=0
  nas "$COMMIT" "$NAS_PROD_DIR" "$runid" "$prev_from" "$short" "$approval_sha" "$approval" >"$tmp/commit" 2>&1 || crc=$?
  case "$crc" in
    0) passed=yes ;;
    3) say "FAIL the server-side dead-man claimed the undo before the pass could be committed"; exit 1 ;;
    4) grep '^FAIL' "$tmp/commit" || true; say "FAIL the pass could not be committed (record, log line or decision); nothing is committed, so it is undone"; exit 1 ;;
    *) say "FAIL could not commit the pass"; exit 1 ;;
  esac
  nas "$DISARMED" "$NAS_PROD_DIR" || { say "FAIL the server-side dead-man did not stand down"; keep_lock=yes; exit 1; }
  say "PASS the server-side dead-man is disarmed"
  say "PASS production runs $short (was $prev_label); record: promote-records/promote-$runid.txt"
  say "UNDO by hand, if it is ever needed:"
  manual_undo
}

run_logged "$logfile" promote_main
