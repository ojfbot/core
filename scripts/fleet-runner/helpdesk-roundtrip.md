# Replay the isolated HelpDesk roundtrip

This operator-run proof carries one signed HelpDesk request through FleetRunner execution,
checks the canonical accepted artifact bytes and returns a signed correlated reply. Repeating
the identical request must reuse the request, job and reply without another handler execution.

It starts only temporary loopback services with synthetic keys. It does not deploy a bridge,
grant delegated authority or operate production services. Selfco and MorningCockpit are outside
the execution path.

## Prerequisites

- Node 24.22.2 and pnpm 9.15.4.
- An isolated Core checkout containing these scripts, based on
  321a44637b8fc406b8823a192c1194511007e6c0.
- An isolated LocalHelp checkout at 1629a1e8db2e526590a33b857848e2f70edf240d.
- Permission to bind temporary 127.0.0.1 listeners and a new evidence directory.

## Run

In each isolated checkout, install its locked dependencies:

```sh
pnpm install --frozen-lockfile --ignore-scripts
```

In LocalHelp, build the service and signed device adapter:

```sh
pnpm build
pnpm typecheck
```

In Core, build FleetRunner and run the proof:

```sh
pnpm exec tsc -p packages/fleet-runner/tsconfig.json
pnpm exec node scripts/fleet-runner/prove-helpdesk-roundtrip.mjs /absolute/isolated/LocalHelp /absolute/new/evidence-directory
```

The evidence directory must not already exist. The proof writes request.json, job.json,
artifact.json, reply.json, duplicate.json and result.json, plus the synthetic databases and
accepted bytes. It closes both services and removes temporary private keys on exit.

## Inspect

Success means one job, one attempt, one handler execution, one artifact and two HelpDesk
messages: request and reply. The duplicate must leave the canonical job and event history
unchanged. Message IDs vary between fresh runs.

The expected artifact contains `fleet NAS qualification v1` followed by a newline. Its SHA-256 is
`4a531719e249b4b40dd32824870633b7ac4a0c13a172c02af1f0393fae888fed`.
The checker opens the job database read-only and compares the actual accepted file's digest
with both the canonical job record and the predeclared expected digest.

This proves the bounded operator-run path and identical retry. It does not establish
unattended recovery, general routing, independent acceptance or production readiness.
