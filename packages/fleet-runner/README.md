# `@core/fleet-runner`

Fleet-runner provides the queue store, signed HTTP client, and worker loop. Its CLI
manages the service, credentials and status, and runs the
[bundled declared-command worker](https://github.com/ojfbot/core/blob/main/packages/fleet-runner/worker-release.md).
Applications provide installed commands rather than code loaded into that worker.
Library consumers can still provide their own job handlers.

See [deployment and worker setup](./deployment.md) for the container service,
the portable package artifact flow, and the clean-build proof command.

See [backup and restore](./recovery.md) for the isolated G7 recovery commands,
generation fencing, persisted restore hold, and qualification boundary.

See [isolated local proof operator](./local-proof-operator.md) for the packaged
binder, guard, and exact-target operator used by a bounded test run.

## Bounded ledger proof

`ledger-proof` runs one installed `bookcase-ledger-replay` job in a disposable
service. The primary worker computes the real application result, then performs
one locally authorized sleep fault. A fallback worker completes at a newer fence;
the original worker verifies that its stale completion is rejected. The deliberately
unclaimable sentinel remains ready and receives a durable hold report.

The proof does not execute provider models. It does not change existing worker
profiles or migrate the service database. The snapshot helper opens SQLite
read-only, including WAL state, and admission requires the reviewed schema-4 target.

### Command reference

All paths and settings digests below come from the operator's private manifest.
The installed Node binary and bundle are absolute paths; no package manager or
source checkout is used at runtime.

- `ledger-proof init --settings FILE --sha256 HASH` creates one epoch journal.
- `ledger-proof launch --settings FILE --sha256 HASH` runs the fixed local role.
  It restarts the primary while idle before admission and restarts the supervisor
  once after acceptance. A repeated launcher start is held.
- `ledger-proof run --settings FILE --sha256 HASH` runs a worker, supervisor or
  watchdog role. A watchdog has its own native process on the always-on host.
- `ledger-proof-snapshot DATABASE OUTPUT` returns only synthetic proof rows,
  events and accepted bytes through the trusted read-only operator route.
- `ledger-proof-relay post|evidence --settings FILE --sha256 HASH` uses the installed
  signed HelpDesk adapter. `post` receives the reserved command ID and bounded
  report on stdin. `evidence` receives the proof ID and `ready` or `fault` phase.
- `ledger-proof-power prepare|cancel|probe-primary|probe-fallback|sleep --settings FILE
  --sha256 HASH` binds one owned wake entry and the actual OS sleep/wake evidence.
  `prepare` uses one explicit pre-arm macOS administrator authorization. It creates
  one owned wake and a fixed cleanup process that can only cancel that same event.
  A one-way flag permits early cancellation, and the helper has an absolute deadline
  plus a finite wait count. `cancel` removes the flag and verifies removal of the event.
  Native sleep is unprivileged. No sudoers rule or persistent privileged service is
  installed; failed authorization or unverified cleanup holds before admission.

### Settings contract

The epoch manifest binds the proof ID, approval expiry, T0, end time, application
commit and fixture digest, local time zone, unique primary/fallback identities and
proof capability. Its end cannot exceed approval expiry or T0 plus 90 minutes.
The primary also requires AC power and its 20:00–07:00 local policy.

Each role has its own private settings, output, pause/reservation paths and CPU
slot. Supervisor and watchdog share only their bound control journal. Settings
files are owner-only, regular files. Artifact maps pin the installed Node, app,
contracts and helpers by SHA-256; the worker verifies them before each claim.
Job input never supplies command arguments, file paths or endpoints.

The six fixed operator commands are `probe`, `snapshot`, `post`, `stop`, `fault`
and `faultEvidence`. Each descriptor binds an absolute executable, fixed arguments,
its digest and the digests of its helper files. The relay and power commands above
supply the corresponding local helpers. NAS snapshot/stop and protected-work probes
use the existing operator route, with exact target/mount/image/epoch checks in the
private setup record. They do not control another workstation.

The supervisor enables claims only after comparing the complete stored JobSpec,
including scheduling fields omitted from Claim and jobKey. The fallback remains
paused until the primary lease expires. Lease-expired audit detail supplies the
exact last expiry for the 310-second reclaim check; poll observations are not an
oracle for the last renewal. Source and fixture manifests, real replay evidence,
accepted bytes, event order, OS evidence, restart and cleanup receipts all remain
required for a live PASS.

The journal reserves external effects before execution. Lost send acknowledgements
reuse the saved HelpDesk command ID and bytes; changed bytes conflict. Unknown
native effects hold rather than launch again. The first terminal report and its command ID are frozen together before network
delivery. An acknowledgement loss or restart after expiry replays those exact bytes;
it cannot replace PASS with HELD or create another terminal command. Later cleanup
status is separate and cannot change the first terminal report. Delivery is distinct
from later agent or human consumption.
At expiry or a terminal outcome, the independent watchdog stops only its frozen
proof targets, preserves state, verifies the protected baseline and reports PASS
or HELD. Unverified cleanup cannot produce PASS.
## Practice preparation

Use [practice prepare and preflight](practice.md) to generate private role settings and
exercise the guard's read-only checks before READY/GO.
