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

The service binds a private address inside its container. That is not the NAS
exposure boundary: Docker publishes on the host separately. Set
`FLEET_BIND_IP` when interface selection is ambiguous, and set `FLEET_PORT`
when 8787 conflicts. Do not use host networking for the service.

Create the state, output, public-key and TLS directories on a **NAS-local SSD
filesystem**, outside any network mount. SQLite is opened only by the service.
Pass the private host location through `FLEET_SERVICE_ROOT`; never commit it.
Initialize only those directories for the runtime UID/GID. Use `--user UID:GID`
with matching ownership if the appliance does not use UID/GID 1000; do not
change ownership of an entire share or appliance volume. Private accepted
outputs remain mode 0600; access them as the service identity through an
explicitly authorized tool rather than making them world-readable over SMB.

Each host generates its own credential locally. Register only the `.pub` PEM
under `public-keys/<id>.pub` (including a separate owner verifier). Private
signing tokens never enter the service container or leave their generating
host. The TLS server key is separate from signing credentials and is generated
on the service host. Put its certificate and key in the `tls` directory with
permissions readable by the service UID only for the key. The certificate must
name the LAN address or stable DNS name used by the clients.

For a private CA, deliver only its public CA certificate to clients and set
`NODE_EXTRA_CA_CERTS` before starting Node. Both `http:` (historical pilot) and
`https:` are supported, with standard certificate and hostname verification.
Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`. Use HTTPS for NAS qualification.
Set both `FLEET_TLS_CERT` and `FLEET_TLS_KEY`; supplying only one fails startup.

Load the source-bound image archive, verify its recorded checksum and image
identity, then deploy by its inspected digest. The published address below is
required; omitting it binds every host interface and can bypass appliance
firewall expectations. Use a separate port and fresh root for qualification.

```sh
shasum -a 256 -c runtime-image.tar.sha256
docker image load --input runtime-image.tar
docker image inspect --format '{{.Id}}' "$FLEET_IMAGE"
docker run --detach --name "$FLEET_CONTAINER" \
  --platform linux/amd64 --restart unless-stopped --stop-timeout 30 \
  --publish "${FLEET_LAN_IP:?}:${FLEET_HOST_PORT:?}:8787" \
  --volume "${FLEET_SERVICE_ROOT:?}/state:/var/lib/fleet-runner/state" \
  --volume "$FLEET_SERVICE_ROOT/output:/var/lib/fleet-runner/output" \
  --volume "$FLEET_SERVICE_ROOT/public-keys:/run/fleet-runner/public-keys:ro" \
  --volume "$FLEET_SERVICE_ROOT/tls:/run/fleet-runner/tls:ro" \
  --env FLEET_TLS_CERT=/run/fleet-runner/tls/server.crt \
  --env FLEET_TLS_KEY=/run/fleet-runner/tls/server.key \
  "$FLEET_IMAGE" serve
```

Use the NAS's LAN address only; do not publish on `0.0.0.0`, `::`, or a WAN
interface. Verify the actual Docker `HostIp` and host listener. No live queue,
registry, accepted artifacts or Mac LaunchAgent is reused for qualification.

Startup and runtime logs contain an allowlisted phase/error code, never a raw
message, path, request body or token. A future schema, missing verifier,
unwritable output or bind failure must exit visibly. HTTP body limits are
64 KiB for controls and 16 MiB for completion, with a 16-connection cap and
bounded header/request/idle timeouts. Header shape, time and registered key are
checked before body allocation; body authentication still verifies its signed
digest. These finite limits are not a general Internet-service qualification.

The image HEALTHCHECK is **TCP liveness only**. Application readiness requires
a signed owner `GET /report`, writable/readable output storage and usable
registry/database. A live process must not be shown as verified backup health.
The server stops accepting on SIGTERM and closes active requests within its
bounded grace; Docker's 30-second stop window exceeds that grace. Process
crashes, container replacement and actual appliance reboots are distinct
qualification cases. A manually stopped container stays stopped under
`unless-stopped`. Keep the original coordinator authoritative until explicit
cutover and rollback rehearsal.

## Worker interruption and diagnostics

A transient heartbeat failure is retried within the known lease budget; an
explicit rejection or exhausted budget cancels the handler. Completion retries
the same bytes/fence after ambiguous transport failures while the lease can be
renewed. Unacknowledged output is retained locally for diagnosis rather than
deleted. Permanent HTTP rejection records a nonretryable failure when the
server still recognizes the claim. An explicit stale response never overwrites
accepted output.

`workOnce` accepts an abort signal for immediate cancellation/release.
`runWorker` drains on stop for `shutdownGraceMs` (default 30 seconds), then
cancels and releases. Handlers must honor the supplied signal. Stop the process
with a grace longer than the drain plus one bounded request; forced termination
still relies on lease recovery. Worker events include only a bounded error
code/status and polling delay. An observation callback cannot kill the loop;
polling adds small bounded jitter (`jitterRatio: 0` for deterministic doubles).

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
separate probe container using the published loopback port and holding synthetic credentials to enqueue one fixed
fixture, execute it through the compiled client/worker loop, verify accepted
output, and assert exactly one completion event. The service container sees
only the public-key registry. The evidence directory preserves both install
manifests and logs, both portable worker tarballs, the runtime image archive and
SHA-256, image inspection and build metadata, negative-probe outputs, and a
machine-readable `evidence-report.json`. Restore the image with
`docker image load --input runtime-image.tar`; install a worker tarball on a Mac
with pnpm as above. The matching local image tag is retained in Docker as well.
The script refuses to overwrite an existing evidence directory and fails if
source changes during proof. The report is evidence for those exact
source/tool/image inputs; it does not assert bit-identical image layers or
production readiness.

The published-port packaging probe uses Docker host networking for its disposable
**client**, not for the service. Run it against a native Linux engine (or an
explicitly enabled Docker Desktop host-network feature). It checks graceful
stop/start and preserved completion; actual NAS crash/reboot evidence remains
separate. The auth mutation now substitutes a module-global replay cache: the
fresh-process test must reject that weaker implementation.
