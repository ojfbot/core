# Fleet-runner release one: G0–G2 contract

Status: accepted delivery scope, qualification pending. Owner direction: 5 November 2026, America/Chicago.
Initiative: core #307. Existing implementation: #578 and PR stack #579–#584. Hosting: #309.
The owner approved the release-one roadmap, then authorized this conductor and lighter-model children to deliver G0–G2.

## Problem and bounded outcome

The two-Mac compute pilot works from review branches, but its installation and inspection depend on local setup and agent sessions.
G0–G2 produce a reviewed source baseline, independently checkable correctness evidence and a reproducible Linux candidate.
The deliverable prepares installation on the UGREEN DXP2800 without claiming that the unavailable NAS has passed qualification.

Release one comprises the NAS compute service, supervised Mac workers, operator CLI and browser operations dashboard.
HelpDesk coordinates agents across LAN devices and owns its coordination journal.
Fleet-runner owns admitted jobs, attempts, queue events and accepted results.
A HelpDesk message is neither an admission grant nor evidence of execution.
The existing application read projection in #561 is related to, but distinct from, service-health inspection.

## Source and tool baseline

| Component | Exact baseline |
| --- | --- |
| Core compute pilot | 973dcfdfc43129353b0ec37fc1a27fcbe97a2f85, PR #584 head |
| BookcaseDiscovery client | ff321c6963aa77d10990d71bbf7a7607e887f910, PR #59 head |
| Core package | @core/fleet-runner 0.1.0, AGPL-3.0-only, no external runtime packages |
| Node qualification target | 24.22.2, matching the installed Yuri worker runtime |
| Package manager | pnpm 9.15.4, as declared by the Core root package |
| Locked build and test tools | TypeScript 5.9.3, Vitest 2.1.9, @types/node 22.19.15 |
| Storage at the pilot baseline | SQLite schema 2, server-owned WAL database and immutable output files |
| Wire compatibility | Existing signed JSON routes and Ed25519 signing tuple remain unchanged |
| Target platform | linux/amd64 for NAS service; darwin/arm64 for current Mac workers |

The candidate's exact commit, source tree, lockfile hash, image digest and schema are generated into its evidence after integration.
A baseline pin is provenance, not a claim that an open PR is merged.
The two clean installs compare software manifests and deterministic outputs; they do not assume byte-identical image builds.

## User stories and authority

1. As the operator, I can identify the exact source and tools behind a candidate.
2. As the operator, I can reproduce a fixed job on a clean Linux installation.
3. As a worker, I can act only on my current lease and fencing token.
4. As the operator, I can retry a request whose response was lost without accepting a second result.
5. As the operator, I can restart the service without making a consumed signed request valid again.
6. As a reviewer, I can rerun the tests and reject missing or fabricated qualification evidence.
7. As an agent using HelpDesk, I can link a coordination event to a Fleet-runner record without changing the record's authority.
8. As tomorrow's installer, I receive an immutable service image, portable library package and explicit mount/configuration requirements.
9. As the operator, I can tell which later gates, including actual NAS and sleep trials, remain untested.

Owner credentials admit work and inspect the queue.
Worker credentials claim and mutate only their own current attempts.
Observer credentials and a dedicated service-status contract remain G5 work.
No coding-agent executor, arbitrary shell workload, GitHub publication or automatic merge authority follows from this contract.
Advertised compute handlers are allowlisted adapters, initially BookcaseDiscovery read-vision and read-qwen only on hosts whose pins/capabilities qualify.
The synthetic qualification handler has fixed, precomputed expected bytes and no external effects.

The existing laptop policy is the baseline: 20:00 inclusive to 07:00 exclusive America/Chicago, verified external power, and only explicitly bounded daytime exceptions.
Activity and shared-resource policy must be resolved and tested at G4 before expanding eligibility.
The first release keeps one sequential job per worker.
Initial queue lease is 300 seconds, lease heartbeat 60 seconds, poll five seconds and maximum retry backoff 60 seconds.

## Testing decisions

The approved primary seam is signed HTTP admission through a pull worker to durable result acceptance and independent readback.
A public JobStore reference-model campaign supplements that seam to explore clock and attempt interleavings deterministically.
The shipped CLI and actual linux/amd64 image form the second external seam.
Inputs, keys, output files, databases and containers in G0–G2 are disposable synthetic fixtures.
Tests do not change the installed Yuri worker, the Yojimbo coordinator or their real jobs.

Expected state is computed by an independently authored reference model, not the production reducer.
Expected synthetic bytes and hashes are fixed before execution.
Every seeded case has a stable test title so a checker can establish the denominator from the raw Vitest report.

## G0 acceptance

- Every release-one behavior is assigned a named case in the complete gate inventory.
- All source, tool, schema and authority claims have a concrete pin or an explicit later-gate boundary.
- The contract preserves existing #307/#309 ownership instead of closing broader pending decisions.
- No deployment owner, package version or qualification target is represented as unknown without blocking promotion.
- Owner approval of the roadmap is recorded separately from code review, merge and production cutover.

## G1 acceptance

- Run 1,000 distinct seeded operation sequences, at least 64 steps per seed, with no violated invariants.
- Test expiry equality, worker-ID reuse, retry limits, heartbeat/release behavior and immutable accepted results.
- Exercise signed HTTP owner/worker permissions, tampering, malformed requests and output digest validation.
- Restart the server/store and reject replay of a previously accepted signed request.
- Verify a failed signature does not consume a later valid request's nonce.
- Prove durable nonce contention permits at most one consumption.
- Lose a completion response after commit, retry, and observe one accepted completion event and matching bytes.
- Interrupt output creation before database commit. An unreferenced file is permitted; an accepted record with missing or mismatched bytes is not.
- Run targeted mutants for owner authorization, completion fencing, hash verification and durable replay.
- Each mutant must cause the corresponding assertion to fail. Syntax errors and empty test discovery do not count as detection.
- A separate checker rejects failed/skipped required cases, missing seed IDs, altered artifact hashes and mismatched source identity.

The nonce persistence change is a storage migration.
It preserves existing v2 jobs/events, maintains the documented v1 retirement semantics, and leaves the wire signer compatible.
The server must never silently fall back to process-local replay protection.

## G2 acceptance

- Build and run the released service image as linux/amd64.
- Use the root pnpm workspace and frozen lockfile. Do not introduce an independent package lock or mini-workspace.
- Complete two clean installations with isolated dependency stores.
- Match normalized source/lock/tool/dependency/build-output manifests and the fixed job's expected bytes.
- Identify the exact Node/base-image and pnpm versions; deploy by image digest.
- Build only the Fleet-runner package, without requiring unrelated workspace build output.
- Ship a non-root runtime with no private credential material or dependency on an author's home path.
- Mount the public-key registry read-only and keep the database and accepted artifacts on persistent volumes.
- Prove API/database availability through an externally signed report/readback on the disposable installation.
- Reject unsupported commands, invalid configuration and incompatible storage rather than claiming readiness.
- Produce the portable library package and commands that use its actual exported API. Do not document nonexistent worker CLI commands.

The service image still uses the pilot's signed HTTP transport inside an isolated test network.
TLS, LAN exposure, full readiness, NAS boot, application health, backup and real worker cutover remain G3–G8.
The Docker host here is Linux ARM64 under Docker Desktop; AMD64 emulation is a G2 platform proof, not actual Intel N100 hardware qualification.

## Later-gate acceptance inventory

The accompanying release-one-gates.json preserves all nine approved gate definitions.
G3 includes ten process crashes and three actual NAS reboots.
G4 removes hand staging, proves both Mac joins and tests all approved eligibility states.
G5 compares CLI/GUI revisions and requires a ten-second process heartbeat, stale display after 30 seconds and bounded status latency.
G6 requires real sleep/wake and network trials and independent HelpDesk failure.
G7 requires consistent independent backups and paused, generation-safe restoration.
G8 requires controlled cutover and a 48-hour, 200-job soak.
These cases remain UNTESTED until their own resolvable evidence exists.

## Security and recovery limits

Signing authenticates a request but does not encrypt transport.
Production network trust and TLS are G3 requirements.
Only temporary public keys are mounted into the service during tests.
Private signing keys remain in disposable caller-owned fixture directories and never enter an image, log or committed evidence.
No test accepts a model answer as semantic ground truth.
Repeated execution is allowed after interruption; accepting more than one canonical result is forbidden.

The candidate is reviewed in isolated branches.
Human merge and production cutover remain distinct events.
Rollback never runs an older binary directly against a newer incompatible database.

## Evidence and deviations

Each gate records commands, time bounds, exact source identity, platform, actual counts, expected/observed values and artifact hashes.
Required missing or skipped evidence blocks a pass.
A generated report must not change a proposed gate to passed merely because a process exited zero.

The local vault capture is preserved in the original artifact bundle.
The user assigned proper Sync-vault cutover and final capture to a separate fork, Complete Selfco Sync vault cutover.
That follow-up does not own Core code changes.

Design revision forecasts: protocol/authority scope 0.10, packaging details 0.25, proof-report format 0.20.
These are subjective forecasts of review changes, not reliability probabilities or test-pass estimates.
