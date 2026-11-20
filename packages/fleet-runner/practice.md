# Prepare and preflight a model-free practice

## Reusable takeover practice

The normal practice entry point is one foreground command on each Mac:

```sh
fleet-runner practice run --role primary
fleet-runner practice run --role fallback
```

Each Mac reads its stable private `fleet-practice.local.json` from the current directory
(or `FLEET_PRACTICE_CONFIG`, or `--config PATH`). It generates its role/operator settings,
runs preflight immediately, and joins a signed relay barrier. Start the primary command
under the conductor's practice GO; the fallback can start first and wait. There are no
scheduled windows, cross-host hash acknowledgements, fresh proof IDs or one-use GO files.

The primary admits one synthetic ledger replay and claims its first attempt, then deliberately
stops renewing. The fallback waits for that signed observation and lease expiry, claims the
second fence, and executes only the fixed reviewed local ledger command. The production
worker code maintains the fallback lease and uploads its result. Primary verifies the accepted
bytes, server receipt, fallback attribution and rejection of its stale write. Both commands
return structured PASS/FAIL and remove their local role lock; target, keys and evidence remain.
This is a foreground scripted takeover, not an OS sleep test. A run has a relative timeout
of at most 15 minutes. No service, GUI app or power state is changed by the command.

Private reusable config contains these stable facts:

- `schemaVersion: 1`, `id: practice-<name>`, `identity` (one stable UUID attached to this
  dedicated target), `device`, `primaryDevice`, `fallbackDevice`, `workers` (primary/fallback
  registered identities), `code`, `fixtureSha256`, `timeoutMs`, `evidenceRoot`, primary-only
  `ownerKey`.
- `host`: NAS route `nasAlias`/`docker`, local `tokenFile`/`caFile`, pinned FleetRunner
  `bundle`/`bundleSha256`, and protected baseline `protected` in the existing operator format.
- `target`: Docker `inspect` facts, `endpoint`, container `node`, `serverBundle` and
  `serverBundleSha256`. Required labels are `fleet.practice=<id>` and `cg307-u1.proof=<identity>`.
- `command`: reviewed model-free Bookcase ledger executable `program`, fixed `args`, `sha256`,
  pinned dependency `files`, and `timeoutMs`. A queued job cannot select a command.
- `relay`: pinned signed adapter `adapter`, `environment`, `thread`, `stream`, initial
  `startAfter`, this host's `session`, and expected `peerSessions` for both roles. Both device
  and session attribution are checked on incoming observations.

Configure these facts once per device in its canonical private configuration record. Runtime
settings are generated privately and saved beside each attempt's receipt. The public repository
contains the generator/schema contract, never personal target facts or keys. Full real-G4 proof
parsing, approval/time gates and one-use GO remain unchanged.

After both commands finish, an explicit reset archives the final local observation and clears
only terminal rows belonging to this practice:

```sh
fleet-runner practice reset --role primary
```

The dedicated practice server must have `FLEET_PRACTICE_ID=<id>` configured at provisioning.
The reset route is disabled on normal services, owner-only when enabled, and refuses active
or foreign jobs. It checks the exact current keys transactionally, retains append-only events,
nonce/fence history and accepted bytes, and keeps the container/key registry. Practice snapshots
show events for current jobs, so preserved prior audit entries do not require a new target.
Failures preserve the first diagnostic and do not retry admission or reset automatically.
An abruptly killed role can leave a lock requiring local liveness inspection before recovery.
Provisioning a standing target is a separate runtime action; these commands do not provision it.

## Bound proof preparation helpers

These lower-level helpers support the existing bound proof path; reusable practice above
does not require a fresh plan or generated window.

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
