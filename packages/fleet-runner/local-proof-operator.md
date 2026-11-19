# Isolated local proof operator

The `fleet-runner-proof-operator`, `fleet-runner-proof-bind`, and
`fleet-runner-proof-guard` commands package the local machinery for a bounded
FleetRunner ledger proof. They are source artifacts for an isolated test path,
not standing worker services or a production deployment recipe. The operator
controls only the exact proof target and protected baseline declared in its
private settings. Host addresses, paths, container identities, and role labels
are supplied at setup; they are not compiled into this package.

The binder validates the installed client bundle and Node executable by digest, the
operator and relay settings, and every role settings digest before initializing
an epoch journal. Each shared journal has exactly one initializer. It then
checks that every role is idle. The guard repeats the idle check immediately
before startup, requires a pre-verified, one-use GO record with a newer source
sequence, pins the operator program and launch definitions, and preflights the
throwaway queue and protected baseline. It invokes the operator with the bound
Node executable. Any failure after the one-use marker enters exact-target stop
and role cleanup; the receipt retains the first failure separately from cleanup
errors. A `STARTED` receipt attests to preflight and role bootstrap only. A
later proof report and cleanup receipt are required for a PASS.

Private setup must bind a fresh proof ID, isolated queue, fixed target image and
mounts, installed artifacts, owner-approved window, and the exact roles for the
one run. Only the trusted GO producer may create the verified GO record. The
boolean in that record is not an independent signature or human approval.
Runtime settings, credentials, and host-specific evidence remain outside this
package. No job model calls are part of this path.

`pnpm --filter @core/fleet-runner proof:local:test` runs the synthetic operator,
binder, and guard fixtures without contacting either Mac, Docker, or HelpDesk.
