# chat-token-vocabulary.md — the cockpit chat's UI-executed command tokens

Registered 2026-08-08 from the cockpit v2 design pass
(`morning-cockpit/research/design-handoff-cockpit-v2/`, README § Chat). This file is the fleet-side
register of the vocabulary: what the tokens are, what capability each one carries, and — the part
that matters most — **what is deliberately not in it**.

## What a token is

A **command token** is a chip above the cockpit chat composer. Clicking it inserts a structured
command that **the UI executes deterministically**. The model writes prose; the UI does verbs.

That split is the whole design. A token is not a tool call the model may decide to make, not a
prompt fragment the model interprets, and not free text handed to a model that might act on it. It
is a UI affordance with a fixed implementation, and the transcript renders it as a coloured chip so
the operator can see which turns were executed rather than generated.

**Unknown tokens fall through as plain text.** A typo is a message, never a silent no-op and never
a guess.

## Phase 1 — the registered vocabulary (read-only + the existing gate)

| Token | Argument | What the UI executes | Reads | Writes |
|-------|----------|----------------------|-------|--------|
| `/explain` | `<node>` | Grounded explainer assembled from authored prose + the node's registry record | northstar registry, authored node prose | none |
| `/ladder` | `<node>` | Walks `ladders_up_to` to the apex, each hop linked | northstar registry | none |
| `/gap` | `[cluster]` | Lists unregistered repos (census − registry) and filters the fleet canvas to them | registry + `~/ojfbot/*/.git` census | none |
| `/open` | `<repo>` | Drives cockpit fleet selection and briefing scope (cockpit ADR-0012, still *Proposed*) | — | UI state only |
| `/draft-handoff` | — | Starts the **existing** gated emit flow (cockpit ADR-0005) — drafts, never auto-sends | current thread + delivery snapshot | a `.handoff` brief, only after the operator approves in the existing gate |

Three capability classes, and the register exists to keep them distinct:

- **read-only** — `/explain`, `/ladder`, `/gap`. Local file reads. No side effects at all.
- **UI-state** — `/open`. Moves the operator's own view. Reversible by clicking something else.
- **gated-write** — `/draft-handoff`. The only token that can put a file on disk, and it does so
  through cockpit ADR-0005's single write carve-out with the operator's approval, not through a new path.

## Invariants

1. **No token writes `current:` or appends `status.jsonl`.** The movement contract holds: a session
   proposes, a merging human records movement via `scripts/record-movement.mjs`.
2. **No token writes into `decisions/northstar/`.** The carve-out is `.handoff` and only `.handoff`.
3. **No token is exposed to the model as a callable tool in phase 1.** If the model could invoke
   `/open` or `/draft-handoff`, "the UI does verbs" stops being true and the whole class becomes a
   tool-use surface with a different risk profile.
4. **Adding a token is a vocabulary change, not a UI change.** Amend this file in the same PR.

## Not registered — a NEW operator decision, never an inference

**Core verbs are not tokens.** Queue-claim, dispatch, `roadmap-compile`, bead emit, movement
recording, and anything else that mutates the fleet's coordination ledger are deliberately absent
from the table above, and their absence is not an oversight to be quietly corrected by a later
session.

Why it needs its own decision rather than an extension of this one:

- These verbs mutate **shared** state. A chat token that claims a slice changes what the day-runner
  may pick up; a bad claim is not undone by clicking elsewhere, which is the property every phase-1
  token has.
- `check:`'s mere presence is the `autonomy_fit` signal — the same hazard already ruled on in
  `decisions/wayfinder/cockpit-northstar-conversation.md` (D5): a fabricated field silently promotes
  a slice to `agent_eligible`.
- The phase-1 vocabulary was justified to the operator on the grounds that it is read-only plus one
  pre-existing gate. Write verbs are a different argument and deserve to be made on their own terms.

If a session finds itself wanting `/claim` or `/dispatch`, the correct move is to **flag it to the
operator** and stop — not to add a row to the table.

## Namespace note

These tokens live in the cockpit's chat composer. They are a different namespace from Claude Code's
`/skill` slash commands, which some names shadow (`/open`, `/explain`). Same character, different
surface, different executor — worth stating once so nobody wires one to the other.

## See also

- `decisions/wayfinder/cockpit-northstar-conversation.md` — the northstar conversation surface these
  tokens serve; D3 (output leaves through the existing gate) and D5 (the intent/slice boundary).
- **morning-cockpit** ADR-0005 (`handoff-emission-write-path`) — the `.handoff` write carve-out
  `/draft-handoff` uses; and morning-cockpit ADR-0012 (`fleet-selection-drives-repo-scoped-briefing`,
  status **Proposed**) — the binding `/open` drives.
- **Numbering collision, read this before citing:** ADR serials are per-repo. In *core*, ADR-0005 is
  Carbon Design System and ADR-0012 is the Module Federation remote pattern — different documents
  entirely. Every ADR reference on this page is a **morning-cockpit** ADR and says so; cite ADRs
  with their repo whenever the sentence crosses a repo boundary.
