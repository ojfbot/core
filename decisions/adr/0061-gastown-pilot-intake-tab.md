# ADR-0061: gastown-pilot Intake tab

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /diagram-intake, /frame-standup
Repos affected: gastown-pilot (browser-app, api), core (.claude/skills/diagram-intake)

---

## Context

The morning ritual produces a stack of graph-paper cards. Each card carries one rig and up to three pencil bullets. Planning stays on paper because the moment planning happens on a screen, the model proposes technical decompositions instead of features. The system meets the developer at the paper boundary: a photo of the cards lands in a UI, a parser turns each card into bead candidates, the developer accepts or edits, and the confirmed beads enter the same store the rest of the day reads from.

The `/diagram-intake` skill (ADR-0038) already does the parsing. It lives at `core/.claude/skills/diagram-intake/diagram-intake.md` and emits structured per-rig priorities mapped through `BEAD_PREFIX_MAP`. The capability exists; what is missing is a persistent surface that consumes the skill, sits next to the rest of the dashboard, and writes beads through the canonical store.

gastown-pilot is the right home. Per `gastown-pilot/CLAUDE.md`, the browser-app on port 3017 is a six-tab Carbon dashboard (Town, Rigs, Convoys, Beads, Formulas, Wasteland), the API on port 3018 owns the data adapters, and React Query (ADR-0028) wires server state. The dashboard is the surface that watches convoys roll in. Adding the photo-intake step there keeps morning planning, daily-logger suggestions, and convoy progress in the same field of view.

Originally drafted as ADR-006 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering.

Cross-references: [ADR-0056](0056-developer-day-orchestration-master.md) (master), [ADR-0038](0038-morning-workflow-orchestration.md) (`/diagram-intake` origin), [ADR-0027](0027-gastown-pilot-direct-core-workflows-consumer.md) (gastown-pilot consumes core workflows directly), [ADR-0028](0028-react-query-for-gastown-pilot-server-state.md) (server-state convention), [ADR-0062](0062-reserved-framebead-label-keys.md) (label keys this tab writes), [ADR-0063](0063-daily-logger-perrig-digest-extension.md) (suggestion source).

## Decision

Add a seventh tab to gastown-pilot named **Intake**. Place it leftmost so the morning starts there.

### Tab order

`Intake / Town / Rigs / Convoys / Beads / Formulas / Wasteland`

The first slice ships drag-and-drop photo upload. Mobile camera capture and voice arrive in a follow-up ADR. The Intake tab does not duplicate Today (that view is the existing Beads tab filtered by `created_at = today`) and does not duplicate Stream (that surface is the EventStream panel under the Town tab).

### Pipeline

`photo upload → preprocess → parse → expand → align → confirm → emit beads`

| Step | Where it runs | What it does |
| --- | --- | --- |
| Preprocess | browser-app | Auto-rotate, deskew, crop, split into one image per card. |
| Parse | api → core skill | `POST /api/intake/parse-card` calls `/diagram-intake` via `core-workflow` CLI. Returns the skill's existing JSON shape (one entry per recognized rig, mapped to canonical `BEAD_PREFIX_MAP` ids). |
| Expand | api → core skill | Each bullet's raw text expands using the rig's recent context: last seven days of beads, current open PRs, the daily-logger digest. Output: `expanded_title`, `expanded_description`, `why`, `candidate_decompositions[]`. |
| Align | browser-app | Two-column view. Original card photo on the left. Expanded title, why, and candidate decompositions on the right. The developer accepts, edits inline, or rejects each entry. |
| Confirm | browser-app | The aligned set renders as a proposed bead graph. |
| Emit beads | api → core | On confirm, `BeadStore.create()` (ADR-0016) writes one transaction per parent. Reserved label keys per ADR-0062 attach: `why`, `priority_tier`, `source = "morning_card"`, `card_image_uri`. |

### Architecture

The browser-app (`packages/browser-app`) gains an `IntakeTab` route under `gastown-pilot/intake`. The API (`packages/api`, port 3018) gains:

- `POST /api/intake/parse-card` — multipart upload, body returns the `/diagram-intake` JSON.
- `POST /api/intake/confirm` — body is the aligned set, the handler invokes `BeadStore.create()` per parent.

Both endpoints route through React Query mutations on the client (per ADR-0028). The parser endpoint shells out to `node packages/cli/dist/index.js "/diagram-intake $arg"` against the core checkout, or invokes `runWorkflow` from `@core/workflows` directly when running co-located. The choice is an implementation detail; the contract is the JSON shape.

A new `IntakeAdapter` joins the existing data adapters under `packages/api/src/adapters/`. Per `gastown-pilot/CLAUDE.md`, all current adapters are scaffold-stubbed; the `IntakeAdapter` ships first as a non-stub, wired to the local API endpoint.

### Bead emission contract

For every confirmed bullet, the API issues one `BeadStore.create()` call. The label payload follows the reserved keys established by ADR-0062:

| Key | Source | Example |
| --- | --- | --- |
| `source` | constant | `morning_card` |
| `card_image_uri` | preprocess step | `file:///var/intake/2026-04-30/cv-builder-card.jpg` |
| `why` | expand step | `unblock the resume parser regression that surfaced Friday` |
| `priority_tier` | bullet ordinal | `P1` for ordinal 1, `P2` for 2, `P3` for 3 |
| `parent_id` | confirm step | parent bead id when a bullet decomposes |
| `decomposition_role` | confirm step | `parent` or `child` |
| `cross_rig_deps` | expand step | comma-joined `BEAD_PREFIX_MAP` ids |
| `parse_prompt_version` | parse step | `/diagram-intake` prompt file SHA |
| `expansion_context_partial` | expand step | `true` when the daily-logger digest is missing |

No nested namespace, no schema migration. The keys land on the existing `labels: Record<string,string>` per ADR-0016.

### Daily-logger suggestions

The right column of the Intake tab also shows daily-logger suggestions sourced from `daily-logger/api/suggested-actions.json` (ArticleDataV2 `suggestedActions` field, ADR-0063). Each suggestion renders as a card with three actions: **Add to today**, **Defer**, **Decline**. **Add to today** routes a suggestion through the same confirm step the photo flow uses, so suggestions and photo bullets emit beads through one path.

### Vocabulary

Per `gastown-pilot/CLAUDE.md:67`, the surface uses `worker` (not polecat), `witness` (not department head), and `mayor` (not CEO). Bead role labels and copy in the Intake tab follow that rule.

### Failure modes

| Mode | Behavior |
| --- | --- |
| Card unreadable | Confidence below threshold. Align view shows the photo with a rephotograph-or-transcribe-manually message. No bead emits. |
| Rig mismatch | The developer assigns a rig from a dropdown of `BEAD_PREFIX_MAP` ids. |
| Daily-logger digest missing | Expand proceeds. The bead carries `labels.expansion_context_partial = "true"`. |
| `/diagram-intake` parser version drift | Each emitted bead carries `labels.parse_prompt_version` from the skill's prompt file. |

## Consequences

### Gains

- The morning's photo lands in the same dashboard that watches the day's convoys. One surface for plan and progress.
- The Intake tab consumes `/diagram-intake` rather than reimplementing parsing. One parser, one place to evolve it.
- Bead emission flows through `BeadStore.create()` (ADR-0016). The rest of the system reads beads the same way it always has.
- Reserved label keys (ADR-0062) carry the *why* and *priority_tier* into the day's downstream skills without a type-shape change.
- The first non-stub adapter (`IntakeAdapter`) demonstrates the pattern for replacing the remaining scaffold adapters.

### Costs

- A seventh tab on a layout that was scoped to six.
- A multipart endpoint and image storage path on the API. The first slice writes uploaded photos to a local directory referenced by `card_image_uri`; durable storage is a follow-up.
- Server-side dependency on a co-located core checkout (or a published `core-workflow` binary) so the API can invoke `/diagram-intake`.
- The Intake tab introduces a vision LLM call into the morning hot path; latency and cost land on every card.

### Risks

- The skill's prompt evolves; the API contract drifts. Mitigation: every emitted bead carries `labels.parse_prompt_version`, and the inspection commit in Provenance pins the version this ADR designs against.
- Handwriting recognition fails on unusual labels. Mitigation: the align view never auto-confirms; every bullet requires an explicit accept.
- Multipart upload to a JWT-protected route on port 3018 must keep `authenticateJWT` per `gastown-pilot/CLAUDE.md`. Mitigation: reuse the existing middleware; add no bypass.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Three-view sub-app (Intake / Today / Stream) per the original ADR-006 draft. | Today duplicates the existing Beads tab filtered by date; Stream duplicates the Town tab's EventStream. One new tab is enough. |
| Reimplement the parser inside gastown-pilot's API. | Two parsers drift. `/diagram-intake` already exists and is the canonical surface. |
| Write beads via `bd create` shell calls. | `BeadStore.create()` (ADR-0016) is the canonical API. The shell wrapper bypasses validation and label-key reservations. |
| Namespace the new bead fields under `frame.*`. | ADR-0062 reserves flat keys on the existing `labels: Record<string,string>`. A nested namespace is a type-shape change. |
| Camera-capture and voice in the first slice. | Both expand the surface area without retiring paper. Drag-and-drop a phone photo covers the morning's path. Camera and voice land in a follow-up. |
| A standalone repo for the intake UI. | One more dev server and one more deploy target. gastown-pilot is the dashboard; the tab fits there. |

## Acceptance criteria

- A new tab labeled **Intake** appears as the leftmost tab in gastown-pilot at port 3017.
- A photographed card with three bullets produces three expanded entries in the align view in under thirty seconds.
- The align view permits inline edit, accept, and reject per bullet.
- On confirm, beads appear in the existing Beads tab with `labels.source = "morning_card"`, `labels.card_image_uri = <URI>`, `labels.why` populated, and `labels.priority_tier` populated, per ADR-0062.
- A deliberately unreadable card produces a "rephotograph or transcribe manually" message and emits no beads.
- Daily-logger suggestions from `daily-logger/api/suggested-actions.json` appear in the right column with **Add to today** / **Defer** / **Decline** actions.
- The parse prompt version (from `/diagram-intake`'s prompt file) appears in every emitted bead's `labels.parse_prompt_version`.
- The new `IntakeAdapter` ships non-stubbed; existing scaffold adapters remain stubbed and untouched.
- Vocabulary in the tab uses `worker`, `witness`, `mayor` per `gastown-pilot/CLAUDE.md:67`.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent); slice zero-point `_pending_` |
| Inspection commit | `_pending_` — required: read `/diagram-intake` skill prompt at `core/.claude/skills/diagram-intake/diagram-intake.md` and verify the parser output shape matches the API contract this ADR proposes |
| /diagram-intake skill prompt version | `_pending_` — read at inspection time |
| Frame route at which Intake mounts | `gastown-pilot/intake` |
| Originally drafted as | ADR-006 (handoff message, 2026-04-30) |
| Master | [ADR-0056](0056-developer-day-orchestration-master.md) |
