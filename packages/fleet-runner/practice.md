# Prepare and preflight a model-free practice

Run on each participating Mac with its own local host profile. Prepare writes a new private
proof directory, generates all role/operator/relay/binder/launch files, and initializes only
that role's idle journal. It never starts a service or writes GO. Existing directories are
refused so earlier evidence cannot be overwritten.

```sh
fleet-runner practice prepare --plan /private/plan.json --role primary \
  --host /private/host.json --target /private/target.json --root /private/new-proof
fleet-runner practice preflight --role primary --root /private/new-proof
```

Use `fallback` on the other Mac. All JSON inputs must be owner-controlled regular files with
mode 0600. Keep host profiles, target facts and generated files private; they do not belong
in a public repository. No machine names, private paths, keys or installation defaults are
built into this command.

Inputs:

- Plan: `proof` accepted by `parseLedgerProof` with `practice: true`, its canonical
  `planSha256`, and relay `thread`, `stream`, `startAfter`.
- Host profile: pinned `node`, `nodeSha256`, `bundle`, `bundleSha256`; `scripts` directory
  containing the reviewed local operator; `device`, `primaryDevice`, `fallbackDevice`;
  local `tokenFile` and `caFile`; existing signed adapter command `adapter` and its
  `environment` accepted by `parseProofRelay`; local protected service baseline `protected`
  accepted by `validateSettings`. The profile supplies facts, not generated runtime files.
- Target facts: raw Docker `inspect` object and canonical `projectionSha256`; `nasAlias`,
  `docker`, container `node`, `serverBundle`, `serverBundleSha256`, and HTTPS `endpoint`.
  The target label must match the proof. Snapshot paths are always the image's internal
  state/output paths. Host mount sources are rejected by the operator itself.

Preflight checks immutable hashes, role/journal binding, the exact guard snapshot invocation
with proof identity on stdin, protected baseline, role absence, signed relay GET with matching
thread/stream, and a signed worker-control GET exercising TLS and this role's registered key.
It prints `PASS`, or `FAIL` with the first reason and bounded original process diagnostics.
Keep diagnostics private. It consumes no GO, bootstraps no role, admits no job, posts no relay
message and performs no cleanup. An existing operator may retain its private command-error
diagnostic on failure; it does not change service/job state.

Both hosts must pass against the running empty isolated target before the conductor issues
READY/GO. A stopped target fails immediately. Preflight does not start it or grant authority
to do so. The launch guard rechecks the shared read-only checks and retains its existing GO,
expiry and startup limits; preflight does not waive them. A successful preflight is a current
observation, not a durable lock against later drift. Keep the current runtime hold until the
owner releases it.

The bundled distribution includes `practice.mjs` beside `fleet-runner.mjs`; install both.
Preparation also requires the reviewed local operator scripts named by the host profile.
The package distribution includes those scripts and compiled modules.
