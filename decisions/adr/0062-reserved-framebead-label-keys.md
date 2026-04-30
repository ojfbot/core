# ADR-0062: Reserved FrameBead label keys

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /diagram-intake, /orchestrate
Repos affected: core (packages/workflows), gastown-pilot (api/intake), daily-logger (src/bead-store), purefoy (packages/api/beads)

---

## Context

The morning ritual photographs three pencil bullets per rig. The afternoon converts each bullet into beads that workers can claim, decompose, and close. The bead is the unit of work; FrameBead is the type ([ADR-0016](0016-framebead-work-primitive.md)). FrameBead's `labels` field is a flat `Record<string, string>` on `core/packages/workflows/src/types/bead.ts:45`. Two keys already live there: `goal_parent` and `okr` (`core/packages/workflows/src/types/bead.ts:42-44`).

The Developer Day master ([ADR-0056](0056-developer-day-orchestration-master.md)) names four missing pieces. One of them is the carrier for the *why*, the *priority*, the *source*, and the parent/child link that the Intake tab ([ADR-0061](0061-gastown-pilot-intake-tab.md)) emits and that `/orchestrate` consumes. That carrier exists already as the `labels` map. The work is reserving the keys.

Originally drafted as ADR-007 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering. Cross-references: [ADR-0056](0056-developer-day-orchestration-master.md), [ADR-0016](0016-framebead-work-primitive.md), [ADR-0039](0039-dolt-bead-store.md), [ADR-0043](0043-agent-bead-bridge.md), [ADR-0044](0044-ubiquitous-language-layer.md), [ADR-0052](0052-bead-prefix-reservations-non-frame.md), [ADR-0061](0061-gastown-pilot-intake-tab.md).

The handoff draft proposed a `frame.*` namespace with nested `source_evidence` and `alignment` objects. That shape changes the FrameBead interface at `core/packages/workflows/src/types/bead.ts:31-57` and forces parallel migrations across `purefoy/packages/api/beads/types.ts:11`, `daily-logger/src/bead-store.ts`, and `gastown-pilot/packages/api/`. The flat-labels shape already carries everything the morning ritual needs. This ADR keeps the shape and reserves seven new keys, plus a contextual subset.

## Decision

Reserve the following keys on `FrameBead.labels`. Values are strings; complex shapes are JSON-encoded into a string. The interface at `bead.ts:31-57` does not change. The JSDoc on the `labels` field at `bead.ts:39-44` extends to enumerate the full reserved-key set.

### Core seven

| Key | Type (string) | Meaning | Example |
| --- | --- | --- | --- |
| `why` | free-text | Originating motivation. The *why* from the morning card or the daily-logger digest. | `"Stale remotes are causing the recurring 4000/4001 mismatch in dev"` |
| `priority_tier` | enum: `feature` \| `quality` \| `infra` \| `research` | Urgency / category axis. | `"feature"` |
| `source` | enum: `morning_card` \| `daily_logger` \| `agent_initiated` \| `manual` | Where the bead came from. | `"morning_card"` |
| `card_image_uri` | URI | Path or URL to the card image (when `source = morning_card`). | `"file:///Users/yuri/ojfbot/gastown-pilot/cards/2026-04-30/shell.jpg"` |
| `parent_id` | bead id | The parent bead id (when this bead is a child decomposition). | `"core-task-x7k2m-001"` |
| `decomposition_role` | enum: `parent` \| `child` | Hierarchy position. | `"parent"` |
| `cross_rig_deps` | JSON-encoded array of bead ids | Dependencies that span rigs. | `"[\"trip-task-...\", \"pure-task-...\"]"` |

### Contextual keys

| Key | Type (string) | Set when | Meaning |
| --- | --- | --- | --- |
| `raw_bullet` | free-text | `source = morning_card` | The bullet line as parsed from the card. |
| `bullet_ordinal` | integer (string) | `source = morning_card` | 1-based position of the bullet on the card. |
| `parse_prompt_version` | semver string | `source = morning_card` | Version of the `/diagram-intake` parse prompt that produced the bead. |
| `digest_run_id` | id | `source = daily_logger` | Run id of the digest job that suggested the bead. |
| `digest_suggestion_id` | id | `source = daily_logger` | Suggestion id within that digest. |
| `aligned_at` | ISO 8601 | confirm-time | Timestamp the developer accepted or edited the expansion. |
| `human_accepted` | `"true"` \| `"false"` | confirm-time | Whether the developer accepted the expansion as-is. |
| `expansion_context_partial` | `"true"` \| `"false"` | confirm-time | Whether the expansion ran with partial context. |
| `human_edits` | JSON-encoded array of `{field, from, to}` | confirm-time | Diff of the developer's edits against the proposed expansion. |

### Hierarchy

Each accepted card bullet produces one parent bead with `labels.decomposition_role = "parent"` and N child beads (N >= 3) with `labels.decomposition_role = "child"` and `labels.parent_id` set to the parent's id. A worker (the headless AgentBead consumer per [ADR-0043](0043-agent-bead-bridge.md) and ADR-0060) claims and works child beads.

State propagation reuses the `BeadStatus` enum at `bead.ts:29` (`created` / `live` / `closed` / `archived`). A parent transitions to `live` when its first child transitions to `live`, and to `closed` when all children are `closed`. The handoff's `awaiting_review` and `in_progress` proposals are dropped; the existing four states are the canonical set.

### Cross-rig dependencies

`cross_rig_deps` carries bead ids from other rig prefixes (`BEAD_PREFIX_MAP` at `bead.ts:95-105`). The orchestrator that respects them is `/orchestrate` ([ADR-0038](0038-morning-workflow-orchestration.md)). The consumer that defers work is the headless AgentBead worker (ADR-0060). A worker does not start a child bead whose parent has unmet `cross_rig_deps`.

### Alignment record is append-only

Once a bead is created with the alignment fields populated, those fields are immutable. A re-alignment event creates a new sibling or a new revision bead linked through `refs` (the field exists at `bead.ts:53`).

## Consequences

### Gains

- Zero migration. The interface at `bead.ts:31-57` does not change. Existing call sites at `purefoy/packages/api/beads/types.ts:11`, `purefoy/packages/api/routes/beads.ts:4`, `purefoy/packages/api/beads/mapper.ts:2`, `daily-logger/src/bead-store.ts`, and the gastown-pilot scaffolded adapters compile unchanged.
- The Intake tab (ADR-0061) and the `/diagram-intake` parser write the same flat shape that `/orchestrate` and `BeadFilter.label` (`bead.ts:66`) read.
- Querying becomes a single `BeadFilter.label` lookup. `byPriorityTier("feature")` returns `{ label: { priority_tier: "feature" } }`.
- Provenance for every bead is one read away. `source`, `card_image_uri`, `digest_run_id`, and `parse_prompt_version` answer "where did this come from?" without crossing tables.

### Costs

- Strings only. `cross_rig_deps` and `human_edits` round-trip through JSON. Callers parse on read; serialize on write.
- No schema-level enforcement of the enum values. A typo in `priority_tier` slips through. Mitigation: a runtime guard in `core/packages/workflows/src/types/bead.ts` (a small `assertReservedLabels` helper) and a unit test that exercises the seven core keys.
- Reserved-key collisions with future ADRs are a documentation discipline. The JSDoc list is the single source of truth.

### Neutral

- The `frame.*` namespace approach remains a future option if FrameBead splits into a base bead and a Frame extension. This ADR does not foreclose it.
- The Dolt-backed BeadStore ([ADR-0039](0039-dolt-bead-store.md)) stores `labels` as a JSON column. The reserved keys are first-class in queries through `JSON_VALUE` without any DDL change.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| `frame.*` namespace with nested `source_evidence` and `alignment` objects (handoff draft). | Changes the FrameBead interface at `bead.ts:31-57`. Forces parallel migrations across `purefoy/packages/api/beads/types.ts:11`, `daily-logger/src/bead-store.ts`, `gastown-pilot/packages/api/`. The flat shape already carries the data. |
| New `BeadStatus` values (`awaiting_review`, `in_progress`). | Breaks the four-state lifecycle defined in ADR-0016 at `bead.ts:29`. Every consumer of `BeadStatus` would need a switch update. The four states cover the morning ritual when paired with `decomposition_role`. |
| Separate `frame_evidence` and `frame_alignment` sibling fields on FrameBead. | Same migration cost as the namespace approach. Adds two new optional fields to the interface; every adapter has to ignore them. |
| One opaque `meta` JSON blob string. | Loses keyed query support through `BeadFilter.label`. Makes `byPriorityTier` a full-table scan. |

## Acceptance criteria

- The JSDoc on the `labels` field at `core/packages/workflows/src/types/bead.ts:39-44` enumerates the full reserved-key set: existing `goal_parent`, `okr` plus the seven core keys plus the contextual subset documented above.
- A bead emitted by the gastown-pilot Intake flow (ADR-0061) carries `labels.source = "morning_card"`, `labels.why`, `labels.priority_tier`, `labels.card_image_uri`, `labels.decomposition_role` populated; a child bead carries `labels.parent_id`.
- A bead emitted from a daily-logger suggestion (ADR-0063) carries `labels.source = "daily_logger"`, `labels.digest_run_id`, `labels.digest_suggestion_id`.
- Existing call sites compile without changes: `purefoy/packages/api/beads/types.ts:11`, `purefoy/packages/api/routes/beads.ts:4`, `purefoy/packages/api/beads/mapper.ts:2`, `daily-logger/src/bead-store.ts`, gastown-pilot scaffolded adapters.
- A query helper at `core/packages/workflows/src/types/bead.ts` (e.g. `byPriorityTier(tier)`) returns the expected filter shape under `BeadFilter.label`.
- A unit test in `core/packages/workflows/src/__tests__/` round-trips `cross_rig_deps` and `human_edits` through JSON encode/decode.
- A runtime guard `assertReservedLabels` rejects unknown values for the four enum keys (`priority_tier`, `source`, `decomposition_role`, plus `human_accepted` / `expansion_context_partial` boolean strings).

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent); slice zero-point `_pending_` |
| FrameBead inspection commit | `_pending_` — required: read `core/packages/workflows/src/types/bead.ts` and grep for FrameBead consumers across the tree before editing JSDoc; produce a one-line consumer list as the inspection commit message |
| Migration Convoy id | `none` — no migration required (additive labels) |
| Originally drafted as | ADR-007 (handoff message, 2026-04-30) |
| Master | [ADR-0056](0056-developer-day-orchestration-master.md) |
