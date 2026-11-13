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

```json
{
  "schemaVersion": 1,
  "endpoint": "https://existing-fleet-service:8443",
  "worker": "yuri",
  "caFile": "/private/existing-fleet-ca.crt",
  "tokenFile": "/private/existing-worker-key",
  "outDir": "/private/fleet-attempts",
  "statusFile": "/private/worker-status.json",
  "kinds": {
    "proof-fixture": {
      "capabilities": ["proof-fixture"],
      "command": [
        "/absolute/FleetRunner/worker/current/node",
        "/absolute/FleetRunner/worker/current/fleet-runner.mjs",
        "proof-fixture"
      ],
      "timeoutMs": 300000
    }
  }
}
```

Each executable must already be installed and executable. The worker invokes the fixed argument
array directly, without a shell. Direct Claude, Codex and shell launchers are refused. Installed
commands are trusted local programs, not a sandbox. Only listed kinds are claimed, with that kind's
own capabilities. One attempt runs at a time; server pause and drain stop new claims.

`caFile` is optional for a local HTTP proof. For the NAS, use the existing trusted CA certificate.
Node reads extra CA trust only at startup, so the command relaunches its own installed Node and
bundle once with that certificate, forwards shutdown signals, and starts no other worker runtime.
If the existing NAS worker uses a recovery generation, preserve it in the optional `generation`
setting. Settings, keys, certificate paths and job content never appear in the status file.

An installed command reads one JSON envelope `{ "job": <claimed job>, "outDir": <output folder> }`
from stdin. It writes `<job.key>.<job.fence>.jsonl` in that folder and returns exactly
`{ "file": "<job.key>.<job.fence>.jsonl", "sha256": "<64 hex characters>" }` on stdout, then exits zero.
Stderr is discarded. The worker validates the result and the normal fenced completion checks the
actual bytes. Cancellation stops the command's process group; a five-second limit follows TERM
with KILL. The built-in proof command writes `fleet NAS qualification v1` plus a newline.

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
