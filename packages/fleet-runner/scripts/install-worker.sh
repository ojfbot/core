#!/bin/sh
# Reuses the LocalHelp device release install layout and signature checks (PR 30).
# Install one FleetRunner worker release into an install root.
#
#   sh install.sh --root <install root> --node <official node binary> [--bundle <fleet-runner.mjs>]
#
# It makes <install root>/worker/<version>/ holding:
#
#   fleet-runner.mjs   the bundle (pnpm build writes it to dist/release/)
#   node                  a copy of the Node binary the operator supplied
#   manifest.json         worker version, commit, Node version, SHA-256 of both files
#
# and then repoints <install root>/worker/current at it, atomically.
#
# It downloads nothing. It never replaces an existing version folder, and writes nowhere outside
# <install root>/worker/, so the device key folder beside it (device/) is never touched.
#
# The Node binary must be an official build: signed by the Node.js project's Developer ID, checked
# with codesign before anything runs it. It must also be the bundle's Node line, at or above the
# floor stamped into the bundle. This is a shell script so that no Node, least of all the one
# being checked, has to run the check.
set -eu
umask 077

# The Node.js project's Developer ID team, as on the macOS builds from nodejs.org.
NODE_TEAM_ID=HX7739G8FX
REQUIREMENT="identifier node and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists and certificate leaf[subject.OU] = $NODE_TEAM_ID"

usage() {
  echo "usage: sh install.sh --root <install root> --node <official node binary> [--bundle <fleet-runner.mjs>]" >&2
  exit 2
}
refuse() {
  echo "install: $1" >&2
  exit 1
}

root=""
node=""
bundle="$(dirname "$0")/../dist/release/fleet-runner.mjs"
while [ $# -gt 0 ]; do
  [ $# -ge 2 ] || usage
  case "$1" in
    --root) root=$2 ;;
    --node) node=$2 ;;
    --bundle) bundle=$2 ;;
    *) usage ;;
  esac
  shift 2
done
[ -n "$root" ] && [ -n "$node" ] || usage
case "$root" in /*) ;; *) refuse "the install root must be an absolute path" ;; esac
case "$node" in /*) ;; *) refuse "the Node binary must be an absolute path" ;; esac
[ -f "$node" ] || refuse "the Node binary does not exist"
[ -f "$bundle" ] || refuse "the bundle does not exist: run pnpm build, or pass --bundle"

# 1. The signature, before anything runs the binary. The override exists for the tests, which run
#    where there is no codesign or no official Node at the floor; the manifest records its use.
codesign=${FLEET_RUNNER_INSTALL_CODESIGN:-/usr/bin/codesign}
if [ "$codesign" = /usr/bin/codesign ]; then
  checked_by=/usr/bin/codesign
  [ -x "$codesign" ] || refuse "the signature check needs macOS codesign (/usr/bin/codesign)"
else
  checked_by=override
  echo "install: WARNING: the signature check is overridden (FLEET_RUNNER_INSTALL_CODESIGN); do not use this release" >&2
fi
signed() {
  "$codesign" --verify --strict -R="$REQUIREMENT" "$1" >/dev/null 2>&1
}
signed "$node" || refuse "the Node binary is not an official build: its code signature is not the Node.js project's Developer ID ($NODE_TEAM_ID)"

# 2. What the bundle is, as it says itself when this Node runs it.
field() {
  printf '%s\n' "$info" | sed -n "s/^  \"$1\": \"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}\$/\1/p"
}
numbers() {
  # "24.22.2" -> "24 22 2", or nothing if it is not three plain numbers.
  printf '%s\n' "$1" | sed -n 's/^\([0-9][0-9]*\)\.\([0-9][0-9]*\)\.\([0-9][0-9]*\)$/\1 \2 \3/p'
}
describe() {
  info=$("$1" "$2" version 2>/dev/null) || refuse "this Node could not run the bundle"
  [ "$(field name)" = fleet-runner ] && [ "$(field bundled)" = true ] ||
    refuse "the bundle is not a fleet-runner bundle (use dist/release/fleet-runner.mjs)"
  version=$(field version)
  commit=$(field commit)
  floor=$(field node_floor)
}
describe "$node" "$bundle"
[ -n "$(numbers "$version")" ] || refuse "the bundle's version is not of the form 1.2.3"
[ -n "$(numbers "$floor")" ] || refuse "the bundle's Node floor is not of the form 1.2.3"
printf '%s\n' "$commit" | grep -Eq '^[0-9a-f]{40}$' ||
  refuse "the bundle was not built from a clean commit (its stamp is \"$commit\"): commit, then pnpm build"

# 3. The Node version: the bundle's Node line, at or above its floor.
node_version=$("$node" --version)
have=$(numbers "${node_version#v}")
[ -n "$have" ] || refuse "the Node binary did not print a version of the form v1.2.3"
at_least() {
  # shellcheck disable=SC2046,SC2086
  set -- $have $(numbers "$floor")
  [ "$1" -eq "$4" ] || return 1
  [ "$2" -gt "$5" ] || { [ "$2" -eq "$5" ] && [ "$3" -ge "$6" ]; }
}
at_least || refuse "Node $node_version is not supported: this release needs Node ${floor%%.*}, at least $floor"

# 4. The version folder. mkdir claims it: an existing one is never replaced or added to.
worker="$root/worker"
target="$worker/$version"
mkdir -p "$worker"
[ -z "$(find "$worker" -maxdepth 0 \( -perm -020 -o -perm -002 \))" ] ||
  refuse "$worker must not be writable by group or others: chmod 700 it"
if [ -e "$worker/current" ] && [ ! -L "$worker/current" ]; then
  refuse "$worker/current exists and is not a link; move it away first"
fi
mkdir "$target" 2>/dev/null ||
  refuse "version $version is already installed at $target; a version folder is never replaced"
link="$worker/.current.$$"
cleanup() {
  rm -rf "$target"
  rm -f "$link"
}
trap cleanup EXIT
trap 'exit 1' INT TERM HUP

sha256() {
  if [ -x /usr/bin/shasum ]; then
    /usr/bin/shasum -a 256 "$1" | cut -d' ' -f1
  else
    sha256sum "$1" | cut -d' ' -f1
  fi
}
cp "$bundle" "$target/fleet-runner.mjs"
cp "$node" "$target/node"
chmod 400 "$target/fleet-runner.mjs"
chmod 500 "$target/node"

# 5. Check the copies, not the originals: same bytes, still signed, and they run.
bundle_sha=$(sha256 "$target/fleet-runner.mjs")
node_sha=$(sha256 "$target/node")
[ "$bundle_sha" = "$(sha256 "$bundle")" ] && [ "$node_sha" = "$(sha256 "$node")" ] ||
  refuse "a copied file does not match its source"
signed "$target/node" || refuse "the copied Node binary lost its code signature"
wanted="$version $commit"
describe "$target/node" "$target/fleet-runner.mjs"
[ "$version $commit" = "$wanted" ] || refuse "the installed release does not report $wanted"

cat >"$target/manifest.json.tmp" <<EOF
{
  "name": "fleet-runner",
  "version": "$version",
  "commit": "$commit",
  "node_version": "$node_version",
  "node_signature": {
    "team_id": "$NODE_TEAM_ID",
    "checked_by": "$checked_by"
  },
  "files": {
    "fleet-runner.mjs": { "sha256": "$bundle_sha" },
    "node": { "sha256": "$node_sha" }
  }
}
EOF
chmod 400 "$target/manifest.json.tmp"
mv "$target/manifest.json.tmp" "$target/manifest.json"

# 6. Repoint current: a new link renamed over the old one, so there is no moment without it.
ln -s "$version" "$link"
case "$(uname)" in
  Darwin) mv -fh "$link" "$worker/current" ;;
  *) mv -fT "$link" "$worker/current" ;;
esac
trap - EXIT

echo "installed fleet-runner $version ($commit) with Node $node_version"
echo "  $target"
echo "  $worker/current -> $version"
echo "next:"
echo "  - settings: $root/fleet-runner.json (README, \"Set up a device\")"
echo "  - a Node build this Mac has not run a login job with needs its own Local Network check (README, \"Login jobs\")"
