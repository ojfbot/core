# G6 interruption qualification

Correlation: `FR-20261110-interruption`

Source under review: core `8ad08230420ba56da55f0d39a177ce9872fcbfd9`

Gate: `decisions/fleet-runner/release-one-gates.json`, G6

G6 is not complete until each named deterministic case below passes ten repetitions, all six physical trials have independent receipts, and the isolation checks pass. Keep the deterministic campaign and physical receipts separate. A synthetic fetch error, worker pause, process suspension, or lid-close event without OS sleep evidence is not an actual sleep trial. A synthetic fetch error is not a Wi-Fi disconnect.

## Existing coverage and limits

Core already has focused one-off coverage in `src/__tests__/fault-contract.test.ts`, `worker.test.ts`, `durability.test.ts`, `jobs.test.ts`, and `server.test.ts`. This includes lost completion response after commit, concurrent claims, stale fencing, recovery after output/DB rollback, output durability errors, lease expiry, retry exhaustion, worker stop/drain, and transport errors. Those tests do **not** run every G6 fault ten times or emit the required per-repetition attempt/fence/output receipt. Do not count a normal suite pass as the G6 denominator.

BCD PR #37 is an opt-in `read-vision` worker rehearsal. Its own report says the lid-close left the laptop awake; a separate recovery trial suspended only the worker while the laptop stayed online. It is useful for exercising stale completion and reclaim against the existing pilot, but it does not establish physical sleep or network loss and does not silently become a live-app drill.

## Deterministic campaign

Run only with a disposable local synthetic service/state and synthetic job payloads. No NAS endpoint, production token, real job admission, or external coordinator is in scope. Use a fresh evidence file for this correlation and preserve every raw JSONL row. The runner requires Node `24.22.2`, pnpm `9.15.4`, a clean committed source tree, and an evidence path that does not already exist.

From the reviewed core checkout with the pinned Node/pnpm environment active, run the 80-row deterministic harness. `G6_RESULTS` should be a new private file path; the runner replaces that one file and validates it after the campaign:

```sh
G6_RESULTS=/private/path/g6-results-<source-commit>.jsonl \
  node packages/fleet-runner/scripts/g6-interruption-run.mjs
```

The campaign uses local persistent SQLite state, synthetic outputs, a signed localhost HTTP service, and an injected clock. The upload-loss case holds a signed `/complete` request after part of its body has arrived, advances the model through lease expiry and a five-second eligible-worker poll, then lets the newer worker claim before the old request finishes. Both crash cases use child processes killed with `SIGKILL`: one after output-file creation and before the database update, and one after the SQL update but before transaction commit. Each case runs ten times and writes a raw JSONL attempt/fence/output receipt for all 80 runs.

Each row names its source commit and tree and includes case-specific observed fault data. The runner creates a sibling `.manifest.json` that binds the JSONL digest to the exact source tree, pinned tool versions, and hashes of the campaign, checker, runner, checkpoint, gate, package documentation, lockfile, and Vitest configuration. The checker verifies those pins, row semantics, and artifact hashes. Synthetic sleep/partition and non-cooperative-handler cases remain model simulations. They do not count as physical sleep or Wi-Fi trials.

For synthetic reclaim rows, the model records a successful heartbeat at `t=10,000 ms`, `L=300,000 ms`, expiry at `t=310,000 ms`, and an eligible worker poll/claim at `t=315,000 ms`. Thus the observed elapsed time from renewal is `305,000 ms` and the poll delay after expiry is `5,000 ms`, within `L+2P=310,000 ms`. These are explicitly synthetic schedule measurements; they do not claim a physical machine or external queue was observed.

The existing focused tests also exercise the public signed HTTP seam and extra one-off contracts. Run those separately:

```sh
pnpm exec vitest run \
  packages/fleet-runner/src/__tests__/fault-contract.test.ts \
  packages/fleet-runner/src/__tests__/worker.test.ts \
  packages/fleet-runner/src/__tests__/durability.test.ts \
  packages/fleet-runner/src/__tests__/jobs.test.ts \
  packages/fleet-runner/src/__tests__/server.test.ts
```

The harness produces exactly ten rows for each of these stable IDs:

| Case ID | Required injected fault | Required evidence in every row |
|---|---|---|
| `completion-response-lost-after-commit` | Lose the first completion response after server commit; retry via normal client | request/retry counts, same attempt fence, one accepted completion, output SHA-256 |
| `worker-sleep-or-partition` | Synthetic local partition or clocked lease expiry; label as simulated | renewal/claim timeline, worker attempt IDs and fences, accepted output SHA-256 |
| `lease-lost-during-upload` | Hold a signed HTTP upload after its body starts; let the newer fence claim before the old upload finishes | request signature/body-start observations, both worker claims and increasing fences, exact `L/P` schedule, old response `false`, one accepted newer output and SHA-256 |
| `crash-output-before-db-commit` | Child process receives `SIGKILL` after output creation and before DB update; reopen persistent SQLite and reclaim | kill signal/point, reopened claimed row with no completion event, both fences, one recovered output and SHA-256 |
| `crash-db-boundary` | Child process receives `SIGKILL` after SQL update but before transaction commit; reopen persistent SQLite and reclaim | kill signal/point, transaction rollback to claimed row with no completion event, both fences, one recovered output and SHA-256 |
| `retry-exhaustion` | Exhaust configured retry budget | each claim/fence, retry count, terminal status, accepted output count `0` |
| `handler-ignores-cancellation` | Deterministic non-cooperative handler observes abort but remains held until a newer worker reclaims | both worker claims and increasing fences, reclaim schedule, worker reports lease lost, later worker accepts one output |
| `stale-fence-rejection` | Stale attempt is submitted after reclaim; the baseline must reject it | stale rejection plus newer accepted fence |

Each JSONL row uses `case_id`, `repetition` (1–10), source commit/tree, ISO `started_at` and `finished_at`, `synthetic: true`, typed `fault: {type, observed}`, ordered `attempts` with worker, fence, claim time, and lease expiry, accepted-output count/hash/fence, applicable renewal/expiry/claim schedule, and `result: "pass"`. The checker rejects `UNTESTED`, contradictory observations, missing/extra attempts, non-increasing fences, wrong output counts, and schedule values outside `L+2P`. Check the completed file and sibling manifest with:

```sh
node packages/fleet-runner/scripts/g6-interruption-check.mjs /path/to/private/g6-results.jsonl /path/to/private/g6-results.jsonl.manifest.json /path/to/source-checkout
```

The checker rejects missing/duplicate repetitions, unsupported or contradictory case evidence, unbound source/artifacts, malformed attempts/fences, a missed applicable reclaim bound, missing hashes for accepted outputs, and synthetic/non-synthetic ambiguity. Its success is only the deterministic denominator; it does not assert the physical campaign passed.

The checker contract itself has a dependency-free test:

```sh
node --test packages/fleet-runner/scripts/g6-interruption-check.test.mjs
```

Run the independent source-bound G1 mutation proof as a separate negative control. It includes the existing `completion-fence` mutant and requires the named public upload-fencing assertion to fail. Its output is not included in the G6 80-row denominator:

```sh
node scripts/fleet-runner/run-g1-proof.mjs /private/path/g1-evidence
```

The trial checkpoint helper also has dependency-free transition/locking tests:

```sh
node --test packages/fleet-runner/scripts/g6-trial-checkpoint.test.mjs
```

## Physical trials: frozen BookcaseDiscovery HTTPS packet

The physical adapter is frozen in BookcaseDiscovery commit `5a6ab63af430367e8d5f9fd4df95c55037770f55`, a clean single child of app main `ed3f01e5e7d5369beda01b5a2c1c567cec691d66`. Its companion procedure is `docs/g6-physical-proof-fixture.md` at that commit. This replaces the previously documented BCD #37 draft procedure; #37 is historical context only and is not the physical runner.

| Pin | Required value |
|---|---|
| App main parent | `ed3f01e5e7d5369beda01b5a2c1c567cec691d66` |
| Frozen app drill source | `5a6ab63af430367e8d5f9fd4df95c55037770f55` (clean, one parent above) |
| App vendored FleetRunner client/worker | `dad1d204bb2e01c691aa69de3ce3f0b218f7de21` |
| Intended refreshed NAS Core source | `78c71e9a7f085c092425fdbe99193a06c06e9e3f` |
| Intended signed service build | `78c71e9` |
| Intended NAS image ID | `sha256:704a311810e999f7cfc24f26a8c22a6cd8090cc63017fc66dc13706fa9865066` |
| Application runtime | Node `24.22.2` |
| Synthetic fixture | `fleet-runner packaging fixture v1\n`; SHA-256 `f04565eea01f62eeb7149c8609c8a901ca0af5ffb74c37a181ca0955479e7890` |

These NAS values identify the intended candidate; they do not prove the running service has those values. Before every trial, the owner must confirm the service/image receipt using the existing approved operator channel, then run the adapter's signed HTTPS status preflight. Stop if image/source/build, TLS identity, readiness, queue state, or historical counts differ. No NAS effect was performed while preparing this procedure.

The adapter submits only a deterministic synthetic `proof-fixture` job with no inputs or payload and a random per-trial capability. Resident workers do not advertise that capability. It does not invoke OCR, use a model/GPU, read NAS filesystem paths, replace resident handlers, or copy the Yojimbo pilot authority. It requires existing local owner/worker tokens and the existing public CA; TLS certificate and hostname verification remain enabled. `FLEET_GENERATION` must be unset for this schema-4 candidate. Never copy tokens, private keys, private endpoints, or service-local paths.

The preserved baseline is exactly 10 completed historical `proof-fixture` jobs and 4 completed historical `read-vision` jobs, plus one additional fixture per earlier passed trial. All other jobs must be idle with no ready, claimed, or failed work. Use the six IDs once, in this order: `lid-1`, `lid-2`, `lid-3`, `wifi-1`, `wifi-2`, `wifi-3`; the second `prepare` argument is the count of earlier passed trials (0–5). A private local `G6_EVIDENCE_DIR` must be absolute and mode `0700`; the adapter rejects relative paths, symlinks, and group/world permissions. Each trial has one exclusive `.g6-physical-active.json` lock and a mode-0600 packet. A failed or interrupted run keeps its lock and packet for owner reconciliation; do not delete or reuse them manually.

On the owner coordinator and both designated workers, use the clean frozen app checkout and each host's existing local identity/token/trust configuration. Do not place secrets in shell history or this document. In each shell, populate the endpoint/CA/token values from that host's approved private configuration, set a new local evidence directory, and verify the source/runtime pins:

```sh
export FLEET_ENDPOINT='https://<existing-approved-nas-endpoint>/'
export NODE_EXTRA_CA_CERTS='<existing-public-CA-certificate-path>'
export FLEET_TOKEN_FILE='<existing-local-token-path>'
export G6_EVIDENCE_DIR='<new-private-local-evidence-directory>'
unset FLEET_GENERATION
umask 077
mkdir -p "$G6_EVIDENCE_DIR"
chmod 700 "$G6_EVIDENCE_DIR"
node --version                                  # require v24.22.2
git rev-parse HEAD                              # record full frozen drill commit
git status --porcelain=v1                       # require empty
cat src/run/vendor/fleet-runner/core-revision.txt # require dad1d204…
```

Yuri additionally must pass the app's existing NAS eligibility policy: AC power, the existing pause/resource/helper gates, and 20:00–07:00 America/Chicago. A daytime run requires an owner-created, existing same-day exception of at most 15 minutes; the adapter reads but never creates or extends it. Battery or unknown power blocks. Yojimbo must pass its local eligibility and remote pause gate before every claim. The owner does not create or change those gates as part of this packet.

### One serialized trial

Use `FLEET_ID=owner` on the coordinator, `FLEET_ID=yuri` on Yuri, and `FLEET_ID=yojimbo` on Yojimbo. The owner first rechecks the approved image/source receipt and runs the baseline preflight/admission. TLS validation and signed status/baseline checks happen before the lock is created; only after they pass does the command write the private packet and enqueue one synthetic fixture:

```sh
node src/run/g6-physical-drill.ts prepare lid-1 0
```

Pass the returned `jobKey` and `capability` to Yuri and Yojimbo through the existing approved channel. They are queue selectors, not authentication credentials. On Yuri, start the one-shot worker; it can handle only the fixture and holds its deterministic output for 12 minutes:

```sh
export FLEET_ID=yuri
node src/run/g6-physical-drill.ts hold lid-1 '<jobKey>' '<capability>'
```

While Yuri holds the job, the owner records the signed first claim (maximum wait 120 seconds):

```sh
export FLEET_ID=owner
node src/run/g6-physical-drill.ts observe lid-1 yuri 120000
```

Then perform one manual interruption. For `lid-*`, verify AC power, close the lid to cause actual macOS sleep, and retain `pmset -g log` evidence covering sleep and wake. For `wifi-*`, retain before/after route and associated-network evidence, physically disconnect Wi-Fi across expiry/reclaim, and manually rejoin only after Yojimbo reports accepted completion. Do not substitute worker suspension, a fetch stub, or another simulation. Do not begin the interruption until the hold process started and the owner observed Yuri's claim.

Once the physical interruption begins, Yojimbo runs the bounded reclaimer. It polls every five seconds for at most 320 seconds and remains subject to local eligibility and remote pause checks:

```sh
export FLEET_ID=yojimbo
node src/run/g6-physical-drill.ts reclaim lid-1 '<jobKey>' '<capability>'
```

The owner records the second claim (maximum wait 320 seconds):

```sh
export FLEET_ID=owner
node src/run/g6-physical-drill.ts observe lid-1 yojimbo 320000
```

For lid trials, open the lid after Yojimbo reports accepted completion. For Wi-Fi trials, rejoin only then. Let Yuri's bounded one-shot finish; it must report `lease-lost`, and its stale completion must be rejected. Never kill or restart the resident worker. Transfer only Yuri's and Yojimbo's local worker receipt files plus OS/network evidence references to the owner through the established approved channel; do not transfer credentials. The owner performs signed event, output, baseline, and schedule readback:

```sh
export FLEET_ID=owner
node src/run/g6-physical-drill.ts verify lid-1
```

`verify` requires Yuri claim → lease expiry → increasing Yojimbo fence → exactly one Yojimbo completion → rejected stale Yuri completion, matching worker receipts and fixture hashes, signed accepted-output verification, preserved 10 historical proof fixtures and 4 historical read-vision outputs, and a reclaim schedule within `L=300,000 ms`, `P=5,000 ms`, `L+2P=310,000 ms` with observed renewal-request duration included as uncertainty. Compare host/server clock evidence; if clocks are not synchronized, mark invalid. Only a complete successful verification records `passed` and releases the lock.

If the physical evidence or sequence is invalid, stop and reconcile the exact queue event, active lease, and local receipts before the owner marks the packet invalid. The bounded reason is required; this does not delete or rerun the job:

```sh
export FLEET_ID=owner
node src/run/g6-physical-drill.ts finish-invalid lid-1 lid-not-slept
```

Repeat the same sequence for each remaining unique trial ID, changing only the ID and prior-passed count. A failed, invalid, or interrupted trial is immutable; reconcile it before another ID. Preserve packets, worker receipts, OS/network evidence references, timestamped attempt/fence sequence, and accepted-output SHA-256 in the private evidence directory. Public notes may include only correlation, trial ID, time window, fault type, private evidence references, fence sequence, output hash, and verdict.

## G6 bounds and limits

Initial release values in the gate are `L=300 s` and `P=5 s`, so safe reclaim is bounded by `L + 2P = 310 s` after the last valid renewal when another eligible worker exists and retries remain. Preserve exact monotonic timestamps needed to assess that bound. Record the no-other-worker and exhausted-retry cases separately; they do not satisfy the conditional reclaim bound. Check that stopping HelpDesk does not alter admitted-job outcomes and FleetRunner outage does not stop HelpDesk coordination, using disposable isolated fixtures only.

## Trial packet and status

Use the following unique IDs exactly once each. Record the owner alias, private checkpoint path, job key, initial and subsequent fences, timestamped OS/network evidence reference, private receipt reference, and final `pass` or `invalid` status in each checkpoint. The checkpoint helper serializes trials with an active-trial lock and refuses a non-increasing fence sequence.

| Trial ID | Fault | Owner alias | Private checkpoint | Receipt reference | Status |
|---|---|---|---|---|---|
| `lid-1` | Actual lid sleep/wake | pending | pending | pending | `UNTESTED` |
| `lid-2` | Actual lid sleep/wake | pending | pending | pending | `UNTESTED` |
| `lid-3` | Actual lid sleep/wake | pending | pending | pending | `UNTESTED` |
| `wifi-1` | Actual Wi-Fi disconnect/rejoin | pending | pending | pending | `UNTESTED` |
| `wifi-2` | Actual Wi-Fi disconnect/rejoin | pending | pending | pending | `UNTESTED` |
| `wifi-3` | Actual Wi-Fi disconnect/rejoin | pending | pending | pending | `UNTESTED` |

HelpDesk failure isolation and FleetRunner failure isolation are also `PENDING`. Until the deterministic harness emits its 80 source-bound raw repetitions and all six real OS/network receipts and both isolation results are attached, G6 remains unqualified. No NAS, live queue, deployment, HelpDesk write, or physical trial is run by this package.
