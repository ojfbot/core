# Correspondence duty

Version 0.4.2. Contract: LocalHelp `docs/correspondence-duty.md` (v1 with the 15 November amendments,
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
  version is `unqualified-profile` when the plan is prepared. Two marked paths skip the allowlist:
  `prepareCorrespondenceQualificationPlan` (a version being qualified; it opens only a qualification
  run) and `prepareCorrespondenceEmulationPlan` (no real binary runs; it opens only an emulation).
- **Limits.** `topLevelTurns` 1–40 as one budget for the whole window
  (`correspondence:<windowId>:<deviceId>`); `windowMs` 60,000–5,400,000; `requestTimeoutMs` 120,000.
- **Supervision.** `owner-attended` only, without `codexHostFileReadRiskAccepted`.
- **No ACLs, so nothing under `~`.** macOS gives home folders the ACL `group:everyone deny delete`,
  and Core refuses any ACL on the approval file, the journal, the working folder, `TMPDIR` or any
  of their parents. Keep all of them outside `~` (for example under `/private/var/folders/…/T`).
  Such a hold is reported as `acl-unqualified`, not as an invalid approval or an environment
  mismatch.
- **Environment.** `HOME` and `CODEX_HOME` must match the controller's own environment exactly, and
  `CODEX_HOME` must be null in the plan, so the controller must run with `CODEX_HOME` unset. Prepare
  the plan in the same environment the launchd job runs with: a `HOME` or `CODEX_HOME` that differs
  from the job's holds the window with `environment-mismatch`.
- **TMPDIR.** Pinned by the plan and set for Claude, exactly as checked; it is not compared with
  the controller's. Duty and qualification plans must pin one: `null` is refused when the plan is
  prepared (`tmpdir-required`), because Claude would fall back to the shared `/tmp`. Only an
  emulation plan may leave it `null`. A pinned folder must be the owner's own
  private folder: its own realpath (no symlink anywhere in it and no trailing slash: on macOS use
  `/private/var/folders/…/T`, not `/var/folders/…/T/`), owned by the owner with mode exactly 0700,
  and without an ACL. Shared folders such as `/private/tmp` or `/Users/Shared`, and any root-owned
  sticky folder, are refused. Every parent up to `/` must be owned by the owner or root and not
  writable by group or others, unless it is root-owned and sticky; parents are checked on open
  descriptors in-process, with one ACL listing for the whole path. Anything else holds with
  `environment-mismatch`.
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
  journal, nor any journal holding correspondence rows (workflow `correspondence` or operation
  `native-fresh`), marked or not. A correspondence opener also refuses an unmarked journal that
  already holds rows (such as a 0.4.0 journal). Only the read-only `reviewCorrespondenceJournal`
  opens those. The check runs in the same transaction as table creation, before it, so a
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
  in `claude_code_version`, and this session. Every key must be on `CORRESPONDENCE_INIT_KEYS` or
  `CORRESPONDENCE_CHECKED_INIT_KEYS`; any other key (a new surface, or a conditional one such as
  `plugin_errors`, `mcp_server_errors`, `startup_timing` or `memory_paths`) refuses the turn
  (`unexpected-init-key`). Its `tools` must be exactly `["StructuredOutput"]`; a duplicate is
  refused. `mcp_servers` must be empty, and so must `slash_commands`, `terminal_slash_commands`
  and `skills` whenever they are listed.
- **Built-in agents and plugins, pinned by exact name.** Safe mode disables installed plugins and
  user-supplied agents, but Claude Code still loads its built-ins: 2.1.308 lists five built-in agent
  types (such as `general-purpose`, `Explore` and `Plan`) and several built-in plugins from a table
  inside the binary (such as `cc-plugin-easel`). Which of the binary's built-in plugins are enabled
  can change without a binary change: on Yojimbo on 16 November the same 2.1.308 binary reported
  three plugins at about 05:36Z and four at about 18:57Z. A change like that refuses duty turns
  until the version is requalified; it fails closed. The model cannot invoke them: it has no Agent tool (its only tool is
  `StructuredOutput`, with `--tools ""`), and hooks are off. Owner's decision, 16 November: "Pin
  exact names". Each allowlist entry carries `builtinAgents` and `builtinPlugins`, the exact sorted
  name sets from its recorded qualification trace, and every duty turn must report exactly those
  sets: an addition, removal, rename or duplicate refuses the turn (`init-builtins-mismatch`), live
  and in replay. Agents are agent-type strings; for plugins only `name` is read, never a path,
  source or version (built-in plugins ship inside the binary, whose SHA-256 is already pinned).
  Anything that is not a plain name of at most 64 characters, in a list of at most 64, refuses the
  turn (`init-value-unexpected`). A qualification turn has no entry yet, so it records the names
  instead of refusing them; the entry it prints carries them, and only a committed entry opens a
  duty window.
- **Print-mode init keys (2.1.308).** Each may be absent; when present it must pass its check:

  | Key                         | Meaning                                           | Check                                  |
  | --------------------------- | ------------------------------------------------- | -------------------------------------- |
  | `capabilities`              | SDK protocol features the CLI supports, not tools | Array of at most 64 `snake_case` names |
  | `original_cwd`              | The folder Claude started in                      | Equals the turn's folder (realpath)    |
  | `additional_directories`    | Extra working folders (`--add-dir`, settings)     | `[]`                                   |
  | `messaging_socket_path`     | The cross-session inbox socket                    | `null` (Core turns the inbox off)      |
  | `fast_mode_state`           | Fast-output mode                                  | `off`, `on` or `cooldown`              |
  | `fast_mode_disabled_reason` | Why fast mode is off                              | `null` or a short `snake_case` code    |
  | `per_turn_effort_active`    | Per-turn effort switching                         | A boolean                              |
  | `view_mode`                 | Interactive view                                  | `default` or `focus`                   |

  A failed check refuses the turn: `init-messaging-socket`, `init-cwd-mismatch`, or otherwise
  `init-value-unexpected`.

- **No cross-session messaging.** Claude Code 2.1.308 binds a Unix-socket "cross-session inbox"
  through which other local Claude sessions can deliver messages, and files, into a session. Core
  sets `CLAUDE_CODE_HARBOR_KITE=0` in Claude's environment (`CORRESPONDENCE_MESSAGING_OFF`), which
  turns that gate off: the inbox is never bound, nor late-bound when a remote flag refresh arrives,
  and the init frame has no `messaging_socket_path`.
- **Calls.** Every allowed frame is searched at any depth, nested `event` objects included, for a
  `tool_use`, `server_tool_use` or other `*tool_use` block (as in a `content_block_start`) and a
  tool-input `content_block_delta`; each one counts. Across the whole turn there is at most one,
  and it must be a direct content block of an assistant frame: `tool_use` named
  `StructuredOutput`. Its `input` must deep-equal the result's `structured_output`,
  and that object is what `parseCorrespondenceAnswer` gets.
- **Result.** `is_error` must be a boolean, or the turn is refused. A proposal comes only from a
  `result/success` frame with `is_error: false`; any other result is a `failed` turn with no
  proposal.
- **Scope.** The advisory canary and supervised transports keep their own checks, unchanged.

Each refusal below ends the turn as `unknown` with no proposal. The reason is journaled; read it with
`dispatcher.turnRefusal(deliveryId)`.

| Reason                     | Meaning                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `unexpected-frame`         | A frame kind not on the allowlist, e.g. `stream_event`     |
| `init-version-mismatch`    | Init reports another Claude version than the plan's        |
| `init-tools-mismatch`      | Init tools are not exactly the output tool                 |
| `init-surface-not-empty`   | An MCP server, slash command or skill                      |
| `init-builtins-mismatch`   | Built-in agents or plugins differ from the pinned sets     |
| `init-messaging-socket`    | Init reports a cross-session messaging socket              |
| `init-cwd-mismatch`        | `original_cwd` is not the turn's folder                    |
| `init-value-unexpected`    | A checked init key failed its check                        |
| `unexpected-init-key`      | An init key not on `CORRESPONDENCE_INIT_KEYS`              |
| `invalid-result`           | A result whose `is_error` is not a boolean                 |
| `tool-name-mismatch`       | Another tool, a server or MCP block, or one out of place   |
| `tool-second-call`         | A second tool-use block                                    |
| `tool-call-without-output` | The output tool was called, but no `structured_output`     |
| `output-without-tool-call` | `structured_output` with no call                           |
| `tool-input-mismatch`      | The call's input differs from `structured_output`          |
| `no-tool-call`             | Neither a call nor `structured_output`, e.g. a text reply  |
| `init-model-mismatch`      | Init reports another model                                 |
| `invalid-frame`            | A line that is not a well-formed frame                     |
| `wrong-session`            | A frame from another session                               |
| `frame-before-init`        | A frame before init                                        |
| `init-repeated`            | A second init frame                                        |
| `frame-after-result`       | A frame after the result                                   |
| `no-result`                | The stream ended without a result                          |
| `deadline`, `aborted`      | The turn's limit passed, or the caller aborted             |
| `output-overflow`          | More than 256 KiB of output                                |
| `exit-nonzero`             | The process exited nonzero                                 |
| `trailing-output`          | Bytes after the last complete line                         |
| `process-error`            | The process could not be spawned                           |
| `descendant-escaped`       | A process from the turn left Claude's group; it was killed |
| `stop-unconfirmed`         | Claude's group or a holder of its stdout may still run     |

## Process lifetime

The watchdog is the controller's own Node binary running `CORRESPONDENCE_WATCHDOG_SOURCE` with
`-e`, started by `spawnCorrespondenceWatchdog` in its own process group. A signal to the
controller's group, including a `kill -9 -<pgid>` or launchd's job teardown, therefore does not
reach it; it treats its parent changing as the controller's death. The controller passes its own
PID. The watchdog installs its signal handlers and its limit first, then starts Claude on the next
turn of its event loop, and only if no signal has arrived and its parent is still that PID
(otherwise exit 122). It starts Claude in Claude's own new process group and owns that whole group:

- at the turn's limit, which it measures itself (at most 120 seconds, never past the window; exit
  124), within 50 ms of its parent changing (exit 125), or when it is signalled (exit 143), it sends
  SIGTERM to the group, then SIGKILL after 200 ms, and polls for up to 2 s until the group is gone;
- when Claude exits by itself, descendants left in its group are killed the same way;
- it exits only after the group is shown gone, or with 121 when it could not show that.

It reports the group once, as `group <pgid>`, on fd 3. Claude is spawned with only stdin, stdout
and stderr; fd 3 is closed in Claude's process, so nothing in Claude's tree can write to that
channel, and nothing on it can skip the controller's own checks.

The controller's own timer stops the turn at the same limit. Its stop first lets the watchdog's
escalation finish (it waits 3 s), then SIGKILLs a watchdog that has not exited, then probes
Claude's group itself and SIGKILLs it while the probe shows it is there. After that it waits at
most 1 s more for the pipes to close. A holder of stdout that left Claude's group cannot be shown
gone, so the controller then stops waiting, destroys the pipes and records `stop-unconfirmed`; the
same happens 1 s after the watchdog exits if the pipes are still open. `dispatch` therefore returns
within the limit plus about 5 s, and `dispatcher.turnProcessGroup(deliveryId)` gives the group to
check. A probe of a group ID that the system has already reused is a residual risk: the controller
signals the group only while its probe succeeds, within seconds of the turn.

Every process of the turn carries `CORE_CORRESPONDENCE_TURN=<session UUID>` in its environment,
set on the watchdog and inherited by Claude and its descendants. After the group kill, and before
any proposal is accepted, the controller scans the process table for that marker
(`/proc/<pid>/environ` on Linux, `ps -ax -E -ww` on macOS, bounded to 2 s) and SIGKILLs anything
it finds. A completed turn with such a process becomes `unknown` with `descendant-escaped` and no
proposal; if a marked process survives the kill, or the table cannot be read, the turn is
`stop-unconfirmed`. Residual risk: a process that both clears its environment and leaves Claude's
group is not found, and on macOS `ps` does not show the environment of Apple platform binaries
(such as `/bin/sleep`). Both are out of scope because the model has no tool to start a process.

A turn refused before any process starts (a binary, approval or environment check just before
launch, or an expired window) is refunded and journaled as a refusal, never as unknown.

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
For a `stop-unconfirmed` turn, also look for an escaped holder of the turn's stdout, a process that
left Claude's group: `ps -axo pid,pgid,ppid,command` for processes started from Claude's working
folder or binary.
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
cut down and written (two-space JSON with a final newline) by `qualifyClaudeCorrespondence`'s real
transport path. Within the package API, that path is the only one that builds a `recorded` trace:
its constructor is internal and exported from neither the main entry nor `testing`, the public
`traceFromFrames` builds only `emulated` traces, and `serializeCorrespondenceTrace` serializes a
plain-data snapshot and refuses a `recorded` one the real path did not build. This does not make
the bytes unforgeable: see [Trust boundary](#trust-boundary). Its SHA-256 is over those exact
bytes. The file is
`{ "format": "claude-correspondence-trace-v4", "source": "recorded", "binary_sha256": "…",
"frames": [...] }`, with the pinned binary's SHA-256 and one entry per stream-json frame. `source`
is `recorded` for a real Claude turn and `emulated` for scripted frames; it is inside the hashed
bytes, so an emulated trace cannot be relabelled without changing its SHA-256. Only a closed set of fields is copied,
each in its expected shape: names (frame, block and tool types and names) only as identifiers,
the model and version only as selectors (otherwise `"invalid"`), and `is_error` only as a boolean
(otherwise `"non-boolean"`):

- every frame keeps only `type` and `subtype`;
- `system/init` also keeps `model` and `claude_code_version`; `tools` keeps its names only when it is
  exactly `["StructuredOutput"]`, otherwise `{count, sha256}` of the sorted names; `mcp_servers`
  and the other init lists keep only `{count, empty}`; `agents` and `plugins` keep only their sorted
  names (or `{count, valid: false}`); an unknown init key is kept by name only, in
  `unexpected_init_keys`; every value-checked or unknown init key also gets a shape in
  `init_key_shapes`: its type, its length (string, array or object) and whether Core allowed it,
  never its content, so a refusal can be diagnosed without another turn;
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
nativeVersion, binarySHA256 })` restores the frames' shape and feeds them to the real checker
against the plan's model, version and binary, never the trace's own claims. It refuses an emulated
trace with `emulated-trace`; only the emulation-only `replayEmulatedCorrespondenceTrace` replays
one.

**The gate.** A duty window opens a Claude profile only when an allowlist entry has its exact
version, binary SHA-256 and model; the entry's embedded trace matches the entry's trace SHA-256,
records the same binary, and replays as accepted with the profile's model and version (so a trace
copied to another version is refused); the answer is for the fixed qualification packet; and the
binary itself reports that version (`--version`, in the static checks).

**Allowlist.** `CLAUDE_CORRESPONDENCE_QUALIFIED` in `src/correspondence-allowlist.ts`, a data-only
module, lists `{ nativeVersion, model, binarySHA256, traceSHA256, trace, builtinAgents,
builtinPlugins }`, with the trace's exact
bytes embedded so they travel with the code into single-file bundles; the committed `.trace.json`
file stays the reviewed source, and a test checks that each embedded trace equals its file. The
list is deep-frozen, and the gate reads a frozen copy taken when the module loads. It holds 2.1.308
(`claude-sonnet-5-5`), qualified on Yojimbo on 16 November 2026; every other version is refused. Adding a version is one data entry, which
the qualification script prints. Tests that need a fixture version use
`replaceCorrespondenceAllowlistForTesting` from the test-only `@core/native-dispatch/testing`
subpath; the main entry does not export it. It sets only the versions plan preparation accepts; the
gate reads only the frozen shipped allowlist, so no test path can make a live window accept a
version.

**Trust boundary.** A live window's gate accepts only entries committed to the shipped allowlist in
`src/correspondence-allowlist.ts`. Trace bytes carry no proof of origin: anyone can write
identical bytes by hand (for example, relabel the output of `traceFromFrames` and call
`JSON.stringify(t, null, 2) + "\n"`). The protection is review of commits to
`correspondence-allowlist.ts` and its trace files, which should come only from a real
qualification turn. The checks in code protect against mistakes and agent-driven misuse through the
package's public exports (main entry and `testing`). Code running inside the listener's process is
trusted, because it could launch a binary directly, and a filesystem import of `dist/` internals is
outside the exports-map boundary.

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
only when the verdict is `accepted`, in which case it also prints the allowlist entry. To qualify the
version, commit the trace as `qualification/claude/<version>.trace.json` and add that entry.

A failed qualification leaves only its own journal unresolved. The owner can review it with
`reviewCorrespondenceJournal` and then delete it, or keep it as evidence; no duty journal is
affected, and no qualified version is needed.

## Offline proof

`openCorrespondenceEmulation` runs the same admission, journal, budget and proposal checks with a
scripted fake model (`answer`, `failed`, `lost`, `hang`). It needs no approval file, binary or
qualified version: prepare its plan with `prepareCorrespondenceEmulationPlan`, which skips the
allowlist and can open nothing but an emulation. `status()` reports `realProviderCalls: 0`, and its
journal is marked `emulated`.

`qualifyClaudeCorrespondenceEmulation({ prepared, stateFile, frames })` proves the qualification
mechanics offline: the same request, dispatcher, frame checker, trace cut, SHA-256 and replay, with
scripted stream-json frames instead of a Claude process. It needs no approval, binary,
managed-policy check or `HOME`, and its journal is marked `emulated`, so it cannot touch a live or
qualification journal. `writeCorrespondenceTrace` writes the trace as the script does. Its trace is
marked `"source": "emulated"`, it returns no allowlist entry, and the gate refuses its bytes even in
a hand-made entry. **For LocalHelp:** the emulated path proves the mechanics only; a real
qualification turn (`qualifyClaudeCorrespondence`, through the script) is the only route to an
allowlist entry.
