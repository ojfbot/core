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

# A checksum only proves the files agree with each other. Before anything is loaded, read what the
# archive itself says it is, with a real JSON parser (a regex can be fooled by spaced keys or decoy
# fields in a nested object, and Docker would load the real ones): exactly one image, whose actual
# top-level Config hashes to image_id, whose RepoTags are exactly [release tag], and (when recorded)
# whose index names manifest_digest. Members that appear twice are refused. A different archive
# cannot pass by sharing a tag the host already has. Needs node (Node 24 is a fleet prerequisite);
# without it the check fails rather than being skipped.
command -v node >/dev/null 2>&1 || fail "node is required to read the archive"
node --input-type=module - "$dir/$archive" "$dir/release.json" "$tag" "$image_id" "$manifest_digest" <<'NODE' || exit 1
import { createHash } from "node:crypto";
import { fstatSync, openSync, readFileSync, readSync } from "node:fs";
const [archive, releaseFile, tag, imageId, manifestDigest] = process.argv.slice(2);
const fail = (why) => {
  console.log(`FAIL ${why}`);
  process.exit(1);
};
// Read the tar headers here instead of asking `tar` to list them, so the names and types checked
// are the ones whose bytes are read, from one parse. Only plain ustar is accepted: regular files
// and directories, canonical names, no pax or GNU extension records, no links, no name prefix.
// (BuildKit's docker export is exactly that.)
const MAX_MEMBER = 1 << 24;
const fd = openSync(archive, "r");
const total = fstatSync(fd).size;
const members = [];
const header = Buffer.alloc(512);
const text = (from, length) => header.toString("latin1", from, from + length).replace(/\0.*$/s, "");
for (let pos = 0; ; ) {
  if (pos + 512 > total) fail("archive is truncated");
  readSync(fd, header, 0, 512, pos);
  if (header.every((byte) => byte === 0)) break;
  if (text(257, 6) !== "ustar") fail("archive is not plain ustar");
  const name = text(0, 100);
  const kind = header[156] === 0 ? "0" : String.fromCharCode(header[156]);
  const octal = text(124, 12).trim();
  if (!/^[0-7]+$/.test(octal)) fail("archive member size");
  const size = parseInt(octal, 8);
  if (text(345, 155) !== "") fail("archive member has a name prefix");
  if (kind !== "0" && kind !== "5") fail("archive has a member that is not a plain file or directory");
  const canonical =
    /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\/?$/.test(name) && !name.split("/").some((part) => part === "." || part === "..");
  if (!canonical || (kind === "0") === name.endsWith("/")) fail("archive has a member that is not canonically named");
  const dataStart = pos + 512;
  const next = dataStart + Math.ceil(size / 512) * 512;
  if (next > total) fail("archive is truncated");
  members.push({ name, kind, dataStart, size });
  pos = next;
}
const count = (name) => members.filter((m) => m.name === name && m.kind === "0").length;
const read = (name) => {
  if (count(name) !== 1) return null;
  const member = members.find((m) => m.name === name && m.kind === "0");
  if (member.size > MAX_MEMBER) fail("archive member is too large to check");
  const buf = Buffer.alloc(member.size);
  readSync(fd, buf, 0, member.size, member.dataStart);
  return buf;
};
const parse = (buf, what) => {
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return fail(`${what} is not valid JSON`);
  }
};
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// release.json, read as JSON, must say what the shell read from it (no duplicate or decoy keys).
const release = parse(readFileSync(releaseFile), "release.json");
if (!isObject(release) || release.tag !== tag || release.image_id !== imageId || (release.manifest_digest ?? "") !== manifestDigest) {
  fail("release.json differs between its text and its JSON");
}

const manifestBytes = read("manifest.json");
if (manifestBytes === null) fail("archive has no single manifest.json");
const manifest = parse(manifestBytes, "manifest.json");
if (!Array.isArray(manifest) || manifest.length !== 1 || !isObject(manifest[0])) {
  fail("archive does not hold exactly one image");
}
const entry = manifest[0];
if (typeof entry.Config !== "string" || !/^(blobs\/sha256\/)?[0-9a-f]{64}(\.json)?$/.test(entry.Config)) {
  fail("archive config name");
}
const config = read(entry.Config);
if (config === null) fail("archive has no single config blob");
const actualId = `sha256:${createHash("sha256").update(config).digest("hex")}`;
if (actualId !== imageId) fail(`archive image ID is ${actualId}, not the recorded one`);
if (!Array.isArray(entry.RepoTags) || entry.RepoTags.length !== 1 || entry.RepoTags[0] !== tag) {
  fail(`archive tags are not exactly ${tag}`);
}
// An index.json, when present, is part of what Docker loads: always parse it, require exactly one
// manifest, and require the release to record that manifest's digest.
const indexBytes = read("index.json");
if (indexBytes === null && count("index.json") > 0) fail("archive has more than one index.json");
if (indexBytes === null && manifestDigest !== "") fail("archive has no single index.json");
if (indexBytes !== null) {
  const index = parse(indexBytes, "index.json");
  if (!isObject(index) || !Array.isArray(index.manifests) || index.manifests.length !== 1) {
    fail("archive index does not hold exactly one manifest");
  }
  if (manifestDigest === "" || index.manifests[0]?.digest !== manifestDigest) {
    fail("archive manifest digest is not the recorded one");
  }
}
console.log(`PASS archive holds ${tag} with image ID ${imageId}`);
NODE

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
