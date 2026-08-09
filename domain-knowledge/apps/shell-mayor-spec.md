# Shell Gas Town Mayor Aggregation Layer — Interface Spec

**Issue:** [shell] #21
**Date:** 2026-03-11
**Status:** Draft
**Author:** /plan-feature
**ADR reference:** ADR-0016 (FrameBead — foundational work primitive)

---

## 1. Problem Statement

The `MetaOrchestratorAgent` in `shell/packages/frame-agent/src/meta-orchestrator.ts` can route conversational messages to domain agents and synthesize their text responses. What it cannot do is answer structured, data-driven queries about work state across the cluster.

Questions like "show me all active job applications", "what documents am I drafting?", or "what ADRs are proposed?" currently require the user to navigate to each sub-app manually. There is no programmatic surface that lets the shell agent pull work item state from all registered remotes and reason over it in one place.

The Mayor aggregation layer solves this by giving `MetaOrchestratorAgent` a single endpoint it can call to get a unified `FrameBeadLike[]` feed from all registered Deacons (sub-apps). With that data, the shell agent can:

- Answer cross-app status queries with factual bead data, not hallucinated estimates
- Surface a unified activity feed in the shell UI (Sprint 4)
- Create `hq-` beads that reference work items from multiple sub-apps (Sprint 2)
- Route sling operations to the correct Deacon based on bead prefix (Sprint 2+)

Without Mayor, each of these requires the shell to know each sub-app's private API schema. Mayor provides a single, stable, prefix-keyed abstraction.

---

## 2. FrameBeadLike Interface Summary

The canonical `FrameBead` interface is defined in ADR-0016 (`packages/workflows/src/types/bead.ts`). Sub-apps expose a locally-defined `FrameBeadLike` shape that is structurally compatible but does not import from `@core/workflows` (to avoid cross-repo dependencies).

The two existing Deacon implementations expose the following fields:

| Field | core-reader (`FrameBeadLike`) | cv-builder (`CVJobBead`) | Mayor consumes? |
|-------|-------------------------------|--------------------------|-----------------|
| `id` | `string` — `core-adr-{NNNN}` | `string` — `cv-{jobId}` | Yes — routing key |
| `type` | `'adr'` | _(absent — `CVJobBead` has no `type` field yet)_ | Yes — filter |
| `status` | `'created' \| 'live' \| 'closed' \| 'archived'` | `'active' \| 'complete' \| 'archived'` | Yes — filter |
| `title` | `string` | _(absent — in `payload.jobTitle`)_ | Yes — display |
| `body` | `string` (full markdown) | _(absent)_ | No — pass-through |
| `labels` | `Record<string, string>` | _(absent)_ | No — pass-through |
| `actor` | `string` | _(absent)_ | No — pass-through |
| `refs` | `string[]` | _(absent)_ | No — pass-through |
| `created_at` | `string` ISO 8601 | _(absent — in `payload.postedDate`)_ | Yes — ordering |
| `updated_at` | `string` ISO 8601 | _(absent)_ | Yes — ordering |
| `closed_at?` | `string` ISO 8601 | _(absent)_ | No — pass-through |
| `sourceApp` | _(absent)_ | `'cv-builder'` | Yes — provenance |

**Mayor's consuming interface** — the minimal shape Mayor reads to merge, filter, and order results:

```typescript
// shell/packages/frame-agent/src/mayor/types.ts

export interface MayorBeadView {
  id: string;           // prefix-keyed routing — "cv-", "core-", "blog-", etc.
  type: string;         // bead type — Mayor passes through unknown values
  status: string;       // lifecycle status — Mayor passes through unknown values
  title: string;        // display label
  created_at: string;   // ISO 8601 — primary sort key
  updated_at: string;   // ISO 8601 — secondary sort key
  sourceApp: string;    // which Deacon provided this bead
  // All other fields are passed through opaquely
  [key: string]: unknown;
}
```

The reason `type`, `status`, and `sourceApp` are typed as `string` (not narrowed to `BeadType`/`BeadStatus` unions) is that Mayor must not break when a Deacon introduces a new type value that the shell's compile-time types don't know about yet. Filtering on these fields is by string equality.

**Migration note on cv-builder:** `CVJobBead` currently stores `jobTitle` inside `payload` rather than at the top level as `title`, and lacks `type`, `created_at`, `updated_at`, and `sourceApp`. Before the cv-builder Deacon is fully compatible with `MayorBeadView`, `mapJobToBead` in `cv-builder/packages/api/src/beads/mapJobToBead.ts` must be updated to promote these fields. This is tracked as an open question (see Section 10).

---

## 3. Mayor Endpoint Contract

### Where Mayor lives

Mayor lives in `shell/packages/frame-agent/` as a new module `src/mayor/`. It is **not** a separate service and does not live in `shell-app/` (the Vite frontend). Reasons:

1. `MetaOrchestratorAgent` in `frame-agent` already has the `SubAppUrls` map and the `init()` fan-out pattern. Mayor is a natural extension of that machinery — same process, same URL map.
2. Mayor requires server-side HTTP fan-out with per-Deacon timeouts. This cannot run in the browser.
3. Shell-app can call Mayor via the existing frame-agent API it already talks to. No new service boundary is introduced.
4. Keeping Mayor in frame-agent avoids exposing sub-app API URLs to the browser.

### Endpoint

```
GET /api/beads
```

Hosted by `shell/packages/frame-agent/` (Express server, same port as the existing frame-agent API).

The path mirrors the Deacon endpoint convention (`GET /api/beads`) intentionally. The shell exposes the same path as an aggregated superset of all Deacon feeds.

### Request

The shell-app or ShellAgent triggers Mayor by calling:

```
GET http://localhost:4001/api/beads
```

Query parameters (all optional):

| Param | Type | Description |
|-------|------|-------------|
| `type` | `string` | Filter beads by type (e.g. `adr`, `cv`, `draft`). Passed through to all Deacons that support it. |
| `status` | `string` | Filter by lifecycle status. Passed through to Deacons. Also applied as a post-merge local filter. |
| `prefix` | `string` | Scope to a single Deacon by bead id prefix (e.g. `cv-` returns only cv-builder beads). When set, Mayor fans out only to the matching Deacon. |
| `sourceApp` | `string` | Alternative to `prefix` — filter by Deacon name (e.g. `cv-builder`). Applied post-merge. |

### Response

```typescript
// HTTP 200
interface MayorBeadsResponse {
  beads: MayorBeadView[];
  count: number;
  sources: MayorSourceStatus[];  // one entry per registered Deacon
}

interface MayorSourceStatus {
  appType: string;           // e.g. "cv-builder"
  status: 'ok' | 'timeout' | 'error' | 'skipped';
  beadCount: number;         // 0 if status !== 'ok'
  errorMessage?: string;     // set when status is 'error'
}
```

The `sources` array is always present in the response — callers (ShellAgent, shell-app UI) can surface partial-result warnings without parsing the bead list.

Mayor always returns HTTP 200 unless Mayor itself crashes (which returns 500). A Deacon being down is not a Mayor error — it is reflected in `sources[n].status`.

---

## 4. Deacon Pattern

### What is a Deacon?

A Deacon is any registered sub-app that:
1. Runs an HTTP API with `GET /api/beads` returning `FrameBeadLike[]` or a response envelope containing a `beads` array.
2. Uses a consistent bead id prefix (`cv-`, `core-`, `blog-`, `trip-`, `pure-`).
3. Supports optional `type`, `status`, and `prefix` query parameters (subset may be absent — Mayor handles missing param support gracefully).

Each entry in `APP_CONFIG` in `shell/packages/shell-app/src/store/slices/appRegistrySlice.ts` corresponds to one Deacon. The five currently registered app types are: `cv-builder`, `tripplanner`, `blogengine`, `purefoy`, `core-reader`.

### Deacon discovery

Mayor derives its Deacon list from a **hardcoded registry** in `shell/packages/frame-agent/src/mayor/deacon-registry.ts`. This registry mirrors `APP_CONFIG` in `appRegistrySlice.ts` but lives server-side (frame-agent has no access to the Redux slice).

```typescript
// shell/packages/frame-agent/src/mayor/deacon-registry.ts

export interface DeaconConfig {
  appType: string;
  beadsUrl: string;        // e.g. "http://localhost:3000/api/beads"
  idPrefix: string;        // e.g. "cv-"
  supportsTypeFilter: boolean;
  supportsStatusFilter: boolean;
  supportsPrefixFilter: boolean;
}

export const DEACON_REGISTRY: DeaconConfig[] = [
  {
    appType: 'cv-builder',
    beadsUrl: process.env.CV_BUILDER_API_URL ?? 'http://localhost:3000/api/beads',
    idPrefix: 'cv-',
    supportsTypeFilter: false,
    supportsStatusFilter: true,
    supportsPrefixFilter: false,
  },
  {
    appType: 'core-reader',
    beadsUrl: process.env.CORE_READER_API_URL ?? 'http://localhost:3015/api/beads',
    idPrefix: 'core-',
    supportsTypeFilter: true,
    supportsStatusFilter: true,
    supportsPrefixFilter: true,
  },
  // blogengine, tripplanner, purefoy added as their /api/beads endpoints land
]
```

Rationale for hardcoded vs. dynamic: The existing `MetaOrchestratorAgent.init()` already uses a hardcoded `SubAppUrls` map — this is established practice in the codebase. Dynamic discovery (via `GET /api/tools`) is already used for tool manifests; it does not provide bead URL metadata. A separate discovery protocol for bead endpoints would add complexity with no current benefit. The registry is a single file — adding a new Deacon is a one-line change.

`SubAppUrls` in `meta-orchestrator.ts` and `DEACON_REGISTRY` must be kept in sync. This is an open question (see Section 10) — they could be unified.

### Fan-out strategy

**Parallel fetch** (`Promise.allSettled`). All Deacons are queried simultaneously. Sequential fetch would add N×latency to every Mayor call — unacceptable when the shell is waiting to respond to a user query.

`Promise.allSettled` is used instead of `Promise.all` so that one Deacon failure does not reject the entire fan-out. Each result is independently inspected.

---

## 5. Merge Strategy

### Combining results

After `Promise.allSettled`, Mayor:

1. Collects all fulfilled Deacon responses and normalises each bead to `MayorBeadView` (injecting `sourceApp` if absent).
2. Applies any post-merge filters (`sourceApp`, `status`) that were not forwarded to individual Deacons.
3. Deduplicates by `id` (see below).
4. Sorts the merged array.

### Ordering

Primary sort: `updated_at` descending (most recently active work first).
Secondary sort (tie-break): `created_at` descending.
Tertiary sort (tie-break): `sourceApp` alphabetically.

Rationale: Users asking "show me my active applications" expect the most recently touched item first. `updated_at` is the most semantically meaningful recency signal across heterogeneous bead types.

### Deduplication

Deduplication is by `id` equality. If two Deacons return a bead with the same `id`, the later-arriving result (lower index in `Promise.allSettled` results) is kept and the duplicate is discarded. In practice, duplicate ids across Deacons should not occur because id prefixes are Deacon-scoped (`cv-`, `core-`, etc.). Deduplication is a safety net, not a primary mechanism.

There is intentionally no content-hash deduplication. Beads from different apps with the same conceptual content are distinct beads with distinct ids — Mayor does not attempt cross-app semantic deduplication.

---

## 6. Graceful Degradation — First-Class Requirements

This section specifies Mayor's exact behaviour for each failure mode. At 5 registered Deacons (with up to 8 anticipated), one slow or down remote must never degrade the entire feed.

**Timeout policy:** Each Deacon fetch is given a **2000 ms** timeout (matching `MetaOrchestratorAgent.INIT_TIMEOUT_MS` — consistent with existing shell practice). This is configurable via `MAYOR_DEACON_TIMEOUT_MS` env var.

### Remote returns 5xx

Mayor treats the response as a Deacon failure. The Deacon's bead count is 0. `sources[n].status = 'error'`, `sources[n].errorMessage = "HTTP 503"` (or whatever status was returned). Mayor returns the merged feed from all other Deacons with HTTP 200.

### Remote times out (>2000 ms)

The `AbortController` fires, the fetch is cancelled, and the Deacon is marked `status: 'timeout'`, `beadCount: 0`. Mayor returns the merged feed from all other Deacons with HTTP 200. The timeout threshold (2000 ms) is intentionally identical to the tool-discovery timeout in `init()`.

### Remote returns unexpected shape (missing required field)

Mayor attempts to normalise each bead via a `normaliseBead(raw: unknown, deacon: DeaconConfig): MayorBeadView | null` function. If a required field (`id`, `created_at`, or `updated_at`) is missing or not a string, `normaliseBead` returns `null` and that bead is dropped. If `title` is absent, Mayor synthesises a fallback: `"${deacon.appType} bead ${raw.id ?? 'unknown'}"`. The Deacon's `sources` entry is marked `status: 'ok'` but only includes successfully normalised beads in `beadCount`.

If the entire response body fails to parse as JSON, the Deacon is marked `status: 'error'`, `errorMessage: 'Invalid JSON'`.

### Remote is unreachable (DNS/network error, ECONNREFUSED)

The fetch throws before any HTTP response is received. Mayor catches the thrown error, marks the Deacon `status: 'error'`, `errorMessage: error.message`. Mayor continues with the remaining Deacons.

### All remotes down

Mayor returns:

```json
{
  "beads": [],
  "count": 0,
  "sources": [
    { "appType": "cv-builder", "status": "error", "beadCount": 0, "errorMessage": "ECONNREFUSED" },
    { "appType": "core-reader", "status": "timeout", "beadCount": 0 }
  ]
}
```

HTTP status is still **200**. The caller (ShellAgent) inspects `sources` to determine that all Deacons failed and may surface a message like: "I couldn't reach any of your apps right now — they may be offline."

### ShellAgent awareness of partial results

`MetaOrchestratorAgent` (or the new `MayorAgent` — see Section 7) receives the `sources` array alongside `beads`. When any source has `status !== 'ok'`, the agent includes a caveat in its response: "Note: I couldn't reach [appType] — results may be incomplete."

---

## 7. ShellAgent Query Interface

### Natural language to bead query

When a user types "show me active job applications", the routing chain is:

1. `MetaOrchestratorAgent.classify()` returns `'cv-builder'` (single-domain) or `'cross-domain'` (multi-domain).
2. For bead-data queries, the domain agent (or MetaOrchestrator directly) calls `GET /api/beads` on frame-agent with query params derived from the message.
3. The bead data is returned as structured JSON and included in the LLM context before generating the user-facing response.

This means ShellAgent's LLM call is data-augmented: the prompt includes the actual bead list, not a guess.

### Query parameter mapping

| Natural language intent | Mayor query params |
|-------------------------|--------------------|
| "active job applications" | `?sourceApp=cv-builder&status=active` |
| "proposed ADRs" | `?sourceApp=core-reader&status=created` |
| "what am I working on across all apps" | _(no params — full feed)_ |
| "open tasks in Resume Builder" | `?prefix=cv-&status=live` |
| "recent blog drafts" | `?sourceApp=blogengine&type=draft` |

### Pass-through vs. local filter

Mayor uses a **hybrid approach**:

1. Query params that the target Deacon supports (per `DeaconConfig.supportsTypeFilter` etc.) are forwarded in the fan-out request to that Deacon. This reduces response payload size from large Deacons.
2. Query params are also applied as a post-merge local filter on Mayor's side. This catches results from Deacons that don't support the param, and provides a consistent result regardless of Deacon capability.

When `prefix` is specified, Mayor fans out **only to the Deacon whose `idPrefix` matches** — no other Deacons are queried. This is a strict optimisation: a `prefix=cv-` query will never touch blogengine.

---

## 8. Acceptance Criteria

**AC-1: Happy path — full fan-out**
Given all five registered Deacons are online and responding within 2000 ms,
When ShellAgent calls `GET /api/beads`,
Then Mayor returns HTTP 200 with a `beads` array containing results from all five Deacons, a `count` equal to the total bead count, and all five `sources` entries with `status: 'ok'`.

**AC-2: Partial failure — one Deacon times out**
Given four Deacons respond within 2000 ms and one Deacon (e.g. `tripplanner`) exceeds 2000 ms,
When ShellAgent calls `GET /api/beads`,
Then Mayor returns HTTP 200 with beads from the four responsive Deacons, `sources` contains a `tripplanner` entry with `status: 'timeout'` and `beadCount: 0`, and the total `count` reflects only the four successful sources.

**AC-3: Partial failure — one Deacon returns 5xx**
Given one Deacon returns HTTP 503,
When ShellAgent calls `GET /api/beads`,
Then Mayor returns HTTP 200, the failing Deacon's `sources` entry has `status: 'error'` and a non-empty `errorMessage`, and all other Deacons' beads are present.

**AC-4: Prefix scoping**
Given cv-builder is online and returns three beads with ids `cv-abc`, `cv-def`, `cv-ghi`,
When ShellAgent calls `GET /api/beads?prefix=cv-`,
Then Mayor fans out only to cv-builder (no other Deacon receives an HTTP request), and returns exactly three beads.

**AC-5: Status filter passthrough + local**
Given cv-builder supports `?status=` and returns only `active` beads when the param is set,
And core-reader does not support `?status=` and returns beads of all statuses,
When ShellAgent calls `GET /api/beads?status=live`,
Then cv-builder is called with `?status=active` (Mayor translates `live` → `active` for cv-builder's status vocabulary — see Open Questions), core-reader is called without a status param, and Mayor's post-merge filter removes any non-`live` beads from core-reader's response.

**AC-6: Sort order**
Given beads from multiple Deacons with varying `updated_at` timestamps,
When the merged `beads` array is returned,
Then beads are ordered by `updated_at` descending (most recently updated first).

**AC-7: Shape normalisation — missing field**
Given a Deacon returns a bead JSON object missing the `title` field,
When Mayor normalises the bead,
Then the bead appears in the result with a synthesised title (e.g. `"cv-builder bead cv-xyz"`) and is not dropped.

**AC-8: All Deacons down**
Given all registered Deacons are unreachable (ECONNREFUSED or timeout),
When ShellAgent calls `GET /api/beads`,
Then Mayor returns HTTP 200 with `beads: []`, `count: 0`, and all `sources` entries with `status` of `'error'` or `'timeout'`.

---

## 9. ADR Stub

**ADR-00XX: Shell Mayor as the bead aggregation layer for Gas Town adoption**

The shell's `frame-agent` service hosts a Mayor endpoint (`GET /api/beads`) that fans out in parallel to all registered Deacon sub-apps, each of which exposes its own `GET /api/beads` in the `FrameBeadLike` shape defined by ADR-0016. Mayor merges results by `updated_at` descending, normalises bead shapes to `MayorBeadView`, and returns a unified feed with per-Deacon `sources` status metadata. Deacon registration is hardcoded in `shell/packages/frame-agent/src/mayor/deacon-registry.ts`, mirroring the existing `SubAppUrls` pattern in `MetaOrchestratorAgent`. Each Deacon fetch is bounded by a 2000 ms timeout (configurable via `MAYOR_DEACON_TIMEOUT_MS`); timed-out or erroring Deacons contribute zero beads and a `status: 'timeout' | 'error'` entry to `sources`. Mayor always returns HTTP 200 — Deacon health is communicated through `sources`, not HTTP status. This decision extends ADR-0016 by defining the shell-side aggregation contract that ADR-0016's sub-app `/api/beads` implementations feed into.

---

## 10. Open Questions

These decisions must be resolved before Sprint 2 implementation begins:

1. **cv-builder `FrameBeadLike` compatibility gap.** `CVJobBead` stores `jobTitle` in `payload` and lacks `type`, `created_at`, `updated_at`, and `sourceApp` at the top level. Does `mapJobToBead` in cv-builder get updated to promote these fields, or does Mayor's normaliser handle the cv-builder shape as a special case? Recommendation: update `mapJobToBead` — Mayor should not contain per-Deacon parsing logic.

2. **Status vocabulary mismatch.** `CVJobBead` uses `'active' | 'complete' | 'archived'` while ADR-0016 defines `'created' | 'live' | 'closed' | 'archived'`. AC-5 above assumes a mapping (`live` → `active`). Should Mayor maintain a per-Deacon status translation map, or should cv-builder's `mapJobToBead` adopt the canonical vocabulary? Recommendation: adopt canonical vocabulary in `mapJobToBead`.

3. **Unification of `SubAppUrls` and `DEACON_REGISTRY`.** `MetaOrchestratorAgent` already holds a `SubAppUrls` map with base URLs for all sub-apps. `DEACON_REGISTRY` would hold the same URLs plus bead-path suffixes. Should these be unified into a single server-side app config? Recommendation: yes — extract a `FRAME_APP_CONFIG` server-side constant that both `MetaOrchestratorAgent` and Mayor import.

4. **blogengine, tripplanner, purefoy Deacon readiness.** None of these three apps have a `GET /api/beads` endpoint yet. Mayor's `DEACON_REGISTRY` can list them with a `disabled: true` flag to skip them during fan-out until their endpoints land. Alternatively, Mayor silently handles their absence via the standard `ECONNREFUSED` degradation path. Which approach is preferred?

5. **`MayorAgent` vs. inline in `MetaOrchestratorAgent`.** Should the Mayor fan-out logic live as a new `MayorAgent` class (parallel to `CvBuilderDomainAgent`) or as a new method on `MetaOrchestratorAgent`? The Mayor query interface (Section 7) implies that bead-data augmentation happens before the LLM call — this is more naturally a method than a separate agent.

6. **ShellAgent bead query trigger.** Precisely when does `MetaOrchestratorAgent` decide to call `GET /api/beads` vs. routing to a domain agent? A new `classify()` branch (`'bead-query'`) is likely needed. How is this integrated with the existing fast-path and LLM classification?

7. **`body` field size.** core-reader returns the full ADR markdown in `body`. For large ADR files, this inflates the Mayor response payload significantly. Should Mayor strip `body` from pass-through beads, expose it only via a `GET /api/beads/:id` detail endpoint, or leave it as-is?

8. **Authentication.** The existing frame-agent and sub-app APIs have no authentication. Is Mayor expected to add any access control before Sprint 2, or is local-only operation (developer workstation) sufficient?
