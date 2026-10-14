# Existing-source inspector contract proposal

Status: local proposal under approved local repair preparation. The schema amendment requires core owner acceptance and a separate publication decision. It does not promote MC-UX-01 or change any dispatch, readiness, settlement, correspondence or authority policy.

The existing Dolt/handoff inspector reads metadata through the core-owned SDL, vendored and code-generated in cockpit. No core runtime import is added. Query-only reads preserve the existing shell, keyboard modal and explicit repository Focus action.

## Resource coordinates

`SourceRecord` is a concrete union closed over `dolt-bead-v1` and `handoff-document-v1`. A Dolt observation has its native bead ID, observed repository (nullable for missing metadata), and no file path. A handoff document has the configured repository and repository-relative document path, and its authored native ID when recorded. The opaque resource key uses the variant and resource coordinates. It is scoped to the configured existing sources; this proposal does not define universal cross-database or cross-provider identity. Authored actors, principals, credentials, agent/runtime/session/model/trace/host fields never participate in the key.

A future GitHub variant must first specify provider host, fully qualified owner/repository and provider-native resource ID. The same resource viewed by two accounts has one resource identity. Account routing stays server-side. Unsupported GitHub observations fail closed; this proposal provisions no accounts, devices or credentials.

## Captured source collections and inspection

`evidenceSummary` describes one observation: its ID, generation/expiry times, Dolt inventory scope/coverage/counts and handoff inventory scope/coverage/counts. Handoff's standalone-unanswered-brief population has its own count. An unavailable inventory/population has a null count, not a fabricated zero. Collection times remain source specific because the aggregate uses bounded source caches. The Dolt scope is the configured database's created/live beads or rows updated/closed since the overnight boundary; absence means not observed within that scope. Handoff observes supported frontmatter in the configured repositories' `.handoff/*.md` files. Bodies and arbitrary labels are absent. The unresolved count combines retained legacy handoff diagnostics and unresolved physically declared task/document links.

`evidenceIndex(snapshotId)` returns a typed product of Dolt and handoff partitions. Each partition is observed (complete/partial coverage) or unavailable; an outage preserves the other source. Index summaries are projections of the captured native collections, not another authoritative inventory. `evidenceRecord(snapshotId, sourceRecordKey)` returns a closed Dolt-native or handoff-authored metadata payload. Production metadata exists only on handoff documents. Invalid coordinates, source unavailable, record not observed in scope, and refresh required are distinct results. Public query names and arguments remain unchanged; there is no caller-selectable source parameter.

Every current WorkItem receives an exact server-minted `inspectionTarget` from that capture, including its key, source coordinates and generation/expiry times. Legacy items without an observed pin/key expose an unavailable target. Clients never synthesize a target from titles, native IDs, actors, sessions or display URLs. All aggregate-dependent roots within one GraphQL request share one capture.

Snapshots are cloned process-local observations retained for five minutes and at most 32 IDs. Exact expiry, eviction or restart yields refresh-required; pinned reads never recollect or substitute a newer observation. Source scope is explicit and an opaque key has no persistence or cross-server guarantee.

Dolt's canonical repository is a unique, nonempty, valid observed `labels.app`/`labels.repo` value. Missing, invalid or conflicting declarations produce a null coordinate and bounded diagnostics. The existing WorkItem display prefix fallback stays separate. The reader does not infer canonical coordinates from prefixes, actors or session metadata.

Handoff diagnostics preserve roles, ambiguity and directed cycles. `closes:` resolves against all observed handoff documents, including closed predecessors. Only eligible live predecessors fold into live successors; an observed closed predecessor is not diagnosed missing and does not hide its live successor. Legacy report `responding_to` and raw refs remain governed by existing handoff-local policies.

## Proposed physically declared task/document navigation

A v1 `source_links` array may be physically present in handoff frontmatter. Dolt `labels.source_links` records that array as a JSON string, preserving the existing string-valued label contract. Each entry has exactly `schemaVersion: 1`, `relation: task-document` and `target`. A document can target `{source: dolt-bead, nativeId}` in the configured Dolt scope. An observed Dolt task can target `{source: handoff-bead, repository, sourcePath}`. The containing record supplies origin and the original declaration field path; supplied origin fields, unknown versions, invalid coordinates and incompatible directions are rejected. No producer is enabled and no historical metadata is converted by this proposal.

Resolution preserves direction and returns resolved observed endpoints/keys, target source unavailable, target not observed in scope, ambiguous observed candidates, incompatible target kind, or invalid declaration. A resolved Dolt endpoint must actually be an observed task. Equal IDs in different sources never create an edge. Absence of declarations means no declared relationship. Resolution neither invents a reverse declaration nor settles work, proves delivery, authenticates a principal, or changes legacy lane/folding rules.

## Proposed foreground behavior

An open inspector keeps its observation pinned. Background polling advertises a new observation without replacing open detail. Explicit refresh ends the old selection/request lifetime; the newest request wins even when it fails before an older success. Collapse, close, unmount and selection replacement abort or invalidate their obsolete requests. Repeated inspection of the same card/key starts a fresh detail request.

Cached detail remains reference material after known expiry and is visibly labeled historical. A new lookup requires explicit refresh; expiry/eviction/restart responses never silently adopt background data. This foreground/expiry policy remains a precise owner-acceptance choice, alongside schema names, repository null/conflict semantics and declaration spelling/navigation semantics.

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

The local pair vendors the proposed exact SDL for review. Publication requires owner acceptance of the precise contract and a separate publication decision. No prerequisite PR or producer activation is created by local qualification. Neutral inspector models are generated from the transitive SDL query/target closure with required concrete discriminants and explicit nullable fields. Query/args/resolver/operation wrappers remain private. Regenerate-diff plus constructors/codecs and exhaustive consumers reject additions until handled; legacy bidirectional field parity remains in force. The existing rich WorkItem chain/detail/provenance REST fields remain explicit pre-existing exclusions; new source/evidence/provenance fields are not exempt.

Native checks cover roles, directed-cycle permutations, unsupported sources, unknown/invalid/recorded production, unchanged resource identity, normalized population, cloned/pinned reads, exact expiry/eviction/restart, actual HTTP/GraphQL metadata-only reads, and lazy UI/disclosure/focus behavior. Controlled browser evidence qualifies this bounded experience only; it does not identify a deployed revision or qualify the complete operating loop.
