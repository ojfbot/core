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

## Physical trials: one owner at a time

Use one designated coordinator and one worker owner per trial. Serialize the six trials. Keep output local and private; report only correlation, trial ID, time window, fault type, evidence references, attempt/fence sequence, output hash, and verdict. Do not copy OCR text, photos, tokens, private endpoints, or host identities into a public artifact.

### Unique trial IDs and resumable checkpoints

Use six distinct IDs: `lid-1`, `lid-2`, `lid-3`, `wifi-1`, `wifi-2`, `wifi-3`. From one private evidence directory, the worker owner runs:

```sh
node packages/fleet-runner/scripts/g6-trial-checkpoint.mjs begin lid-1 <private-worker-alias> "$G6_EVIDENCE_DIR/lid-1.json"
node packages/fleet-runner/scripts/g6-trial-checkpoint.mjs arm "$G6_EVIDENCE_DIR/lid-1.json" <job-key-from-events> <fence-from-events>
node packages/fleet-runner/scripts/g6-trial-checkpoint.mjs attempt "$G6_EVIDENCE_DIR/lid-1.json" <worker-alias> <job-key-from-events> <next-fence>
node packages/fleet-runner/scripts/g6-trial-checkpoint.mjs resume "$G6_EVIDENCE_DIR/lid-1.json"
node packages/fleet-runner/scripts/g6-trial-checkpoint.mjs finish "$G6_EVIDENCE_DIR/lid-1.json" pass <private-receipt-reference>
```

The checkpoint tool creates a mode-0600 file and directory-wide exclusive active-trial lock. `arm` records the first observed claim; use `attempt` for each subsequent claim/fence from `fleet-runner events --after <cursor> --json`. Do not start another trial while the lock exists. On a pause or restart, run `resume` on the same checkpoint and reconcile the server state before continuing. `finish` records `pass` or `invalid` only after evidence review, then releases the lock. A crash leaves the lock and armed checkpoint in place; do not remove it by hand until the owner reconciles the exact job/attempt.

The draft BCD #37 script currently uses `const drillId = "lid-close-drill"`. Before running the six trials, the BCD owner should patch that line locally to require a unique trial ID:

```ts
const trialId = process.env.FLEET_G6_TRIAL_ID;
if (!/^(lid|wifi)-[1-3]$/.test(trialId ?? "")) throw new Error("invalid G6 trial ID");
const drillId = `g6-${trialId}`;
```

Use the same `FLEET_G6_TRIAL_ID=lid-1` (or the matching unique Wi-Fi ID) for coordinator enqueue and worker execution. This is a precise local setup change to the draft drill; it does not import or alter the live FleetRunner app.

### Three actual lid-sleep/wake trials

Use the BCD #37 opt-in drill as a model for holding one real result before upload, but note that #37 is an open draft PR, not a merged core feature. Run each trial only from its owner-approved BCD setup after the operator confirms the host configuration and the job is explicitly identified as a disposable drill. The operator must confirm the lid action actually put macOS to sleep. Capture the worker's local sleep/wake log using the already available macOS tool, for example `pmset -g log | rg -i 'Entering Sleep|Wake from'`; retain timestamps covering sleep and wake. Record the armed time, close/open cue times, worker rejoin, server claim/fence sequence, stale rejection or recovery path, exactly one accepted completion, and accepted output SHA-256. If the OS evidence shows the laptop remained awake, label the trial `not-run/invalid`; never substitute worker suspension.

In the BookcaseDiscovery #37 PR branch/setup, the proposed drill entry points are:

```sh
# Coordinator, with the already approved pilot environment loaded:
pnpm exec node scripts/fleet-lid-drill.ts enqueue "$BOOKCASE_DATA/pilot.jpg"

# Worker, once per serialized trial, with its existing approved helper/credential setup:
pnpm exec node scripts/fleet-lid-drill.ts work
```

These commands are manual and run only from the owner-approved BCD PR setup. The coordinator and worker each remain the sole owner of their step; no concurrent trial. Do not copy the drill into FleetRunner's live app or substitute its private job input with a real user image. The published BCD #37 report is not a passing sleep receipt; it explicitly records that the lid-close left the laptop awake.

The draft script hardcodes one drill request ID, so it is a one-job rehearsal as written. Before a three-trial campaign, the BCD owner must provision a fresh, unique disposable job identity and prove the expected server queue for each trial. Never enqueue over or reinterpret a completed job as a new repetition.

### Three actual Wi-Fi disconnect/rejoin trials

Use the same drill owner and one active trial. The operator must physically disconnect the worker from Wi-Fi using the approved manual procedure, verify actual loss of the network route in local OS/network evidence (for example, capture `route -n get default` and `networksetup -getairportnetwork <approved-interface>` before and after), leave it disconnected across the planned lease/reclaim boundary, then manually rejoin. Retain local disconnect/rejoin timestamps plus worker/server attempt and fence sequence, stale upload/reclaim outcome, accepted output SHA-256, and exactly one accepted completion. If the route remains available or only a fetch is stubbed to fail, label it simulated/invalid, not a Wi-Fi pass.

### Safe checkpoints and resume

Before arming, write a private checkpoint containing correlation, trial ID, single owner, job key, current attempt/fence, evidence directory, and `armed=false`. Set `armed=true` only after confirming the disposable queue and worker. After any interruption, stop before issuing another drill; inspect server status/events and the job/output hash first. Resume only the same trial after the owner reconciles whether an attempt is still active, expired, or accepted. A completed trial is immutable; a rerun gets a new trial ID and a new denominator entry. No simultaneous physical trials.

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
