#!/usr/bin/env bash
# Build a FleetRunner release image from one commit and prove it reproducible (#647, slice 1).
#
#   packages/fleet-runner/scripts/release-image.sh <new-release-directory> [commit]
#
# 1. Exports only the build inputs of the commit (default HEAD) with git archive, so nothing
#    uncommitted, untracked or ignored can reach the build context.
# 2. Builds the linux/amd64 runtime image twice, without cache, with SOURCE_DATE_EPOCH set to the
#    commit time and timestamps rewritten, and requires the two image IDs (config digests, which
#    cover every layer's content) to be identical.
# 3. Writes the release: fleet-runner-image.tar, its SHA-256 file and release.json (the image ID,
#    the manifest digest, the source commit and the build inputs). Deploy by that image ID.
# 4. Loads the image into the local engine as fleet-runner:<commit> and checks it with
#    verify-release.sh, the same check the stage script runs before it starts anything.
#
# Needs Docker with Buildx. Each build runs in a new BuildKit container builder from a pinned
# image, removed afterwards. Prints counts and digests only: no paths, hosts or secrets.
# Bash 3 compatible (macOS /bin/bash): no associative arrays, no mapfile.
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: release-image.sh <new-release-directory> [commit]" >&2
  exit 2
fi
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
out="$1"
commit="$(git -C "$repo_root" rev-parse --verify "${2:-HEAD}^{commit}")"
if [[ -e "$out" ]]; then
  echo "release-image: the release directory already exists; refusing to overwrite it" >&2
  exit 1
fi
if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
  echo "release-image: note: the working tree has changes; the image is built from the commit only" >&2
fi
mkdir -p "$out"
out="$(cd "$out" && pwd)"

context="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/fleet-runner-release.XXXXXX")"
builders=()
cleanup() {
  local b
  if [[ ${#builders[@]} -gt 0 ]]; then
    for b in "${builders[@]}"; do
      docker buildx rm --force "$b" >/dev/null 2>&1 || true
    done
  fi
  rm -rf "$context"
}
trap cleanup EXIT

# The build inputs named by the Dockerfile; Dockerfile.dockerignore narrows them further.
git -C "$repo_root" archive --format=tar "$commit" \
  -- package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json packages/fleet-runner \
  | tar -x -C "$context"

epoch="$(git -C "$repo_root" log -1 --format=%ct "$commit")"
short="$(git -C "$repo_root" rev-parse --short=12 "$commit")"
tag="fleet-runner:${commit}"
platform="linux/amd64"
dockerfile="$context/packages/fleet-runner/Dockerfile"
# The archive exporter with rewritten timestamps needs a BuildKit container builder; the engine's
# built-in driver cannot export. The BuildKit image is pinned like the base image.
BUILDKIT_IMAGE="moby/buildkit:v0.34.1@sha256:99368f3e46177c6405b9740e4461d91cee004128daeecca78d4ceac50ec1da5c"

# Each build gets its own fresh builder, so the second shares no state with the first.
build() {
  local n="$1" builder started ended
  builder="fleet-runner-release-$n-$$"
  builders+=("$builder")
  docker buildx create --name "$builder" --driver docker-container \
    --driver-opt "image=$BUILDKIT_IMAGE" >/dev/null
  started="$(date +%s)"
  SOURCE_DATE_EPOCH="$epoch" docker buildx build --builder "$builder" \
    --platform "$platform" --no-cache --provenance=false --sbom=false \
    --build-arg "SOURCE_DATE_EPOCH=$epoch" \
    --target runtime --tag "$tag" \
    --output "type=docker,dest=$out/build-$n.tar,rewrite-timestamp=true" \
    --file "$dockerfile" "$context" > "$out/build-$n.log" 2>&1 || {
      tail -n 60 "$out/build-$n.log" >&2
      return 1
    }
  ended="$(date +%s)"
  echo $(( ended - started )) > "$out/build-$n.seconds"
}

# The image ID is the config blob's digest, named in the archive's manifest.json; the manifest
# digest is index.json's, which an engine using the containerd image store reports as the ID.
identity() {
  node --input-type=module - "$1" <<'NODE'
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const archive = process.argv[2];
const read = (name) => execFileSync("tar", ["-xOf", archive, name], { maxBuffer: 1 << 26 });
const manifest = JSON.parse(read("manifest.json"))[0];
const config = read(manifest.Config);
let manifestDigest = null;
try {
  manifestDigest = JSON.parse(read("index.json")).manifests[0].digest;
} catch {}
console.log(JSON.stringify({
  image_id: `sha256:${createHash("sha256").update(config).digest("hex")}`,
  manifest_digest: manifestDigest,
  layers: manifest.Layers.length,
}));
NODE
}

build 1
build 2
first="$(identity "$out/build-1.tar")"
second="$(identity "$out/build-2.tar")"
if [[ "$first" != "$second" ]]; then
  echo "release-image: the two builds differ: $first vs $second" >&2
  exit 1
fi

mv "$out/build-1.tar" "$out/fleet-runner-image.tar"
rm -f "$out/build-2.tar" "$out"/build-*.log
(cd "$out" && { sha256sum fleet-runner-image.tar 2>/dev/null || shasum -a 256 fleet-runner-image.tar; } > fleet-runner-image.tar.sha256)

node --input-type=module - "$out" "$commit" "$short" "$epoch" "$tag" "$first" "$context" <<'NODE'
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [out, commit, short, epoch, tag, identity, root] = process.argv.slice(2);
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const dockerfile = readFileSync(join(root, "packages/fleet-runner/Dockerfile"), "utf8");
const base = /^FROM (node:\S+@sha256:[0-9a-f]{64}) AS runtime$/m.exec(dockerfile)?.[1] ?? "unknown";
const pnpm = /corepack prepare pnpm@(\S+) --activate/.exec(dockerfile)?.[1] ?? "unknown";
const { image_id, manifest_digest, layers } = JSON.parse(identity);
const seconds = [1, 2].map((n) => Number(readFileSync(join(out, `build-${n}.seconds`), "utf8")));
// Flat fields first: verify-release.sh reads them with sed, so it needs nothing but a shell.
const release = {
  format: "fleet-runner-release/1",
  revision: commit,
  short_revision: short,
  source_date_epoch: Number(epoch),
  tag,
  platform: "linux/amd64",
  user: "node",
  image_id,
  manifest_digest,
  layers,
  archive: "fleet-runner-image.tar",
  archive_sha256: sha(join(out, "fleet-runner-image.tar")),
  inputs: {
    base_image: base,
    pnpm,
    buildkit: "moby/buildkit:v0.34.1@sha256:99368f3e46177c6405b9740e4461d91cee004128daeecca78d4ceac50ec1da5c",
    lockfile_sha256: sha(join(root, "pnpm-lock.yaml")),
  },
  reproducibility: { builds: 2, identical: true, seconds },
};
writeFileSync(join(out, "release.json"), `${JSON.stringify(release, null, 2)}\n`);
for (const n of [1, 2]) rmSync(join(out, `build-${n}.seconds`));
console.log(JSON.stringify({ revision: commit, image_id, manifest_digest, identical: true }));
NODE

# Load it here and run the consumer's own check, so CI proves what the stage script will rely on.
bash "$script_dir/verify-release.sh" load "$out" "$commit"
