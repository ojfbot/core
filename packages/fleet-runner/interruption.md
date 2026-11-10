# G6 interruption qualification

Correlation: `FR-20261110-interruption`

Source under review: core `8ad08230420ba56da55f0d39a177ce9872fcbfd9`

Gate: `decisions/fleet-runner/release-one-gates.json`, G6

G6 is not complete until each named deterministic case below passes ten repetitions, all six physical trials have independent receipts, and the isolation checks pass. Keep the deterministic campaign and physical receipts separate. A synthetic fetch error, worker pause, process suspension, or lid-close event without OS sleep evidence is not an actual sleep trial. A synthetic fetch error is not a Wi-Fi disconnect.

## Existing coverage and limits

Core already has focused one-off coverage in `src/__tests__/fault-contract.test.ts`, `worker.test.ts`, `durability.test.ts`, `jobs.test.ts`, and `server.test.ts`. This includes lost completion response after commit, concurrent claims, stale fencing, recovery after output/DB rollback, output durability errors, lease expiry, retry exhaustion, worker stop/drain, and transport errors. Those tests do **not** run every G6 fault ten times or emit the required per-repetition attempt/fence/output receipt. Do not count a normal suite pass as the G6 denominator.

BCD PR #37 is an opt-in `read-vision` worker rehearsal. Its own report says the lid-close left the laptop awake; a separate recovery trial suspended only the worker while the laptop stayed online. It is useful for exercising stale completion and reclaim against the existing pilot, but it does not establish physical sleep or network loss and does not silently become a live-app drill.

## Deterministic campaign

Run only with a disposable local synthetic service/state and synthetic job payloads. No NAS endpoint, production token, real job admission, or external coordinator is in scope. Use a fresh evidence file for this correlation and preserve every raw JSONL row.

From the reviewed core checkout with the pinned Node/pnpm environment active, run the 80-row deterministic harness. `G6_RESULTS` should be a new private file path; the runner replaces that one file and validates it after the campaign:

```sh
G6_RESULTS=/private/path/g6-results.jsonl \
  node packages/fleet-runner/scripts/g6-interruption-run.mjs
```

The campaign uses local `JobStore` state, synthetic outputs, injected clock changes, and a localhost signed HTTP service for the dropped-completion-response case. It writes raw attempt/fence/output receipts for 80 repetitions. The deterministic sleep/partition and non-cooperative-handler cases are clocked simulations; the physical sleep and Wi-Fi trials below remain separate.

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
| `lease-lost-during-upload` | Let a newer fence claim while old upload is in flight | stale rejection, newer accepted fence, output SHA-256, accepted count |
| `crash-output-before-db-commit` | Throw after durable attempt file write and before DB commit; reopen and reclaim | orphan and accepted file names, DB state, both fences, accepted SHA-256 |
| `crash-db-boundary` | Inject DB/output durability boundary fault | transaction/event state, attempt fences, final output hash or explicit no-output terminal state |
| `retry-exhaustion` | Exhaust configured retry budget | each claim/fence, retry count, terminal status, accepted output count `0` |
| `handler-ignores-cancellation` | Deterministic non-cooperative handler cancellation case | stop/drain deadline, lease/attempt state, whether later work was admitted, no stale accepted output |
| `stale-fence-rejection` | Stale attempt is submitted after reclaim; the baseline must reject it | stale rejection plus newer accepted fence |

Each JSONL row must use `case_id`, `repetition` (1–10), ISO `started_at` and `finished_at`, `synthetic: true`, `fault_evidence`, `attempts: [{worker_id,fence}]`, `accepted_output_count` (0 or 1), `accepted_output_sha256` (64 lowercase hex or `null`), `reclaim_applicable` (boolean), `reclaim_elapsed_ms` and `reclaim_bound_ms` when applicable, and `result: "pass"`. Do not invent evidence for values a test did not observe. Check the completed file with:

```sh
node packages/fleet-runner/scripts/g6-interruption-check.mjs /path/to/private/g6-results.jsonl
```

The checker rejects missing/duplicate repetitions, malformed attempts/fences, a missed applicable reclaim bound, missing hashes for accepted outputs, and synthetic/non-synthetic ambiguity. Its success is only the deterministic denominator; it does not assert the physical campaign passed.

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

This package creates a procedure and checker. Until the deterministic harness emits its 80 raw repetitions and the six real OS/network receipts are attached, G6 remains unqualified. No NAS, live queue, deployment, HelpDesk write, or physical trial is run by this package.
