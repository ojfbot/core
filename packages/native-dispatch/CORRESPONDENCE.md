# Correspondence duty

Version 0.4.1. Contract: LocalHelp `docs/correspondence-duty.md` (v1 with the 15 November amendments,
HelpDesk thread `cca89987-fda6-433f-999d-f73987025c13`, #6141 and #6144). Charter: vault
`diagrams/circusgreen-duty-soak-charter-20261115.md`.

A correspondence turn reads one bounded packet built by LocalHelp and returns a proposal: a reply, or
an escalation with one of four reasons. The model holds no key, client or general tool; its only
tool is Claude's built-in output tool. LocalHelp checks, signs and posts the result. Core reads
nothing from HelpDesk.

## What Core enforces

- **Plan kind.** `prepareCorrespondencePlan` accepts `kind: "correspondence"` with one or two
  bindings, at most one per provider. Any Codex profile or binding is refused as `revoked-provider`.
  In practice the plan is Claude-only.
- **Limits.** `topLevelTurns` 1–40 as one budget for the whole window
  (`correspondence:<windowId>:<deviceId>`); `windowMs` 60,000–5,400,000; `requestTimeoutMs` 120,000.
- **Supervision.** `owner-attended` only, without `codexHostFileReadRiskAccepted`.
- **Environment.** `HOME` and `CODEX_HOME` must match the controller's own environment exactly, and
  `CODEX_HOME` must be null in the plan, so the controller must run with `CODEX_HOME` unset.
  `TMPDIR` is pinned by the plan and set for Claude; it is not compared with the controller's. A
  pinned `TMPDIR` must exist and be the owner's own folder, not writable by group or others, or a
  root-owned sticky folder such as `/tmp`; `null` leaves it unset for Claude. Prepare the plan in
  the same environment the launchd job runs with: a `HOME` or `CODEX_HOME` that differs from the
  job's holds the window with `environment-mismatch`.
- **Approval.** `kind: "owner-approved-correspondence-window"`, with
  `expiresAtMs - startsAtMs === plan.limits.windowMs`. The owner approves each window in that Mac's chat.
- **Qualified version.** A duty window opens only for a Claude version listed in
  `CLAUDE_CORRESPONDENCE_QUALIFIED` with the pinned binary SHA-256, whose committed trace matches
  the listed trace SHA-256 and replays as accepted. Otherwise it holds with
  `native-profile-unqualified`. See [Qualifying a Claude version](#qualifying-a-claude-version).
- **Fresh session.** Grants use operation `native-fresh`. The dispatcher mints a new session UUID when
  it books the turn and journals it before any launch; the command is `--session-id <uuid>`, never
  `--resume`. Only one turn runs at a time.
- **Request.** `workflow: "correspondence"`; `task.input` is the packet (at most 32,768 UTF-8 bytes) and
  `task.inputDigest` its SHA-256. The packet's `request.message_id`, `thread_id` and `sequence` must
  match the delivery, and `resources` must be exactly `["helpdesk:thread:<threadId>"]`. The full
  packet grammar is checked at admission: a malformed packet is refused with `invalid-request`
  before anything is reserved or journaled.
- **Threads.** A binding names explicit `helpdesk:thread:<id>` resources, or exactly
  `helpdesk:thread:*` for any one thread. That wildcard is the only pattern, and only for
  correspondence.
- **Input.** `CORRESPONDENCE_INSTRUCTIONS_V1`, then the packet digest, then the packet verbatim. The
  packet's last byte is the last byte of stdin (no trailing newline), so no end marker can be forged
  from inside it.
- **One output tool.** See [Frame contract](#frame-contract).
- **Proposal.** `parseCorrespondenceAnswer` accepts only the closed six-field answer, with the digest
  echo, the reply/escalate rules, `needs` only for `missing-context`, `gaps` only for a reply, and no
  `missing-context` under `best_effort`. `text` is 1–4,000 code points and at most 8,000 bytes,
  `needs` at most 1,000 code points and 4,000 bytes, `gaps` at most 2,000 code points and 8,000
  bytes. Code points match the schema's `maxLength`. Anything else is a completed turn with no
  proposal.
- **Journal source.** A correspondence journal records whether it is `live` or `emulated`. A live
  window never opens on an emulated journal, nor an emulation on a live one; both throw
  `journal-source-mismatch`. So does an unmarked journal that already holds rows.

## Frame contract

With `--json-schema`, Claude Code 2.1.308 implements the answer as a built-in tool named
`StructuredOutput` (`CLAUDE_OUTPUT_TOOL`). The model must call it once; the call ends the turn, and
the result frame carries the same object as `structured_output`. `createCorrespondenceFrameChecker`
is the one checker: the live transport, trace replay and qualification all use it.

- **Init.** The first frame is `system/init` with the pinned model and this session. Its `tools`, as
  a set, must be exactly `["StructuredOutput"]`. `mcp_servers` must be empty, and so must
  `slash_commands`, `terminal_slash_commands`, `agents`, `skills` and `plugins` whenever they are
  listed.
- **Calls.** Across the whole turn there is at most one tool-use block of any kind, and it must be
  `tool_use` named `StructuredOutput`. Its `input` must deep-equal the result's `structured_output`,
  and that object is what `parseCorrespondenceAnswer` gets.
- **Errors.** A result frame with `is_error` other than `false` is a `failed` turn with no proposal.
- **Scope.** The advisory canary and supervised transports keep their own checks, unchanged.

Each refusal below ends the turn as `unknown` with no proposal. The reason is journaled; read it with
`dispatcher.turnRefusal(deliveryId)`.

| Reason                     | Meaning                                                   |
| -------------------------- | --------------------------------------------------------- |
| `init-tools-mismatch`      | Init tools are not exactly the output tool                |
| `init-surface-not-empty`   | An MCP server, slash command, agent, skill or plugin      |
| `tool-name-mismatch`       | Another tool, or a server or MCP tool-use block           |
| `tool-second-call`         | A second tool-use block                                   |
| `tool-call-without-output` | The output tool was called, but no `structured_output`    |
| `output-without-tool-call` | `structured_output` with no call                          |
| `tool-input-mismatch`      | The call's input differs from `structured_output`         |
| `no-tool-call`             | Neither a call nor `structured_output`, e.g. a text reply |
| `init-model-mismatch`      | Init reports another model                                |
| `invalid-frame`            | A line that is not a well-formed frame                    |
| `wrong-session`            | A frame from another session                              |
| `frame-before-init`        | A frame before init                                       |
| `init-repeated`            | A second init frame                                       |
| `frame-after-result`       | A frame after the result                                  |
| `no-result`                | The stream ended without a result                         |
| `deadline`, `aborted`      | The turn's limit passed, or the caller aborted            |
| `output-overflow`          | More than 256 KiB of output                               |
| `exit-nonzero`             | The process exited nonzero                                |
| `trailing-output`          | Bytes after the last complete line                        |
| `process-error`            | The process could not be spawned                          |
| `stop-unconfirmed`         | A stop could not be confirmed                             |

## Process lifetime

Claude is never spawned `detached`. It runs as the child of a small watchdog (the controller's own
Node binary running `CORRESPONDENCE_WATCHDOG_SOURCE` with `-e`), and both stay in the controller's
process group, so launchd's job teardown reaches them. The watchdog measures the turn's limit (at
most 120 seconds, never past the window) itself, so the hard limit does not depend on the
controller staying alive. It SIGKILLs Claude at that limit (exit 124), within 100 ms of its parent
controller disappearing (exit 125), or when it is signalled (exit 143). It reads neither stdin nor
stdout: Claude inherits those pipes directly. The controller's own timer still stops the turn at the
same limit.

Limits: the watchdog kills Claude's process, not descendants that leave its process group; a turn
whose only tool is the output tool is not expected to start any. If the watchdog itself is
SIGKILLed, Claude is left to launchd's group teardown, and the controller records
`stop-unconfirmed`.

## Unresolved turns

After a lost turn, a hang, or any refusal above, the turn stays `unknown`, its budget stays spent,
and its controller row stays. Every later dispatch in that journal is `busy` until the owner
reconciles it. Nothing is retried or refunded. That is the safe default.

To reconcile, the owner stops the listener (it holds the journal's exclusive lock), confirms that
the turn's Claude process is gone (`pgrep -f <nativeSessionId>` prints nothing; once the watchdog's
limit has passed it must be), then opens the window again with the same plan, approval and journal
and calls `reconcile`:

```js
const opened = openCorrespondenceWindow({ prepared, stateFile, runtimeApprovalFile, deviceId });
const turn = opened.dispatcher.lookup(deliveryId); // { kind: "unknown", dispatchId, nativeSessionId, … }
opened.dispatcher.reconcile({
  dispatchId: turn.dispatchId,
  nativeSessionId: turn.nativeSessionId,
  nativeTurnId: turn.nativeTurnId, // null for correspondence
  outcome: "interrupted",
});
opened.dispatcher.close();
```

`reconcile` checks that the invocation exists, that the session and any recorded turn ID match the
journal, that the outcome is terminal (`completed`, `failed`, `interrupted`, `approval-blocked` or
`authentication-blocked`), that this process is not still running it, and that it does not conflict
with an earlier observation. It releases the controller, records no proposal and refunds no
budget. Use `interrupted` unless there is native evidence of another outcome. The window must
still be approved and active to open. After it expires, keep that journal as evidence and name a
new journal in the next window's approval.

## Qualifying a Claude version

**Trace format.** `qualification/claude/<version>.trace.json` holds one real correspondence turn,
cut down by `traceFromFrames(frames)` and written by `serializeCorrespondenceTrace` (two-space JSON
with a final newline). Its SHA-256 is over those exact bytes. The file is
`{ "format": "claude-correspondence-trace-v1", "frames": [...] }`, one entry per stream-json frame:

- every frame keeps only `type` and `subtype`;
- `system/init` also keeps `model`, `tools`, `mcp_servers` and any of `slash_commands`,
  `terminal_slash_commands`, `agents`, `skills` and `plugins` (list entries keep only a string or a
  `name`);
- `assistant` keeps `message.content`, where a tool-use block keeps `type`, `name` and `input`, and
  any other block keeps only its `type`;
- `result` keeps `is_error` and `structured_output`;
- a line that was not a JSON object is `null`.

No session, account, usage, cost, identifier or prose beyond the answer is kept.
`replayCorrespondenceTrace` re-attaches a placeholder session and feeds the frames to the real
checker. A committed trace must be accepted and must answer the fixed qualification packet.

**Allowlist.** `CLAUDE_CORRESPONDENCE_QUALIFIED` in `src/correspondence-qualification.ts` lists
`{ nativeVersion, binarySHA256, traceSHA256 }`. It is empty: no real trace exists yet, so 2.1.286
and 2.1.308 are refused. Adding a version is one data entry and no code change.

**Recording.** With the built package, the owner's existing approval for a window, and an output
path that does not exist yet:

```sh
node <package>/scripts/qualify-claude-correspondence.mjs <plan.json> <approval.json> <out.trace.json>
```

The script calls `qualifyClaudeCorrespondence`, which goes through `openCorrespondenceWindow`'s
path, transport and frame checker. It runs exactly one real turn on the fixed, built-in
`CORRESPONDENCE_QUALIFICATION_PACKET` (no HelpDesk data), in the approval's own journal, which
counts it against that window's budget. In this one path the version-has-trace refusal is skipped
(marked `QUALIFICATION BYPASS` in the code), and the window admits only that packet's thread. It
refuses to run without a valid approval, never writes an approval, and opens no listener. It writes
the trace and prints the version, path, SHA-256, the turn's disposition and the verdict, and exits 0
only when the verdict is `accepted`. To qualify the version, commit the trace as
`qualification/claude/<version>.trace.json` and add its allowlist entry with the binary's SHA-256.

## Offline proof

`openCorrespondenceEmulation` runs the same admission, journal, budget and proposal checks with a
scripted fake model (`answer`, `failed`, `lost`, `hang`). It needs no approval file or binary, and
`status()` reports `realProviderCalls: 0`. Its journal is marked `emulated`.
