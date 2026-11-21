# Install the declared-command FleetRunner worker

FleetRunner owns the worker loop. Local settings select the job kinds, capabilities and installed
commands. Jobs provide data, never command text. The existing signed client and fenced acceptance
path handle the result. No project handler is imported into FleetRunner.

## Build and install

Use Node 24.22.2 and pnpm 9.15.4 in a clean, committed Core checkout.

```sh
pnpm install --frozen-lockfile
pnpm --filter @core/fleet-runner build
pnpm --filter @core/fleet-runner bundle
sh packages/fleet-runner/scripts/install-worker.sh --root "$INSTALL_ROOT" --node "$OFFICIAL_NODE"
```

Both paths must be absolute. For a normal Mac installation, use
`~/Library/Application Support/FleetRunner` as the root. Supply an official Node 24 binary,
at least 24.22.2. The installer checks its Node.js Developer ID signature before running it.
It downloads nothing and never writes settings or identity files.

The layout matches the HelpDesk device adapter:

```text
FleetRunner/
  fleet-runner.json
  worker-status.json
  worker/
    current -> 0.1.0
    0.1.0/{fleet-runner.mjs,node,manifest.json}
```

The manifest records the version, source commit, Node version, signature verifier, and both file
digests. A version folder is immutable and never replaced. The current link changes atomically
only after the copies, digests, signature and version report pass. Keep the previous version and
link target for rollback. The installer refuses an uncommitted bundle or a shell standing in for Node.

## Declare a command

Create `fleet-runner.json` with this shape, substituting absolute local paths and existing
worker credentials. Do not replace or copy another device's signing key.
The settings and token files must not be writable by group or others; mode `0600` is suitable.
The worker refuses either file when `mode & 0022` is nonzero.

```json
{
  "schemaVersion": 1,
  "endpoint": "https://existing-fleet-service:8443",
  "worker": "example-mac",
  "caFile": "/private/existing-fleet-ca.crt",
  "tokenFile": "/private/existing-worker-key",
  "outDir": "/private/fleet-attempts",
  "inputDir": "/private/fleet-staged-inputs",
  "statusFile": "/private/worker-status.json",
  "policy": {
    "timezone": "America/New_York",
    "power": "ac-only",
    "windows": [{ "days": [1, 2, 3, 4, 5], "start": "22:00", "end": "06:00" }],
    "exceptions": [{ "allow": "outside-window", "until": "2026-12-01T00:00:00Z" }],
    "gpuBusyFile": "/private/gpu-in-use"
  },
  "kinds": {
    "proof-fixture": {
      "capabilities": ["proof-fixture"],
      "command": [
        "/absolute/FleetRunner/worker/current/node",
        "/absolute/FleetRunner/worker/current/fleet-runner.mjs",
        "proof-fixture"
      ],
      "resource": "gpu",
      "requires": { "platform": "darwin", "arch": "arm64", "files": ["/private/models/model.bin"] },
      "pins": [
        {
          "path": "/absolute/FleetRunner/worker/current/node",
          "sha256": "<64 hex characters>"
        },
        {
          "path": "/absolute/FleetRunner/worker/current/fleet-runner.mjs",
          "sha256": "<64 hex characters>"
        }
      ],
      "timeoutMs": 300000
    }
  }
}
```

`inputDir` and `pins` are optional. With `inputDir`, the worker downloads every input of a claimed job
with that job's own lease before the command starts. Each download is size-bounded and hash-checked.
Verified bytes are kept once, read-only, in `blobs/` under their hash name and are read back without
following links and re-hashed before reuse; anything in the cache that is not a regular file this user
owns is replaced. The job gets its own folder `jobs/<key>.<fence>/` that holds links to exactly its own
inputs, which is the `inputDir` the command is told about; the folder is removed when the attempt ends. The
worker refuses (`unsafe-input-dir`) an `inputDir` that is a link or that others can write. This keeps one
job's command from stumbling over another job's inputs; commands are still trusted local programs, not a
sandbox. A corrupt or interrupted download is a retryable `input-unavailable`; a refusal by the service
(for example a blob the job does not name) is a non-retryable `input-refused`. Without `inputDir` the
worker fetches nothing.

`pins` name local files whose bytes the command depends on. If any pin is declared, the pins must include the
executable and every absolute path argument (the script it runs), whether or not it exists yet, or the
settings are refused. A pin is
checked at start and again as the last step before each command starts, after the inputs are staged, and a
pinned file must be a regular file that group and others cannot write. If one changed, the attempt ends with
`handler-pin-mismatch`, nothing is submitted, and that kind is no longer claimed (and drops out of the
status file) until the worker restarts. The check cannot be atomic with starting the program, so keep
pinned files and their folders writable only by the worker's own user.

`policy` is optional; without it the worker claims whenever the service allows, as before. With it the
worker claims nothing unless every rule holds, checked before each claim:

- `power`: `ac-only` (the default) refuses battery power and also refuses when the power source cannot
  be read. `any` skips the check.
- `windows`: days (0 is Sunday) with local `start` and `end` times in `timezone`. A window that ends
  before it starts runs past midnight and belongs to the day it starts on. Times follow the real clock of
  that zone, so daylight-saving changes need no special handling. No windows means always.
- `exceptions`: `outside-window` or `on-battery` until a time with an explicit offset. An expired
  exception is ignored (and reported as such). Unknown power is never excepted.
- `gpuBusyFile`: while anything exists at this path, or the path cannot be examined for any reason other
  than being absent, kinds with `"resource": "gpu"` are held back; other kinds run. Doubt means busy.

The rules are checked before the claim request and again immediately before each kind is claimed. They
can still change in the instant before the server sees the request; that gap cannot be closed without the
server, so it is narrowed and not removed. A running job is never cut short by it.

`requires` keeps a kind unavailable on a host that lacks the stated `platform`, `arch` or files, so a
handler that cannot run here is never offered or claimed. If a rule cannot be evaluated the worker does
not claim. The status file lists only the kinds currently offered, `unavailable` (kind to reason code:
`unsupported-platform`, `unsupported-arch`, `missing-file`, `gpu-busy`, `resource-busy`, `handler-pin-mismatch`) and
`claiming` (`allowed` plus `ok`, `power-battery`, `power-unknown`, `outside-window`, `exception-expired`,
`policy-error` or `service-paused`). A job already running is not interrupted by a rule change.

One worker identity runs one client. At start the worker takes a lock file beside its token file; a second
client for the same identity exits at once with `duplicate-client`, before it writes status, claims or
downloads anything. The lock belongs to a live process, so one left by a crashed worker is taken over
automatically. Kinds with a `resource` also take a slot file in `resourceDir` (default: a `resources` folder
beside the status file) before they claim, and keep it until the attempt ends, so only one job at a time
holds that resource among all workers sharing the folder. While another process holds it, the kind is
reported as `resource-busy`. Workers that share a resource on one host must share `resourceDir`.

Each executable must already be installed and executable. The worker invokes the fixed argument
array directly, without a shell. Direct Claude, Codex and shell launchers are refused. Installed
commands are trusted local programs, not a sandbox. Only listed kinds are claimed, with that kind's
own capabilities. One attempt runs at a time; server pause and drain stop new claims.

HTTP is accepted only for `127.0.0.1`, `::1` or `localhost` proofs. All other endpoints require HTTPS.
`caFile` is optional for a loopback HTTP proof. For the NAS, use the existing trusted CA certificate.
Node reads extra CA trust only at startup, so the command relaunches its own installed Node and
bundle once with that certificate, forwards shutdown signals, and starts no other worker runtime.
Repeated TERM or INT signals continue the same bounded drain, including in the CA parent.
If the existing NAS worker uses a recovery generation, preserve it in the optional `generation`
setting. Settings, keys, certificate paths and job content never appear in the status file.

An installed command reads one JSON envelope `{ "job": <claimed job>, "outDir": <output folder> }`
(plus `"inputDir"` when configured: that job's own folder, holding the files named by `job.inputs`)
from stdin. It writes `<job.key>.<job.fence>.jsonl` in that folder and returns exactly
`{ "file": "<job.key>.<job.fence>.jsonl", "sha256": "<64 hex characters>" }` on stdout, then exits zero.
Stderr is discarded. The worker validates the result and the normal fenced completion checks the
actual bytes. Cancellation waits for the command's process group, even if the command root exits
first. A five-second grace follows TERM with KILL, then allows at most half a second to confirm
the group is gone. Unconfirmed cleanup is an error. The built-in proof command writes
`fleet NAS qualification v1` plus a newline.

## Replace one login job

Generate a template with the existing worker's exact label:

```sh
"$INSTALL_ROOT/worker/current/node" "$INSTALL_ROOT/worker/current/fleet-runner.mjs" worker-plist "$INSTALL_ROOT" "$EXISTING_LABEL"
```

The template launches the installed Node and bundle, with no checkout or global Node. It does not
install or start a job. Before replacing the existing job, keep its original plist and runtime,
alert the owner, and record the old current link. Replace that job one for one. If the test job
fails, stop the replacement and restore the original plist and link before loading it again.

`statusFile` contains only worker identity, listed kinds, version, process state and update time.
A status display reads that file without any key. It must treat an old timestamp as stale.

The current BookcaseDiscovery `read-vision` worker claims its own jobs and has no command for an
already claimed job. Preserve that existing worker until its project provides such a command.
Do not add another background entry or change BookcaseDiscovery for this release.
