# Existing-source inspector contract proposal

Status: local proposal under approved Decision11. The schema amendment requires core owner acceptance and a separate publication decision. It does not promote MC-UX-01 or change any dispatch, readiness, settlement, correspondence or authority policy.

The existing Dolt/handoff inspector reads metadata through the core-owned SDL, vendored and code-generated in cockpit. No core runtime import is added. Query-only reads preserve the existing shell, keyboard modal and explicit repository Focus action.

## Resource coordinates

`SourceRecord` is closed over `dolt-bead-v1` and `handoff-document-v1`. A Dolt observation has its native bead ID, observed repository (nullable for missing metadata), and no file path. A handoff document has the configured repository and repository-relative document path, and its authored native ID when recorded. The opaque resource key uses the variant and resource coordinates. It is scoped to the configured existing sources; this proposal does not define universal cross-database or cross-provider identity. Authored actors, principals, credentials, agent/runtime/session/model/trace/host fields never participate in the key.

A future GitHub variant must first specify provider host, fully qualified owner/repository and provider-native resource ID. The same resource viewed by two accounts has one resource identity. Account routing stays server-side. Unsupported GitHub observations fail closed; this proposal provisions no accounts, devices or credentials.

## Observation and diagnostic reads

`evidenceSummary` returns coverage, counted population/repository totals, unresolved count, generation time and an opaque `snapshotId`. REST `/api/cockpit` carries this small summary, never the full metadata ledger. `evidenceIndex(snapshotId)` returns normalized record summaries, population record keys and diagnostics. `evidenceRecord(snapshotId, sourceRecordKey)` returns metadata and production state from that same observation.

Snapshots are process-local, cloned observations retained for five minutes and at most 32 snapshots. Exact expiry, capacity eviction or server restart yields `refresh-required`; no resolver substitutes a newer observation. A missing key in a retained snapshot yields `record-not-observed`. IDs have no persistence or cross-server guarantee. Failure/partial coverage remains visible independently of population zero.

Diagnostics preserve roles: referrer/requested target for missing targets; referrer/candidate targets for ambiguous targets; predecessor/candidate successors for unresolved order; directed predecessor-to-successor cycle keys, canonically rotated to the least key. A role-less sorted participant bag is not the contract. Unresolved observations remain outside guessed lane state; inspection cannot change source status.

## Document production and proposed producer semantics

The reader accepts a frontmatter `document_production` object with `schemaVersion: 1` and a nonempty `interactions` array. It exposes a presentation-independent `DocumentProduction` union. A collapsed disclosure is only the human rendering.

- `recorded`: validated self-recorded interactions, not proof of authenticated authority or actual completion.
- `legacy-unknown`: capture is absent from observed frontmatter; historical production remains unknown. The reader does not determine whether another unobserved representation exists. The reader does not infer anything from actor, filename, mtime, legacy session strings or the current runtime.
- `unavailable`: expected capture is malformed, unsupported or unreadable. The failure does not become legacy history or a complete trace.

The proposed producer minting authority is the producing launcher: it mints `runtime:v1:<UUIDv4>` at process start, before the first captured interaction. A replacement process gets a new runtime ID even when it genuinely resumes a provider-native session. An OS PID or host ID is not the runtime ID. Durable `agentId` reuses core's agent bead identity; sessions are disposable. `sessionProvider` plus exact provider-native `sessionId` is a pair; no normalization guesses joins between historical ISO timestamp sessions and provider UUIDs.

Each interaction has its unique producer-assigned `interactionId`, explicit parent ID when known, runtime, host and start/end timestamps. A model-generation interaction requires the durable agent, provider-native session namespace and exact model provider/model ID. Human edit/approval requires a self-recorded principal and cannot claim a model or agent as that human; emission is another interaction and does not invent a model invocation. Schema-v1 interactions declare every nullable field (`principalId`, `parentInteractionId`, `agentId`, `sessionProvider`, `sessionId`, `modelProvider`, `modelId`, `traceId`); applicable unknown or inapplicable values are explicit nulls, not omitted fields or guessed identities. An omitted declaration makes the captured schema-v1 object unavailable. Absence of the whole `document_production` object remains legacy-unknown. Parent IDs may refer to earlier documents/interactions; the reader makes no historical join claim.

`traceId` is the read-model projection of the existing core `trace_id`, propagated unchanged when captured; no second tracing scheme is minted here. Principal/host values are recorded noncredential identifiers provided by the producer. They never select a credential, authorize a mutation or make an authored actor authenticated. Timestamps require zoned RFC3339 values with at most millisecond precision. The reader checks real calendar dates before parsing; leap seconds and unzoned local timestamps are unsupported. Duplicate interaction IDs, incomplete model/session pairs, invalid or reversed timestamps, unsupported versions and invalid runtime IDs produce `unavailable`.

Required-trace validation for actual cockpit emissions is **inactive**. The existing approved emission path is unchanged. Before activating it, the owner must accept mint/restart/unknown/trace semantics, identify the producer integration and verify current-preview, approval, path-safety and failure behavior. New emission/report verbs, principal authority and fleet-wide identity are outside this proposal.

## Coupled landing and checks

Core SDL/proposal lands first after its owner/publication decision. Cockpit then vendors that accepted exact SDL, regenerates and verifies the served schema. Bidirectional field parity rejects SDL-only and shared-only fields on the governed public types. The existing rich WorkItem chain/detail/provenance REST fields remain explicit pre-existing exclusions; new source/evidence/provenance fields are not exempt.

Native checks cover roles, directed-cycle permutations, unsupported sources, unknown/invalid/recorded production, unchanged resource identity, normalized population, cloned/pinned reads, exact expiry/eviction/restart, actual HTTP/GraphQL metadata-only reads, and lazy UI/disclosure/focus behavior. Controlled browser evidence qualifies this bounded experience only; it does not identify a deployed revision or qualify the complete operating loop.
