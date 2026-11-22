#!/usr/bin/env bash
# Verify a FleetRunner release before anything runs it (#647, slice 1). The stage script runs this
# on the CI artifact of a revision; CI runs it on the release it just built.
#
#   verify-release.sh check <release-directory> [revision]   checksum and release.json, no Docker
#   verify-release.sh load  <release-directory> [revision]   check, then load and inspect the image
#
# The release directory holds fleet-runner-image.tar, fleet-runner-image.tar.sha256 and
# release.json from release-image.sh. [revision] is a full commit or any unambiguous prefix of
# one; when given, release.json must name that commit. Needs only bash, sed, awk and a SHA-256
# tool (plus Docker for `load`). Prints PASS or FAIL lines and digests, nothing else.
# Bash 3 compatible (macOS /bin/bash).
set -euo pipefail

usage() {
  echo "usage: verify-release.sh check|load <release-directory> [revision]" >&2
  exit 2
}
[[ $# -ge 2 && $# -le 3 ]] || usage
mode="$1"
dir="$2"
want_rev="${3:-}"
case "$mode" in check | load) ;; *) usage ;; esac

fail() {
  echo "FAIL $1"
  exit 1
}

[[ -f "$dir/release.json" ]] || fail "release.json missing"

# release.json is written with two-space indent; the flat fields sit at the top level.
field() {
  sed -n "s/^  \"$1\": \"\([^\"]*\)\".*/\1/p" "$dir/release.json" | head -n 1
}
format="$(field format)"
revision="$(field revision)"
image_id="$(field image_id)"
manifest_digest="$(field manifest_digest)"
tag="$(field tag)"
archive="$(field archive)"
archive_sha256="$(field archive_sha256)"
platform="$(field platform)"
user="$(field user)"

[[ "$format" == "fleet-runner-release/1" ]] || fail "release.json format"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || fail "release.json has no full revision"
[[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "release.json has no image_id"
[[ -z "$manifest_digest" || "$manifest_digest" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "release.json manifest_digest"
[[ "$archive" == "fleet-runner-image.tar" ]] || fail "release.json archive name"
[[ "$archive_sha256" =~ ^[0-9a-f]{64}$ ]] || fail "release.json archive_sha256"
[[ "$tag" == "fleet-runner:$revision" ]] || fail "release.json tag does not match the revision"
[[ "$platform" == "linux/amd64" && "$user" == "node" ]] || fail "release.json platform or user"

if [[ -n "$want_rev" ]]; then
  [[ "$want_rev" =~ ^[0-9a-f]{7,40}$ ]] || fail "revision is not a hex commit prefix"
  case "$revision" in
    "$want_rev"*) echo "PASS revision $revision" ;;
    *) fail "release is revision $revision, not $want_rev" ;;
  esac
fi

[[ -f "$dir/$archive" && -f "$dir/$archive.sha256" ]] || fail "archive or checksum file missing"

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}
actual="$(sha256_of "$dir/$archive")"
recorded="$(awk '{print $1}' "$dir/$archive.sha256" | head -n 1)"
if [[ "$actual" == "$recorded" && "$actual" == "$archive_sha256" ]]; then
  echo "PASS archive checksum $actual"
else
  fail "archive checksum"
fi

[[ "$mode" == "load" ]] || exit 0

matches() {
  [[ "$1" == "$image_id" ]] || { [[ -n "$manifest_digest" && "$1" == "$manifest_digest" ]]; }
}

docker image load --input "$dir/$archive" >/dev/null
loaded="$(docker image inspect --format '{{.Id}}' "$tag")"
loaded_platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$tag")"
loaded_user="$(docker image inspect --format '{{.Config.User}}' "$tag")"
if matches "$loaded"; then echo "PASS image ID $loaded"; else fail "image ID $loaded"; fi
if [[ "$loaded_platform" == "linux/amd64" && "$loaded_user" == "node" ]]; then
  echo "PASS linux/amd64 as user node"
else
  fail "platform or user"
fi
# The configured user name could still map to root; ask the image which numeric user it runs as.
uid="$(docker run --rm --platform linux/amd64 --network none --entrypoint node "$tag" -p 'process.getuid()')"
if [[ "$uid" =~ ^[0-9]+$ && "$uid" != "0" ]]; then echo "PASS non-root (uid $uid)"; else fail "image runs as root"; fi
