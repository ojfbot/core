#!/usr/bin/env bash
# Verify a FleetRunner release before anything runs it (#647, slice 1). The stage script runs this
# on the CI artifact of a revision; CI runs it on the release it just built.
#
#   verify-release.sh check <release-directory> [revision]   checksum and release.json, no Docker
#   verify-release.sh load  <release-directory> [revision]   check, then load and inspect the image
#
# The release directory holds fleet-runner-image.tar, fleet-runner-image.tar.sha256 and
# release.json from release-image.sh. [revision] is a full commit or any unambiguous prefix of
# one; when given, release.json must name that commit. Needs bash, sed, awk, node and a
# SHA-256 tool (plus Docker for `load`). Prints PASS or FAIL lines and digests, nothing else.
# Bash 3 compatible (macOS /bin/bash).
#
# On a server without node, run `check` here (Mac or CI) first, then copy the archive and run
# `sh load-release.sh <archive> <archive-sha256> <image-id> <tag> [manifest-digest]` there with the
# values from release.json: it needs only POSIX sh and re-hashes the archive against the checked
# SHA-256 before loading.
set -euo pipefail
# Locate the sibling scripts with shell builtins only: this must work, and must reach the checks
# below, on a PATH that holds nothing but the tools they use.
script_path="${BASH_SOURCE[0]}"
case "$script_path" in
  */*) script_dir="$(cd "${script_path%/*}" && pwd)" ;;
  *) script_dir="$(pwd)" ;;
esac

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

# A checksum only proves the files agree with each other. Read what the archive itself says it is,
# before anything is loaded: see verify-archive.mjs for the exact-allowlist rule. This needs node
# (Node 24 is a fleet prerequisite) and runs on the Mac or in CI; without node it fails rather than
# being skipped. The server half, which needs no node, is load-release.sh.
command -v node >/dev/null 2>&1 || fail "node is required to read the archive"
node "$script_dir/verify-archive.mjs" "$dir/$archive" "$dir/release.json" "$tag" "$image_id" "$manifest_digest" || exit 1

[[ "$mode" == "load" ]] || exit 0

# Load here with the same script the server runs, given the values just checked.
sh "$script_dir/load-release.sh" "$dir/$archive" "$actual" "$image_id" "$tag" "$manifest_digest"
