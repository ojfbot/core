# Verify the #599 evidence bundle through live HelpDesk

This operator command posts one real signed HelpDesk request using the host's existing enrollment
on Yuri or Yojimbo. The host remains both requester and operator; signing keys stay on that host.
A temporary FleetRunner worker verifies the saved #599 bundle and writes a JSON receipt.
The operator checks the accepted bytes against the canonical job record before replying.
The command repeats the identical request once, checks that no second execution occurs, and exits.

## Run

Use Node 24.22.2, pnpm 9.15.4, an isolated clean committed Core checkout, and a built LocalHelp
checkout at `1629a1e8db2e526590a33b857848e2f70edf240d`.
Build FleetRunner with `pnpm exec tsc -p packages/fleet-runner/tsconfig.json`.

Pass the existing HelpDesk adapter environment to the command, including its service origin,
device writer, existing key location if overridden, and trusted CA certificate.
Keep the existing key on this device. Do not change service configuration or trust settings.

```sh
pnpm exec node scripts/fleet-runner/verify-helpdesk-bundle.mjs \
  /absolute/built/LocalHelp \
  /absolute/helpdesk-fleetrunner-trace-20261113.zip \
  /absolute/new/evidence-directory
```

The fixed bundle is 37,000 bytes with SHA-256
`c57717be0317cbb284e4e98d520e00ab6f38588d165cb6817e87d06f4a963d48`.
The request addresses Yuri and Yojimbo. It supplies no executable code, JobSpec, or local path.
The worker downloads its input through FleetRunner's fenced input API.

## Inspect and stop

Inspect `request.json`, `manifest.json`, `job.json`, `artifact.json`, `reply-readback.json`,
`duplicate.json`, and `result.json`. The accepted JSON receipt includes the bundle digest,
byte count, request ID, and exact committed code revision. The reply includes the job key
and a separately verified output digest.

Success means one job, attempt, handler execution, and accepted artifact, plus two HelpDesk
messages. The duplicate reuses the request, job, and reply IDs and leaves canonical job
records and events unchanged. The temporary listener stops and its keys are removed.

Stop after the required checks and these two cases. On failure, preserve `failure.json` and
stop. Do not post a success reply before artifact verification. This is operator-run work
with a 60-second worker cancellation signal and one allowed attempt. It does not start a
resident worker, deploy a service, or change delegated authority. Selfco and MorningCockpit
are outside this command.
