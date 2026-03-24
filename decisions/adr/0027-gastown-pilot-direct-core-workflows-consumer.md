# ADR-0027: GasTownPilot as first direct @core/workflows consumer sub-app

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Repos affected: gastown-pilot, core, shell
Shipped: [gastown-pilot] initial scaffold (7da9207)

---

## Context

All existing Frame sub-apps (cv-builder, blogengine, tripplanner, purefoy, core-reader, lean-canvas) consume Gas Town primitives indirectly via frame-agent in the shell. GasTownPilot is different: its agent-graph directly imports `runPrimeNode`, `sling`, `FilesystemBeadStore` from `@core/workflows` because it is the observability and control surface for those primitives — it doesn't just benefit from them, it displays and operates on them.

The question was whether GasTownPilot should follow the indirect pattern (all primitives proxied through frame-agent) or take a direct dependency on `@core/workflows`.

## Decision

GasTownPilot's `packages/agent-graph/package.json` declares `@core/workflows` as a direct dependency. Other sub-apps continue consuming primitives indirectly via frame-agent.

## Consequences

### Gains
- Type-safe access to all Gas Town primitives without frame-agent proxying.
- GasTownPilot can use `runPrimeNode` directly in its LangGraph graph — first live consumer of the A3 pattern.
- Panel data hooks can query `BeadStore` directly in the API layer, no intermediate abstraction needed.

### Costs
- GasTownPilot is directly coupled to `@core/workflows` breaking changes. Other sub-apps remain insulated by the frame-agent boundary.
- Coordination cost: any `@core/workflows` breaking change requires gastown-pilot to be updated alongside core.

### Neutral
- This does not change the recommendation for other sub-apps — they should continue indirect consumption unless they are also observability/control surfaces.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Indirect consumption via frame-agent | frame-agent would need dozens of new proxy endpoints for every BeadStore query, gt CLI command, and SSE relay event. The proxy layer adds latency and maintenance burden with no benefit — GasTownPilot is the control surface, not a consumer. |
| Import @core/workflows in all sub-apps | Unnecessary coupling. Other sub-apps only need the primitives for their own agent behavior, which frame-agent handles. |
