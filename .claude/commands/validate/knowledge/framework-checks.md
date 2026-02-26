# Framework-Specific Checks

Project-specific invariants loaded during `/validate` Phase 3. Supplement the universal invariants with these checks for the stack in use.

## LangGraph (cv-builder, TripPlanner, BlogEngine)

Load `domain-knowledge/langgraph-patterns.md` for the full invariant set. Key checks:

- [ ] `StateAnnotation` uses `Annotated[list, add_messages]` for message accumulation
- [ ] Every conditional edge function has a path to `END`
- [ ] No `sync` tool calls inside `async` nodes
- [ ] `interrupt_before` is set if human-in-the-loop is required
- [ ] Checkpointer is persistent (not `MemorySaver`) in production builds
- [ ] Tool functions return a `ToolMessage`, not a bare string
- [ ] Node functions only read from `state`, never from external global state

## Frame OS / Shell (Module Federation)

- [ ] Shell uses `import()` dynamic imports for remote modules, not static
- [ ] Sub-apps do not call AI APIs directly — all LLM calls through `frame-agent`
- [ ] No `<iframe>` used for sub-app embedding (violates shell architecture)
- [ ] Sub-app port is correct per `frame-os-context.md`
- [ ] Module Federation remote entry is served from the correct URL

## Browser Extension (MrPlug+)

Load `domain-knowledge/mrplug-architecture.md` for full invariant set. Key checks:

- [ ] Content script imports nothing from `@anthropic-ai/sdk`
- [ ] Content script bundle size is within limits (see `extension-audit` knowledge)
- [ ] AI calls are in background service worker only
- [ ] `manifest.json` version is V3
- [ ] `sender` origin is validated in background message handlers

## Express / REST API (shared-stack)

Load `domain-knowledge/shared-stack.md` for patterns. Key checks:

- [ ] All routes under `/api/` have auth middleware applied
- [ ] JWT is verified with `verifyJwt()`, not decoded with `decode()`
- [ ] All Prisma queries use parameterized values (Prisma handles this automatically — flag manual `$queryRaw`)
- [ ] SSE responses have `Connection: keep-alive` and `Content-Type: text/event-stream`
- [ ] Error responses use the structured `{ error: string, code?: string }` shape

## React / Carbon (shared-stack)

- [ ] Carbon components used where available (not custom for generic UI elements)
- [ ] No inline styles overriding Carbon tokens
- [ ] `useEffect` dependencies are complete (no missing deps)
- [ ] No `key` using array index when list can be reordered

## Python (purefoy, python-scraper template)

- [ ] Pydantic models used for all external data ingestion
- [ ] No `response.json()` without Pydantic parsing
- [ ] No synchronous HTTP calls in async functions (`requests` in async context)
- [ ] SQLite operations use parameterized queries (not f-string interpolation)
- [ ] MCP server tools return typed responses matching the declared schema
