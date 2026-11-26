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
scripts/fleet-promote.sh revert <run> --owner-approved '<the owner's yes, naming the run>'
scripts/fleet-promote.sh status <run>
```

Going live always needs the owner's own yes, and only for a revision the stage
script passed (ojfbot/core#647, slice 4). The private config gains production's
control folder, service root, Compose project, the exact identities whose keys
production has enrolled (`PROD_KEY_IDS`, required), and a private folder on this
Mac holding a **read-only** identity's token (default `observer`) and
production's CA certificate; the full list is at the top of
`scripts/lib/fleet-stage-lib.sh`. The promote never signs as production's owner
and refuses a config that asks it to. All its output also goes to a durable log
beside the private config (`logs/promote-<run>.log`). It prints no host, address,
account or path, and not the owner's words either (they may name such things):
it prints what they approve and the SHA-256 the decider spends, and the words
themselves are kept only in the run's plan and record on the server.

### One decider

Exactly **one process decides** whether a switch passed or is undone: the
decider, `scripts/fleet-promote-decider.sh` (POSIX sh, with
`scripts/fleet-promote-guard.pl` for what sh cannot do). The Mac uploads both
into the run's own folder on the server and starts the decider there, in a
session of its own, so it outlives the connection. There is no second party
that could also decide: no watchdog, no claim files, nothing to arbitrate.

- **The lock is the decider's life.** The decider holds an exclusive kernel lock
  (`flock`) on production's **control folder itself** (`NAS_PROD_DIR`), on a
  descriptor it keeps open for its whole run. `run`, `recover` and `revert` all
  take it first. The lock is held by the decider and by the helper that bounds
  each step, so it is free only when both are gone. There is no lock file or
  folder, and nothing to remove by hand. The control folder is where the decider
  is; a plan cannot name another one, and the decider refuses if the folder is
  not the one earlier operations ran in.
- **The journal is the only authority.** `promote-runs/<run>/journal` has one
  line per completed step, written in one write and flushed to disk (file and
  folder) before the next step starts. What production runs now, which yes was
  spent and whether an operation is unfinished are all read from the journals,
  nowhere else; the records in `promote-records/` are reports derived from them.
  Only one operation may be unfinished at a time: every mode refuses while
  another operation's journal has no `done` line, except `recover` of that
  operation. Every journal is read once, by the guard, and checked before
  anything is decided by it. An absent journal, an empty one and a last line
  without its line break (cut) are states an operation can be in. A complete
  line that is not a record, or a journal that cannot be read, is not: the
  decider halts and changes nothing, in every mode. It never takes "could not
  read" for "never began".
- **It halts rather than guess.** When the engine's or the disk's state is
  ambiguous the decider stops, says what is unresolved, and changes nothing
  more. It never writes `done` for an outcome it did not just observe. A halted
  operation blocks every other one until it is resolved.
- **The Mac supplies evidence, not decisions.** It answers two challenges, each
  with a fresh random value from the decider that it must echo: a **go** at the
  start (so a start that arrives late, with nobody watching, changes nothing),
  and, once the new revision runs, the **evidence** only a client can give: what
  the signed status answers and the TLS certificate's fingerprint. The decider
  compares the values itself. Evidence that does not answer its challenge is
  ignored, not treated as bad. No evidence in the window, or evidence that does
  not match, means undo. So a Mac that is closed, interrupted or cut off
  mid-promote ends in an undo, made by the decider alone.
- **The Mac prints PASS only from the decider's record:** after reading
  `done outcome=pass` in the journal *and* the record the decider wrote. It
  says it as that run's result, with the time the decider committed it ("PASS
  run <run> promoted <revision>, committed <time>"), never as "production
  runs": whoever reads it late is not told what production runs now.

Subprocesses the decider starts: perl (the guard), the engine client (`docker`)
and its Compose plugin, `sh`, `ps` and coreutils. Nothing else. On the server
the Compose plugin runs in the engine client's own process group (seen in the
rehearsal: a real, attached `compose up` ended at its bound left neither the
client nor the plugin), so ending the group ends it too. A later plugin that
started in a group of its own while keeping the client's pipe would make the
guard report a step that could not be ended, and the decider would halt.
Nothing the decider decides rests
on "the client is gone", though: every undo step and the commit look at the
engine's own state (a container seen stopped, a list seen empty, the previous
production seen running, and seen again after a settle interval).

`promote-runs/<run>/steps.log` and `engine.log` are operational logs: the label
and bound of each engine call, and the engine's own output. Nothing reads them
to decide anything.

### What it refuses, before anything changes

On the Mac: no approval (exit 3) or one of more than one line; a revision
argument that is not the start of the commit ID it resolves to (a branch or tag
named like a short ID); an approval that does not hold the start (7 to 40 hex
characters) of exactly this revision's commit ID (a hex-looking word that is the
start of no commit, such as a date, is ignored; one that names another commit,
or more than one, refuses); a checkout that is not clean or not at `origin/main`
(`--rehearsal` lifts this for a throwaway production only); `stage-state` not
naming the revision as both `last_passed` and `staged_ok`; no **receipt** on this
Mac for the revision, or a server `release.json` or image that does not match
it; a Compose config that is not production's allowlisted shape
(`scripts/compose-check.mjs`: the hardening, a non-root user that owns the state
folder, the five mounts, one published address and port, this revision's image,
production's current worker and observer lists by SHA-256, and no `$`).

By the decider (its `check` mode before the start, and again under the lock):
an approval already used (each yes covers one operation; its SHA-256 is in the
journal line that spends it); another unfinished operation; a production that is
not in exactly the form the journals say; for the first promote, a hand-started
container that is not exactly what the Compose file reproduces (port, five
mounts, settings), or whose **restart policy would bring it back at a reboot**
(anything but `no` or `unless-stopped` is refused: `always` comes back, and for
`on-failure` the engine's documentation does not say that a container stopped
by hand stays stopped; changing a policy is the owner's step, never the
script's); enrolled keys that are not exactly `PROD_KEY_IDS`; free disk below
twice the state folder plus 50 MB (both numbers are printed); a bound that is
not a plain whole number between its floor and its ceiling; and **everything an
undo would need** (see below).

**The staged revision, at the moment the yes is spent.** The Mac reads the test
copy's `stage-state` early, as a first refusal. The decider reads it again
itself, once, under its lock, immediately before it writes the line that spends
the yes, and refuses if this revision is no longer both the last that passed
and the one staged. So a revision that was staged over while the Mac was
preparing is not promoted.

### The switch

After the Mac's go and the checks, the decider spends the yes (one journal line)
and then:

1. stops the previous production and **sees it stopped**;
2. copies the state folder (flushed to disk), checks the copy with SQLite's
   integrity check, and names it `state.pre-<run>` with a marker inside that
   names the run. The check runs as the service account in a helper container
   that is given that one copy and nothing else, and opens the database
   read-only. The copy's folder is mounted writable for it: a database in
   write-ahead mode cannot be opened from a folder SQLite may not write its
   index files to, so the snapshot may hold `fleet.sqlite-shm` and
   `fleet.sqlite-wal` beside the database;
3. writes `starting` (from here the new revision may have changed the state
   folder) and starts the new revision from **exactly the checked bytes**: the
   guard reads the config once, checks its SHA-256, and gives that one buffer to
   Compose on stdin, so no file is read between the check and the start;
4. checks on the server: the running image is the checked one, the engine
   reports it healthy, the enrolled keys are identical by hash, and there are no
   fewer jobs than in the snapshot. (If the engine has no health check for a
   container, the journal and the record say "running, no health check", never
   "healthy"; what the service itself answers is the Mac's evidence);
5. waits for the Mac's evidence (default 120 seconds, 60 to 600);
6. writes `committed`. That line is the decision. Then the record
   (`promote-records/promote-<run>.txt`) and `done outcome=pass`.

Any failure after the yes is spent is undone by the decider itself.

### The undo

Every step is "make it so" and looks at what is there:

1. this run's helper containers are removed by name and seen gone; an
   **unverified** snapshot copy of this run is removed (never a verified
   snapshot, never another run's): it is the likeliest thing to have filled a
   disk;
2. if the new revision may have started: every container of the production
   project is stopped, removed, and seen gone;
3. if the new revision may have started: the changed state folder is set aside
   as `state.failed-<run>` and the snapshot becomes the state folder again. Two
   renames, each atomic and flushed; where they stand is read from the folder
   names **and** the snapshot's marker, and anything else halts;
4. the previous production: if its own container still exists it is stopped and
   **seen stopped** first (a stop the engine accepted goes on after its client
   is gone, so "it runs" is never trusted after an interrupted stop), then
   started. A previous Compose production that the new revision replaced is
   started from this run's own copy of its config, whose SHA-256 must be the one
   journaled before the switch; a changed copy is never started;
5. the engine reports it healthy (or running, where it has no health check for
   it, and the record says which); after a settle interval it is checked again to
   be the same container or image, running and as it was. Only then `done
   outcome=undone` and the record `promote-records/undo-<run>.txt`, which
   carries the time of that check and how many jobs the set-aside state holds
   compared with the snapshot (so the owner knows what the unconfirmed build
   accepted).

The undo's prerequisites are checked **before the first disruptive call, in
every mode** (`run`, `recover`, `revert`): the previous container or this run's
copy of the previous config, the previous image by ID and that its name still
names it, the snapshot with its marker where there should be one, and the state
folders. If `recover` finds one missing while the unconfirmed build runs, it
refuses and **leaves that build running**, saying exactly what is missing.

A journal line that cannot be written does not stop the undo: production coming
back matters more than the line. The run then ends "UNDONE, RECORD INCOMPLETE"
with a non-zero status, and `recover` completes the record. If the line that
was lost is the one saying the previous production was seen stopped, the
message says that `recover` will stop it, see it stopped and start it again
before it completes the record (see "It looks before it acts" below). A `committed` line
whose write reported a failure is read back: if the line is in the journal the
run ends "COMMITTED, RECORD INCOMPLETE" (never undone, never called a pass until
`recover` confirms it); if it is not, the switch is undone.

Engine calls that outlive their client, stated plainly: one call the engine had
already accepted may still land after its client was ended. A stop that lands
late is caught by "stop again and see it stopped" and by the settle check. A
container that a late create makes is never started (nothing is left to send
the start) and is found by the check at the next operation's entry, which
refuses while a container of the project exists that the journals do not
explain.

### recover: the one command

```sh
# on the server, in production's control folder (NAS_PROD_DIR in the private config):
cd <control folder> && sh promote-runs/<run>/decider.sh recover <run>
```

That one line is the whole "put it back by hand". It needs nothing from a Mac:
the run's folder holds the decider, its helper, the plan and the journal. It
takes the lock, reads the journal, and either **confirms a committed pass**
(completing its record) or **completes the undo**, from every journal position,
and is safe to repeat: a finished operation is only read. It never goes
forward: without a `committed` line it undoes.

Before it touches the engine it requires that this is the operation that was
begun: the plan in the run folder must have the hash recorded in the journal's
first line, and the control folder must be the one recorded there (a copy of
the folder has another lock). If not it halts and changes nothing.

It **looks before it acts**. If what the undo brings about is already there (no
helper container of the run, the previous production running with its recorded
identity and nothing of the project beside it, the state folders as an undo
leaves them), it stops nothing and starts nothing: it checks health, waits the
settle interval, checks again and writes the record. That is the case after a
run that ended "UNDONE, RECORD INCOMPLETE". The one exception: if the journal
does not show that the previous production was ever *seen stopped* (the run
died at its very first stop), a stop may still be on its way in the engine, so
the previous production is stopped, seen stopped, and started again.

If the lock is held, a holder exists: the decider, or a step it started that is
still running. `recover` waits for the longest step to be ended at its bound;
after that it refuses and names the holder by process ID and command name. If a
recorded step of the run is still running although the lock is free, it halts
and names it. In both cases production may be down until that process is
ended, and nothing else will run.

### revert: going back after a pass

`fleet-promote.sh revert <run>` is an **owner-run command. No agent runs it
without the owner's yes naming the run.** It is an operation of its own, with
its own name, journal and approval (single-use, like a promote's; it must hold
the run's whole name), and is recovered by `recover` like any operation: a
half-done revert is completed, never rolled back. The promote's journal and
record are never rewritten. Only the run production is on now can be reverted.
Before it does anything it prints how many jobs accepted since the promote it
will set aside; they stay in `state.failed-<revert run>`. After a first cutover
the hand-started container stays stopped so a revert can bring it back; the
owner may remove it once a revert is no longer wanted.

### The bounds

Every engine call is bounded. At the bound the guard ends the step's whole
process group (TERM, 5 seconds, KILL) whether or not its leader already exited.
A step has ended when its leader has exited **and** nothing else is left in its
process group; the guard looks at the group itself (with `ps`, while the
leader is still its uncollected child, so the group's number cannot have been
given to anyone else). The pipe every descendant inherits is only a hint to
look: a process can close it and live on. A process that leaves the group
cannot be seen this way; if it kept the pipe the guard reports a step that
could not be ended, and otherwise nothing knows of it, which is why no decision
rests on a client having ended. The step's group is recorded in the run folder
before the step starts; in an undo a step runs even if that record could not be
written (the disk may be the problem), and then relies on the lock, which the
guard holds until the step's group is gone, and on the undo looking at the
engine's state after each step. The decider, the guard and the engine client
hold the lock. The Compose plugin does not, because the engine client does not
pass that descriptor on. So if the guard and the client are both killed while
the plugin still runs, and the record was not written, nothing records the
plugin. The next operation then relies only on what it sees of the engine's
state, as it does for any engine request that outlives its client. A step that cannot be ended halts the decider,
which changes nothing more.

All waits and bounds are measured on a clock that cannot be set (the guard reads
`CLOCK_MONOTONIC`), not by counting sleeps, so a busy server does not stretch
them. A health wait is one budget: a look at the container is only started if
its bound and the ending of a look that runs into it still fit.

`sh scripts/fleet-promote-decider.sh bounds` prints the table. The Mac prints it,
for the plan it is about to send, **before the yes is spent**; an impossible
setting is refused before anything is touched. With the defaults:

| Step | Seconds |
|---|---|
| The Mac waits for the decider's first journal line | 15 |
| The decider waits for the Mac's go | 30 |
| The decider's checks, production still up | 270 |
| Stop the previous production and see it stopped | 55 |
| Copy the state folder (the snapshot) | 120 |
| The snapshot's integrity check | 60 |
| Name the verified snapshot | 30 |
| Start the new revision and identify it | 80 |
| Wait for the engine to report it healthy (one budget) | 60 |
| Enrolled keys and job count in the new container | 60 |
| **Wait for the Mac's evidence** | **120** |
| Undo: see that no helper container of this run is left | 10 |
| Undo: stop and remove the new revision | 75 |
| Undo: look at the state folders, two renames | 90 |
| Undo: stop the previous production again and see it stopped | 65 |
| Undo: start the previous production and identify it | 80 |
| Undo: identify it and wait for the engine to report it healthy | 80 |
| Undo: settle, then check it again | 35 |
| Undo: count the jobs set aside and write the record | 40 |
| Ending the five steps that may run into their bound without ending the undo | 80 |

**Worst case, production offline or on an unconfirmed build: 1140 seconds
(about 19 minutes).** A pass takes at most 625 seconds; the longest stretch with
nothing answering is 910 seconds. The decider computes these figures from the
same numbers it runs the steps with, and a test adds up every call of a pass, of
a full undo and of the checks against them. Five steps may run into their bound
without ending the run, and so add their ending (10 seconds; 40 for a helper
container, which is then removed by name and seen gone): the stop of the
previous production, the stop and the removal of the new revision, the second
stop of the previous production, and the count of set-aside jobs. Any other
step that runs into its bound ends the switch or halts the undo. Local record
writes are counted (10 seconds) but not timed. These hold while the engine and the disk
answer within their bounds. If an undo step itself fails, the decider halts,
says production may be down, and waits for `recover`; it does not retry forever.
Each bound is `FLEET_B_<NAME>` in the environment of `fleet-promote.sh` (`STOP`,
`COPY`, `INTEGRITY`, `START`, `HEALTH`, `EXEC`, `EVIDENCE`, `UNDO_START`,
`UNDO_HEALTH`, `SETTLE`, `GO`, `FIRST`). A bound must be a plain whole number
(no leading zero) between its floor and its ceiling; the ceilings are far above
what the rehearsal measured, with room for a state folder of gigabytes:

| Bound | Default | Floor | Ceiling |
|---|---|---|---|
| `FIRST` | 15 | 10 | 120 |
| `GO` | 30 | 10 | 300 |
| `STOP` | 45 | 40 | 300 |
| `COPY` | 120 | 10 | 3600 |
| `INTEGRITY` | 60 | 10 | 900 |
| `START` | 60 | 10 | 600 |
| `HEALTH`, `UNDO_HEALTH` | 60 | 20 | 600 |
| `EXEC` | 30 | 10 | 300 |
| `EVIDENCE` | 120 | 60 | 600 |
| `UNDO_START` | 60 | 10 | 600 |
| `SETTLE` | 10 | 1 | 120 |

The defaults stay as they are for the first real promote, by the owner's
decision of 2026-11-26: "keep generous worst case limit for first run". No
ceiling is below its default. Tightening them is a later change, made once real
production times exist.

Measured once, on a throwaway production on the server with a state folder of
about 1 MB and every bound at its default (2026-11-25; a bigger state folder
copies for longer): a passing promote took 18 seconds from the decider's first
journal line to `done`, with nothing answering for 3 seconds (stop, snapshot,
start) and the new revision unconfirmed for 9 seconds; an undo after bad
evidence took 21 seconds, 10 of them the settle interval; `recover` after the
decider was killed took 23 seconds; a revert took 24 seconds. The bounds are
far above these on purpose: they are what is waited for when something hangs,
not what a healthy switch takes.

If the Mac never sees the decider's first journal line it says the decider did
not begin and that nothing was changed by this run. If it cannot reach the
server any more it says what it last read and when, whether its evidence was
delivered, and gives the `status` and `recover` lines; it never prints PASS and
never says anything about a lock. After Ctrl-C it prints "interruption
requested; outcome pending" and keeps reading until it knows the outcome; its
own look at what production answers afterwards has the same patience as
without the interruption.

### If the server reboots mid-switch

There is no boot-time hook (installing one is the owner's step on the server).
The journal and `recover` are the answer:

| Journal at the reboot | What is up after boot | What to do |
|---|---|---|
| before `stopped` | the previous production | `recover` closes the run |
| `stopped` up to before `starting` | nothing: a container stopped by hand stays stopped | `recover` starts the previous production |
| `starting` up to before `committed` | the unconfirmed new revision, by its restart policy | `recover` undoes |
| `committed` or later | the new revision | `recover` confirms |

This table is why the first cutover refuses a hand-started container whose
restart policy would bring it back after it was stopped.

### Rehearsal

`--rehearsal` lifts the clean-checkout rule and is refused unless the control
folder **and the service root** both carry `.fleet-runner-promote-rehearsal`: a
throwaway production with its own Compose project, folders, port and keys,
never production's database. A real promote refuses a folder that carries the
marker. So a throwaway control folder cannot be paired with production's own
service root: production's root does not carry the marker.
`FLEET_PROMOTE_FAULT=health` makes the Mac's evidence name a wrong build;
`FLEET_PROMOTE_FAULT=silent` withholds it. Both need `--rehearsal`.

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
