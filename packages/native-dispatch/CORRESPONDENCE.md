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
- **Claude version.** Correspondence plans and dispatchers take their Claude versions from
  `CLAUDE_CORRESPONDENCE_QUALIFIED` only, never from the advisory canary's fixed list; any other
  version is `unqualified-profile` when the plan is prepared. Only
  `prepareCorrespondenceQualificationPlan` accepts a version not yet listed, and such a plan opens
  only a qualification run.
- **Limits.** `topLevelTurns` 1–40 as one budget for the whole window
  (`correspondence:<windowId>:<deviceId>`); `windowMs` 60,000–5,400,000; `requestTimeoutMs` 120,000.
- **Supervision.** `owner-attended` only, without `codexHostFileReadRiskAccepted`.
- **Environment.** `HOME` and `CODEX_HOME` must match the controller's own environment exactly, and
  `CODEX_HOME` must be null in the plan, so the controller must run with `CODEX_HOME` unset. Prepare
  the plan in the same environment the launchd job runs with: a `HOME` or `CODEX_HOME` that differs
  from the job's holds the window with `environment-mismatch`.
- **TMPDIR.** Pinned by the plan and set for Claude, exactly as checked; it is not compared with
  the controller's. `null` leaves it unset for Claude. A pinned folder must be its own realpath (no
  symlink anywhere in it and no trailing slash: on macOS use `/private/var/folders/…/T`, not
  `/var/folders/…/T/`), carry no ACL, and be either the owner's own folder with mode exactly 0700 or
  a root-owned sticky folder such as `/private/tmp`. Every parent up to `/` must be owned by the
  owner or root and not writable by group or others, unless it is root-owned and sticky. Anything
  else holds with `environment-mismatch`.
- **Approval.** `kind: "owner-approved-correspondence-window"`, with
  `expiresAtMs - startsAtMs === plan.limits.windowMs`. The owner approves each window in that Mac's
  chat. A qualification approval (`owner-approved-correspondence-qualification`) never opens a duty
  window.
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
- **Input.** `CORRESPONDENCE_INSTRUCTIONS_V2` (which tells Claude to answer by calling the
  StructuredOutput tool exactly once and use no other tool), then the packet digest, then the packet
  verbatim. The
  packet's last byte is the last byte of stdin (no trailing newline), so no end marker can be forged
  from inside it.
- **One output tool.** See [Frame contract](#frame-contract).
- **Proposal.** `parseCorrespondenceAnswer` accepts only the closed six-field answer, with the digest
  echo, the reply/escalate rules, `needs` only for `missing-context`, `gaps` only for a reply, and no
  `missing-context` under `best_effort`. `text` is 1–4,000 code points and at most 8,000 bytes,
  `needs` at most 1,000 code points and 4,000 bytes, `gaps` at most 2,000 code points and 8,000
  bytes. Code points match the schema's `maxLength`. Anything else is a completed turn with no
  proposal.
- **Journal source.** Every opener declares its source. A correspondence journal is marked `live`
  (duty), `qualification` or `emulated`, and opens only for that source. The advisory and
  supervised openers, including the public `openDispatcher`, declare none and cannot open a marked
  journal. A correspondence opener also refuses an unmarked journal that already holds rows (such as
  a 0.4.0 journal). The check runs in the same transaction as table creation, before it, so a
  refused open leaves the journal byte-for-byte unchanged. `openCorrespondenceWindow` returns a
  `held` result with `journal-source-mismatch`; the emulation throws it.

## Frame contract

With `--json-schema`, Claude Code 2.1.308 implements the answer as a built-in tool named
`StructuredOutput` (`CLAUDE_OUTPUT_TOOL`). The model must call it once; the call ends the turn, and
the result frame carries the same object as `structured_output`. `createCorrespondenceFrameChecker`
is the one checker: the live transport, trace replay and qualification all use it.

- **Frames.** Fail closed: every frame's `type` or `type/subtype` must be on
  `CORRESPONDENCE_ALLOWED_FRAMES` (`system/init`, `system/status`, `system/api_retry`,
  `rate_limit_event`, `assistant`, `user`, and `result/` with `success` or one of the four `error_`
  subtypes). Anything else, `stream_event` included, refuses the turn with `unexpected-frame`. A
  version that emits another frame kind needs a reviewed change to that list.
- **Init.** The first frame is `system/init` with the plan's model, the plan's exact Claude version
  in `claude_code_version`, and this session. Its `tools`, as a set, must be exactly
  `["StructuredOutput"]`. `mcp_servers` must be empty, and so must
  `slash_commands`, `terminal_slash_commands`, `agents`, `skills` and `plugins` whenever they are
  listed.
- **Calls.** Every allowed frame is searched at any depth, nested `event` objects included, for a
  `tool_use`, `server_tool_use` or other `*tool_use` block (as in a `content_block_start`) and a
  tool-input `content_block_delta`; each one counts. Across the whole turn there is at most one,
  and it must be a direct content block of an assistant frame: `tool_use` named
  `StructuredOutput`. Its `input` must deep-equal the result's `structured_output`,
  and that object is what `parseCorrespondenceAnswer` gets.
- **Errors.** A result frame with `is_error` other than `false` is a `failed` turn with no proposal.
- **Scope.** The advisory canary and supervised transports keep their own checks, unchanged.

Each refusal below ends the turn as `unknown` with no proposal. The reason is journaled; read it with
`dispatcher.turnRefusal(deliveryId)`.

| Reason                     | Meaning                                                   |
| -------------------------- | --------------------------------------------------------- |
| `unexpected-frame`         | A frame kind not on the allowlist, e.g. `stream_event`    |
| `init-version-mismatch`    | Init reports another Claude version than the plan's       |
| `init-tools-mismatch`      | Init tools are not exactly the output tool                |
| `init-surface-not-empty`   | An MCP server, slash command, agent, skill or plugin      |
| `tool-name-mismatch`       | Another tool, a server or MCP block, or one out of place  |
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
| `stop-unconfirmed`         | Claude's process group could not be shown to be gone      |

## Process lifetime

The watchdog is the controller's own Node binary running `CORRESPONDENCE_WATCHDOG_SOURCE` with
`-e`. It is not detached, so it stays in the controller's process group and launchd's job teardown
signals it. The controller passes its own PID; the watchdog refuses to start Claude (exit 122)
unless that PID is its parent, and ends the turn as soon as its parent changes. It starts Claude in
Claude's own new process group and owns that whole group:

- at the turn's limit, which it measures itself (at most 120 seconds, never past the window; exit
  124), within 50 ms of its parent changing (exit 125), or when it is signalled (exit 143), it sends
  SIGTERM to the group, then SIGKILL after 200 ms, and polls for up to 2 s until the group is gone;
- when Claude exits by itself, descendants left in its group are killed the same way;
- it exits only after the group is shown gone, or with 121 when it could not show that.

It reports `group <pgid>` and `done <code>` on fd 3 and never reads stdin or stdout: Claude
inherits those pipes. The controller's own timer stops the turn at the same limit. Its stop first
lets the watchdog's escalation finish (it waits 3 s), then SIGKILLs a watchdog that has not exited
and Claude's group directly. Once the watchdog has confirmed the group gone, the controller never
signals that group ID again. If neither can show the group gone, the turn records
`stop-unconfirmed`, and `dispatcher.turnProcessGroup(deliveryId)` gives the group to check.
A process that leaves Claude's group (a new session or group of its own) is outside this
guarantee; a turn whose only tool is the output tool is not expected to start one.

## Unresolved turns

After a lost turn, a hang, or any refusal above, the turn stays `unknown`, its budget stays spent,
and its controller row stays. Every later dispatch in that journal is `busy` until the owner
reconciles it. Nothing is retried or refunded. That is the safe default.

To see what is unresolved without a plan, approval or qualified version, stop the listener (it
holds the journal's exclusive lock) and call `reviewCorrespondenceJournal(stateFile)`. It is
read-only and works on every journal, including 0.4.0 journals with no source marker and
qualification journals; it lists each unresolved turn's delivery, dispatch and session IDs, its
journaled refusal and Claude's process group.

To reconcile, the owner confirms that the turn's processes are gone: `pgrep -g <processGroup>`
prints nothing (the group from the review, or from `turnProcessGroup`), and
`pgrep -f <nativeSessionId>` prints nothing (it matches the watchdog's and Claude's command lines).
Then the owner opens the window again with the same plan, approval and journal, and calls
`reconcile`:

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
still be approved and active to open. After it expires, or for a 0.4.0 journal (which no 0.4.1
opener accepts), keep that journal as evidence and name a new journal in the next window's
approval.

## Qualifying a Claude version

**Trace format.** `qualification/claude/<version>.trace.json` holds one real correspondence turn,
cut down by `traceFromFrames(frames, { acceptedAnswer })` and written by
`serializeCorrespondenceTrace` (two-space JSON with a final newline). Its SHA-256 is over those
exact bytes. The file is `{ "format": "claude-correspondence-trace-v2", "frames": [...] }`, one
entry per stream-json frame:

- every frame keeps only `type` and `subtype`;
- `system/init` also keeps `model` and `claude_code_version`; `tools` keeps its names only when it is
  exactly `["StructuredOutput"]`, otherwise `{count, sha256}` of the sorted names; `mcp_servers`
  and the other init lists keep only `{count, empty}`;
- `assistant` keeps `message.content`, where a tool-use block keeps its `type` and `name` and any
  other block only its `type`;
- `result` keeps `is_error` and `has_structured_output`;
- tool use found anywhere else in a frame is kept as `nested_tool_uses` (type and name), so replay
  refuses it as the live checker did;
- a line that was not a JSON object is `null`.

Tool input is never copied, except that the single StructuredOutput call's input and the result's
`structured_output` are kept when the turn was accepted and the answer passed
`parseCorrespondenceAnswer`. A refused trace keeps only names, counts and block types. No session,
account, usage, cost or identifier is kept. `replayCorrespondenceTrace(trace, { model,
nativeVersion })` restores the frames' shape and feeds them to the real checker against the plan's
model and version, never the trace's own claims.

**The gate.** A duty window opens a Claude profile only when its version and binary SHA-256 match an
allowlist entry, the committed trace matches the entry's trace SHA-256, the trace replays as
accepted with the profile's model and version (so a trace copied to another version's name is
refused), the answer is for the fixed qualification packet, and the binary itself reports that
version (`--version`, in the static checks).

**Allowlist.** `CLAUDE_CORRESPONDENCE_QUALIFIED` in `src/correspondence-allowlist.ts`, a data-only
module, lists
`{ nativeVersion, binarySHA256, traceSHA256 }`. It is empty: no real trace exists yet, so 2.1.286
and 2.1.308 are refused. Adding a version is one data entry and no code change.

**Recording.** The owner approves one qualification run with
`kind: "owner-approved-correspondence-qualification"`, the same fields as a window approval, a
window of 1 to 30 minutes, and its own `invocationStateFile`, separate from every duty journal.
A duty-window approval does not authorise it. Then, with the built package and an output path that
does not exist yet:

```sh
node <package>/scripts/qualify-claude-correspondence.mjs <plan.json> <approval.json> <out.trace.json>
```

The script prepares the plan with `prepareCorrespondenceQualificationPlan` and calls
`qualifyClaudeCorrespondence`, which goes through `openCorrespondenceWindow`'s path, transport and
frame checker. It runs exactly one real turn on the fixed, built-in
`CORRESPONDENCE_QUALIFICATION_PACKET` (no HelpDesk data); the qualification journal has a budget of
exactly one turn. In this one path the version-has-trace refusal is skipped (marked
`QUALIFICATION BYPASS` in the code); the binary, version, help and managed-policy checks still run,
and the window admits only that packet's thread. It refuses to run without a valid approval, never
writes an approval, and opens no listener. It writes the trace only to the path given, with mode
0600, and prints the version, path, SHA-256, the turn's disposition and the verdict; it exits 0
only when the verdict is `accepted`. To qualify the version, commit the trace as
`qualification/claude/<version>.trace.json` and add its allowlist entry with the binary's SHA-256.

A failed qualification leaves only its own journal unresolved. The owner can review it with
`reviewCorrespondenceJournal` and then delete it, or keep it as evidence; no duty journal is
affected, and no qualified version is needed.

## Offline proof

`openCorrespondenceEmulation` runs the same admission, journal, budget and proposal checks with a
scripted fake model (`answer`, `failed`, `lost`, `hang`). It needs no approval file or binary, and
`status()` reports `realProviderCalls: 0`. Its journal is marked `emulated`.
