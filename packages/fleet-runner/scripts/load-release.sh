#!/bin/sh
# Load a FleetRunner release image on the server and check what was loaded (#647, slice 1).
#
#   sh load-release.sh <archive> <archive-sha256> <image-id> <tag> [manifest-digest]
#
# This is the half of verification that runs where the image will run. The server need not have
# node or bash: the full archive check (verify-release.sh check, which needs node) runs earlier, on
# the Mac or in CI, and prints the values passed here. This script then does only what ties the
# bytes in front of it to that check:
#   1. the archive's SHA-256 equals the checked value, before anything is loaded;
#   2. docker image load;
#   3. the loaded image's ID equals the checked image ID (or its manifest digest, which an engine
#      with the containerd image store reports as the ID);
#   4. linux/amd64, configured user node, and a numeric non-root uid.
# POSIX sh, sed, awk and sha256sum (or shasum) only. Prints PASS or FAIL lines, nothing else.
set -eu

usage() {
  echo "usage: load-release.sh <archive> <archive-sha256> <image-id> <tag> [manifest-digest]" >&2
  exit 2
}
[ "$#" -ge 4 ] && [ "$#" -le 5 ] || usage
archive="$1"
want_sha="$2"
image_id="$3"
tag="$4"
manifest_digest="${5:-}"

fail() {
  echo "FAIL $1"
  exit 1
}

is_hex64() {
  [ "${#1}" -eq 64 ] && [ -z "$(printf '%s' "$1" | tr -d '0-9a-f')" ]
}
is_hex64 "$want_sha" || fail "archive checksum argument"
case "$image_id" in sha256:*) is_hex64 "${image_id#sha256:}" || fail "image ID argument" ;; *) fail "image ID argument" ;; esac
case "$manifest_digest" in
  "") ;;
  sha256:*) is_hex64 "${manifest_digest#sha256:}" || fail "manifest digest argument" ;;
  *) fail "manifest digest argument" ;;
esac
case "$tag" in fleet-runner:*) ;; *) fail "tag argument" ;; esac
[ -f "$archive" ] || fail "archive missing"

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$archive" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
fi
if [ "$actual" = "$want_sha" ]; then echo "PASS archive checksum $actual"; else fail "archive checksum"; fi

docker image load --input "$archive" >/dev/null
loaded="$(docker image inspect --format '{{.Id}}' "$tag")"
if [ "$loaded" = "$image_id" ] || { [ -n "$manifest_digest" ] && [ "$loaded" = "$manifest_digest" ]; }; then
  echo "PASS image ID $loaded"
else
  fail "image ID $loaded"
fi
platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$tag")"
user="$(docker image inspect --format '{{.Config.User}}' "$tag")"
if [ "$platform" = "linux/amd64" ] && [ "$user" = "node" ]; then
  echo "PASS linux/amd64 as user node"
else
  fail "platform or user"
fi
# The configured user name could still map to root; ask the image which numeric user it runs as.
uid="$(docker run --rm --platform linux/amd64 --network none --entrypoint node "$tag" -p 'process.getuid()')"
case "$uid" in
  "" | 0 | *[!0-9]*) fail "image runs as root" ;;
  *) echo "PASS non-root (uid $uid)" ;;
esac
