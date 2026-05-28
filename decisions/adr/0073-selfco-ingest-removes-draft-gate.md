# ADR-0073: selfco ingest removes the `draft` gate — the box files all non-terminal Inbox rows

Date: 2026-05-27
Status: Proposed
OKR: 2026-Q2 / O-Knowledge / KR-cross-project-recall
Commands affected: /vault (consumer Agent Skill guidance), selfco-box Notion poller
Repos affected: selfco-box (poller filter + test + README), core (this ADR, `/vault` connectors doc + consumer SKILL), selfco (CLAUDE.md write-path note)

> **Number is provisional.** ADR files in `core` top out at `0070`; docs reference `0071`/`0072` (selfco-box design; Notion-as-write-channel) with no committed files, and a `vault/adr-0079-crossrefs` branch references `0079`. Confirm/renumber before merge.

---

## Context

The `selfco-box` Notion poller (ADR-0070/0072) drained only `status=ready` rows from the `📥 selfco — Inbox`
DB (`pollNotionInbox`, `filter: { property: "status", select: { equals: "ready" } }`). `draft` meant "still
editing — don't file"; the human flipped `draft → ready` to release a capture into the vault.

In practice this gate adds a manual step that gets skipped (the canonical Newline-Miami prep row sat at
`draft` and never ingested), and it conflates two different evolution surfaces. The owner's intent: **reaching
the Notion Inbox is itself the signal to ingest** — "if it goes to Notion we want it in selfco, at least in
draft form" — and the place a vault document *evolves* is the **vault's git history**, not a Notion status
field.

## Decision

**Remove the `draft` gate. The poller files every non-terminal Inbox row** — any `status` except the three
terminal/handled states `promoted`, `declined`, `failed`. So `draft`, `ready`, and unset-status rows all
ingest. Implemented as a `does_not_equal` AND-filter rather than an `equals: "ready"` filter.

Idempotency is unchanged and load-bearing: the unique `notion_page_id` index makes each row a **one-shot
capture** — a row ingests exactly once; later edits to the same Notion row do **not** re-sync. Refinement
happens in the vault (commits on `ojfbot/selfco`), which is the versioned evolution surface. To re-capture
materially changed content, create a **new** row (a new page id).

The terminal states keep their meaning: `promoted` (filed; the box wrote it back with a `commit ref`),
`failed` (terminal error / unknown tag), `declined` (human rejected). None of these re-ingest.

## Consequences

### Gains
- Captures can't get stranded at `draft`. Dropping a row into the Inbox is sufficient to get it into the vault.
- One clear model: Notion = one-shot capture inbox; vault git history = where the document evolves.
- No code path depends on a human remembering to flip `draft → ready`.

### Costs
- **A row can ingest before the author finishes writing it.** The poller fetches the body on its next pass
  (≤5 min); a half-written `draft` will be filed as-is, and idempotency means the finished version won't
  re-sync. Accepted under the "evolve in the vault" model — the right fix for a rough first capture is a vault
  commit, not a Notion edit. Mitigation guidance: **create the row complete**; treat the Inbox as send-once.
- Empty-status rows now ingest too — including a row created by a stray click. Low-frequency; the same
  one-shot/idempotency reasoning applies, and unknown-tag rows still fail closed.
- Consumer guidance that taught "draft while editing, flip to ready when done" is now wrong and is updated
  (the `/vault` consumer SKILL + connectors doc + the vault CLAUDE.md write-path note).

### Neutral
- The Notion schema is unchanged — `draft`/`ready` remain selectable options; they simply no longer gate
  ingest. (A later cleanup could drop the `draft` option entirely; out of scope here.)
- Write-back (`promoted`/`failed`) and the unknown-tag rejection path are untouched.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep the gate; just fix the consumer skill to always set `ready` | Doesn't match the intent ("Notion arrival = ingest"); still one human step that can be skipped; the stranded-draft failure recurs. |
| Ingest `draft` + `ready` via an explicit `or` filter (treat unset as held) | Slightly safer against stray empty rows, but enumerates statuses (new statuses silently excluded) and still requires the row to carry a chosen status. The `does_not_equal` form is the more faithful "anything not already handled." Noted as the fallback if stray-empty-row ingest proves noisy. |
| Re-sync a row when its `draft` body changes (drop idempotency) | Breaks the one-shot model and the `notion_page_id` uniqueness invariant; turns Notion into a live editing surface, which is explicitly *not* the design — the vault git history is the evolution surface. |
