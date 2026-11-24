#!/usr/bin/env bash
# Fetch the two approved G0 baseline commits that scripts/fleet-runner/verify-contract.mjs reads.
# Neither is on a default branch, so each is fetched by exact SHA (no tag or branch is needed).
# Core's commit goes into the current checkout; BookcaseDiscovery's into a fresh directory.
# Prints the client directory on stdout. Usage: fetch-g0-baselines.sh <client-dir>
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
contract="$here/verify-contract.mjs"
core_sha="$(sed -n 's/^const CORE_BASELINE = "\([0-9a-f]\{40\}\)";$/\1/p' "$contract")"
client_sha="$(sed -n 's/^const CLIENT_BASELINE = "\([0-9a-f]\{40\}\)";$/\1/p' "$contract")"
[ -n "$core_sha" ] && [ -n "$client_sha" ] || { echo "could not read the baseline SHAs from $contract" >&2; exit 1; }
client_dir="${1:?usage: fetch-g0-baselines.sh <client-dir>}"

fetch_sha() { # <git-dir-args...> -- <url> <sha>
  local url="$1" sha="$2"; shift 2
  git "$@" fetch --quiet --no-tags "$url" "$sha" || { sleep 5; git "$@" fetch --quiet --no-tags "$url" "$sha"; }
}

core_root="$(git rev-parse --show-toplevel)"
if ! git cat-file -e "$core_sha^{commit}" 2>/dev/null; then
  fetch_sha https://github.com/ojfbot/core "$core_sha" -C "$core_root" || true
fi
git cat-file -e "$core_sha^{commit}" 2>/dev/null \
  || { echo "G0 baseline: Core commit $core_sha is not reachable from github.com/ojfbot/core; it may have been deleted with its branch" >&2; exit 1; }

rm -rf "$client_dir"
git init --quiet "$client_dir"
fetch_sha https://github.com/ojfbot/BookcaseDiscovery "$client_sha" -C "$client_dir" || true
git -C "$client_dir" cat-file -e "$client_sha^{commit}" 2>/dev/null \
  || { echo "G0 baseline: BookcaseDiscovery commit $client_sha is not reachable from github.com/ojfbot/BookcaseDiscovery; it may have been deleted with its branch" >&2; exit 1; }
echo "$client_dir"
