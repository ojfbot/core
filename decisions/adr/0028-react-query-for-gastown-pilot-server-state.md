# ADR-0028: React Query for server state in GasTownPilot

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Repos affected: gastown-pilot
Shipped: [gastown-pilot] initial scaffold (7da9207)

---

## Context

All existing Frame sub-apps use Redux for both UI and server state. GasTownPilot has a fundamentally different data access pattern: three data sources (SSE push, Dolt SQL polling, gt CLI mutations), seven data hooks, and real-time invalidation via SSE events. Redux requires manual cache invalidation, loading/error state tracking per query, and fetch deduplication — all of which React Query provides automatically.

The question was whether to follow the established Redux-only pattern or introduce React Query for server state.

## Decision

GasTownPilot uses `@tanstack/react-query` for all server state (beads, agents, convoys, formulas, wasteland data). Redux is used only for UI state (active tab, selected bead, expanded panels). This is a deliberate departure from other Frame apps, justified by the real-time multi-source data model.

## Consequences

### Gains
- SSE invalidation is a single `queryClient.invalidateQueries()` call — no manual Redux action dispatch per query.
- Loading, error, and stale states are automatic per query. No boilerplate reducers.
- Fetch deduplication prevents duplicate API calls when multiple components use the same hook.
- Stale-while-revalidate pattern keeps the UI responsive during background refetches.

### Costs
- New dependency (`@tanstack/react-query` ~45KB). Added to the MF shared singleton map.
- Pattern divergence from other Frame apps. Contributors must know which pattern applies where.
- If other sub-apps later adopt React Query, there's no established migration path from Redux server state.

### Neutral
- React Query is additive to the shell's Redux Provider. The QueryClientProvider wraps DashboardContent inside the Dashboard component — it does not conflict with the shell's store.
- The shell's SettingsModal reads GasTownPilot settings from Redux (via settingsSlice). React Query handles only API data.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Redux for everything (follow existing pattern) | Would require ~50 lines of boilerplate per data hook (action creators, reducers, selectors, loading/error state). Seven hooks × 50 lines = 350 lines of Redux ceremony that React Query eliminates. |
| SWR | Similar to React Query but smaller ecosystem. React Query's `invalidateQueries` + SSE integration is more mature. |
| Custom hooks with fetch + useState | No caching, no deduplication, no stale-while-revalidate. Would reinvent React Query poorly. |
