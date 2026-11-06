# Reproduce Fleet-runner G0–G2 qualification

Run these checks on the exact committed candidate. The gate definitions are in
[the release-one contract](release-one-g0-g2.md). A passing candidate prepares
the NAS installation; actual NAS recovery, Mac enrollment, operations UI and
production cutover remain G3–G8.

## Prerequisites

- A Core checkout containing the approved pilot commit
  `973dcfdfc43129353b0ec37fc1a27fcbe97a2f85` and the candidate.
- A BookcaseDiscovery Git repository containing
  `ff321c6963aa77d10990d71bbf7a7607e887f910`. It is read only during these checks.
- Actual Node `24.22.2`, pnpm `9.15.4`, Docker Engine and Buildx with
  `linux/amd64` execution. Check the executable versions, including when using
  a bundled launcher. A launcher that selects another pnpm version cannot qualify.
- Network access to retrieve the digest-pinned base image and locked packages,
  and permission to open disposable local HTTP listeners and Docker resources.

Use a clean candidate checkout. Do not run against the installed coordinator's
database, tokens, output directory or real jobs. The packaging proof creates its
own disposable credentials, containers and volumes.

## Commands

From the Core repository root, prepare build output used by the workspace tests:

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm build
```

Choose a new evidence directory and the explicit client repository. The G0
qualification suite requires the pinned runtime and historical client source,
so it has a dedicated configuration rather than joining ordinary shallow-clone
Core unit tests.

```sh
export FLEET_RUNNER_CLIENT_REPO=/path/to/BookcaseDiscovery
export FLEET_EVIDENCE="$PWD/.handoff/fleet-runner-g0-g2/evidence/my-run"
mkdir -p "$FLEET_EVIDENCE"

pnpm exec node scripts/fleet-runner/verify-contract.mjs \
  --client-repo "$FLEET_RUNNER_CLIENT_REPO" > "$FLEET_EVIDENCE/g0.json"
pnpm exec vitest run \
  --config scripts/fleet-runner/vitest.qualification.config.mjs \
  --reporter=json --outputFile="$FLEET_EVIDENCE/g0-tests.json"

pnpm exec node scripts/fleet-runner/run-g1-proof.mjs "$FLEET_EVIDENCE/g1"
pnpm exec node scripts/fleet-runner/check-g1-evidence.mjs \
  "$FLEET_EVIDENCE/g1/g1-evidence.json" > "$FLEET_EVIDENCE/g1-check.json"
pnpm exec vitest run scripts/lib/__tests__/fleet-runner-g1-evidence.test.mjs

pnpm --dir packages/fleet-runner proof:packaging "$FLEET_EVIDENCE/g2"
```

Stop on any nonzero exit. Keep the raw reports and logs, including expected
mutant failures. Rerun into a fresh directory after any source change. The G1
checker rejects evidence from another `HEAD`; it does not silently rebind old
reports to new source. The G2 output contains the install manifests, worker
tarballs, runtime image archive and their hashes for transfer to the NAS.

## Gate decisions

| Gate | Required observations |
| --- | --- |
| G0 | Both source objects resolve; actual tools and schema match; 20 case mappings and nine gate definitions are checked; all qualification checker tests pass. |
| G1 | All Fleet-runner tests pass without pending cases; seeds 1–1000 each execute 64 model steps; all four deliberate guard mutations fail their named behavioral assertions; the independent evidence checker accepts the raw bundle and its own negative tests pass. |
| G2 | Two isolated frozen installs agree on source, lock, tools, dependencies and compiled output; the actual amd64 image runs as nonroot; a signed fixed job has one accepted completion and independently verified expected bytes; portable packages install; invalid commands/configuration/storage fail; artifacts are preserved. |

The reference model explores a finite deterministic campaign. The output-write
interruption test injects an exception and reopens the store; it is not an OS
power-loss trial. Four mutations demonstrate detection of those four removed
guards, not every possible defect. G2 runs amd64 under Docker Desktop on this
Apple Silicon host; N100 hardware and actual NAS restart tests remain G3.

Hash checks establish artifact integrity relative to the recorded source and
reports. They are not independent attestations that a remote party executed
the commands. A reviewer can reproduce the commands to check execution.

Record qualification results outside the source tree so the receipt can name
the exact tested commit without a self-referential evidence commit. Code
review, merging the existing PR stack, device installation and production
cutover remain separate decisions.
