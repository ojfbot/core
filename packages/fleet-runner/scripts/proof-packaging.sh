#!/usr/bin/env bash
set -euo pipefail

if (( $# > 1 )); then
  echo "usage: proof-packaging.sh [new-evidence-directory]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
package_dir="$repo_root/packages/fleet-runner"
dockerfile="$package_dir/Dockerfile"
invocation_dir="$PWD"
cd "$repo_root"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/fleet-runner-proof.XXXXXX")"
suffix="$(basename "$temp_root" | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]')"
image_tag="fleet-runner:packaging-proof-$suffix"
container_name="fleet-runner-proof-$suffix"
state_volume="fleet-runner-proof-state-$suffix"
output_volume="fleet-runner-proof-output-$suffix"
probe_volume="fleet-runner-proof-probe-$suffix"
registry_volume="fleet-runner-proof-registry-$suffix"
bad_schema_volume="fleet-runner-proof-bad-schema-$suffix"
container_id=""

context_files=(
  package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json
  packages/fleet-runner/package.json packages/fleet-runner/LICENSE
  packages/fleet-runner/README.md packages/fleet-runner/deployment.md
  packages/fleet-runner/tsconfig.json packages/fleet-runner/Dockerfile
  packages/fleet-runner/Dockerfile.dockerignore
  packages/fleet-runner/docker-entrypoint.mjs
)
while IFS= read -r file; do [[ -n "$file" ]] && context_files+=("$file"); done < <(
  find packages/fleet-runner/src packages/fleet-runner/scripts -type f -print | sort
)
for file in "${context_files[@]}"; do
  git -C "$repo_root" ls-files --error-unmatch -- "$file" >/dev/null || {
    echo "build context file is not tracked: $file" >&2
    exit 1
  }
done
if ! git -C "$repo_root" diff --quiet HEAD -- "${context_files[@]}"; then
  echo "tracked Docker build-context files have local changes; commit or discard them before proof" >&2
  exit 1
fi
untracked_context="$(git -C "$repo_root" ls-files --others --exclude-standard -- \
  package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json \
  packages/fleet-runner/src packages/fleet-runner/scripts packages/fleet-runner/package.json \
  packages/fleet-runner/LICENSE packages/fleet-runner/README.md packages/fleet-runner/deployment.md \
  packages/fleet-runner/tsconfig.json packages/fleet-runner/Dockerfile \
  packages/fleet-runner/Dockerfile.dockerignore packages/fleet-runner/docker-entrypoint.mjs)"
if [[ -n "$untracked_context" ]]; then
  echo "untracked Docker build-context files found:" >&2
  printf '%s\n' "$untracked_context" >&2
  exit 1
fi

if (( $# == 1 )); then
  evidence_arg="$1"
elif [[ -n "${FLEET_PACKAGING_EVIDENCE_DIR:-}" ]]; then
  evidence_arg="$FLEET_PACKAGING_EVIDENCE_DIR"
else
  evidence_arg="$repo_root/.handoff/fleet-runner/packaging-evidence-$(date -u +%Y%m%dT%H%M%SZ)-$suffix"
fi
if [[ "$evidence_arg" != /* ]]; then evidence_arg="$invocation_dir/$evidence_arg"; fi
mkdir -p "$(dirname "$evidence_arg")"
evidence_parent="$(cd "$(dirname "$evidence_arg")" && pwd)"
evidence_dir="$evidence_parent/$(basename "$evidence_arg")"
case "$evidence_dir/" in
  "$package_dir/"*) echo "evidence directory cannot be inside the fleet-runner package/context" >&2; exit 2 ;;
esac
mkdir -p "$evidence_parent"
if [[ -e "$evidence_dir" || -L "$evidence_dir" ]]; then
  echo "evidence directory already exists; refusing to overwrite: $evidence_dir" >&2
  exit 1
fi
mkdir "$evidence_dir"

cleanup() {
  if [[ -n "$container_id" ]]; then
    docker logs "$container_id" > "$evidence_dir/service-container.log" 2>&1 || true
    docker rm --force "$container_id" >/dev/null 2>&1 || true
  fi
  docker volume rm "$state_volume" "$output_volume" "$probe_volume" "$registry_volume" "$bad_schema_volume" >/dev/null 2>&1 || true
  rm -rf "$temp_root"
}
trap cleanup EXIT

cd "$repo_root"
git rev-parse HEAD > "$evidence_dir/source-revision.txt"
docker version --format '{{json .Server}}' > "$evidence_dir/docker-server.json"
docker buildx version > "$evidence_dir/buildx-version.txt"

first_command="docker buildx build --platform linux/amd64 --no-cache --pull --target proof-export --build-arg CLEAN_RUN=first --output type=local,dest=$evidence_dir/install-first --file packages/fleet-runner/Dockerfile ."
second_command="docker buildx build --platform linux/amd64 --no-cache --pull --target proof-export --build-arg CLEAN_RUN=second --output type=local,dest=$evidence_dir/install-second --file packages/fleet-runner/Dockerfile ."
if ! docker buildx build --platform linux/amd64 --no-cache --pull \
  --target proof-export --build-arg CLEAN_RUN=first \
  --output "type=local,dest=$evidence_dir/install-first" \
  --file "$dockerfile" . > "$evidence_dir/install-first-build.log" 2>&1; then
  cat "$evidence_dir/install-first-build.log" >&2
  exit 1
fi
if ! docker buildx build --platform linux/amd64 --no-cache --pull \
  --target proof-export --build-arg CLEAN_RUN=second \
  --output "type=local,dest=$evidence_dir/install-second" \
  --file "$dockerfile" . > "$evidence_dir/install-second-build.log" 2>&1; then
  cat "$evidence_dir/install-second-build.log" >&2
  exit 1
fi
diff -u "$evidence_dir/install-first/build-manifest.json" "$evidence_dir/install-second/build-manifest.json"
diff -u "$evidence_dir/install-first/dependencies.json" "$evidence_dir/install-second/dependencies.json"

image_command="docker buildx build --platform linux/amd64 --no-cache --pull --target runtime --load --tag $image_tag --metadata-file $evidence_dir/runtime-build-metadata.json --file packages/fleet-runner/Dockerfile ."
if ! docker buildx build --platform linux/amd64 --no-cache --pull \
  --target runtime --load --tag "$image_tag" \
  --metadata-file "$evidence_dir/runtime-build-metadata.json" \
  --file "$dockerfile" . > "$evidence_dir/runtime-build.log" 2>&1; then
  cat "$evidence_dir/runtime-build.log" >&2
  exit 1
fi
docker image inspect "$image_tag" > "$evidence_dir/runtime-image-inspect.json"
docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image_tag" | grep -qx 'linux/amd64'
docker image save --output "$evidence_dir/runtime-image.tar" "$image_tag"
shasum -a 256 "$evidence_dir/runtime-image.tar" > "$evidence_dir/runtime-image.tar.sha256"

for volume in "$state_volume" "$output_volume" "$probe_volume" "$registry_volume" "$bad_schema_volume"; do
  docker volume create "$volume" >/dev/null
done
docker run --rm --platform linux/amd64 --user 0:0 \
  --volume "$state_volume:/state" --volume "$output_volume:/output" \
  --volume "$probe_volume:/probe" --volume "$registry_volume:/registry" \
  --volume "$bad_schema_volume:/bad-schema" --entrypoint node "$image_tag" \
  -e 'import { chownSync } from "node:fs"; for (const p of ["/state", "/output", "/probe", "/registry", "/bad-schema"]) chownSync(p, 1000, 1000);'
docker run --rm --platform linux/amd64 --user node \
  --volume "$probe_volume:/probe" --entrypoint node "$image_tag" \
  --input-type=module -e 'import { generateToken } from "/app/dist/auth.js"; generateToken("/probe/owner"); generateToken("/probe/worker");'
docker run --rm --platform linux/amd64 --user node \
  --volume "$probe_volume:/probe:ro" --volume "$registry_volume:/registry" --entrypoint node "$image_tag" \
  -e 'import { copyFileSync, chmodSync } from "node:fs"; for (const id of ["owner", "worker"]) { copyFileSync(`/probe/${id}.pub`, `/registry/${id}.pub`); chmodSync(`/registry/${id}.pub`, 0o644); }'

capture_expected_exit() {
  local name="$1" expected="$2" output_file="$3" code=0
  shift 3
  if "$@" > "$output_file" 2>&1; then code=0; else code=$?; fi
  printf '%s\n' "$code" > "$evidence_dir/$name.exit-code"
  if [[ "$code" -ne "$expected" ]]; then
    cat "$output_file" >&2
    echo "$name exited $code; expected $expected" >&2
    exit 1
  fi
}
unsupported_command="docker run --rm --platform linux/amd64 $image_tag unsupported-proof-command"
capture_expected_exit unsupported-command 2 "$evidence_dir/unsupported-command.log" \
  docker run --rm --platform linux/amd64 "$image_tag" unsupported-proof-command
invalid_port_command="docker run --rm --platform linux/amd64 --env FLEET_PORT=0 $image_tag serve"
capture_expected_exit invalid-port 2 "$evidence_dir/invalid-port.log" \
  docker run --rm --platform linux/amd64 --env FLEET_PORT=0 "$image_tag" serve

docker run --rm --platform linux/amd64 --user node --volume "$bad_schema_volume:/bad-schema" \
  --entrypoint node "$image_tag" --input-type=module \
  -e 'import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync("/bad-schema/fleet.sqlite"); db.exec("PRAGMA user_version = 99"); db.close();'
incompatible_schema_command="docker run --rm --platform linux/amd64 --volume $bad_schema_volume:/var/lib/fleet-runner/state $image_tag serve"
capture_expected_exit incompatible-schema 1 "$evidence_dir/incompatible-schema.log" \
  docker run --rm --platform linux/amd64 --volume "$bad_schema_volume:/var/lib/fleet-runner/state" "$image_tag" serve

container_id="$(docker run --detach --name "$container_name" --platform linux/amd64 \
  --publish 127.0.0.1::8787 \
  --volume "$state_volume:/var/lib/fleet-runner/state" \
  --volume "$output_volume:/var/lib/fleet-runner/output" \
  --volume "$registry_volume:/run/fleet-runner/public-keys:ro" \
  "$image_tag" serve)"
container_ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container_id")"
probe_command="docker run --rm --platform linux/amd64 --network container:$container_id --volume $probe_volume:/probe:ro --volume $output_volume:/accepted-output:ro --env FLEET_PROBE_ENDPOINT=http://$container_ip:8787 --entrypoint node $image_tag --input-type=module -e <signed-lifecycle-probe>"
probe_code='import assert from "node:assert/strict"; import { createHash } from "node:crypto"; import { readFile } from "node:fs/promises"; import { join } from "node:path"; import { fleetClient } from "/app/dist/client.js"; import { workOnce } from "/app/dist/worker.js"; import { writeOutput } from "/app/dist/jobs.js"; const expectedSha256 = "f04565eea01f62eeb7149c8609c8a901ca0af5ffb74c37a181ca0955479e7890"; const endpoint = process.env.FLEET_PROBE_ENDPOINT; const owner = fleetClient(endpoint, "owner", "/probe/owner"); const worker = fleetClient(endpoint, "worker", "/probe/worker"); const fixture = Buffer.from("fleet-runner packaging fixture v1\n", "utf8"); const inputSha256 = createHash("sha256").update(fixture).digest("hex"); const expectedOutputSha256 = createHash("sha256").update(fixture).digest("hex"); assert.equal(expectedOutputSha256, expectedSha256); const admitted = await owner.enqueue({ kind: "proof-fixture", inputs: [inputSha256], payload: null, requires: ["packaging-proof"] }); assert.equal(admitted.created, true); const workerResult = await workOnce(worker, { caps: ["packaging-proof"], outDir: "/tmp/fleet-runner-proof-output", handlers: { "proof-fixture": async (job, ctx) => writeOutput(ctx.outDir, job, fixture) } }); assert.equal(workerResult, "completed"); const acceptedBytes = await readFile(join("/accepted-output", `${admitted.key}.1.jsonl`)); assert.deepEqual(acceptedBytes, fixture); const acceptedOutputSha256 = createHash("sha256").update(acceptedBytes).digest("hex"); assert.equal(acceptedOutputSha256, expectedSha256); const verification = await owner.verify(admitted.key); assert.equal(verification.verified, true); const completionEvents = (await owner.events()).filter((event) => event.key === admitted.key && event.type === "completed"); assert.equal(completionEvents.length, 1); assert.equal(verification.period.byWorker.worker.completed, 1); console.log(JSON.stringify({ authenticated: true, admitted: admitted.created, inputSha256, workerResult, acceptedBytesMatchFixture: true, expectedOutputSha256, acceptedOutputSha256, verifiedAgainstDatabaseDigest: verification.verified, completedEvents: completionEvents.length, report: verification }));'
readiness_code='import assert from "node:assert/strict"; import { fleetClient } from "/app/dist/client.js"; const report = await fleetClient(process.env.FLEET_PROBE_ENDPOINT, "owner", "/probe/owner").report(); assert.ok(report && typeof report === "object"); console.log(JSON.stringify({ authenticated: true, route: "GET /report", report }));'
ready=0
for attempt in $(seq 1 30); do
  if docker run --rm --platform linux/amd64 --network "container:$container_id" \
    --volume "$probe_volume:/probe:ro" --env "FLEET_PROBE_ENDPOINT=http://$container_ip:8787" \
    --entrypoint node "$image_tag" --input-type=module -e "$readiness_code" \
    > "$evidence_dir/signed-report-readiness.log" 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  cat "$evidence_dir/signed-report-readiness.log" >&2
  docker logs "$container_id" >&2 || true
  echo "signed /report auth/database request did not succeed" >&2
  exit 1
fi
if ! docker run --rm --platform linux/amd64 --network "container:$container_id" \
  --volume "$probe_volume:/probe:ro" --volume "$output_volume:/accepted-output:ro" \
  --env "FLEET_PROBE_ENDPOINT=http://$container_ip:8787" --entrypoint node "$image_tag" \
  --input-type=module -e "$probe_code" > "$evidence_dir/signed-lifecycle.json" 2> "$evidence_dir/signed-lifecycle.log"; then
  cat "$evidence_dir/signed-lifecycle.log" >&2
  docker logs "$container_id" >&2 || true
  exit 1
fi

node --input-type=module - "$repo_root" "$evidence_dir" "$image_tag" \
  "$first_command" "$second_command" "$image_command" "$unsupported_command" \
  "$invalid_port_command" "$incompatible_schema_command" "$probe_command" <<'NODE'
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [repoArg, evidenceArg, imageTag, firstCommand, secondCommand, imageCommand, unsupportedCommand, invalidPortCommand, incompatibleSchemaCommand, probeCommand] = process.argv.slice(2);
const repo = resolve(repoArg);
const evidence = resolve(evidenceArg);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const contextFiles = [
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json",
  "packages/fleet-runner/package.json", "packages/fleet-runner/LICENSE", "packages/fleet-runner/README.md",
  "packages/fleet-runner/deployment.md", "packages/fleet-runner/tsconfig.json",
  "packages/fleet-runner/Dockerfile", "packages/fleet-runner/Dockerfile.dockerignore",
  "packages/fleet-runner/docker-entrypoint.mjs",
];
for (const dir of ["packages/fleet-runner/src", "packages/fleet-runner/scripts"]) {
  const list = execFileSync("find", [dir, "-type", "f", "-print"], { cwd: repo, encoding: "utf8" });
  contextFiles.push(...list.trim().split("\n").filter(Boolean));
}
contextFiles.sort();
const context = [];
for (const path of contextFiles) context.push({ path, sha256: hash(await readFile(join(repo, path))) });
const contextSha = hash(context.map((row) => `${row.path}\0${row.sha256}`).join("\n"));
const firstManifest = await readJson(join(evidence, "install-first/build-manifest.json"));
const secondManifest = await readJson(join(evidence, "install-second/build-manifest.json"));
const firstDependencies = await readJson(join(evidence, "install-first/dependencies.json"));
const secondDependencies = await readJson(join(evidence, "install-second/dependencies.json"));
const comparison = {
  sourceAndLockHashesMatch: firstManifest.source.sha256 === secondManifest.source.sha256 && firstManifest.lockfileSha256 === secondManifest.lockfileSha256,
  toolVersionsMatch: JSON.stringify(firstManifest.tools) === JSON.stringify(secondManifest.tools),
  dependencyManifestsMatch: JSON.stringify(firstDependencies) === JSON.stringify(secondDependencies),
  compiledFileHashesMatch: JSON.stringify(firstManifest.dist) === JSON.stringify(secondManifest.dist),
  bitIdenticalImageClaim: false,
};
if (Object.entries(comparison).some(([key, value]) => key !== "bitIdenticalImageClaim" && value !== true)) throw new Error("clean install manifests differ");
const artifacts = [];
for (const id of ["install-first", "install-second"]) {
  const archive = join(evidence, id, "core-fleet-runner-0.1.0.tgz");
  const files = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n").sort();
  for (const required of ["package/package.json", "package/LICENSE", "package/README.md", "package/deployment.md"]) {
    if (!files.includes(required)) throw new Error(`${id} artifact is missing ${required}`);
  }
  if (!files.some((file) => file.startsWith("package/dist/"))) throw new Error(`${id} artifact has no compiled files`);
  artifacts.push({ cleanInstall: id, path: `${id}/core-fleet-runner-0.1.0.tgz`, sha256: hash(await readFile(archive)), files, consumerInstall: await readJson(join(evidence, id, "package-consumer.json")) });
}
const imageInspect = await readJson(join(evidence, "runtime-image-inspect.json"));
const image = imageInspect[0];
const metadata = await readJson(join(evidence, "runtime-build-metadata.json"));
const smoke = await readJson(join(evidence, "signed-lifecycle.json"));
const negative = [];
for (const [name, command, expectedExitCode] of [["unsupported-command", unsupportedCommand, 2], ["invalid-port", invalidPortCommand, 2], ["incompatible-schema", incompatibleSchemaCommand, 1]]) {
  const observedExitCode = Number((await readFile(join(evidence, `${name}.exit-code`), "utf8")).trim());
  if (observedExitCode !== expectedExitCode) throw new Error(`${name} exit code mismatch`);
  negative.push({ name, command, expectedExitCode, observedExitCode, outputPath: `${name}.log`, output: (await readFile(join(evidence, `${name}.log`), "utf8")).trim() });
}
const imageArchiveSha256 = hash(await readFile(join(evidence, "runtime-image.tar")));
const report = {
  schemaVersion: 2,
  sourceRevision: (await readFile(join(evidence, "source-revision.txt"), "utf8")).trim(),
  sourceCleanAtStart: true,
  untrackedBuildContextFiles: [],
  context: { files: context, sha256: contextSha, lockfileSha256: hash(await readFile(join(repo, "pnpm-lock.yaml"))) },
  tools: { dockerServer: await readJson(join(evidence, "docker-server.json")), buildx: (await readFile(join(evidence, "buildx-version.txt"), "utf8")).trim(), imageNode: "24.22.2", packageManager: "pnpm@9.15.4" },
  cleanInstalls: [
    { id: "first", command: firstCommand, installCommand: "pnpm install --filter core-workflow-framework --filter @core/fleet-runner --frozen-lockfile --ignore-scripts", buildCommand: "pnpm --filter @core/fleet-runner build", installExitCode: 0, buildExitCode: 0, outputPath: "install-first-build.log", manifest: firstManifest, dependencies: firstDependencies },
    { id: "second", command: secondCommand, installCommand: "pnpm install --filter core-workflow-framework --filter @core/fleet-runner --frozen-lockfile --ignore-scripts", buildCommand: "pnpm --filter @core/fleet-runner build", installExitCode: 0, buildExitCode: 0, outputPath: "install-second-build.log", manifest: secondManifest, dependencies: secondDependencies },
  ],
  cleanInstallComparison: comparison,
  portableWorkerArtifacts: artifacts,
  runtimeImage: {
    command: imageCommand, tag: imageTag, targetPlatform: "linux/amd64", observedPlatform: `${image.Os}/${image.Architecture}`,
    imageId: image.Id, configUser: image.Config.User, buildxDigest: metadata["containerimage.digest"] ?? null,
    baseImage: "node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c",
    archivePath: "runtime-image.tar", archiveSha256: imageArchiveSha256, loadCommand: "docker image load --input runtime-image.tar",
    inspectPath: "runtime-image-inspect.json", buildMetadataPath: "runtime-build-metadata.json", buildLogPath: "runtime-build.log",
  },
  negativeProbes: negative,
  signedLifecycle: { command: probeCommand, readinessLogPath: "signed-report-readiness.log", outputVolumeMountedReadOnly: true, probeKeysOutsideService: true, observation: smoke },
  evidenceFiles: ["runtime-image.tar", "runtime-image.tar.sha256", "runtime-image-inspect.json", "runtime-build-metadata.json", "runtime-build.log", "signed-report-readiness.log", "signed-lifecycle.json", "signed-lifecycle.log", "unsupported-command.log", "invalid-port.log", "incompatible-schema.log"],
  claimBoundary: "synthetic container packaging and job lifecycle evidence only; TLS and production/network readiness remain G3 gates",
};
if (report.runtimeImage.observedPlatform !== "linux/amd64") throw new Error("image architecture mismatch");
if (report.runtimeImage.configUser !== "node") throw new Error(`runtime user is ${report.runtimeImage.configUser}`);
if (smoke.acceptedOutputSha256 !== "f04565eea01f62eeb7149c8609c8a901ca0af5ffb74c37a181ca0955479e7890") throw new Error("accepted output SHA-256 mismatch");
if (smoke.acceptedBytesMatchFixture !== true || smoke.verifiedAgainstDatabaseDigest !== true || smoke.completedEvents !== 1) throw new Error("signed lifecycle assertions did not pass");
await writeFile(join(evidence, "evidence-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(`Evidence saved to ${evidence}`);
console.log(`Runtime image: ${imageTag} ${image.Id} (${image.Os}/${image.Architecture})`);
console.log(`Runtime archive SHA-256: ${imageArchiveSha256}`);
console.log(`Worker tarball SHA-256: ${artifacts[0].sha256}`);
NODE

cat "$evidence_dir/install-first-build.log"
cat "$evidence_dir/install-second-build.log"
cat "$evidence_dir/runtime-build.log"

if [[ "$(git rev-parse HEAD)" != "$(cat "$evidence_dir/source-revision.txt")" ]] \
  || ! git diff --quiet HEAD -- "${context_files[@]}" \
  || [[ -n "$(git ls-files --others --exclude-standard -- \
    package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json \
    packages/fleet-runner/src packages/fleet-runner/scripts packages/fleet-runner/package.json \
    packages/fleet-runner/LICENSE packages/fleet-runner/README.md packages/fleet-runner/deployment.md \
    packages/fleet-runner/tsconfig.json packages/fleet-runner/Dockerfile \
    packages/fleet-runner/Dockerfile.dockerignore packages/fleet-runner/docker-entrypoint.mjs)" ]]; then
  echo "source revision or Docker build context changed during proof" >&2
  exit 1
fi
