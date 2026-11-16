# Native dispatch contract

`@core/native-dispatch` 0.4.0 supplies admission and durable invocation safety to the HelpDesk
device receiver. LocalHelp owns replay, the receiver inbox, checkpoints and correspondence receipts.
Core owns the invocation journal. The package adds no delivery queue or scheduler and changes no
FleetRunner compute behavior. It implements the applicable semantics of
[Core 596](https://github.com/ojfbot/core/pull/596) under the separate 14 November build charter.

Version 0.2 adds [disabled subscription-canary preparation](./CANARY.md). Version 0.3 adds a
separate [owner-attended subscription transport](./SUPERVISED.md), gated by a local approval
artifact and exact 30-minute window. The preparation API remains disabled. The mechanical
contract below and its controller/recovery rules remain in force.
Version 0.3.4 revokes all Codex subscription qualifications after the live trial exposed tools.
The two-provider supervised plan remains held; preparation and BASIC coordination remain available.
Version 0.4.0 adds [correspondence duty](./CORRESPONDENCE.md): a separate Claude-only plan kind whose
turns read LocalHelp's packet, run on a fresh native session each time, and return a checked
reply-or-escalation proposal. The advisory canary is unchanged.

The mechanical entry has no real-provider launch path. `createQualificationTransport()` runs fixed local
emulators with the current Node executable and an empty environment. There is no executable option,
live-arm flag, credential option, provider fallback or model retry. An arbitrary transport object is
refused at runtime, including a copied qualification transport. The fixtures contain no network or
filesystem operations and stop themselves after ten seconds if their controller disappears.

## Public API

```ts
import { createQualificationTransport, openDispatcher } from "@core/native-dispatch";

const dispatcher = openDispatcher({
  stateFile, // owner-private file beside LocalHelp's inbox, never inside a checkout
  bindings,
  grants,
  profiles,
  transport: createQualificationTransport(),
});
const disposition = await dispatcher.dispatch(request, { signal });
const recorded = dispatcher.lookup(request.deliveryId);
dispatcher.close(); // refuses while a local invocation is active
```

The declarations exported by `src/index.ts` are the field contract. A `DispatchRequest` carries a
stable delivery ID, journal and message references, exact recipient and binding revision, charter,
grant and profile revisions, the workflow, resource references, and `task: { input, inputDigest }`.
`task.input` is at most 4,096 bytes and contains only this JSON pointer:

```json
{
  "message_id": "message-reference",
  "thread_id": "thread-reference",
  "sequence": 7,
  "stream_id": "journal-stream",
  "bindingRevision": "binding-revision"
}
```

The five values must match the surrounding request. `inputDigest` is the SHA-256 of the exact UTF-8
pointer bytes. Message bodies, command arguments and executable paths are not pointer fields.
Both native interfaces reconstruct the pointer from validated fields. Duplicate JSON keys or
ignored raw text cannot reach a session.
The native input identifies peer data. Native APIs accepting that input as a user turn do not make
the peer an operator or grant issuer.

Bindings, profiles and grants are trusted owner configuration, copied when opening the dispatcher.
They never come from a peer's asserted approval. Unknown recipients, stale revisions, holds, expiry,
resource mismatches and non-advisory workflows are refused before a subprocess starts. A profile
selects a provider, exact native version and model. A binding fixes the device, logical alias,
native session, working directory and resource list. Only the `advisory-review` workflow and
`native-resume` operation are registered in this slice.
Working directories resolve to their existing canonical paths before the authorization snapshot
and subprocess launch, so operating-system path aliases do not change the native binding.

## Journal and recovery

The receiver first commits its addressed import, then calls Core with the same deterministic
`deliveryId` on every retry. Core atomically records the authorization snapshot, request digest,
budget reservation, invocation ID and native-session controller before any subprocess effect.
The invocation ID is deterministic from the delivery ID. A retry returns the persisted disposition;
reusing an ID with changed request bytes is refused.
Admission takes its time snapshot inside the transaction and checks expiry again immediately before
the native effect. If commit time exhausts the grant, Core records an expired refusal, starts no
process and atomically refunds that proven-no-effect reservation. The refused delivery stays
terminal, so retrying it still cannot launch work. Unknown or started invocations are never refunded.

Only one dispatcher opens a journal at a time. SQLite retains an exclusive OS lock for that
connection's lifetime. Another open fails with `dispatcher-already-open`; process death releases
the OS lock. The next owner still finds the unresolved invocation and cannot repeat it.
Within that owner, one controller serves each device/provider/native-session tuple, including
aliases that name the same session. A second invocation is busy. Core reserves it in an immediate
transaction with a full-synchronous, owner-private journal. There is no expiry-based unlock.
Core creates the journal with mode `0600` before SQLite opens it. On macOS, both `fullfsync` and
`checkpoint_fullfsync` are enabled before effects. These are verified connection settings, not a
hardware power-loss qualification. SQLite documents the
[exclusive lock](https://www.sqlite.org/pragma.html#pragma_locking_mode) and
[full sync](https://www.sqlite.org/pragma.html#pragma_fullfsync) behavior.
Process death, a queued prompt followed by exit zero, a lost completion, a timeout and cancellation
leave an unknown invocation and retain the controller. Restarting does not repeat the invocation.

`lookup(deliveryId)` reads the committed disposition. `reconcile(evidence)` requires explicit terminal
native evidence with the matching invocation, session and any previously recorded turn ID. The
receiver must obtain that evidence from its qualified observation boundary, never a peer claim.
Conflicting terminal evidence is refused. Reconciliation releases the session controller but does
not refund budget. A controller must not be reconciled while its local invocation is active.

`dispatch` returns one of:

| Kind       | Meaning                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `refused`  | No new native invocation started; a reason identifies the failed check. |
| `busy`     | Another unresolved invocation owns this native session.                 |
| `unknown`  | An invocation intent exists; native effect or completion is unresolved. |
| `observed` | Matching terminal native evidence was persisted.                        |

An observed native completion is neither an agent acknowledgement nor a successful work result.
Those remain separate correlated HelpDesk replies. The receiver publishes import and invocation
receipts only after the corresponding durable records exist.

Grant usage survives revision changes. Budget usage survives fresh grants sharing the same budget
scope. Stored limits cannot be increased by a new revision. These counters bound invocations in one
journal; they do not enforce provider attempts, money, output tokens or a cross-host aggregate.
`now` is injectable for deterministic tests. Normal receiver operation uses the wall clock.

## Native profiles and evidence limits

The qualified code uses Codex `initialize`, `thread/resume`, `turn/start`, terminal turn events and
explicit approval denial. It never starts or forks a new session. The Claude interface uses an
explicit `--resume` ID with print/stream JSON output and tools disabled. Claude turn IDs remain
`null`: this interface has not established a portable native turn identifier. Local process exit
alone supplies no terminal evidence. The emulators exercise the framing in real subprocesses.

| Inventory profile       | Source inspected                                    | Qualification claim                       |
| ----------------------- | --------------------------------------------------- | ----------------------------------------- |
| Codex 0.165.0-alpha.1.2 | Offline generated protocol schema and local version | Emulator framing and local lifecycle only |
| Codex 0.164.0           | Peer offline schema inventory                       | Emulator framing and local lifecycle only |
| Claude Code 2.1.286     | Local version and help                              | Emulator framing and local lifecycle only |
| Claude Code 2.1.308     | Peer version and help inventory                     | Emulator framing and local lifecycle only |

Sources: [Codex app-server](https://learn.chatgpt.com/docs/app-server) and
[Claude Code programmatic interface](https://code.claude.com/docs/en/headless). Inventory is not
proof that these exact real profiles, account modes or permission configurations work unattended.
The current Claude help does not advertise `--max-turns`. Its `--max-budget-usd` API wording does
not establish a subscription-wide hard ceiling. Cost estimates, CLI exit and process timeouts
cannot prove a provider-call cap.

The live-test packet must resolve protected provider credentials and egress, every internal retry
and compaction call, aggregate budget across both hosts, output bounds, exact tool and configuration
isolation, session ownership beyond this managed dispatcher, authentication, and native evidence
reconciliation. Same-user and administrator access remain trusted boundaries. A local controller
file cannot fence an unrelated native UI or another program that bypasses this library. No live
profile is eligible until those requirements and separate owner approval are satisfied.

## Build and package

Use the repository-pinned pnpm version and Node 24.22.2 or later:

```sh
pnpm install --frozen-lockfile
pnpm --filter @core/native-dispatch build
pnpm exec vitest run packages/native-dispatch/src/__tests__/dispatch.test.ts
pnpm --dir packages/native-dispatch pack --pack-destination "$ARTIFACT_DIR"
```

LocalHelp vendors the packed artifact from an exact committed Core source revision, records its
SHA-256 and uses a locked `file:` dependency. Its adapter bundles the package at build time.
The installed receiver imports no checkout. Source/build pins and the actual tarball digest belong
in the consuming release receipt; generated artifacts and personal bindings do not belong here.
