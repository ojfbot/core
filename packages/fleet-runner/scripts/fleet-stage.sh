#!/usr/bin/env bash
# fleet-stage: put a FleetRunner release into the TEST COPY on the server, smoke-test it from this
# Mac, and put the last revision that passed back on any failure (ojfbot/core#647, slices 2 and 3).
# It never touches production: it only uses the test copy's own project, folders, port and keys, and
# refuses to start unless the private config and the server's env file agree those are its own.
#
#   scripts/fleet-stage.sh <revision> [--release <dir>] [--keep-running]
#
# <dir> holds fleet-runner-image.tar, its .sha256 and release.json (release-image.sh, or the CI
# artifact). Without --release it downloads the CI artifact of that revision, choosing the CI RUN,
# never the artifact name (see deployment.md):
#   - a push run on main of the workflow fleet-runner-release.yml whose head SHA is the revision, in
#     this repository, succeeded; else
#   - the newest successful workflow_dispatch rebuild run on main in this repository whose
#     release.json names the revision.
# Steps: take the run lock on the server; ALWAYS verify the release here with verify-release.sh
# check (needs node), also when the server already holds a copy (that copy must be identical to the
# verified one); copy it, and that revision's compose.yaml and load-release.sh, to the server; load
# it there with load-release.sh (which re-hashes the archive against the checked SHA-256 and checks
# the image ID, platform and non-root); stop the test copy and copy its state folder aside; start
# the new revision; check the running image; then from this Mac, with the test copy's own keys: the
# signed status answers with exactly this revision, a signed job submit is accepted, and a worker
# claims the job (stage-smoke.mjs). On success the test copy is stopped (it runs only while a test is
# under way; --keep-running leaves it up) and stage-state is written: ONE file, replaced by ONE
# rename, naming the last revision that passed and the one now staged (promotable). Every run first
# clears the staged one, keeping the last-passed record.
# The server-side steps that change things (the switch, and recording the pass) run in their own
# process group, recorded in the lock folder, with the Compose variables of the server shell cleared
# (Compose prefers them to the env file) and the RESOLVED compose config checked against the private
# config right before anything starts.
# On ANY failure, Ctrl-C, SIGTERM or lost connection after the switch began, an exit trap rolls back:
# it first tells anything still running on the server to stop and waits for the whole process group
# to end (a Compose child outlives the shell that started it), then puts back the state folder, env
# file and compose.yaml, resets stage-state to the last revision that PASSED, starts that revision,
# checks it answers as that revision, and stops it.
# Rollback never reports PASS after a failed step. The test copy is stopped by its Compose project
# label, not by Compose, so it works whatever the env file holds. Config and folders:
# scripts/lib/fleet-stage-lib.sh.
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/fleet-stage-lib.sh
. "$here/lib/fleet-stage-lib.sh"

usage() {
  echo "usage: fleet-stage.sh <revision> [--release <dir>] [--keep-running]" >&2
  exit 2
}
[ "$#" -ge 1 ] || usage
rev_arg="$1"
shift
release=""
keep_running=no
while [ "$#" -gt 0 ]; do
  case "$1" in
    --release) [ "$#" -ge 2 ] || usage; release="$2"; shift 2 ;;
    --keep-running) keep_running=yes; shift ;;
    *) usage ;;
  esac
done

load_conf
repo="$(git -C "$here" rev-parse --show-toplevel)"
cd "$repo"
rev="$(full_revision "$rev_arg")"
short="${rev:0:7}"
# One ID per run, names every backup and the lock, so nothing from another run is ever reused.
runid="$(date -u +%Y%m%dT%H%M%SZ)-$$"
say "== stage $short into $STAGE_PROJECT ($runid)"
check_isolation

tmp="$(mktemp -d "${TMPDIR:-/tmp}/fleet-stage-$short.XXXXXX")"
have_lock=no switching=no passed=no rolled_back=no keep_lock=no
prev="" prev_label="the empty state"

# Stop what this run started or left, on any way out, and let go of the lock.
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$switching" = yes ] && [ "$passed" != yes ] && [ "$rolled_back" != yes ]; then
    say "FAIL $short did not pass in the test copy; rolling back to $prev_label"
    do_rollback || keep_lock=yes
    [ "$rc" -ne 0 ] || rc=1
  fi
  if [ "$have_lock" = yes ] && [ "$keep_lock" = yes ]; then
    say "the stage lock is kept because the test copy may not be at rest: look at it, then remove the lock folder"
  elif [ "$have_lock" = yes ]; then
    nas "$UNLOCK" "$NAS_STAGE_DIR" "$runid" .stage-lock || say "FAIL could not release the run lock on the server"
  fi
  rm -rf "$tmp"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

nas "$LOCK" "$NAS_STAGE_DIR" "$runid" .stage-lock stage || die "could not take the stage lock"
have_lock=yes
# Only a run that passes below may leave a revision promotable: clear the staged pass first (the
# record of the last revision that passed stays). Both live in one file, stage-state, so they are
# always written together by one rename.
# (STATE_FN, read_state and write_state of stage-state, is in the lib: the promote reads it.)
nas "$STATE_FN"'write_state "$1" "$(read_state "$1" last_passed)" ""' "$NAS_STAGE_DIR"

# Node, as the test copy's own client: its keys and CA only (client_node, in the lib).
stage_node() { client_node "$STAGE_HOST" "$STAGE_PORT" "$STAGE_KEYS_DIR" owner "$here/stage-smoke.mjs" "$@"; }

# Wait for the signed status to answer ready on exactly <revision>: up to FLEET_READY_TRIES tries
# (default 30), FLEET_READY_SLEEP seconds apart (default 3).
wait_ready() {
  local want="$1" out="" i tries="${FLEET_READY_TRIES:-30}" pause="${FLEET_READY_SLEEP:-3}"
  for i in $(seq 1 "$tries"); do
    if out="$(stage_node status "$want" 2>/dev/null)"; then
      say "PASS status ready, build ${want:0:7}"
      return 0
    fi
    [ "$i" -eq "$tries" ] || sleep "$pause"
  done
  say "FAIL status not ready on ${want:0:7} after $tries tries (last: ${out:-no answer})"
  return 1
}

# 1. The release, verified HERE every time: given, or the CI artifact chosen by run.
if [ -z "$release" ]; then
  release="$tmp/release"
  artifact="fleet-runner-release-${rev:0:12}"
  found=no
  while read -r run_id kind; do
    [ -n "${run_id:-}" ] || continue
    rm -rf "$release" && mkdir -p "$release"
    gh run download "$run_id" --repo "$FLEET_REPO" --name "$artifact" --dir "$release" >/dev/null 2>&1 || continue
    # A rebuild run's head SHA is not the revision, so release.json's revision decides; the push
    # run is also checked this way.
    if bash "$here/verify-release.sh" check "$release" "$rev" >/dev/null 2>&1; then
      say "PASS downloaded the CI release of $short from run $run_id ($kind)"
      found=yes
      break
    fi
  done < <(select_runs "$rev")
  [ "$found" = yes ] ||
    die "no trusted CI release for $short (artifacts expire after 7 days: run the workflow from main with the revision to rebuild it, or pass --release <dir>)"
fi
[ -f "$release/release.json" ] || die "$release has no release.json"
bash "$here/verify-release.sh" check "$release" "$rev" || die "the release does not verify"

# The server's copy, if it has one, must be the very release just verified; else it is refused,
# never trusted for its own checksum.
have_remote="$(nas '[ -f "$1/releases/$2/release.json" ] && echo yes || echo no' "$NAS_STAGE_DIR" "$rev")"
if [ "$have_remote" = yes ]; then
  nas 'cat "$1/releases/$2/release.json"' "$NAS_STAGE_DIR" "$rev" >"$tmp/remote-release.json"
  cmp -s "$release/release.json" "$tmp/remote-release.json" ||
    die "the copy of $short on the server is not the release just verified; remove releases/$rev there by hand if it is stale"
  say "PASS the server already holds exactly this release"
else
  nas 'mkdir -p "$1/releases/$2.part"' "$NAS_STAGE_DIR" "$rev"
  nas_put "$NAS_STAGE_DIR/releases/$rev.part" "$release"/fleet-runner-image.tar \
    "$release"/fleet-runner-image.tar.sha256 "$release"/release.json
  # The deploy files of that revision travel with it.
  git show "$rev:packages/fleet-runner/deploy/compose.yaml" >"$tmp/compose.yaml" ||
    die "$short has no packages/fleet-runner/deploy/compose.yaml: it predates the test copy"
  git show "$rev:packages/fleet-runner/scripts/load-release.sh" >"$tmp/load-release.sh" ||
    die "$short has no load-release.sh"
  nas_put "$NAS_STAGE_DIR/releases/$rev.part" "$tmp/compose.yaml" "$tmp/load-release.sh"
  nas 'mv "$1/releases/$2.part" "$1/releases/$2"' "$NAS_STAGE_DIR" "$rev"
fi
# What the load checks against comes from the release verified here.
image_id="$(json_field image_id <"$release/release.json")"
manifest_digest="$(json_field manifest_digest <"$release/release.json")"
archive_sha="$(json_field archive_sha256 <"$release/release.json")"
tag="$(json_field tag <"$release/release.json")"
[ "$tag" = "fleet-runner:$rev" ] || die "release.json names an unexpected image tag"

# 2. Load and check the image there (the image store is shared; loading a new tag changes nothing
# running). load-release.sh re-hashes the archive against the SHA-256 checked here.
nas 'cd "$1/releases/$2" && sh load-release.sh fleet-runner-image.tar "$3" "$4" "$5" "$6"' \
  "$NAS_STAGE_DIR" "$rev" "$archive_sha" "$image_id" "$tag" "$manifest_digest"

# The smoke client is the one in this checkout, built here (pnpm only).
say "building the smoke client"
pnpm --filter @core/fleet-runner build >/dev/null || die "could not build the smoke client"

# 3. The revision to put back is the last one that PASSED (stage-state), not whatever the env file
# happens to hold after a partial run. None yet: a rollback returns to the empty state.
prev="$(nas "$STATE_FN"'read_state "$1" last_passed' "$NAS_STAGE_DIR")"
if [[ "$prev" =~ ^[0-9a-f]{40}$ ]]; then
  prev_label="${prev:0:7}"
  say "last revision that passed in the test copy: $prev_label"
else
  prev=""
  say "no revision has passed in the test copy yet"
fi

# Stop the test copy by its Compose project label, with the Compose variables of the server shell
# cleared, and fence the server-side steps: STOP_FN, STOP, CLEAN_ENV and fenced are in the lib.

# The env and compose backups come first, so a rollback always has them; the state copy is only
# complete once it is renamed from .part. Every name carries this run's ID.
SWITCH_BODY="$CLEAN_ENV$STOP_FN"'
project="$1" rev="$2" root="$3" image_id="$4" manifest_digest="$5" port="$6" lan="$7"
cd "$dir" || exit 1
step
[ -d "$root/state" ] || { echo "FAIL no test copy state folder"; exit 1; }
{ cp -p fleet-staging.env "fleet-staging.env.pre-$runid.part" && mv "fleet-staging.env.pre-$runid.part" "fleet-staging.env.pre-$runid"; } ||
  { echo "FAIL backing up fleet-staging.env"; exit 1; }
{ cp -p compose.yaml "compose.yaml.pre-$runid.part" && mv "compose.yaml.pre-$runid.part" "compose.yaml.pre-$runid"; } ||
  { echo "FAIL backing up compose.yaml"; exit 1; }
step
stop_project "$project" || { echo "FAIL could not stop the test copy"; exit 1; }
step
cp -a "$root/state" "$root/state.pre-$runid.part" || { echo "FAIL copying the test copy state folder"; exit 1; }
mv "$root/state.pre-$runid.part" "$root/state.pre-$runid" || { echo "FAIL could not finish the state copy"; exit 1; }
step
{ cp "releases/$rev/compose.yaml" compose.yaml.new && mv compose.yaml.new compose.yaml; } || exit 1
grep -v -e "^FLEET_REVISION=" -e "^FLEET_IMAGE=" "fleet-staging.env.pre-$runid" > fleet-staging.env.new || true
printf "FLEET_REVISION=%s\nFLEET_IMAGE=fleet-runner:%s\n" "$rev" "$rev" >> fleet-staging.env.new
{ chmod 0600 fleet-staging.env.new && mv fleet-staging.env.new fleet-staging.env; } || exit 1
c="docker compose -p $project --env-file fleet-staging.env -f compose.yaml"
# What Compose will actually use, with nothing inherited from this shell, must be the test copy:
# its own project, the four folders under its own root, its own address and port.
cfg="$($c config 2>/dev/null)" || { echo "FAIL could not resolve the compose file"; exit 1; }
ok=1
printf "%s\n" "$cfg" | grep -qx "name: $project" || ok=0
for d in state output public-keys tls; do printf "%s\n" "$cfg" | grep -qxF "        source: $root/$d" || ok=0; done
[ "$(printf "%s\n" "$cfg" | grep -c "^ *source: ")" -eq 4 ] || ok=0
printf "%s\n" "$cfg" | grep -qxF "        host_ip: $lan" || ok=0
printf "%s\n" "$cfg" | grep -qxF "        published: \"$port\"" || ok=0
[ "$(printf "%s\n" "$cfg" | grep -c "published:")" -eq 1 ] || ok=0
[ "$ok" -eq 1 ] || { echo "FAIL the resolved compose config is not the test copy own folders, port and name"; exit 1; }
step
# Never pull: the only image this may run is the one just loaded from the checked archive.
$c up -d --pull never >/dev/null 2>&1 || { echo "FAIL compose up"; exit 1; }
id="$($c ps -q fleet-runner)"
[ -n "$id" ] || { echo "FAIL the test copy container is not running"; exit 1; }
running="$(docker inspect --format "{{.Image}}" "$id")"
if [ "$running" = "$image_id" ] || { [ -n "$manifest_digest" ] && [ "$running" = "$manifest_digest" ]; }; then
  echo "PASS running image $running"
else
  echo "FAIL running image $running is not the checked release"; exit 1
fi
'
SWITCH="$(fenced .stage-lock "$SWITCH_BODY")"

# Recording the pass is fenced too, and is one rename of one file (last passed and staged together),
# so a connection lost around it can never leave the two disagreeing.
RECORD_BODY="$STATE_FN"'
rev="$1"
step
write_state "$dir" "$rev" "$rev" || { echo "FAIL could not write stage-state"; exit 1; }
echo "PASS recorded: $rev staged and smoke-tested"
'
RECORD="$(fenced .stage-lock "$RECORD_BODY")"

# Works from any point SWITCH reached: what was saved is put back, what was not is left alone. Only
# finished backups are used; a leftover .part is ignored. Files are changed only after both backups
# finished, so a missing backup means its file was never changed. First it FENCES: anything fenced
# still running on the server (its connection may be long gone, and a Compose child outlives the
# shell that started it) is told to stop, and the whole process group is waited out; never killed,
# as a stale ID could belong to someone else, so if it does not end the lock is kept. Then the pass
# record and env file are set to the last revision that passed (or none), and that revision is
# started. Exits non-zero if any step failed; the caller then checks it and stops it.
ROLLBACK="$CLEAN_ENV$STATE_FN$STOP_FN$FENCE_WAIT_FN"'
set +e
dir="$1" project="$2" runid="$3" root="$4" prev="$5" wait="$6"
bad=0
cd "$dir" || exit 1
fence_wait "$dir/.stage-lock" "$runid" "$wait" || exit 1
[ -f "fleet-staging.env.pre-$runid" ] && cp -p "fleet-staging.env.pre-$runid" fleet-staging.env
[ -f "compose.yaml.pre-$runid" ] && cp -p "compose.yaml.pre-$runid" compose.yaml
if stop_project "$project"; then
  if [ -d "$root/state.pre-$runid" ]; then
    if mv "$root/state" "$root/state.failed-$runid" && mv "$root/state.pre-$runid" "$root/state"; then
      echo "rolled back the state; the failed state is state.failed-$runid"
    else
      echo "FAIL could not put the state folder back"; bad=1
    fi
  else
    [ -d "$root/state.pre-$runid.part" ] && mv "$root/state.pre-$runid.part" "$root/state.partial-$runid"
    echo "the state copy was not complete, so the new revision never started: state left as it was"
  fi
else
  echo "FAIL could not stop the test copy; its state folder was left alone"; bad=1
fi
# Whatever happened to the acknowledgement of recording the pass, it is undone in one rename.
write_state "$dir" "$prev" "" || { echo "FAIL could not restore stage-state"; bad=1; }
if [ "$bad" -eq 0 ]; then
  grep -v -e "^FLEET_REVISION=" -e "^FLEET_IMAGE=" fleet-staging.env > fleet-staging.env.new
  if [ -n "$prev" ]; then printf "FLEET_REVISION=%s\nFLEET_IMAGE=fleet-runner:%s\n" "$prev" "$prev" >> fleet-staging.env.new; fi
  chmod 0600 fleet-staging.env.new && mv fleet-staging.env.new fleet-staging.env || { echo "FAIL could not rewrite fleet-staging.env"; bad=1; }
  if [ "$bad" -eq 0 ] && [ -n "$prev" ]; then
    docker compose -p "$project" --env-file fleet-staging.env -f compose.yaml up -d --pull never >/dev/null 2>&1 ||
      { echo "FAIL could not start $prev"; bad=1; }
  fi
fi
exit "$bad"
'
# Called once, from the exit trap, for any way the run can end before it passed. Prints PASS only
# when every step worked.
do_rollback() {
  local ok=yes
  rolled_back=yes
  nas "$ROLLBACK" "$NAS_STAGE_DIR" "$STAGE_PROJECT" "$runid" "$NAS_STAGE_ROOT" "$prev" "${FLEET_FENCE_WAIT:-300}" || ok=no
  if [ "$ok" = yes ] && [ -n "$prev" ]; then
    wait_ready "$prev" || ok=no
  fi
  # Whatever happened, nothing of the test copy is left running, whatever revision it is (a failed
  # stop is a FAIL).
  if ! nas "$STOP" "$STAGE_PROJECT"; then
    say "FAIL could not confirm the test copy is stopped: look at it before staging again"
    return 1
  fi
  if [ "$ok" = yes ]; then
    if [ -n "$prev" ]; then say "PASS the test copy is back on $prev_label and stopped"; else say "PASS the test copy is back to its empty state and stopped"; fi
    return 0
  fi
  say "FAIL the test copy did not come back cleanly on $prev_label: look at it before staging again"
  return 1
}

# The switch begins here: from now on the exit trap puts things back on any failure.
switching=yes
nas "$SWITCH" "$NAS_STAGE_DIR" "$runid" "$STAGE_PROJECT" "$rev" "$NAS_STAGE_ROOT" "$image_id" "$manifest_digest" "$STAGE_PORT" "$STAGE_LAN_IP" || exit 1

# 4. Smoke tests from this Mac, as the test copy's own client.
wait_ready "$rev" || exit 1
stage_node smoke "$rev" || exit 1

# 5. The test copy goes back to rest, then the pass is recorded for the promote script. The state
# copies stay (nothing here deletes data); prune old state.pre-* folders by hand when needed.
if [ "$keep_running" = no ]; then
  nas "$STOP" "$STAGE_PROJECT" || { say "FAIL could not stop the test copy"; exit 1; }
  say "the test copy is stopped again (it runs only while a test is under way)"
fi
nas "$RECORD" "$NAS_STAGE_DIR" "$runid" "$rev" || { say "FAIL could not record the pass"; exit 1; }
passed=yes
say "PASS $short is staged and smoke-tested in $STAGE_PROJECT (was $prev_label)"
say "next: going live needs the owner's yes naming $short; promote is a separate step and is not run here"
