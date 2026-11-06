# Fleet-runner deployment and worker setup

This package uses the core repository's `pnpm-lock.yaml`. The service image
build context is restricted by `Dockerfile.dockerignore` to the root package
manifest, workspace manifest, lockfile, base TypeScript config, and the
fleet-runner package files needed to compile and package it. Builds install the
workspace root and fleet-runner importers with the frozen lockfile, and build
only `@core/fleet-runner`.

The image uses Node `24.22.2` and pnpm `9.15.4`. The Node image is pinned to its
multi-platform manifest digest in `Dockerfile`; `--platform linux/amd64`
selects the Linux x86-64 variant even when building on an Apple Silicon Mac.
The runtime image contains compiled files only and runs as the official image's
`node` user (UID/GID 1000).

## Service image

From the core repository root, build and inspect the service image:

```sh
docker buildx build --platform linux/amd64 --load \
  --tag fleet-runner:local \
  --file packages/fleet-runner/Dockerfile .
docker image inspect --format '{{.Os}}/{{.Architecture}} {{.Id}}' fleet-runner:local
```

The service binds to the container's private IPv4 address on `eth0`. The
existing LAN-only bind check remains enabled. Set `FLEET_PORT` if the default
8787 conflicts. `FLEET_DB`, `FLEET_OUT_DIR`, and `FLEET_PUBLIC_KEYS_DIR` can
override the default container paths.

Create persistent state/output volumes and initialize their ownership for the
non-root service user:

```sh
docker volume create fleet-runner-state
docker volume create fleet-runner-output
docker run --rm --user 0:0 \
  --volume fleet-runner-state:/state \
  --volume fleet-runner-output:/output \
  --entrypoint node fleet-runner:local \
  -e 'import { chownSync } from "node:fs"; chownSync("/state", 1000, 1000); chownSync("/output", 1000, 1000);'
mkdir -p ./fleet-runner-public-keys
chmod 755 ./fleet-runner-public-keys
```

Place each authorized worker's `.pub` PEM file in
`./fleet-runner-public-keys/<id>.pub`, mode 0644. The private token remains on
the worker Mac. Mount only the public-key directory into the service, read-only:

```sh
docker run --detach --name fleet-runner \
  --platform linux/amd64 --publish 8787:8787 \
  --volume fleet-runner-state:/var/lib/fleet-runner/state \
  --volume fleet-runner-output:/var/lib/fleet-runner/output \
  --volume "$PWD/fleet-runner-public-keys:/run/fleet-runner/public-keys:ro" \
  fleet-runner:local serve
```

The published-port command above is G3 preparation only. Do not expose the
service to a LAN until TLS, network policy, firewall, and production readiness
qualification are complete. For a local synthetic proof, bind the host port to
loopback instead.

The volumes retain the SQLite database and outputs across container replacement.
The container has no private credentials. Restrict the host firewall to the
worker LAN and use private network interfaces only. A successful TCP connection
alone is liveness, not readiness; an operator can use an authenticated signed
`GET /report` request to exercise authentication and database access. TLS,
Internet exposure, production readiness, and full service supervision remain
separate deployment qualification work.

For a mounted host directory instead of Docker volumes, pre-create the DB and
output directories with owner UID/GID 1000 on the Docker host. Keep the public
key registry separate and mounted read-only.

## Portable Mac worker artifact

The worker loop is a library API. There is no `fleet-runner worker` command:
each consuming worker application supplies handlers for its supported job
kinds and owns its application-specific input/output semantics.

On a clean core checkout at the reviewed commit, use Node 24.22.2 and pnpm
9.15.4, then build and pack the package using the repository's existing lock:

```sh
git checkout --detach "${FLEET_RUNNER_SOURCE_COMMIT:?set this to the reviewed packaging source commit}"
corepack prepare pnpm@9.15.4 --activate
pnpm install --filter core-workflow-framework --filter @core/fleet-runner \
  --frozen-lockfile --ignore-scripts
pnpm --filter @core/fleet-runner build
mkdir -p "$PWD/.artifacts"
pnpm --dir packages/fleet-runner pack --pack-destination "$PWD/.artifacts"
(cd .artifacts && shasum -a 256 core-fleet-runner-0.1.0.tgz > fleet-runner-artifact.sha256)
```

Transfer the `.tgz` and `fleet-runner-artifact.sha256` to the worker Mac over the
approved channel, verify the hash there, and install it in the worker
application with pnpm:

```sh
shasum -a 256 -c fleet-runner-artifact.sha256
pnpm add ./core-fleet-runner-0.1.0.tgz
```

The consumer imports `fleetClient` from `@core/fleet-runner/client` and
`runWorker` from `@core/fleet-runner/worker`. It must provide a
`Record<string, JobHandler>`, capability labels, an output directory, and an
`AbortSignal`, as required by the worker API. Keep its private token in a
worker-only directory with mode 0600; transfer only the generated `.pub` file
to the service owner. Use a private endpoint after the deployment's G3 gates
are met. The package tarball contains compiled output, license, README, and
deployment instructions, not the core checkout or service secrets.

## Repeatable clean-install and container proof

Run from the core repository root on a machine with Docker Desktop or Docker
Engine and Buildx available. Give each run a new evidence directory, outside
`packages/fleet-runner` and its Docker build context:

```sh
pnpm --dir packages/fleet-runner proof:packaging -- \
  .handoff/fleet-runner/packaging-evidence-<unique-name>
```

The script performs two uncached `linux/amd64` proof-stage builds, each with a
distinct temporary pnpm store, and compares the source, lockfile, tool,
dependency, and compiled-file manifests. Each pass also packs the worker
library, installs that tarball into an isolated consumer, and imports the
compiled client and worker exports. It then builds and loads the runnable
`linux/amd64` image, starts the image with temporary Docker volumes, and uses a
separate probe container holding synthetic credentials to enqueue one fixed
fixture, execute it through the compiled client/worker loop, verify accepted
output, and assert exactly one completion event. The service container sees
only the public-key registry. The evidence directory preserves both install
manifests and logs, both portable worker tarballs, the runtime image archive and
SHA-256, image inspection and build metadata, negative-probe outputs, and a
machine-readable `evidence-report.json`. Restore the image with
`docker image load --input runtime-image.tar`; install a worker tarball on a Mac
with pnpm as above. The script refuses to overwrite an existing evidence
directory and fails if source changes during proof. The report is evidence for
those exact source/tool/image inputs; it does not assert bit-identical image
layers or production readiness.
