# Correspondence duty

Version 0.4.0. Contract: LocalHelp `docs/correspondence-duty.md` (v1 with the 15 November amendments,
HelpDesk thread `cca89987-fda6-433f-999d-f73987025c13`, #6141 and #6144). Charter: vault
`diagrams/circusgreen-duty-soak-charter-20261115.md`.

A correspondence turn reads one bounded packet built by LocalHelp and returns a proposal: a reply, or
an escalation with one of four reasons. The model holds no key, client or tool. LocalHelp checks,
signs and posts the result. Core reads nothing from HelpDesk.

## What Core enforces

- **Plan kind.** `prepareCorrespondencePlan` accepts `kind: "correspondence"` with one or two
  bindings, at most one per provider. Any Codex profile or binding is refused as `revoked-provider`.
  In practice the plan is Claude-only.
- **Limits.** `topLevelTurns` 1–40 as one budget for the whole window
  (`correspondence:<windowId>:<deviceId>`); `windowMs` 60,000–5,400,000; `requestTimeoutMs` 120,000.
- **Supervision.** `owner-attended` only, without `codexHostFileReadRiskAccepted`. `CODEX_HOME` must be
  null in the plan, so the controller must run with `CODEX_HOME` unset (the environment must match).
- **Approval.** `kind: "owner-approved-correspondence-window"`, with
  `expiresAtMs - startsAtMs === plan.limits.windowMs`. The owner approves each window in that Mac's chat.
- **Fresh session.** Grants use operation `native-fresh`. The dispatcher mints a new session UUID when
  it books the turn and journals it before any launch; the command is `--session-id <uuid>`, never
  `--resume`. Only one turn runs at a time.
- **Request.** `workflow: "correspondence"`; `task.input` is the packet (at most 32,768 UTF-8 bytes) and
  `task.inputDigest` its SHA-256. The packet's `request.message_id`, `thread_id` and `sequence` must
  match the delivery.
- **Input.** `CORRESPONDENCE_INSTRUCTIONS_V1`, then the packet digest, then the packet verbatim as the
  last bytes of stdin, so no end marker can be forged from inside it.
- **No tools.** The first frame must show the pinned model, no tools and no tool servers. A `tool_use`
  block in any assistant frame makes the turn unknown, with no proposal.
- **Proposal.** `parseCorrespondenceAnswer` accepts only the closed six-field answer, with the digest
  echo, the reply/escalate rules, `needs` only for `missing-context`, no `missing-context` under
  `best_effort`, and text of at most 8,000 bytes. Anything else is a completed turn with no proposal.

## Offline proof

`openCorrespondenceEmulation` runs the same admission, journal, budget and proposal checks with a
scripted fake model (`answer`, `failed`, `lost`, `hang`). It needs no approval file or binary, and
`status()` reports `realProviderCalls: 0`.
