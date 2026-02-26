# ADR-0002: Single LLM gateway (frame-agent) for all sub-apps

Date: 2026-01
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /validate, /hardening, /investigate
Repos affected: shell, cv-builder, blogengine, tripplanner, purefoy, MrPlug

---

## Context

Multiple sub-apps need AI capabilities. Without a central gateway, each sub-app would need its own Anthropic API key, its own retry/rate-limit logic, and its own prompt design. More critically: cross-domain coordination — the hero demo — requires a single agent that can reason across cv-builder, tripplanner, and blogengine simultaneously. That is impossible if each sub-app holds its own isolated AI context.

## Decision

frame-agent (port 4001) is the single LLM gateway for the entire Frame OS cluster. Sub-apps expose `GET /api/tools` capability manifests and CRUD APIs. All natural language requests flow through `MetaOrchestratorAgent → domain agent → sub-app API`. Sub-apps never call Anthropic directly.

## Consequences

### Gains
- One Anthropic API key, one rate limit surface, one cost center.
- Cross-domain coordination is architecturally possible: MetaOrchestrator can fan out to multiple domain agents in a single request.
- Prompt injection attack surface is contained to frame-agent — MrPlug's security model is cleaner with one gateway to harden.
- classify() routing is transparent to the user: they don't know or care which domain handles their message.

### Costs
- Sub-apps must implement `GET /api/tools` to be reachable by domain agents. cv-builder has this; blogengine and TripPlanner do not yet — Phase 1 blocker.
- frame-agent becomes a single point of failure. If it's down, all AI features across all apps are down.
- Local development requires frame-agent running alongside the sub-app even for sub-app-only work.

### Neutral
- SSE streaming uses `fetch() + response.body.getReader()` (not EventSource) because EventSource only supports GET. This is a constraint on the client streaming implementation but not a significant problem.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Each sub-app has its own Anthropic key | Multiple keys, multiple rate limits, no cross-domain coordination. Breaks the hero demo. Each sub-app becomes an isolated AI silo. |
| AI calls in MrPlug content script | Active security vulnerability (prompt injection with access to page content + ability to exfiltrate). Being migrated to background service worker. |
| BFF (Backend-for-Frontend) per sub-app | Still doesn't enable cross-domain coordination. Adds complexity without the key benefit. |
