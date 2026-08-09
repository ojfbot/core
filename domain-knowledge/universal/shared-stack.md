# Shared Stack Patterns Across Projects

Patterns common to cv-builder, TripPlanner, and BlogEngine. MrPlug is a browser extension and differs — see `mrplug-architecture.md`.

## Monorepo structure

All three projects use (or are migrating to) pnpm workspaces + Lerna. Standard package layout:

```
packages/
  api/              Express API server, v2 routes under /api/v2/
  agent-graph/      LangGraph implementation (nodes, graphs, state, RAG, checkpointer)
  agent-core/       Legacy BaseAgent or shared agent utilities
  browser-app/      React frontend (Carbon Design System)
```

## Authentication pattern (identical across all three)

All three projects have the same auth gap and the same planned solution:

```typescript
// JWT middleware — applied to ALL /api/v2/ routes
authenticateJWT(req, res, next)  // reads Bearer token, sets req.user

// Ownership middleware — applied to any route with :threadId or threadId in body
checkThreadOwnership(req, res, next)  // verifies thread.userId === req.user.userId
```

Dev bypass: `MOCK_AUTH=true` sets `req.user = { userId: 'dev-user', email: 'dev@example.com' }`.

Token storage: `localStorage.getItem('auth_token')` in browser app (consider HttpOnly cookies in production).

**Invariant for `/validate` and `/pr-review`:** Every new Express route on `v2/` must have `authenticateJWT`. Every route touching a thread must have `checkThreadOwnership`. Missing either is a BLOCKING finding.

## Carbon Design System (frontend)

All three use IBM Carbon Design System for UI components. Key patterns:

- `ContentSwitcher` — tab-style lens/view switcher (used in TripPlanner itinerary lenses, BlogEngine tabs)
- `DataTable` — structured data display (reservations, transit, threads)
- `Accordion` — collapsible grouped content (by-day itineraries, content sections)
- `Tile` — card-style item display
- `Heading`, `Button`, `Search`, `Dropdown`, `DatePicker` — standard form controls
- `Tag` — status badges (Confirmed/Pending/Cancelled, content categories)
- `StructuredList` — timeline-style content

**Dashboard pattern:** Multi-tab shell with a persistent `CondensedChat` overlay component that remains accessible across all tabs. Chat must not block critical controls — responsive layout required.

## LangGraph node pattern

Standard node signature across all projects:

```typescript
async function myNode(state: ProjectState): Promise<Partial<ProjectState>> {
  // 1. Read only what you own from state
  // 2. Call LLM or tool
  // 3. Return partial state update — only fields this node owns
}
```

State schema convention: each project has a central state type (`CVBuilderState`, `TripPlannerState`, etc.) in `packages/agent-graph/src/state/schema.ts`. All fields typed with reducers.

**Invariant:** Nodes must handle LLM errors (rate limit, malformed response) without letting the graph hang. Always return a valid partial state even on error — set an `error` field rather than throwing.

## SSE streaming pattern

All three projects stream agent responses to the browser via Server-Sent Events:

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
// emit: data: { type: 'progress' | 'chunk' | 'done' | 'error', ... }
```

Progress events are used (especially in TripPlanner's 11-phase pipeline) to update UI loading states in real time.

**Known issue:** AbortController cleanup can cause premature stream termination (cv-builder #60, TripPlanner #6).

## RAG / vector store pattern

All three have (or are building) a RAG layer:
- cv-builder: 3 specialized retrievers (resume templates, learning resources, interview prep) — migrating from MemoryVectorStore to sqlite-vec
- TripPlanner: document processing pipeline — chunking, embedding, sqlite-vec storage for trip conversations
- BlogEngine: library tab — PDF/URL ingestion, semantic search over stored sources

**Shared invariant:** Every project using MemoryVectorStore in production is a blocker. Migration target is sqlite-vec (same SQLite db as checkpointer). See `langgraph-patterns.md` for retriever invariants.

## Dev-mode storage pattern

Projects use a lightweight JSON-on-disk pattern for dev persistence (before a real DB):
```
packages/api/.data/<entity>/<userId>.json
packages/api/.data/<entity>/files/<userId>/...  (for binary uploads)
```

Rules: no path traversal, extension/mime validation on uploads, safe file handling. This pattern appears in BlogEngine #4 (library) and is referenced as "similar to cv-builder's personal/bios storage approach."

## Logging

All projects: `getLogger('module-name')` from `utils/logger.ts`. No raw `console.*` in any package under `packages/`. This is a recurring debt item across all repos.
