# Prepare the subscription canary

This is the disabled preparation contract introduced in 0.2. The separate 0.3
[supervised contract](./SUPERVISED.md) does not arm this API.

This release prepares the owner's selected four top-level turns across two devices in one
30-minute window. It cannot run a real provider. The current Codex profile lacks a qualified
complete empty-tool set, and Claude's managed host customizations remain unqualified. The runtime
entry returns `held` even when a syntactically valid approval and matching binary pins are supplied.
No boolean or peer message removes those holds. A real native driver is not shipped behind a
misleading arm flag. Resolving a native capability requires evidence and a later source change.

## Typed boundary

`prepareSubscriptionCanary(unknown)` validates and constructs the entire plan. The result is
`PreparedSubscriptionCanary`, with `mode: "prepared-disabled"`, `liveEligible: false`, a SHA-256
`planDigest` and explicit hold codes. It creates no files, sessions or subprocesses. Consumers
display the digest and redacted readiness facts, never the plan's native paths or session IDs.

The plan fixes one Codex and one Claude profile and binding for this device. Each profile pins its
binary's canonical path, SHA-256, exact native version, model, low effort and existing-subscription
auth mode. Each binding pins its logical alias, revision, session UUID, working directory and
resources. Both bindings must belong to the plan's device and match their provider profile.

Plan, window, device, profile and binding identifiers use the same grammar as Core admission:
`[a-z0-9][a-z0-9._-]{0,63}`, matched against the entire string. Model selectors use that grammar
with an optional bracketed suffix of 1–16 lowercase alphanumeric characters, such as `opus[1m]`;
`gpt-6.1-sol` is also valid. Whitespace, paths and email addresses are refused at both boundaries.
This constrains selector syntax; it does not detect secrets embedded in otherwise valid identifiers.

The only fixture is the exported `SUBSCRIPTION_CANARY_FIXTURE`, SHA-256
`d17f721f53033a64b6d7a495c8b2522a784000903329375f79028abb4dbb9b99`. It is a non-sensitive
wording review, not evidence that the described events occurred. The plan must contain those exact
UTF-8 bytes. Peer bodies and arbitrary instructions cannot substitute another fixture.

The accepted limits are exactly two top-level turns per device/window, 30 minutes and 120 seconds
per request. `declaredUnproved` must explicitly retain dollars, output tokens and provider-internal
requests. These are not secretly treated as enforced by native timeouts, estimates or CLI flags.
Model and effort are explicit; neither inherits a user's interactive default.

## Fake qualification

`openCanaryQualification({ prepared, stateFile, startsAtMs, now? })` uses the existing Core journal,
exclusive owner and persisted idempotency. Its only transport is a fixed built-in Node emulator
with an empty environment. Profile executable paths are data and are never used by this factory,
even if they point at an executable. There is no test mode that chooses between fake and real.

The factory reserves one turn per binding and two per device/window. Its grant revision is returned
by `canaryGrantRevision(prepared, alias)`; the charter ID is the plan's window ID. Delivery requests
retain the existing five-key metadata pointer and must use UUID journal/message/thread identifiers.
Both native emulator inputs are built inside Core from the frozen fixture and validated identifiers.
Existing Core duplicate, unknown, expiry and budget rules apply without another delivery queue.
Known pre-launch expiry refunds remain safe; unknown or started invocations remain spent.

Claude `initial-fixed` selects the explicit UUID's first counted prompt, represented by
`--session-id`; `existing-fixed` selects `--resume`. There is no fallback to a new session on an
error, and no separate uncounted creation prompt. Codex preparation accepts only `existing-fixed`.
This release registers or starts no actual duty session. Native lifecycle qualification is still
required before an operator can claim those exact CLI profiles work.

`lookup(deliveryId)` reads native evidence. `agentProposal(deliveryId)` separately reads an accepted,
bounded advisory ACK/result observation from the same private journal. Core validates the message,
binding revision, fixture hash and output shape before persisting it alongside native completion.
Native completion with invalid or absent model output does not manufacture an ACK.

Proposals are labelled `attribution: "device-relayed-output"`, `source: "deterministic-emulator"`
and `verifiedWork: false`. A no-tools model cannot post a HelpDesk reply. A later receiver would
publish attributed output on that binding's behalf, signed by the device, with that limitation
visible. It must not call the output the agent's own signed reply or independently verified work.
Result text is limited to 2,048 characters and 4,096 UTF-8 bytes. Those byte/character bounds are
not a provider output-token cap, and schema validation does not judge wording quality.

## Approval and profile holds

`openApprovedSubscriptionCanary({ prepared, runtimeApprovalFile, now? })` is an explicit refusal
boundary, not a launcher. It checks a private owner-owned regular approval file, exact plan digest,
window/device identity, finite 30-minute validity and native-owner approval reference. It also
checks canonical binary paths and byte hashes. It returns the current unsupported/unqualified
profile holds regardless. Missing, loose, mismatched or expired approval adds its own refusal.

Only the owner, or an agent acting on direct owner words in that Mac's own chat, may create an
actual runtime artifact. A relayed peer approval does not authorize writing it. An owner-owned
file is a trusted local operator boundary, not cryptographic proof of a human statement. The
preparation command does not create that artifact; unit tests use isolated synthetic files only.
Pins must be checked and re-approved at an attended window start, with no mid-window auto-update.

`subscriptionCanaryCommand(prepared, alias)` returns a command proposal as data. Codex returns
`unsupported` for the present no-tools profile. Claude returns `candidate-only` with pinned model,
low effort, safe mode, empty settings sources, empty built-in tools, strict empty MCP configuration,
MCP denial, one top-level turn and structured output. It never executes the proposal.

The [Claude CLI reference](https://code.claude.com/docs/en/cli-reference) distinguishes `--tools`
from MCP denial and notes that managed hooks can still apply under safe mode. Bare mode changes
authentication behavior and is not selected. The [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
provides per-feature, app and MCP controls, but this slice has not established removal of every
built-in tool on the pinned native profiles. Read-only sandboxing, denied approvals and model
instructions are not a complete empty-tool capability. Signing in does not establish that property.

## Verify

```sh
pnpm --filter @core/native-dispatch build
pnpm exec vitest run packages/native-dispatch/src/__tests__/canary.test.ts packages/native-dispatch/src/__tests__/dispatch.test.ts
```

The new cases run four fake role turns across two device journals, prove retry/restart reuse,
enforce the per-binding/device/window bounds, retain the concrete live holds, and demonstrate that
even matching synthetic approval/binary pins cannot launch the executable fixture. No inference,
provider, account, global configuration, live job or NAS change is part of this proof.
The disabled-entry test blocks and directly counts `spawn` and `execFile` attempts, so an
asynchronous child launch cannot pass merely because its marker file has not appeared yet.
