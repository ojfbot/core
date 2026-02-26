# ADR-0001: Module Federation over iframes for shell composition

Date: 2026-01
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /validate, /hardening, /scaffold-app
Repos affected: shell, cv-builder, blogengine, tripplanner, purefoy

---

## Context

The Frame OS shell needs to compose multiple sub-applications into a single unified surface. The sub-apps are separate repos with their own build pipelines. We needed a way to load them dynamically at runtime without duplicating React, Redux, or other shared singletons.

## Decision

Use Vite Module Federation to load sub-apps as real React remotes. The shell is the Federation HOST. Sub-apps are REMOTE entries that export components consumed by the host.

## Consequences

### Gains
- Shared React/Redux/RTK singleton across all loaded apps — no duplicate react instances, no cross-origin store isolation headaches.
- Sub-apps render inside the host's React tree — full CSS cascade, shared context providers, shared theme.
- True compositor model: the shell can orchestrate state across all running sub-apps simultaneously.
- Enables the hero demo: cross-domain coordination requires a shared Redux store.

### Costs
- All sub-apps must expose a Module Federation remote entry (`remoteEntry.js`). Apps that don't implement this can't be loaded.
- BlogEngine and TripPlanner are currently missing Module Federation config — this is a hard blocker for Phase 1.
- Vite MF config is sensitive to port numbers and `VITE_REMOTE_*` env vars must be set correctly for production.

### Neutral
- Build complexity is higher than a simple iframe embed, but the DX is manageable once the vite.config.ts pattern is established.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| iframes | No shared state. Cross-origin messaging is error-prone. Can't share React, Redux, or theme. Produces a tab-aggregator UX, not a compositor. Explicitly deprioritized. |
| Single monorepo with all apps | Would eliminate the need for MF, but loses the ability to deploy sub-apps independently and ship them as standalone products. |
| Web Components / Custom Elements | Framework-agnostic but requires wrapping React apps and loses the shared singleton benefit. |
