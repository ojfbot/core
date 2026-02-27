# ADR-0006: GraphQL Federation for Frame OS domain data layer

Date: 2026-02-26
Status: Proposed
OKR: 2026-Q1 / O1 / KR1
Commands affected: /scaffold-app, /validate, /hardening
Repos affected: shell, cv-builder, blogengine, TripPlanner, purefoy

---

## Context

Frame OS sub-apps share a Redux singleton for UI state but have no formal contract
for domain data. REST endpoints proliferate without schema enforcement. As cross-domain
coordination (hero demo) grows, the absence of a typed data contract becomes a blocker
for both developer experience and agent tool-call reliability.

The shell app is itself a GraphQL consumer — it queries the supergraph to power
cross-domain UI surfaces (active instance context, cross-app data display). Sub-apps
are also consumers, each owning their own adapters to the federated graph.

The boundary between the two layers is strict:
- **Redux** — ephemeral browser session state with no server source of truth. Synchronous. No round-trip.
- **GraphQL** — all server-authoritative data, shared across shell and sub-apps via the normalized cache or subscriptions. Shell is a consumer too.

## Decision

**This ADR is Proposed and open. The following questions must be resolved via architecture audit before this ADR can be accepted:**

1. **Apollo Client: shared Module Federation singleton vs per-module instances** — load-bearing decision; determines sync model, cache invalidation strategy, and whether shell + sub-apps see consistent data without subscriptions.
2. **Gateway location: co-located in frame-agent vs dedicated service** — affects ops complexity and whether frame-agent's dual role (LLM gateway + GraphQL gateway) is tenable long-term.
3. **urql vs Apollo Client** — bundle size implications across all sub-apps and MrPlug; affects which cache model is available.
4. **REST sunset scope** — browser vs agent traffic split; determines migration depth. REST remains for internal server-to-server tool calls regardless.
5. **Auth propagation in the GraphQL link chain** — JWT token from Redux `session` slice must be forwarded via Apollo/urql link chain; blocks production readiness.

Pending those audits, the working design is:

- Each sub-app API exposes a `/graphql` Apollo Federation v2 subgraph endpoint alongside existing REST
- `frame-agent` hosts a GraphQL gateway federating all subgraphs into a supergraph
- Shell app and each sub-app browser package hold GraphQL client instances (Apollo or urql) querying the supergraph
- Sub-app browser packages own their own query hooks — no shared query layer via Module Federation
- Cross-domain queries for the MetaOrchestrator hero demo are issued server-side (frame-agent), not from browser adapters
- SSE streaming for LLM output is preserved unchanged — GraphQL subscriptions are not used for agent streaming
- Redux retains ownership of `appRegistry`, `chat`, `session`, `ui` — no domain entities in Redux

## Consequences

### Gains
- Typed schema contract across all domain data
- Shell and sub-apps share data consistency via the GraphQL layer (not Redux)
- Sub-apps remain independently deployable (subgraph can evolve without gateway changes if `@key` directives are stable)
- Cross-domain queries for the hero demo are issued from MetaOrchestrator (server-side) — clean separation of AI coordination from UI data fetching
- Adding a new sub-app requires only: a new subgraph entry in gateway config + `@key` directive on at least one type

### Costs
- Each sub-app API requires a new `/graphql` endpoint (Apollo Federation subgraph setup)
- Each sub-app browser-app requires GraphQL client setup and query migration from REST hooks
- frame-agent takes on a second responsibility (LLM gateway + GraphQL gateway) — may not be tenable
- Sync model is unsettled until Apollo Client singleton vs per-module decision is made

### Neutral
- REST endpoints are not removed — they remain for internal server-to-server tool calls
- SSE streaming is unchanged

## Alternatives considered

| Alternative | Why rejected / deferred |
|-------------|------------------------|
| REST only, no GraphQL | No schema contract; cross-domain fan-out has no typed surface; REST proliferates without governance |
| GraphQL monolith (single schema in frame-agent) | Sub-apps lose schema ownership; every domain change requires frame-agent deploy |
| GraphQL subscriptions for LLM streaming | SSE is already working and purpose-built for streaming; subscriptions add complexity with no benefit here |
| Shared Apollo Client singleton via Module Federation | Under audit — may be correct but requires evaluation against per-module instances |
