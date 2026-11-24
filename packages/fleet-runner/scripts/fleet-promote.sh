#!/usr/bin/env bash
# fleet-promote: put a FleetRunner revision that passed in the TEST COPY onto PRODUCTION, with an
# undo (ojfbot/core#647, slice 4). It refuses without the owner's yes, given as a flag:
#
#   scripts/fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>'
#
# Refuses unless: the approval is given, is one line and names the revision (7 characters or more of
# it); stage-state (written by fleet-stage.sh) says this exact revision passed and is promotable; the
# approval was never used before (each yes covers one promotion: its SHA-256 goes into promote.log
# when production is about to change, and an approval already there is refused); production's
# folders, port and name are not the test copy's; and production runs now, in one of two forms:
#   - the hand-started container PROD_CONTAINER (the first promote: its port, mounts and settings
#     must be exactly what the Compose file below reproduces, else nothing changes), or
#   - the Compose project PROD_PROJECT from an earlier promote.
# Steps, with nothing changed until the switch: take the promote lock; re-check the staged image on
# the server (load-release.sh: archive hash, image ID, platform, non-root); read, while production
# still runs, its signed status build (as the read-only identity PROD_STATUS_ID, never the owner
# key), its TLS certificate and its enrolled public keys. Then the switch, fenced on the server like
# the stage script's: back up the env and compose files; stop the previous production; snapshot its
# state folder (a copy, by a throwaway container, as the folder is the service account's) and verify
# the snapshot by opening it read-only and running SQLite's integrity check; write the new env and
# compose files prepared and checked before the switch (the previous identities, folders, port and
# certificate are kept; the resolved compose config must be byte-identical to the one checked against
# compose-check.mjs's exact allowlist); start the new revision (never pulling); check the running image. Then the
# health check from this Mac: the signed status answers ready with exactly this revision, the TLS
# certificate is the same one, the same public keys are enrolled (by hash, inside the new container),
# and the job count is not lower than the snapshot's.
# On ANY failure, Ctrl-C, SIGTERM, SIGHUP or lost connection after the switch began, an exit trap
# undoes it: it fences (waits for anything still running on the server), stops the new revision,
# puts the snapshot back as the state folder (the failed state is kept beside it), restores the env
# and compose files, starts the previous production (for the first promote: that very container,
# checked by its ID and image), checks it answers as the previous build, and writes an undo record.
# It never prints PASS for a promote that did not pass. A successful promote ends with the exact
# manual undo. Config: the lib's header, plus the production keys listed in load_prod_conf.
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/fleet-stage-lib.sh
. "$here/lib/fleet-stage-lib.sh"

usage() {
  echo "usage: fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>'" >&2
  exit 2
}
[ "$#" -ge 1 ] || usage
rev_arg="$1"
shift
approval=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --owner-approved) [ "$#" -ge 2 ] || usage; approval="$2"; shift 2 ;;
    *) usage ;;
  esac
done
if [ -z "${approval//[[:space:]]/}" ]; then
  echo "REFUSED promote changes production and needs the owner's yes." >&2
  echo "Ask the owner, then pass their answer, which names the revision: --owner-approved '<their words>'" >&2
  exit 3
fi
case "$approval" in *$'\n'* | *$'\r'*) die "--owner-approved must be one line" ;; esac
# A rehearsal against a throwaway production can force the health check to fail; never production.
fault="${FLEET_PROMOTE_FAULT:-}"
case "$fault" in "" | health) ;; *) die "FLEET_PROMOTE_FAULT may only be health" ;; esac

load_conf
load_prod_conf
repo="$(git -C "$here" rev-parse --show-toplevel)"
cd "$repo"
rev="$(full_revision "$rev_arg")"
short="${rev:0:7}"
# One yes, one revision: the approval must name this revision.
named=no
for n in $(seq 40 -1 7); do
  case "$approval" in *"${rev:0:$n}"*) named=yes; break ;; esac
done
[ "$named" = yes ] || die "the owner's approval must name the revision it approves ($short); nothing was changed"
# The same words with other spacing or case are the same yes.
approval_sha="$(printf '%s' "$approval" | tr '[:upper:]' '[:lower:]' | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//' |
  shasum -a 256 | cut -d' ' -f1)"
runid="$(date -u +%Y%m%dT%H%M%SZ)-$$"
say "== promote $short to production ($runid)"
check_prod_isolation

tmp="$(mktemp -d "${TMPDIR:-/tmp}/fleet-promote-$short.XXXXXX")"
have_lock=no switching=no passed=no undone=no keep_lock=no
kind="" prev_label="" prev_build="" prev_rev="" old_cid="" old_image=""

# What this run does on every way out: undo a switch that did not pass, then let go of the lock.
# While it undoes, Ctrl-C and hangups are ignored (by its ssh too), so the undo itself is never cut
# short by the same key that started it.
cleanup() {
  local rc=$?
  trap '' INT TERM HUP
  trap - EXIT
  if [ "$switching" = yes ] && [ "$passed" != yes ] && [ "$undone" != yes ]; then
    say "FAIL $short did not pass in production; undoing the switch back to $prev_label"
    do_undo || keep_lock=yes
    [ "$rc" -ne 0 ] || rc=1
  fi
  if [ "$have_lock" = yes ] && [ "$keep_lock" = yes ]; then
    say "the promote lock is kept because production may not be at rest: look at it, then remove the lock folder"
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

nas "$LOCK" "$NAS_PROD_DIR" "$runid" .promote-lock promote || die "could not take the promote lock"
have_lock=yes

# 1. The gates that need the server: a fresh approval, and this exact revision staged.
used="$(nas 'if [ -f "$1/promote.log" ] && grep -q "approval_sha256=$2 " "$1/promote.log"; then echo used; else echo new; fi' \
  "$NAS_PROD_DIR" "$approval_sha")"
[ "$used" = new ] || die "this approval was already used (promote.log): each yes covers one promotion; nothing was changed"
if [ -n "$fault" ]; then
  nas '[ -f "$1/.fleet-runner-promote-rehearsal" ]' "$NAS_PROD_DIR" ||
    die "FLEET_PROMOTE_FAULT is only for a rehearsal production (its deploy folder carries .fleet-runner-promote-rehearsal)"
  say "REHEARSAL: the health check will be made to fail ($fault)"
fi
staged="$(nas "$STATE_FN"'read_state "$1" staged_ok' "$NAS_STAGE_DIR")"
[ "$staged" = "$rev" ] ||
  die "$short is not staged: stage-state does not name it as passed and promotable (run scripts/fleet-stage.sh $short); nothing was changed"
say "PASS stage-state: $short passed in the test copy and is promotable"

# 2. The image staging verified, checked again where it will run: the archive's hash and the image
# ID from the release.json the stage run compared byte for byte with the one it verified.
nas 'cat "$1/releases/$2/release.json"' "$NAS_STAGE_DIR" "$rev" >"$tmp/release.json" ||
  die "the test copy has no release of $short"
image_id="$(json_field image_id <"$tmp/release.json")"
manifest_digest="$(json_field manifest_digest <"$tmp/release.json")"
archive_sha="$(json_field archive_sha256 <"$tmp/release.json")"
tag="$(json_field tag <"$tmp/release.json")"
[ "$(json_field revision <"$tmp/release.json")" = "$rev" ] || die "the staged release.json names another revision"
[ "$tag" = "fleet-runner:$rev" ] || die "release.json names an unexpected image tag"
nas 'cd "$1/releases/$2" && sh load-release.sh fleet-runner-image.tar "$3" "$4" "$5" "$6"' \
  "$NAS_STAGE_DIR" "$rev" "$archive_sha" "$image_id" "$tag" "$manifest_digest" ||
  die "the staged image of $short does not check out on the server; nothing was changed"

# 3. Which form production is in now. Exactly one must be running: both would be two queues.
INSPECT='
c="$1" project="$2" dir="$3"
running="$(docker inspect --format "{{.State.Running}}" "$c" 2>/dev/null)" || running=absent
ids="$(docker ps -q --filter "label=com.docker.compose.project=$project")"
echo "container=$running"
if [ -n "$ids" ]; then echo "compose=running"; else echo "compose=stopped"; fi
echo "revision=$(sed -n "s/^FLEET_REVISION=//p" "$dir/fleet-production.env" 2>/dev/null | tail -n 1)"
'
nas "$INSPECT" "$PROD_CONTAINER" "$PROD_PROJECT" "$NAS_PROD_DIR" >"$tmp/form"
form_container="$(sed -n 's/^container=//p' "$tmp/form")"
form_compose="$(sed -n 's/^compose=//p' "$tmp/form")"
form_rev="$(sed -n 's/^revision=//p' "$tmp/form")"
if [ "$form_container" = true ] && [ "$form_compose" = stopped ]; then
  kind=container
elif [ "$form_container" != true ] && [ "$form_compose" = running ] && [[ "$form_rev" =~ ^[0-9a-f]{40}$ ]]; then
  kind=compose
  prev_rev="$form_rev"
  [ "$prev_rev" != "$rev" ] || { say "production already runs $short; nothing to do"; exit 0; }
else
  die "production is not running in a form this script knows (hand-started container: $form_container, Compose project: $form_compose); nothing was changed"
fi

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
[ "$(f "{{.HostConfig.Privileged}} {{len .HostConfig.CapAdd}} {{len .HostConfig.Devices}} {{.HostConfig.NetworkMode}}")" = "false 0 0 bridge" ] ||
  { echo "FAIL it runs with privileges, devices or a network the Compose file does not give"; bad=1; }
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
if [ "$kind" = container ]; then
  nas "$FIRST_CHECK" "$PROD_CONTAINER" "$NAS_PROD_ROOT" "$PROD_LAN_IP" "$PROD_PORT" >"$tmp/first" ||
    { grep '^FAIL' "$tmp/first" || true; die "the first promote cannot reproduce the hand-started container; nothing was changed (an owner decision)"; }
  grep '^PASS' "$tmp/first"
  old_cid="$(sed -n 's/^id=\([0-9a-f]*\) image=.*/\1/p' "$tmp/first")"
  old_image="$(sed -n 's/^id=.* image=\(sha256:[0-9a-f]*\)$/\1/p' "$tmp/first")"
  [ -n "$old_cid" ] && [ -n "$old_image" ] || die "could not read the hand-started container's ID and image"
else
  old_image="$(nas 'docker inspect --format "{{.Image}}" "$(docker ps -q --filter "label=com.docker.compose.project=$1" | head -n 1)"' "$PROD_PROJECT")"
  [[ "$old_image" =~ ^sha256:[0-9a-f]{64}$ ]] || die "could not read the running production image"
fi

# 4. While production still runs: what it answers as, its certificate, its enrolled keys.
prod_node() { client_node "$PROD_HOST" "$PROD_PORT" "$PROD_KEYS_DIR" "$PROD_STATUS_ID" "$here/stage-smoke.mjs" "$@"; }
read_build() {
  local out
  out="$(prod_node build 2>/dev/null)" || return 1
  printf '%s' "$out" | json_field build
}
# Only a revision-shaped build is printed.
build_label() { if [[ "$1" =~ ^[0-9a-f]{7,40}$ ]]; then printf 'build %s' "${1:0:12}"; else printf 'its non-revision build label'; fi; }
# Wait for the signed status to answer ready with exactly <build>: FLEET_READY_TRIES tries (default
# 30), FLEET_READY_SLEEP seconds apart (default 3). The undo's own checks say CHECKED, not PASS.
wait_build() {
  local want="$1" word="${2:-PASS}" got="" i tries="${FLEET_READY_TRIES:-30}" pause="${FLEET_READY_SLEEP:-3}"
  for i in $(seq 1 "$tries"); do
    if got="$(read_build)" && [ "$got" = "$want" ]; then
      say "$word signed status ready, $(build_label "$want")"
      return 0
    fi
    [ "$i" -eq "$tries" ] || sleep "$pause"
  done
  say "FAIL signed status is not ready on $(build_label "$want") after $tries tries"
  return 1
}
tls_fingerprint() {
  local sni=()
  [[ "$PROD_HOST" =~ ^[0-9.]+$ ]] || sni=(-servername "$PROD_HOST")
  openssl s_client -connect "$PROD_HOST:$PROD_PORT" ${sni[@]+"${sni[@]}"} </dev/null 2>/dev/null |
    openssl x509 -noout -fingerprint -sha256 2>/dev/null | sed 's/^.*=//'
}
prev_build="$(read_build)" || die "production does not answer a signed status now; the promote will not replace a service it could not prove it brought back"
[ -n "$prev_build" ] || die "production's signed status names no build"
if [ "$kind" = container ]; then
  prev_label="the hand-started container $PROD_CONTAINER ($(build_label "$prev_build"))"
else
  [ "$prev_build" = "$prev_rev" ] || die "production answers as $(build_label "$prev_build"), not the ${prev_rev:0:7} its env file names"
  prev_label="${prev_rev:0:7}"
fi
say "production now: $prev_label"
tls_before="$(tls_fingerprint)"
[ -n "$tls_before" ] || die "could not read production's TLS certificate"
# Every enrolled public key by its hash, read through a throwaway container of the checked image
# (the folder may belong to the service account). The same command runs in the new container later.
KEYS_HOST='docker run --rm --network none --user 0:0 --entrypoint sh -v "$1/public-keys:/k:ro" "fleet-runner:$2" -c "cd /k && sha256sum -- *.pub"'
nas "$KEYS_HOST" "$NAS_PROD_ROOT" "$rev" >"$tmp/keys-before" || die "could not list production's enrolled keys"
key_names="$(sed -n 's/^[0-9a-f]\{64\}  \(.*\)\.pub$/\1/p' "$tmp/keys-before" | sort | tr '\n' ' ' | sed 's/ $//')"
[ -n "$key_names" ] || die "production has no enrolled keys"
if [ -n "$PROD_KEY_IDS" ]; then
  [ "$key_names" = "$(printf '%s\n' $PROD_KEY_IDS | sort | tr '\n' ' ' | sed 's/ $//')" ] ||
    die "production's enrolled keys are not the ones PROD_KEY_IDS names; nothing was changed"
fi
say "PASS $(wc -l <"$tmp/keys-before" | tr -d ' ') enrolled keys read ($key_names)"

# 5. The production Compose file: the promoted revision's own if it has one, else this checkout's.
if git cat-file -e "$rev:packages/fleet-runner/deploy/compose.production.yaml" 2>/dev/null; then
  git show "$rev:packages/fleet-runner/deploy/compose.production.yaml" >"$tmp/compose.yaml"
  compose_from="$short's own"
else
  git show "HEAD:packages/fleet-runner/deploy/compose.production.yaml" >"$tmp/compose.yaml" ||
    die "this checkout has no committed deploy/compose.production.yaml"
  compose_from="this checkout's ($(git rev-parse --short=7 HEAD); $short predates it)"
fi
nas 'mkdir -p "$1/promote-records"' "$NAS_PROD_DIR"
nas_put "$NAS_PROD_DIR/promote-records" "$tmp/compose.yaml"
nas 'mv "$1/promote-records/compose.yaml" "$1/compose.yaml.next-$2"' "$NAS_PROD_DIR" "$runid"

# The next env file, written beside the live one (production is not touched), and the compose config
# Compose resolves from the two, checked HERE against an exact allowlist (compose-check.mjs): the
# Compose file comes from the revision, so its hardening, user, mounts and port are not trusted.
# The switch later requires the config it resolves to be byte-identical to the one checked here.
PREPARE="$CLEAN_ENV$ENV_PLAIN_FN"'
dir="$1" runid="$2" kind="$3" project="$4" rev="$5" root="$6" port="$7" lan="$8" container="$9"
cd "$dir"
owner="$(stat -c %u:%g "$root/state")"
case "$owner" in *[!0-9:]* | 0:* | "") echo "FAIL the state folder has no service account owner" >&2; exit 1 ;; esac
next="fleet-production.env.next-$runid"
if [ "$kind" = container ]; then
  envs="$(docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" "$container")"
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
env_is_plain "$next.part" || { echo "FAIL the new env file is not one plain KEY=value per line" >&2; exit 1; }
chmod 0600 "$next.part" && mv "$next.part" "$next"
echo "$owner" > "uidgid.next-$runid"
docker compose -p "$project" --env-file "$next" -f "compose.yaml.next-$runid" config --format json
'
nas "$PREPARE" "$NAS_PROD_DIR" "$runid" "$kind" "$PROD_PROJECT" "$rev" "$NAS_PROD_ROOT" "$PROD_PORT" "$PROD_LAN_IP" \
  "$PROD_CONTAINER" >"$tmp/resolved.json" || die "could not prepare and resolve the new compose config; nothing was changed"
uidgid="$(nas 'cat "$1/uidgid.next-$2"' "$NAS_PROD_DIR" "$runid")"
node "$here/compose-check.mjs" "$tmp/resolved.json" "$PROD_PROJECT" "$NAS_PROD_ROOT" "$PROD_LAN_IP" "$PROD_PORT" "$uidgid" "$rev" ||
  die "the compose config $short would run with is not production's allowlisted shape; nothing was changed"
resolved_sha="$(shasum -a 256 "$tmp/resolved.json" | cut -d' ' -f1)"

say "approved by the owner: $approval"
say "changes: production goes from $prev_label to $short under the Compose project $PROD_PROJECT, with $compose_from compose.production.yaml"
say "         (same folders, enrolled keys, certificate, address and port); it is offline for the switch"
say "undo: on any failure from here on the switch is undone by itself, from a verified snapshot of the state folder"

log() {
  nas 'printf "%s %s %s -> %s approval_sha256=%s approval: %s\n" "$2" "$3" "$4" "$5" "$6" "$7" >> "$1/promote.log"' \
    "$NAS_PROD_DIR" "$runid" "$1" "${prev_rev:-$PROD_CONTAINER}" "$short" "$approval_sha" "$approval"
}

# 6. The switch, fenced on the server. The file backups come first, and count only once renamed
# from .part; a missing backup means its file never existed (the first promote) or was never changed.
SNAP_JS='const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const check = db.prepare("PRAGMA integrity_check").all().map((r) => Object.values(r)[0]);
const version = db.prepare("PRAGMA user_version").get().user_version;
const jobs = db.prepare("SELECT count(*) AS n FROM jobs").get().n;
db.close();
if (check.length !== 1 || check[0] !== "ok") { console.log("integrity-failed"); process.exit(1); }
console.log("ok " + version + " " + jobs);'
SWITCH_BODY="$CLEAN_ENV$STOP_FN$ENV_PLAIN_FN"'
kind="$1" project="$2" rev="$3" root="$4" image_id="$5" manifest_digest="$6" port="$7" lan="$8" container="$9"
shift 9
js="$1" resolved_sha="$2"
img="fleet-runner:$rev"
cd "$dir"
step
loaded="$(docker image inspect --format "{{.Id}}" "$img")"
[ "$loaded" = "$image_id" ] || { [ -n "$manifest_digest" ] && [ "$loaded" = "$manifest_digest" ]; } ||
  { echo "FAIL $img is not the checked image"; exit 1; }
for f in fleet-production.env compose.yaml; do
  if [ -f "$f" ]; then
    { cp -p "$f" "$f.pre-$runid.part" && mv "$f.pre-$runid.part" "$f.pre-$runid"; } || { echo "FAIL backing up $f"; exit 1; }
  fi
done
step
if [ "$kind" = container ]; then
  docker stop -t 30 "$container" >/dev/null || { echo "FAIL could not stop the previous production"; exit 1; }
  [ "$(docker inspect --format "{{.State.Running}}" "$container")" = false ] || { echo "FAIL the previous production is still running"; exit 1; }
else
  stop_project "$project" || { echo "FAIL could not stop the previous production"; exit 1; }
fi
echo "stopped the previous production"
step
docker run --rm --network none --user 0:0 --entrypoint sh -v "$root:/srv" "$img" -c "
  rm -rf /srv/state.pre-$runid.part && cp -a /srv/state /srv/state.pre-$runid.part && mv /srv/state.pre-$runid.part /srv/state.pre-$runid" ||
  { echo "FAIL could not copy the state folder"; exit 1; }
owner="$(stat -c %u:%g "$root/state")"
case "$owner" in *[!0-9:]* | 0:* | "") echo "FAIL the state folder has no service account owner"; exit 1 ;; esac
snap="$(docker run --rm --network none --user "$owner" --entrypoint node -v "$root/state.pre-$runid:/snap" "$img" -e "$js" /snap/fleet.sqlite 2>/dev/null)" ||
  { echo "FAIL the snapshot does not open read-only or fails its integrity check"; exit 1; }
set -- $snap
[ "$1" = ok ] || { echo "FAIL the snapshot check said: $snap"; exit 1; }
echo "SNAPSHOT state.pre-$runid integrity=ok schema=$2 jobs=$3"
step
{ cp -p "fleet-production.env.next-$runid" fleet-production.env.new && mv fleet-production.env.new fleet-production.env; } || exit 1
{ cp "compose.yaml.next-$runid" compose.yaml.new && mv compose.yaml.new compose.yaml; } || exit 1
c="docker compose -p $project --env-file fleet-production.env -f compose.yaml"
# What Compose will actually use, with nothing inherited from this shell, must be the very config
# that was checked against the allowlist before production was touched, byte for byte.
got="$($c config --format json 2>/dev/null | sha256sum | cut -d" " -f1)"
[ "$got" = "$resolved_sha" ] || { echo "FAIL the resolved compose config is not the one that was checked"; exit 1; }
step
$c up -d --pull never >/dev/null 2>&1 || { echo "FAIL compose up"; exit 1; }
id="$($c ps -q fleet-runner)"
[ -n "$id" ] || { echo "FAIL the new production container is not running"; exit 1; }
running="$(docker inspect --format "{{.Image}}" "$id")"
if [ "$running" = "$image_id" ] || { [ -n "$manifest_digest" ] && [ "$running" = "$manifest_digest" ]; }; then
  echo "PASS running image $running"
else
  echo "FAIL running image $running is not the checked release"; exit 1
fi
'
SWITCH="$(fenced .promote-lock "$SWITCH_BODY")"

# The undo, from any point the switch reached. Only finished backups are used. It fences first,
# stops the new revision, puts the snapshot back (keeping the failed state as state.failed-<run>),
# restores the files, and starts the previous production: the same container for the first promote,
# checked by ID and image; else the previous Compose revision, checked by its image.
UNDO="$CLEAN_ENV$STOP_FN$FENCE_WAIT_FN"'
set +e
dir="$1" runid="$2" kind="$3" project="$4" root="$5" container="$6" old_cid="$7" old_image="$8" rev="$9"
shift 9
wait="$1"
img="fleet-runner:$rev"
bad=0
cd "$dir" || exit 1
fence_wait "$dir/.promote-lock" "$runid" "$wait" || exit 1
stop_project "$project" || { echo "FAIL could not stop the new revision; nothing else was changed"; exit 1; }
echo "the new revision is stopped"
for f in fleet-production.env compose.yaml; do
  if [ -f "$f.pre-$runid" ]; then
    cp -p "$f.pre-$runid" "$f" || { echo "FAIL could not restore $f"; bad=1; }
  elif [ "$kind" = container ] && [ -f "$f" ]; then
    mv "$f" "$f.failed-$runid" || { echo "FAIL could not set $f aside"; bad=1; }
  fi
done
where="$(docker run --rm --network none --user 0:0 --entrypoint sh -v "$root:/srv" "$img" -c "
  cd /srv || exit 1
  if [ -d state.pre-$runid ]; then mv state state.failed-$runid && mv state.pre-$runid state && echo restored
  elif [ -d state.pre-$runid.part ]; then mv state.pre-$runid.part state.partial-$runid && echo partial
  else echo untouched; fi")"
case "$where" in
  restored) echo "put the snapshot back as the state folder; the failed state is state.failed-$runid" ;;
  partial | untouched) echo "the snapshot was not complete, so the new revision never started: the state folder was left as it was" ;;
  *) echo "FAIL could not put the state folder back"; bad=1 ;;
esac
if [ "$bad" -eq 0 ]; then
  if [ "$kind" = container ]; then
    docker start "$container" >/dev/null || { echo "FAIL could not start the previous production"; bad=1; }
    [ "$(docker inspect --format "{{.Id}} {{.Image}} {{.State.Running}}" "$container")" = "$old_cid $old_image true" ] ||
      { echo "FAIL the running container is not the one that ran before"; bad=1; }
  else
    c="docker compose -p $project --env-file fleet-production.env -f compose.yaml"
    $c up -d --pull never >/dev/null 2>&1 || { echo "FAIL could not start the previous revision"; bad=1; }
    id="$($c ps -q fleet-runner)"
    [ -n "$id" ] && [ "$(docker inspect --format "{{.Image}}" "$id")" = "$old_image" ] ||
      { echo "FAIL the previous revision is not running its own image"; bad=1; }
  fi
  [ "$bad" -eq 0 ] && echo "started the previous production again"
fi
exit "$bad"
'
manual_undo() {
  local helper="docker run --rm --network none --user 0:0 --entrypoint sh -v $NAS_PROD_ROOT:/srv fleet-runner:$rev"
  say "  1. stop the new revision:  ssh $NAS_SSH 'docker stop -t 30 \$(docker ps -q --filter label=com.docker.compose.project=$PROD_PROJECT)'"
  say "  2. put the pre-promote snapshot back (this LOSES every job accepted since the promote; they stay in state.undone-$runid):"
  say "     ssh $NAS_SSH '$helper -c \"cd /srv && mv state state.undone-$runid && cp -a state.pre-$runid state\"'"
  if [ "$kind" = container ]; then
    say "  3. set the new files aside and start the hand-started container again:"
    say "     ssh $NAS_SSH 'cd $NAS_PROD_DIR && mv fleet-production.env fleet-production.env.undone-$runid && mv compose.yaml compose.yaml.undone-$runid && docker start $PROD_CONTAINER'"
  else
    say "  3. put the previous files back and start ${prev_rev:0:7}:"
    say "     ssh $NAS_SSH 'cd $NAS_PROD_DIR && cp -p fleet-production.env.pre-$runid fleet-production.env && cp -p compose.yaml.pre-$runid compose.yaml && docker compose -p $PROD_PROJECT --env-file fleet-production.env -f compose.yaml up -d --pull never'"
  fi
  say "  4. check it answers as before: $(build_label "$prev_build")"
}
# A record is copied into promote-records/ on the server under its own name.
record() { nas_put "$NAS_PROD_DIR/promote-records" "$1" || say "FAIL could not write the record $(basename "$1")"; }

# Called once, from the exit trap. Never prints PASS: the promote did not pass, whatever the undo did.
do_undo() {
  local ok=yes out=""
  undone=yes
  out="$(nas "$UNDO" "$NAS_PROD_DIR" "$runid" "$kind" "$PROD_PROJECT" "$NAS_PROD_ROOT" "$PROD_CONTAINER" \
    "$old_cid" "$old_image" "$rev" "${FLEET_FENCE_WAIT:-300}" 2>&1)" || ok=no
  printf '%s\n' "$out"
  if [ "$ok" = yes ]; then wait_build "$prev_build" CHECKED || ok=no; fi
  {
    echo "undo of promote $runid: $prev_label -> $short"
    echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "approval_sha256: $approval_sha"
    echo "server steps:"
    printf '%s\n' "$out" | sed 's/^/  /'
    if [ "$ok" = yes ]; then echo "result: production is back on $prev_label and answers as before"; else echo "result: FAILED, production may be down or on the wrong revision"; fi
  } >"$tmp/undo-$runid.txt"
  if [ "$ok" = yes ]; then
    record "$tmp/undo-$runid.txt"
    log undone || true
    say "UNDONE production is back on $prev_label and answers as before; $short was NOT promoted (record: promote-records/undo-$runid.txt)"
    return 0
  fi
  record "$tmp/undo-$runid.txt"
  log undo-failed || true
  say "FAIL the undo did not complete: production may be down. Put it back by hand:"
  manual_undo
  return 1
}

# The approval is spent once production is about to change, whatever happens next.
log started
switching=yes
nas "$SWITCH" "$NAS_PROD_DIR" "$runid" "$kind" "$PROD_PROJECT" "$rev" "$NAS_PROD_ROOT" "$image_id" "$manifest_digest" \
  "$PROD_PORT" "$PROD_LAN_IP" "$PROD_CONTAINER" "$SNAP_JS" "$resolved_sha" | tee "$tmp/switch.out" || exit 1
jobs_before="$(sed -n 's/^SNAPSHOT .* jobs=\([0-9][0-9]*\)$/\1/p' "$tmp/switch.out")"
[ -n "$jobs_before" ] || { say "FAIL the snapshot's job count is missing"; exit 1; }

# 7. The health check, from this Mac and in the new container.
want="$rev"
[ "$fault" != health ] || want="0000000000000000000000000000000000000000"
wait_build "$want" || exit 1
tls_after="$(tls_fingerprint)"
[ "$tls_after" = "$tls_before" ] || { say "FAIL production's TLS certificate changed"; exit 1; }
say "PASS the same TLS certificate"
KEYS_NEW='docker exec "$(docker ps -q --filter "label=com.docker.compose.project=$1" | head -n 1)" sh -c "cd /run/fleet-runner/public-keys && sha256sum -- *.pub"'
nas "$KEYS_NEW" "$PROD_PROJECT" >"$tmp/keys-after" || { say "FAIL could not list the enrolled keys in the new container"; exit 1; }
cmp -s "$tmp/keys-before" "$tmp/keys-after" || { say "FAIL the new container does not see the same enrolled keys"; exit 1; }
say "PASS the same $(wc -l <"$tmp/keys-after" | tr -d ' ') enrolled keys, by hash"
JOBS_NEW='docker exec "$(docker ps -q --filter "label=com.docker.compose.project=$1" | head -n 1)" node -e "$2" /var/lib/fleet-runner/state/fleet.sqlite 2>/dev/null'
after="$(nas "$JOBS_NEW" "$PROD_PROJECT" "$SNAP_JS")" || { say "FAIL could not count the jobs in the new container"; exit 1; }
jobs_after="$(printf '%s' "$after" | sed -n 's/^ok [0-9]* \([0-9][0-9]*\)$/\1/p')"
[ -n "$jobs_after" ] && [ "$jobs_after" -ge "$jobs_before" ] ||
  { say "FAIL the job count fell from $jobs_before to ${jobs_after:-unknown}"; exit 1; }
say "PASS $jobs_after jobs (the snapshot had $jobs_before)"

# 8. Passed: record it, then say how to undo it by hand.
log promoted
passed=yes
{
  echo "promote $runid: $prev_label -> $rev"
  echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "approval_sha256: $approval_sha"
  echo "snapshot: state.pre-$runid ($jobs_before jobs)"
  echo "compose.production.yaml: $compose_from"
  echo "manual undo:"
  manual_undo
} >"$tmp/promote-$runid.txt"
record "$tmp/promote-$runid.txt"
say "PASS production runs $short (was $prev_label); record: promote-records/promote-$runid.txt"
say "UNDO by hand, if it is ever needed:"
manual_undo
