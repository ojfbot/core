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

After copying each **public** verifier, check that the actual nonroot service
UID can read it. A source file copied as mode 0600 under a different UID causes
HTTP 401 even with the correct signing credential. Use service ownership with
0600, or 0644 for these public files inside the dedicated registry; never apply
this permission change to private signing or TLS keys, or recursively to a home.
Verify readability from the running container's service identity before
starting its worker.

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

## CI release image

Every push to `main` runs `.github/workflows/fleet-runner-release.yml`
(ojfbot/core#647, slice 1). It builds the service image from a `git archive` of
that commit, twice, without cache, for `linux/amd64`, with timestamps rewritten
to the commit time. The two image IDs must be identical or the run fails. It
then runs `scripts/verify-release.sh load` on the result: checksum, the
archive's own identity, load, image ID, `linux/amd64`, and a numeric non-root
user. Each non-PR run has its own concurrency group and is never cancelled, so
every `main` revision gets a release even when pushes arrive close together.

The run publishes one artifact, `fleet-runner-release-<12-character revision>`,
kept 7 days, holding three files:

| File | Contents |
|------|----------|
| `fleet-runner-image.tar` | the image archive |
| `fleet-runner-image.tar.sha256` | its SHA-256 |
| `release.json` | full revision, image ID, manifest digest, archive hash, build inputs |

Pull requests that touch the build inputs run the same build and verification
but publish nothing. This repository is public, so runner minutes are free; the
only stored output is one archive per `main` push.

To rebuild a release whose artifact has expired, run the workflow from `main`
in the Actions tab (`workflow_dispatch`) and give the `revision` input. The
revision must be an ancestor of `main`; the workflow checks out full history to
prove that, then builds that commit using the build files from that commit.
Artifact names only have to be unique within one run, so rebuilding a revision
that still has an artifact (or rebuilding it twice) creates a second artifact
with the same name in a different run. See the rule below for which one to use.

### Trusting a downloaded release

Checksums only prove the three files agree with each other, not who built
them. `verify-release.sh` therefore also reads the archive itself *before*
loading anything (`scripts/verify-archive.mjs`), on one rule: an exact
allowlist, and refuse everything else. Docker and tar clean paths, match JSON
field names case-insensitively and let the last duplicate win, so anything they
could read differently from the verifier is refused rather than reconciled.

- **Tar members:** plain ustar only, regular files and directories only, and
  only the names a BuildKit docker export holds (`manifest.json`, `index.json`,
  `oci-layout`, `blobs/`, `blobs/sha256/`, `blobs/sha256/<hex>`). Each name
  appears once; `./x`, `x/../y`, `/x`, `a//b`, links, and pax or GNU extension
  records are all refused. A directory must have size 0 (a sized one could hide
  members from the parse), and nothing but zeros may follow the end marker.
- **JSON:** read by a strict parser that rejects duplicate keys, and every
  object (`manifest.json` entry, `index.json`, its manifest entry, its
  annotations and platform, `release.json`) must have *exactly* the expected
  keys, so `config` or `CONFIG` beside `Config` is refused.
- **Identity:** one image, whose config blob hashes to `image_id`, whose only
  tag is `fleet-runner:<revision>`, and whose index (annotations an engine
  names the loaded image from, platform, digest) is the one the release
  records. A different archive cannot pass by sharing a tag the host already
  has.
- **The OCI manifest:** an engine using the containerd image store imports from
  `index.json` and ignores `manifest.json`, so the manifest blob the index
  points at must hash to the recorded manifest digest, name the checked image
  ID as its config, list the same layers as `manifest.json`, and obey the same
  exact-key rule. An `oci-layout` is accepted only with an `index.json`.

### Where each half runs

The full check needs `node` and runs on the Mac or in CI, never skipped (a host
without `node` fails it). A server such as the NAS has neither node nor
necessarily bash, so the load there is a separate POSIX `sh` script that needs
only `sh`, `awk`, `tr`, a SHA-256 tool and Docker:

```sh
# On the Mac or in CI, before copying anything to the server:
bash packages/fleet-runner/scripts/verify-release.sh check <release-dir> <revision>
# On the server, with the values from the checked release.json:
sh load-release.sh <archive> <archive-sha256> <image-id> <tag> [manifest-digest]
```

`load-release.sh` re-hashes the archive against the checked SHA-256 before
loading (which ties the bytes it sees to what was checked), loads it, requires
the loaded image ID to equal the checked one, and checks `linux/amd64`, user
`node` and a numeric non-root uid. `verify-release.sh load` runs the same
script, so CI exercises exactly what the server runs.

None of that proves the build came from this repository. On a public
repository a fork's pull request runs the *fork's* copy of the workflow, which
can publish an artifact with the same name as a real `main` release. A consumer
(the stage script, slice 3) must therefore select the workflow run, never the
artifact name, and download by that run's ID. Never download by artifact name
alone. Two kinds of run are acceptable, all with workflow file
`fleet-runner-release.yml`, head repository `ojfbot/core` and branch `main`:

- **A push run:** event `push`, and head SHA equal to the full revision.
- **A rebuild run:** event `workflow_dispatch`. Its head SHA is the tip of
  `main` when it was dispatched, *not* the rebuilt revision, so that field
  cannot be used. Accept it only when `release.json`'s `revision` is the
  requested commit (`verify-release.sh ... <revision>` checks this, and it
  binds the revision to the archive's own tag).

Prefer a successful push run when one exists and has not expired; otherwise
take the **newest successful rebuild run** for that revision.

Check a downloaded release anywhere with bash, sed, awk, node and a SHA-256
tool (plus Docker for `load`; see above for the node-free server half):

```sh
bash packages/fleet-runner/scripts/verify-release.sh check <release-dir> <revision>
bash packages/fleet-runner/scripts/verify-release.sh load  <release-dir> <revision>
```

`<revision>` is a full commit or an unambiguous prefix; the check fails if
`release.json` names another commit. To build the same release by hand, run
`bash packages/fleet-runner/scripts/release-image.sh <new-directory> [commit]`
on a machine with Docker Buildx.

## Test copy and stage script

A permanent FleetRunner **test copy** on the server (ojfbot/core#647, slices 2
and 3) takes a release from CI, proves it works, and leaves it ready for a
promote. It has its own Compose project, folders, port, database, TLS
certificate and signing keys, separate from production, and it runs only while a
test is under way. Staging needs no approval; going live always needs the
owner's own yes naming the revision (see "Promoting to production").

Nothing machine-specific is in this repository. The scripts read a private
config file outside Git (default `~/.fleet-runner-stage/stage.conf`, mode 0600;
a file others can write is refused), documented at the top of
`scripts/lib/fleet-stage-lib.sh`: the SSH alias, the deploy folder and service
root of the test copy, its LAN address, port and name, the private folder on this
Mac for the test keys and CA certificate, and production's port and container
name, declared only so the scripts can refuse to collide with them.

### One-time setup

```sh
scripts/fleet-stage-setup.sh --tls      # idempotent; never overwrites a key, certificate or env file
```

On the server it creates the deploy folder (`compose.yaml`, `fleet-staging.env`,
`releases/`) and the service root (`state/`, `output/`, `public-keys/`, `tls/`),
each carrying a marker file. Every later run refuses to change anything unless
both markers are present, so a run can only ever target a folder this setup
created for the test copy; a folder that already holds files but has no marker
is refused. The env file holds no secret.

On the Mac it generates the test copy's own `owner` and `stage-worker` signing
keys with `fleet-runner keygen`. The private tokens stay in the private folder;
only the `.pub` files go to the server's registry. These are never production's
keys. With `--tls` the server's TLS key is made on the server and never leaves
it; the certificate is signed here with the private CA, naming the test copy's
host and address, and only the certificate is copied back. A passphrase-protected
CA key stops this step: it never asks for or types one.

### Staging a revision

```sh
scripts/fleet-stage.sh <revision> [--release <dir>] [--keep-running]
```

1. **Isolation.** Refuses unless both markers exist, the server's
   `fleet-staging.env` says the same `FLEET_STAGE_ROOT`, `FLEET_HOST_PORT`,
   `FLEET_LAN_IP` and project as the private config (the container is configured
   by the one, the checks by the other, so they must agree), the test copy's root
   and deploy folder are not inside production's declared root (or the reverse),
   the port differs from production's and is not published by another
   container, and the name differs from production's. It compares declared
   values and lists container names and ports only; it does not inspect or touch
   production. The env file is the one Compose actually reads, so a root, port or
   address in it that differs from the private config (for example one that names
   production's root) is refused before anything changes. Compose's own env
   parser accepts more than `KEY=value` (`export KEY=...`, quotes, and a later
   duplicate that wins), so instead of re-implementing it the file must be exactly
   one plain `KEY=value` per line: no `export`, no quotes, no duplicate keys, no
   interpolation. Setup and the stage script write that form themselves.
2. **Lock.** One run at a time: an atomic lock folder on the server, owned by this
   run's ID (the time plus the process ID, which also names every backup of the
   run) and released on every way out. The switch records its server-side process
   in the lock and checks before every step that the run still owns the lock and
   has not been told to stop. Each such server-side script (the switch, and the
   recording of the pass) runs in its own process group, recorded in the lock, so
   that a rollback can wait for everything it started (the record is removed only once
   the whole group is confirmed gone, never by the shell's own exit handling, which
   bash runs on HUP or TERM while a child lives on); if a group cannot be made,
   the step fails rather than running unfenced. A crashed run's lock is left for a person to remove,
   and so is the lock of a rollback that could not confirm the test copy is at rest;
   the message says where.
3. **Release, verified here every time.** Uses `--release <dir>`, or downloads the
   CI artifact by **run ID**, choosing the run by the rule in "Trusting a
   downloaded release": workflow `fleet-runner-release.yml`, this repository,
   branch `main`, success, and either a push run whose head SHA is the revision,
   or (newest first) a rebuild run whose `release.json` names the revision. A
   fork's look-alike artifact is never selected. `verify-release.sh check` runs
   on this machine even when the server already holds a copy of that revision;
   that copy must then be byte-identical to the verified `release.json`, else it
   is refused and never trusted for its own checksum.
4. **Copy and load.** The archive, its checksum, `release.json`, and that
   revision's own `compose.yaml` and `load-release.sh` go to the server, where
   `load-release.sh` re-hashes the archive against the checksum checked here,
   loads it, and checks the image ID, platform and non-root user.
5. **Switch.** Backs up the env file, `compose.yaml` and the state folder (names
   carry the run ID), stops the test copy, writes the new revision, starts it
   (never pulling an image), and checks that the running image is the checked
   one. Compose prefers a variable in the calling shell to the env file, so every
   `FLEET_*` and `COMPOSE_*` variable of the server shell is cleared first (a profile
   that exports `FLEET_HOST_PORT` cannot move the test copy), and right before
   `up` the resolved `docker compose config` must show the test copy's own project,
   the four folders under its own root, its own address and its own port. The test copy is always stopped by its Compose project label rather than
   through Compose, which would first have to interpolate an env file that may
   hold no revision; a stop that fails, or leaves a container running, is a FAIL,
   and neither the state backup nor the pass record happens until every container
   of the project is confirmed stopped.
6. **Smoke test** from this Mac with the test copy's own keys
   (`scripts/stage-smoke.mjs`, using the built client of this checkout): the
   signed status answers ready with exactly this revision as its build; a signed
   job submit is accepted; a worker claims that job and finishes it.
7. **Result.** On success the test copy is stopped (`--keep-running` leaves it
   up), then `stage-state` is written in the deploy folder: one file, replaced by
   one rename, holding `last_passed` and `staged_ok`. At the start of every run
   `staged_ok` is cleared (keeping `last_passed`), so only a passing run leaves a
   revision promotable, and there is no moment when the two disagree. **On any
   failure, Ctrl-C, SIGTERM or lost connection after the switch began, an exit trap
   rolls back.** Its first act is to tell anything still running on the server (its
   connection may have dropped while it kept going) to stop, and to wait until the
   whole process group has ended, so a half-finished switch, or a Compose child that
   outlived its shell, can never start the untested revision after the rollback.
   That wait never kills anything (a stale ID could belong to someone else); if the
   group does not end in time the lock is kept and the message says so. Then the
   state folder, env file and `compose.yaml` are put back, `stage-state` is reset to
   the last revision that passed, that revision is started, checked to answer as
   itself, and stopped; with none yet, the test copy returns to its empty state.
   Rollback prints PASS only if every step worked. State copies (`state.pre-*`,
   `state.failed-*`) are kept; prune them by hand.

The test copy's containers are never restarted by the engine (`restart: "no"`),
and no scheduled job starts them.

## Promoting to production

```sh
scripts/fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>'
```

Going live always needs the owner's own yes, and only for a revision the stage
script passed (ojfbot/core#647, slice 4). The private config gains production's
deploy folder, service root, Compose project, the exact identities whose keys
production has enrolled (`PROD_KEY_IDS`, required), and a private folder on this
Mac holding a **read-only** identity's token (default `observer`) and
production's CA certificate; the full list is at the top of
`scripts/lib/fleet-stage-lib.sh`. The promote never signs as production's owner
and refuses a config that asks it to. All its output also goes to a durable log
beside the private config (`logs/promote-<run>.log`).

1. **Refusals, before anything changes** (production's deploy folder is not even
   created):
   - no approval (exit 3), or one of more than one line;
   - an approval in which any hex string of 7 or more characters (bounded by
     non-hex, any case) does not resolve, unambiguously, to exactly this revision,
     or in which there is none: a longer string that only starts with the
     revision, a window inside one, another commit, or an ambiguous short ID is
     refused;
   - a checkout that is not clean or not at `origin/main` (`--rehearsal` lifts
     this for a throwaway production only, and is refused unless its deploy folder
     carries a rehearsal marker);
   - `stage-state` not naming the revision as both `last_passed` and `staged_ok`;
   - no **receipt** on this Mac for the revision, or a server `release.json` that
     is not byte-identical to the receipted one. `fleet-stage.sh` writes the
     receipt (`receipts/<revision>.receipt`, beside the private config) from the
     release it verified on the Mac, so the server's account cannot forge the
     evidence;
   - an approval already used (each yes covers one promotion: its SHA-256, of the
     words in lower case with spacing collapsed, goes into `promote.log` when
     production is about to change; a refusal does not spend it).
2. **Checks under the promote lock, production still running:** the staged
   archive is re-hashed and loaded by **this checkout's committed**
   `load-release.sh` with the receipt's values; which form production is in
   (exactly one of the hand-started container `PROD_CONTAINER` and the Compose
   project); for the first promote, that the container is exactly what the
   Compose file reproduces; its signed status build, its TLS certificate
   (fingerprint), its enrolled keys by hash (exactly `PROD_KEY_IDS`). A
   production that does not answer a signed status now is not replaced.
3. **The Compose config, frozen and checked.** `deploy/compose.production.yaml`
   comes from the promoted revision, or from this checkout when the revision
   predates it. The next env file is written beside the live one; Compose
   resolves the two **once** (`config --format json`, its exit status checked)
   into a frozen file under the lock, and `scripts/compose-check.mjs` checks that
   file on the Mac against an exact allowlist: the hardening (`read_only`,
   `cap_drop: [ALL]`, `no-new-privileges`), a non-root user that owns the state
   folder, the five mounts (key and TLS folders read-only), one published address
   and port, this revision's image, production's current worker and observer
   lists (compared by SHA-256, never printed), and no `$`. Anything else
   (`privileged`, `cap_add`, devices, another network, a sidecar, an extra mount,
   port or variable) is refused by key name.
4. **The dead-man.** Before production is touched, a process is started on the
   server in a session of its own (it outlives the connection, with its own log
   in the lock). Unless this Mac commits a pass within `FLEET_DEADMAN_SECS`
   (default 600), it claims the undo and runs it, then writes the undo record and
   a `promote.log` line and keeps the lock for a person. The Mac and the dead-man
   claim the decision with one atomic `mkdir` under the lock, so exactly one of
   them undoes, and a pass can only be committed if the dead-man has not claimed
   the undo.
5. **The switch**, fenced on the server like the stage script's (own process
   group, output to a file in the lock, so a dropped channel cannot kill it):
   back up the files; mark `stopping`; stop the previous production; copy its
   state folder to `state.pre-<run>.part` (by a throwaway container of the checked
   image, by ID), open that copy read-only and run `PRAGMA integrity_check`, and
   only then name it `state.pre-<run>`; install the frozen config, check its
   hash again, mark `started`, and start it with
   `docker compose --env-file /dev/null -f compose.resolved.json up`, so nothing
   is re-read or interpolated.
6. **Health check:** the signed status answers ready with exactly this revision;
   the TLS certificate is the same; the new container sees the same keys by hash
   (exactly `PROD_KEY_IDS`); the job count is not lower than the snapshot's.
7. **Undo**, on any failure, Ctrl-C, SIGTERM, SIGHUP, closed terminal or lost
   connection after the switch began: this Mac claims the undo and starts it on
   the server in a session of its own, retrying with backoff for
   `FLEET_UNDO_RETRY_SECS` (default 180), or waits for the dead-man's. The undo
   fences, stops the new revision, restores the files, swaps the verified snapshot
   back **only if** the new revision was started (otherwise the live state is left
   alone), starts the previous production (for the first promote, that very
   container, checked by ID and image; else the previous frozen config), and waits
   for the engine's health. The Mac then checks the signed status answers as the
   previous build and writes `promote-records/undo-<run>-mac.txt`; a record that
   cannot be written is a failure. Ctrl-C cannot cut the undo short. It never
   prints PASS for a promote that did not pass.
8. **Success:** the record is written first (a failure undoes the switch), then
   the pass is committed (which publishes the record, logs it and disarms the
   dead-man), and only then PASS and the exact manual undo. A manual undo later
   loses every job accepted since the promote (they stay in the set-aside state
   folder).

The first promote replaces production's hand-started container. It is refused
unless that container is exactly what the Compose file reproduces: one published
port, the five service folders under the declared root (key and TLS folders
read-only), no privileges, devices, other network or auto-remove, and no setting
that would not carry over (only setting names and same/differs are printed,
never a value). That container is stopped, never removed, so the undo can start
it again; remove it by hand only once the owner has accepted the new production.
A promote is not release acceptance (G8).

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
FLEET_RUNNER_ARCHIVE="core-fleet-runner-$(node -p 'require("./packages/fleet-runner/package.json").version').tgz"
(cd .artifacts && shasum -a 256 "$FLEET_RUNNER_ARCHIVE" > fleet-runner-artifact.sha256)
```

Transfer the `.tgz` and `fleet-runner-artifact.sha256` to the worker Mac over the
approved channel, verify the hash there, and install it in the worker
application with pnpm:

```sh
shasum -a 256 -c fleet-runner-artifact.sha256
# Set FLEET_RUNNER_ARCHIVE to the exact basename in the reviewed checksum file.
pnpm add "./${FLEET_RUNNER_ARCHIVE:?set to reviewed archive basename}"
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

## Automatic input delivery (isolated NAS candidate)

Set `FLEET_INPUT_DIR` to a dedicated server-local writable directory and persist
it beside state and output. Enabling it requires each input hash to exist and
verify before admission. Existing pilot deployments without this variable retain
their protocol. Models and helpers stay host-local; the input limit is 16 MiB.

The owner signs a raw `POST /inputs/<sha256>` before enqueueing a typed job.
A worker signs `GET /inputs/<sha256>?key=<job>&fence=<attempt>` only after
claiming. The server checks the active worker, fence, lease and input membership;
release, completion and expiry revoke access. Neither route accepts a filesystem
path. Uploads are hash checked and durably published; clients bound and hash
check downloads before their application publishes to its own content store.
TLS uses ordinary certificate and hostname validation. Never disable validation.

This candidate extends the isolated qualification service. Historical G3 proof
is bound to its earlier source/image; it is not a G3 rerun of this extension.
Mac installation and real-handler receipts belong to the application PR linked
from the existing tracker. No live queue migration is implied.

## G5 operations contract and controls

The status API is version 1. Queue storage migrates atomically from v3 to v4,
preserving jobs, events and replay nonces while adding process-presence and
worker-control tables. Older binaries reject v4. A database trigger also blocks
an already-open older writer from claiming for a paused worker; current leased
work may drain. Never restart an older image against the migrated database.
This candidate changes only the isolated service; no live cutover is authorized.

`FLEET_WORKERS` declares the expected public worker labels (default yuri,yojimbo).
`FLEET_OBSERVERS` declares observer identities (default observer); register their
public verifiers with service-readable permissions. `FLEET_BUILD_REF` is the
public source commit shown in status. The process start counter tracks service
instances since status instrumentation, not the appliance's lifetime reboots.

- Signed `GET /status`: owner/observer only; version/revision/time, readiness,
  worker freshness/eligibility, queue and lease counts, opaque traces and an
  explicitly unqualified backup state. No payloads, input IDs, private paths,
  raw job keys, reader output or arbitrary logs are serialized.
- Signed `POST /worker-status`: registered expected worker's own observation;
  strict fixed fields/codes. Presence is independent of lease heartbeat and
  sent every ten seconds. Older than thirty seconds means stale/unknown.
- Signed `GET /worker-control`: each expected worker sees only its own gate.
- Signed `POST /control`: owner only, worker plus pause/drain/resume. The claim
  transaction and database trigger enforce pause. Active attempts may finish.
- Signed `GET /status/events?after=N`: bounded opaque replay, stable numeric
  cursor, at most 100 records. Legacy full-key events/reports remain owner-only.

With explicit local `FLEET_ENDPOINT`, `FLEET_TOKEN_FILE`, and `FLEET_ID`:

```sh
fleet-runner status --json
fleet-runner workers --json
fleet-runner events --after 0 --json
fleet-runner logs --json
fleet-runner doctor --json
# Owner credential only:
fleet-runner control yuri pause
fleet-runner control yuri drain
fleet-runner control yuri resume
# Observer credential; opens a local read-only viewer server:
fleet-runner console
# Optional stable loopback port for a separately supervised observer process:
fleet-runner console --port 8790
```

`logs` is the bounded structured latest worker diagnostic projection, not raw
container stdout. `doctor` distinguishes service/freshness from policy gating;
a deliberately paused fresh worker is observable, and backup qualification
remains explicitly unknown until G7.

The console prints a loopback URL without a credential. Its process signs
observer requests over the normal trusted TLS route; the browser never receives
a signing key or bearer token. The loopback server accepts only literal-local
Host and same-origin GETs, rejects writes/cross-site requests, and uses text-only
DOM insertion. Refresh is two seconds; failed, old or reordered snapshots clear
current readiness to unavailable/stale. CLI/browser views use the same snapshot
revision. The console is an operator client; the NAS service and Mac workers
continue independently if it or an agent GUI closes.
To keep the viewer available after an operator session closes, supervise that
observer command with the host service manager and a stable installed package,
managed Node executable and local observer configuration. Bind remains
127.0.0.1 even when a port is supplied. Never put a private signing key in a
service definition; reference its existing host-local file. This viewer adds
no queue authority or remote mutation endpoint.

Native latency qualification uses `scripts/fleet-runner/native-g5-benchmark.mjs`
in a disposable container from the same runtime image. It seeds 10,000 completed
fixed synthetic jobs in a new container-local database, declares two synthetic
process observations, and serves normal signed status over TLS. A separate LAN
observer records 1,000 request durations, checks the exact denominator, computes
p95 and rejects values over 250 ms. This fixture never seeds the actual sandbox
or live queue; its synthetic observations are not real Mac availability evidence.
