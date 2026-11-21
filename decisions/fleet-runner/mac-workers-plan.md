# Plan: join both Macs to the NAS-hosted FleetRunner (G4)

Gate G4 in [the release-one gates](release-one-gates.json): both Macs run pinned,
supervised workers that execute a NAS-admitted job with no manual input
staging. The NAS hosting gate (G3) passed; see
[the NAS qualification](release-one-nas-qualification.md). This plan changes no
live service. Every piece is proven in a disposable local setup first.

This file is public. It names no host, address, account, device or path. Those
stay in private worker settings.

Existing pieces this builds on: the signed worker client, the NAS service's
authenticated input route (a worker may read only a blob named by a job it
currently holds), the declared-command worker, and the installer. The worker did
not yet fetch inputs by itself, and a declared handler was not pinned.

## Pieces (one pull request each)

1. **A worker fetches its own inputs and runs a pinned handler (G4).**
   After a worker claims a job it downloads each input from the service,
   checks every hash, hands the files to a handler it has verified against a
   pinned fingerprint, and submits the result with its hash. A corrupt or
   interrupted download, an unauthorized blob, or a changed handler never
   produces a result. Proven against a throwaway local service.
2. **Policy and capability reporting (G4).**
   The worker decides whether it may claim (battery or unknown power, time
   windows, expired exceptions, busy GPU) and reports the reason and the
   capabilities it really has. Handlers that cannot run on a host stay
   unavailable. Proven with simulated power, clock and DST cases.
3. **One job at a time per resource, and duplicate-client refusal (G4).**
   A per-worker resource slot so only one job holds the GPU, and a local lock
   that refuses a second client for the same worker identity.
4. **Pause, drain and resume from the service (G4).**
   Wire the existing authorized worker control to the supervised process so an
   owner can pause or drain a Mac without opening an agent session, and show
   the state in worker presence.
5. **Per-host install and rejoin readback (G4).**
   Install the pinned release as a supervised service on one host, rejoin after
   restart without a GUI, and record an install manifest and a capability
   matrix. Proven first with a disposable root; the real installs on the two
   Macs need the owner's approval and are not done here.
6. **Two-host acceptance run (G4).**
   Run NAS-admitted synthetic jobs on both Macs, compare input and result
   hashes with the expected bytes, and collect the evidence the gate lists.
   This is the only piece that touches live machines and waits for the owner.

## Piece 1 definition of done

- Settings may name an input directory and, per handler, pinned file
  fingerprints. Both are validated; a pin is re-checked before every run.
- Inputs are fetched with the job's own lease, size-bounded, hash-checked,
  written read-only under their hash name, and listed in the handler envelope.
- Failure codes distinguish a transient fetch problem (retryable), a refusal
  (not retryable) and a pin mismatch (the handler is withdrawn).
- Tests use a real local service, real signed requests and the real worker.

## Deliberately later

Cache eviction for staged inputs, model pinning and the policy rules (piece 2),
the service-side pin registry, and any use of the live service or either Mac.
