#!/usr/bin/env bash
# fleet-stage: put a FleetRunner release into the TEST COPY on the server, smoke-test it from this
# Mac, and put the previous test revision back on any failure (ojfbot/core#647, slices 2 and 3).
# It never touches production: it only uses the test copy's own project, folders, port and keys, and
# refuses to start unless the private config and the server agree those are its own.
#
#   scripts/fleet-stage.sh <revision> [--release <dir>] [--keep-running]
#
# <dir> holds fleet-runner-image.tar, its .sha256 and release.json (release-image.sh, or the CI
# artifact). Without --release it reuses the copy already on the server, else downloads the CI
# artifact of that revision, choosing the CI RUN, never the artifact name (see deployment.md):
#   - a push run on main of the workflow fleet-runner-release.yml whose head SHA is the revision, in
#     this repository, succeeded; else
#   - the newest successful workflow_dispatch rebuild run on main in this repository whose
#     release.json names the revision.
# Steps: verify the archive here with verify-release.sh check (needs node); copy it, and that
# revision's compose.yaml and load-release.sh, to the server; load it there with load-release.sh
# (re-hashes against the checked SHA-256, checks the image ID, platform and non-root); stop the test
# copy and copy its state folder aside; start the new revision; check the running image; then from
# this Mac, with the test copy's own keys: the signed status answers with exactly this revision, a
# signed job submit is accepted, and a worker claims the job (stage-smoke.mjs). On success the test
# copy is stopped again (it runs only while a test is under way; --keep-running leaves it up) and
# releases/<revision>/STAGED_OK is written, which the promote script requires; every run first
# clears all earlier ones. On failure it puts back the state folder, env file and compose.yaml,
# starts the previous revision, checks it answers as that revision, and stops it again.
# Config and folders: scripts/lib/fleet-stage-lib.sh.
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
downloaded=""
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
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
say "== stage $short into $STAGE_PROJECT ($stamp)"
check_isolation
# Only a run that passes below may leave a revision promotable: clear every earlier pass first.
nas 'rm -f "$1"/releases/*/STAGED_OK' "$NAS_STAGE_DIR"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/fleet-stage-$short.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

# Node, as the test copy's own client: its keys and CA only, nothing inherited from this shell.
stage_node() {
  (
    for v in $(env | grep -oE '^(FLEET_[A-Z_]*|STAGE_[A-Z_]*|NODE_EXTRA_CA_CERTS)=' | tr -d =); do unset "$v"; done
    export STAGE_URL="https://$STAGE_HOST:$STAGE_PORT" STAGE_KEYS_DIR
    export NODE_EXTRA_CA_CERTS="$STAGE_KEYS_DIR/ca.crt"
    node "$here/stage-smoke.mjs" "$@"
  )
}

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

# 1. The release: on the server already, given, or the CI artifact.
have_remote="$(nas '[ -f "$1/releases/$2/release.json" ] && echo yes || echo no' "$NAS_STAGE_DIR" "$rev")"
if [ "$have_remote" = no ]; then
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
# What the load checks against, read from the release that was verified (or, on a re-run, from the
# server's copy of it, which load-release.sh then re-hashes the archive against).
nas 'cat "$1/releases/$2/release.json"' "$NAS_STAGE_DIR" "$rev" >"$tmp/release.json"
[ "$(json_field revision <"$tmp/release.json")" = "$rev" ] || die "the release on the server is not for $short"
image_id="$(json_field image_id <"$tmp/release.json")"
manifest_digest="$(json_field manifest_digest <"$tmp/release.json")"
archive_sha="$(json_field archive_sha256 <"$tmp/release.json")"
tag="$(json_field tag <"$tmp/release.json")"
[ "$tag" = "fleet-runner:$rev" ] || die "release.json names an unexpected image tag"

# 2. Load and check the image there (the image store is shared; loading a new tag changes nothing
# running).
nas 'cd "$1/releases/$2" && sh load-release.sh fleet-runner-image.tar "$3" "$4" "$5" "$6"' \
  "$NAS_STAGE_DIR" "$rev" "$archive_sha" "$image_id" "$tag" "$manifest_digest"

# The smoke client is the one in this checkout, built here (pnpm only).
say "building the smoke client"
pnpm --filter @core/fleet-runner build >/dev/null || die "could not build the smoke client"

# 3. Switch the test copy, keeping what is needed to undo it. A test copy that has never held a
# revision has no previous one: then a rollback only restores the empty state.
prev="$(nas 'sed -n "s/^FLEET_REVISION=//p" "$1/fleet-staging.env" | tail -n 1' "$NAS_STAGE_DIR")"
if [ -n "$prev" ]; then
  prev_label="${prev:0:7}"
  say "previous test revision: $prev_label"
else
  prev_label="the empty state"
  say "no previous test revision"
fi
# The env and compose backups come first, so a rollback always has them; the state copy is only
# complete once it is renamed from .part.
SWITCH='
dir="$1" project="$2" rev="$3" stamp="$4" root="$5" image_id="$6" manifest_digest="$7"
cd "$dir"
[ -d "$root/state" ] || { echo "FAIL no test copy state folder"; exit 1; }
{ cp -p fleet-staging.env "fleet-staging.env.pre-$stamp.part" && mv "fleet-staging.env.pre-$stamp.part" "fleet-staging.env.pre-$stamp"; } ||
  { echo "FAIL backing up fleet-staging.env"; exit 1; }
{ cp -p compose.yaml "compose.yaml.pre-$stamp.part" && mv "compose.yaml.pre-$stamp.part" "compose.yaml.pre-$stamp"; } ||
  { echo "FAIL backing up compose.yaml"; exit 1; }
c="docker compose -p $project --env-file fleet-staging.env -f compose.yaml"
$c stop >/dev/null 2>&1 || true
cp -a "$root/state" "$root/state.pre-$stamp.part" || { echo "FAIL copying the test copy state folder"; exit 1; }
mv "$root/state.pre-$stamp.part" "$root/state.pre-$stamp"
{ cp "releases/$rev/compose.yaml" compose.yaml.new && mv compose.yaml.new compose.yaml; } || exit 1
grep -v -e "^FLEET_REVISION=" -e "^FLEET_IMAGE=" "fleet-staging.env.pre-$stamp" > fleet-staging.env.new || true
printf "FLEET_REVISION=%s\nFLEET_IMAGE=fleet-runner:%s\n" "$rev" "$rev" >> fleet-staging.env.new
{ chmod 0600 fleet-staging.env.new && mv fleet-staging.env.new fleet-staging.env; } || exit 1
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
# Works from any point SWITCH reached: what was saved is put back, what was not is left alone.
# Only finished backups are used; a leftover .part is ignored. Files are only changed after both
# backups finished, so a missing backup means its file was never changed. Starts the previous
# revision when there was one (its image is still loaded); the caller checks it and stops it.
ROLLBACK='
set +e
dir="$1" project="$2" stamp="$3" root="$4"
cd "$dir" || exit 1
[ -f "fleet-staging.env.pre-$stamp" ] && cp -p "fleet-staging.env.pre-$stamp" fleet-staging.env
[ -f "compose.yaml.pre-$stamp" ] && cp -p "compose.yaml.pre-$stamp" compose.yaml
c="docker compose -p $project --env-file fleet-staging.env -f compose.yaml"
$c stop >/dev/null 2>&1
if [ -d "$root/state.pre-$stamp" ]; then
  mv "$root/state" "$root/state.failed-$stamp" && mv "$root/state.pre-$stamp" "$root/state" &&
    echo "rolled back the state; the failed state is state.failed-$stamp"
else
  [ -d "$root/state.pre-$stamp.part" ] && mv "$root/state.pre-$stamp.part" "$root/state.partial-$stamp"
  echo "the state copy was not complete, so the new revision never started: state left as it was"
fi
echo "rolled back fleet-staging.env and compose.yaml from $stamp"
if grep -q "^FLEET_REVISION=." fleet-staging.env; then $c up -d --pull never >/dev/null 2>&1; fi
'
rollback() {
  say "FAIL $short did not pass in the test copy; rolling back to $prev_label"
  nas "$ROLLBACK" "$NAS_STAGE_DIR" "$STAGE_PROJECT" "$stamp" "$NAS_STAGE_ROOT" || true
  if [ -z "$prev" ]; then
    nas 'cd "$1" && docker compose -p "$2" --env-file fleet-staging.env -f compose.yaml stop >/dev/null 2>&1 || true' "$NAS_STAGE_DIR" "$STAGE_PROJECT"
    say "PASS the test copy is back to its empty state and stopped"
  elif wait_ready "$prev"; then
    say "PASS the test copy is back on ${prev:0:7}"
    nas 'cd "$1" && docker compose -p "$2" --env-file fleet-staging.env -f compose.yaml stop >/dev/null 2>&1 || true' "$NAS_STAGE_DIR" "$STAGE_PROJECT"
  else
    say "FAIL the test copy did not come back on ${prev:0:7}: look at it before staging again"
  fi
  exit 1
}

nas "$SWITCH" "$NAS_STAGE_DIR" "$STAGE_PROJECT" "$rev" "$stamp" "$NAS_STAGE_ROOT" "$image_id" "$manifest_digest" || rollback

# 4. Smoke tests from this Mac, as the test copy's own client.
wait_ready "$rev" || rollback
stage_node smoke "$rev" || rollback

# 5. The pass is recorded for the promote script, and the test copy goes back to rest. The state
# copies stay (nothing here deletes data); prune old state.pre-* folders by hand when needed.
if [ "$keep_running" = no ]; then
  nas 'cd "$1" && docker compose -p "$2" --env-file fleet-staging.env -f compose.yaml stop >/dev/null 2>&1 || true' "$NAS_STAGE_DIR" "$STAGE_PROJECT"
  say "the test copy is stopped again (it runs only while a test is under way)"
fi
nas 'printf "%s staged and smoke-tested\n" "$3" > "$1/releases/$2/STAGED_OK"' "$NAS_STAGE_DIR" "$rev" "$stamp"
say "PASS $short is staged and smoke-tested in $STAGE_PROJECT (was $prev_label)"
say "next: going live needs the owner's yes naming $short; promote is a separate step and is not run here"
