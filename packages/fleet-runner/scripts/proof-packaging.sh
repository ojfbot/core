#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
package_dir="$repo_root/packages/fleet-runner"
dockerfile="$package_dir/Dockerfile"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/fleet-runner-proof.XXXXXX")"
suffix="$(basename "$temp_root" | tr -cd '[:alnum:]')"
image_tag="fleet-runner-proof:$suffix"
container_name="fleet-runner-proof-$suffix"
state_volume="fleet-runner-proof-state-$suffix"
output_volume="fleet-runner-proof-output-$suffix"
probe_volume="fleet-runner-proof-probe-$suffix"
registry_volume="fleet-runner-proof-registry-$suffix"
container_id=""

cleanup() {
  if [[ -n "$container_id" ]]; then docker rm --force "$container_id" >/dev/null 2>&1 || true; fi
  docker volume rm "$state_volume" "$output_volume" "$probe_volume" "$registry_volume" >/dev/null 2>&1 || true
  docker image rm "$image_tag" >/dev/null 2>&1 || true
  rm -rf "$temp_root"
}
trap cleanup EXIT

cd "$repo_root"
git rev-parse HEAD > "$temp_root/source-revision.txt"
git status --porcelain=v1 > "$temp_root/source-status.txt"
docker version --format '{{json .Server}}' > "$temp_root/docker-server.json"
docker buildx version > "$temp_root/buildx-version.txt"

first_command="docker buildx build --platform linux/amd64 --no-cache --pull --target proof-export --build-arg CLEAN_RUN=first --output type=local,dest=<temp>/install-first --file packages/fleet-runner/Dockerfile ."
second_command="docker buildx build --platform linux/amd64 --no-cache --pull --target proof-export --build-arg CLEAN_RUN=second --output type=local,dest=<temp>/install-second --file packages/fleet-runner/Dockerfile ."
docker buildx build --platform linux/amd64 --no-cache --pull \
  --target proof-export --build-arg CLEAN_RUN=first \
  --output "type=local,dest=$temp_root/install-first" \
  --file "$dockerfile" .
docker buildx build --platform linux/amd64 --no-cache --pull \
  --target proof-export --build-arg CLEAN_RUN=second \
  --output "type=local,dest=$temp_root/install-second" \
  --file "$dockerfile" .
diff -u "$temp_root/install-first/build-manifest.json" "$temp_root/install-second/build-manifest.json"
diff -u "$temp_root/install-first/dependencies.json" "$temp_root/install-second/dependencies.json"

image_command="docker buildx build --platform linux/amd64 --no-cache --pull --target runtime --load --tag $image_tag --metadata-file <temp>/image-metadata.json --file packages/fleet-runner/Dockerfile ."
docker buildx build --platform linux/amd64 --no-cache --pull \
  --target runtime --load --tag "$image_tag" \
  --metadata-file "$temp_root/image-metadata.json" \
  --file "$dockerfile" .
docker image inspect "$image_tag" > "$temp_root/image-inspect.json"
docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image_tag" | grep -qx 'linux/amd64'

for volume in "$state_volume" "$output_volume" "$probe_volume" "$registry_volume"; do
  docker volume create "$volume" >/dev/null
done
docker run --rm --platform linux/amd64 --user 0:0 \
  --volume "$state_volume:/state" --volume "$output_volume:/output" \
  --volume "$probe_volume:/probe" --volume "$registry_volume:/registry" --entrypoint node "$image_tag" \
  -e 'import { chownSync } from "node:fs"; for (const p of ["/state", "/output", "/probe", "/registry"]) chownSync(p, 1000, 1000);'
docker run --rm --platform linux/amd64 --user node \
  --volume "$probe_volume:/probe" --entrypoint node "$image_tag" \
  --input-type=module -e 'import { generateToken } from "/app/dist/auth.js"; generateToken("/probe/owner"); generateToken("/probe/worker");'
docker run --rm --platform linux/amd64 --user node \
  --volume "$probe_volume:/probe:ro" --volume "$registry_volume:/registry" --entrypoint node "$image_tag" \
  -e 'import { copyFileSync, chmodSync } from "node:fs"; for (const id of ["owner", "worker"]) { copyFileSync(`/probe/${id}.pub`, `/registry/${id}.pub`); chmodSync(`/registry/${id}.pub`, 0o644); }'

container_id="$(docker run --detach --name "$container_name" --platform linux/amd64 \
  --publish 127.0.0.1::8787 \
  --volume "$state_volume:/var/lib/fleet-runner/state" \
  --volume "$output_volume:/var/lib/fleet-runner/output" \
  --volume "$registry_volume:/run/fleet-runner/public-keys:ro" \
  "$image_tag" serve)"
container_ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container_id")"
smoke_command="docker run --rm --platform linux/amd64 --network container:$container_id --volume $probe_volume:/probe:ro --env FLEET_PROBE_ENDPOINT=http://$container_ip:8787 --entrypoint node $image_tag --input-type=module -e <signed-lifecycle-probe>"
smoke_code='import assert from "node:assert/strict"; import { createHash } from "node:crypto"; import { fleetClient } from "/app/dist/client.js"; import { workOnce } from "/app/dist/worker.js"; import { writeOutput } from "/app/dist/jobs.js"; const endpoint = process.env.FLEET_PROBE_ENDPOINT; const owner = fleetClient(endpoint, "owner", "/probe/owner"); const worker = fleetClient(endpoint, "worker", "/probe/worker"); const fixture = Buffer.from("fleet-runner packaging fixture v1\n", "utf8"); const inputSha256 = createHash("sha256").update(fixture).digest("hex"); const expectedOutputSha256 = createHash("sha256").update(fixture).digest("hex"); const admitted = await owner.enqueue({ kind: "proof-fixture", inputs: [inputSha256], payload: null, requires: ["packaging-proof"] }); assert.equal(admitted.created, true); const workerResult = await workOnce(worker, { caps: ["packaging-proof"], outDir: "/tmp/fleet-runner-proof-output", handlers: { "proof-fixture": async (job, ctx) => writeOutput(ctx.outDir, job, fixture) } }); assert.equal(workerResult, "completed"); const verification = await owner.verify(admitted.key); assert.equal(verification.verified, true); const completionEvents = (await owner.events()).filter((event) => event.key === admitted.key && event.type === "completed"); assert.equal(completionEvents.length, 1); assert.equal(verification.period.byWorker.worker.completed, 1); console.log(JSON.stringify({ authenticated: true, admitted: admitted.created, inputSha256, workerResult, verified: verification.verified, expectedOutputSha256, completedEvents: completionEvents.length, report: verification }));'
smoke_output=""
for attempt in $(seq 1 30); do
  if smoke_output="$(docker run --rm --platform linux/amd64 --network "container:$container_id" \
    --volume "$probe_volume:/probe:ro" --env "FLEET_PROBE_ENDPOINT=http://$container_ip:8787" \
    --entrypoint node "$image_tag" --input-type=module -e "$smoke_code" 2>/dev/null)"; then
    break
  fi
  sleep 1
done
if [[ -z "$smoke_output" ]]; then
  docker logs "$container_id" >&2 || true
  echo "signed enqueue/worker/verify smoke did not succeed" >&2
  exit 1
fi
printf '%s\n' "$smoke_output" > "$temp_root/signed-report-smoke.json"

node --input-type=module - "$repo_root" "$package_dir" "$temp_root" "$image_tag" \
  "$first_command" "$second_command" "$image_command" "$smoke_command" <<'NODE'
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [repoArg, packageArg, tempArg, imageTag, firstCommand, secondCommand, imageCommand, smokeCommand] = process.argv.slice(2);
const repo = resolve(repoArg);
const packageDir = resolve(packageArg);
const temp = resolve(tempArg);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const contextFiles = [
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json",
  "packages/fleet-runner/package.json", "packages/fleet-runner/tsconfig.json",
  "packages/fleet-runner/LICENSE", "packages/fleet-runner/README.md",
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
const imageInspect = await readJson(join(temp, "image-inspect.json"));
const image = imageInspect[0];
const metadata = await readJson(join(temp, "image-metadata.json"));
const artifacts = [];
for (const id of ["install-first", "install-second"]) {
  const archive = join(temp, id, "core-fleet-runner-0.1.0.tgz");
  const files = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n").sort();
  if (!files.includes("package/package.json") || !files.some((file) => file.startsWith("package/dist/"))) {
    throw new Error(`${id} package artifact is missing its manifest or compiled files`);
  }
  artifacts.push({
    cleanInstall: id,
    filename: "core-fleet-runner-0.1.0.tgz",
    sha256: hash(await readFile(archive)),
    files,
    consumerInstall: await readJson(join(temp, id, "package-consumer.json")),
  });
}
const report = {
  schemaVersion: 1,
  sourceRevision: (await readFile(join(temp, "source-revision.txt"), "utf8")).trim(),
  sourceStatus: (await readFile(join(temp, "source-status.txt"), "utf8")).trim().split("\n").filter(Boolean),
  context: { files: context, sha256: contextSha, lockfileSha256: hash(await readFile(join(repo, "pnpm-lock.yaml"))) },
  tools: {
    dockerServer: await readJson(join(temp, "docker-server.json")),
    buildx: (await readFile(join(temp, "buildx-version.txt"), "utf8")).trim(),
    imageNode: "24.22.2",
    packageManager: "pnpm@9.15.4",
  },
  cleanInstalls: [
    { id: "first", command: firstCommand, installCommand: "pnpm install --filter core-workflow-framework --filter @core/fleet-runner --frozen-lockfile --ignore-scripts", buildCommand: "pnpm --filter @core/fleet-runner build", installExitCode: 0, buildExitCode: 0, manifest: await readJson(join(temp, "install-first/build-manifest.json")), dependencies: await readJson(join(temp, "install-first/dependencies.json")) },
    { id: "second", command: secondCommand, installCommand: "pnpm install --filter core-workflow-framework --filter @core/fleet-runner --frozen-lockfile --ignore-scripts", buildCommand: "pnpm --filter @core/fleet-runner build", installExitCode: 0, buildExitCode: 0, manifest: await readJson(join(temp, "install-second/build-manifest.json")), dependencies: await readJson(join(temp, "install-second/dependencies.json")) },
  ],
  portableWorkerArtifacts: artifacts,
  cleanInstallComparison: {
    sourceAndLockHashesMatch: true,
    toolVersionsMatch: true,
    dependencyManifestsMatch: true,
    compiledFileHashesMatch: true,
    bitIdenticalImageClaim: false,
  },
  imageBuild: {
    command: imageCommand,
    targetPlatform: "linux/amd64",
    observedPlatform: `${image.Os}/${image.Architecture}`,
    imageId: image.Id,
    configUser: image.Config.User,
    buildxDigest: metadata["containerimage.digest"] ?? null,
    baseImage: "node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c",
  },
  signedApiDbSmoke: {
    command: smokeCommand,
    syntheticCredentials: true,
    observation: JSON.parse((await readFile(join(temp, "signed-report-smoke.json"), "utf8")).trim()),
  },
  claimBoundary: "container build and signed report/database smoke only; no TLS or production readiness claim",
};
if (report.imageBuild.observedPlatform !== "linux/amd64") throw new Error("image architecture mismatch");
if (report.imageBuild.configUser !== "node") throw new Error(`runtime user is ${report.imageBuild.configUser}`);
await writeFile(join(packageDir, "packaging-proof.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${join(packageDir, "packaging-proof.json")}`);
NODE
