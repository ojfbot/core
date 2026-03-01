---
id: ADR-0008
title: ShellAgent Routing Protocol and MetaOrchestrator Dynamic Discovery
status: Accepted
date: 2026-02-27
authors: [Jim Green, Claude Sonnet 4.6]
tags: [frame-agent, meta-orchestrator, routing, dynamic-discovery, api-tools]
related: [ADR-0007]
---

## Context

`frame-agent` (port 4001) is the single LLM gateway for Frame OS. Its
`MetaOrchestratorAgent` routes every incoming natural-language message to the
correct domain agent (cv-builder, blogengine, tripplanner, purefoy). The
routing logic currently has two hard dependencies on static knowledge:

1. **Hardcoded keyword signals** — each domain's routing hints are baked into
   `meta-orchestrator.ts` as string literals (e.g. `'resume'`, `'blog'`,
   `'trip'`).
2. **Hardcoded tool lists** — each `DomainAgent.getTools()` returns a static
   array; the MetaOrchestrator aggregates them for its own `GET /api/tools`
   manifest. The tool definitions are not read from the sub-apps.

This creates a maintenance coupling: adding a tool to TripPlanner requires
changing *both* TripPlanner and frame-agent. It also means the LLM
classification prompt becomes stale whenever a sub-app evolves.

ADR-0007 established a canonical `GET /api/tools` contract for every sub-app.
This ADR governs how frame-agent consumes those manifests and what the routing
protocol should look like as a result.

---

## Decision

### 1. Startup dynamic discovery

On initialization, `MetaOrchestratorAgent` **fetches** the `GET /api/tools`
manifest from each registered sub-app. The fetched data is used to:

- Populate the domain agent's tool list (replacing the hardcoded static arrays)
- Construct the LLM classification prompt's domain description dynamically
- Build a keyword index for the fast-path heuristic

If a sub-app is unreachable at startup, frame-agent **falls back** to the
hardcoded tool stubs already present in each `DomainAgent` and logs a warning.
It does **not** fail to start. Sub-app outage must not take down the gateway.

```
MetaOrchestrator.init()
  for each domain in registry:
    fetch GET <domain_api_url>/api/tools   ← ADR-0007 shape
    on success: register discovered tools
    on failure: use hardcoded stubs, log warn
  build classification prompt from registered tools
  build keyword index from tool names + descriptions
```

### 2. Domain registry (config-driven)

Domains are no longer hardcoded in `meta-orchestrator.ts`. A
`domain-registry.ts` module exports the registry:

```typescript
export const DOMAIN_REGISTRY: DomainConfig[] = [
  {
    id: 'cv-builder',
    apiUrl: process.env.CV_BUILDER_API_URL ?? 'http://localhost:3001',
    keywords: ['resume', 'cv', 'job', 'interview', 'cover letter', 'skills gap'],
  },
  {
    id: 'blogengine',
    apiUrl: process.env.BLOGENGINE_API_URL ?? 'http://localhost:3006',
    keywords: ['blog', 'post', 'draft', 'publish', 'notion', 'podcast'],
  },
  {
    id: 'tripplanner',
    apiUrl: process.env.TRIPPLANNER_API_URL ?? 'http://localhost:3011',
    keywords: ['trip', 'itinerary', 'hotel', 'flight', 'destination', 'travel'],
  },
  {
    id: 'purefoy',
    apiUrl: process.env.PUREFOY_API_URL ?? 'http://localhost:3020',
    keywords: ['deakins', 'cinematography', 'lighting', 'film'],
  },
]
```

`keywords` serve as the fast-path heuristic fallback when the sub-app is
offline or when the LLM classification budget is exhausted. They are
intentionally retained even after dynamic discovery so the gateway can route
without any LLM call when the signal is unambiguous.

### 3. Classification prompt construction

After discovery, the MetaOrchestrator builds the classification prompt by
concatenating each domain's discovered tool `description` fields:

```
Classify which ojfbot Frame OS domain should handle this user message.
Domains:
  cv-builder — generate_resume, analyze_job, tailor_resume, skills_gap, cover_letter, interview_prep
  blogengine — draft_post, edit_post, publish_post, notion_sync, podcast_notes, content_strategy
  tripplanner — create_itinerary, research_destination, estimate_budget, find_accommodation, plan_transport
  purefoy — cinematography_query
  cross-domain — message requires coordinating multiple domains
```

This prompt is rebuilt on each `init()` call so it stays current without a
code change.

### 4. `GET /api/tools` response from frame-agent

frame-agent's own `GET /api/tools` endpoint returns a merged manifest:

```json
{
  "service": "frame-agent",
  "version": "0.1.0",
  "description": "Single LLM gateway and routing orchestrator for Frame OS",
  "routing": "dynamic — tools fetched from sub-apps at startup",
  "domains": {
    "cv-builder":  { "status": "online", "tools": [...] },
    "blogengine":  { "status": "online", "tools": [...] },
    "tripplanner": { "status": "online", "tools": [...] },
    "purefoy":     { "status": "offline (stub)", "tools": [...] }
  }
}
```

The `status` field reflects whether discovery succeeded at startup.

### 5. purefoy DomainAgent

purefoy currently has no dedicated `DomainAgent` class and falls through to the
`default` switch case in `MetaOrchestrator.route()`. This ADR requires creating
`domain-agents/purefoy-agent.ts` matching the pattern of the other three agents.
Until purefoy's `GET /api/tools` exists, the agent uses the single hardcoded
stub tool (`cinematography_query`).

---

## Implementation checklist

| Task | Owner | Status |
|------|-------|--------|
| Create `domain-registry.ts` in frame-agent | frame-agent | ❌ |
| `MetaOrchestratorAgent.init()` fetches `GET /api/tools` per domain | frame-agent | ❌ |
| Fallback to stubs on fetch failure with `log.warn` | frame-agent | ❌ |
| Classification prompt rebuilt from discovered tools | frame-agent | ❌ |
| `GET /api/tools` response includes per-domain status | frame-agent | ❌ |
| Create `domain-agents/purefoy-agent.ts` | frame-agent | ❌ |
| cv-builder `GET /api/tools` matches ADR-0007 shape | cv-builder | ✅ (exists) |
| blogengine `GET /api/tools` matches ADR-0007 shape | blogengine | ⚠️ (diverges — tools → chat dispatcher) |
| tripplanner `GET /api/tools` implemented | tripplanner | ❌ |
| purefoy `GET /api/tools` implemented | purefoy | ❌ |

---

## Consequences

**Positive**
- Adding a tool to any sub-app is a single-repo change; frame-agent picks it up
  on next restart with no code change
- LLM classification prompt automatically stays current
- Startup health check surfaces sub-app availability before any user message hits

**Negative / risks**
- `init()` adds network I/O to startup — must have a short timeout (≤2s per domain)
- If all sub-apps are offline, classification falls back to keyword-only, which may
  misroute ambiguous messages
- Keyword list in `domain-registry.ts` still requires manual maintenance;
  consider extracting keywords from tool `description` fields in a future iteration

**Neutral**
- Hardcoded keyword stubs remain; they are the safety net, not the primary path
- The existing `DomainAgent.getTools()` methods are superseded by discovered data
  but kept as the fallback source — no deletion required
