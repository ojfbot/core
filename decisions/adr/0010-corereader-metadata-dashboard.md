# ADR-0010 — CoreReader Metadata Dashboard

**Status:** Proposed
**Date:** 2026-03-01
**Deciders:** Jim Green
**GitHub:** [ojfbot/core#8](https://github.com/ojfbot/core/issues/8)
**OKR:** 2026-Q1 / O1 / KR2
**Commands affected:** /scaffold-app, /plan-feature
**Repos affected:** core-reader (new), shell, frame-agent

---

## Context

Frame OS currently surfaces four domain applications — cv-builder, blogengine, tripplanner, and purefoy — as Module Federation remotes in the shell. All four serve end-user domains. There is no application that exposes the framework's own operational metadata: the 30 Claude commands, 9+ ADRs, OKRs, and domain-knowledge docs that define how Frame OS itself is built and evolved.

Today, a developer working inside Frame OS must leave the Frame OS experience (drop to a terminal, open a file editor, read raw markdown) to browse commands, check ADR status, or update the roadmap. This breaks the "AI-native application OS" story: the system that manages other apps should itself be manageable through the same UI paradigm it provides.

CoreReader addresses this by introducing a fifth sub-app that reads the `core` repo's own filesystem and presents it as a structured, queryable, eventually-mutable dashboard — appearing in the shell's app switcher alongside the other four apps.

---

## Decision

CoreReader is a new sibling repo (`core-reader`) that follows the established Frame OS sub-app architecture:

- **Dual-mode** (ADR-0009): standalone preview on `:3015`, embedded MF remote on `:3016`
- **Module Federation remote** consumed by the shell host at `:4000` — no iframes (ADR-0001)
- **Frame-agent routing** for the embedded chat agent — no direct Anthropic calls in CoreReader packages (ADR-0002)
- **GET /api/tools** capability manifest (ADR-0007)
- **Carbon Design System** for all UI components (ADR-0005)

### Data access

CoreReader API reads the `core` repo filesystem via a `CORE_REPO_PATH` environment variable. This decouples the two repos while giving the API full read (and, in Phase 3, write) access to commands, ADRs, OKRs, and docs.

```
CORE_REPO_PATH=/path/to/ojfbot/core
```

No separate database. All persistence is the `core` repo filesystem. Mutations in Phase 3 write back to disk; git commit/push is a manual step.

### Repo structure

```
core-reader/
├── packages/
│   ├── browser-app/          # React 18 + Carbon + Webpack 5 MF remote
│   │   ├── src/
│   │   │   ├── tabs/         # Commands, ADRs, OKRs, Roadmap, Docs
│   │   │   ├── components/   # Shared: Chat panel, GlobalSearch, DetailPane
│   │   │   ├── hooks/        # TanStack Query data-fetching hooks
│   │   │   └── App.tsx
│   │   └── webpack.config.js
│   ├── api/                  # Express + TypeScript
│   │   ├── src/
│   │   │   ├── routes/       # /api/commands, /api/adrs, /api/okrs, /api/roadmap, /api/docs
│   │   │   ├── parsers/      # gray-matter + remark per entity type
│   │   │   ├── watchers/     # chokidar → WebSocket push
│   │   │   └── index.ts
│   │   └── package.json
│   └── agent-graph/          # LangGraph TS — routes through frame-agent
└── package.json
```

### Port assignment

| Mode       | Port | Consumer            |
|------------|------|---------------------|
| Standalone | 3015 | Developer / QA      |
| Embedded   | 3016 | Shell MF host :4000 |

3015/3016 follows the `X0 standalone / X1 embedded` pattern from ADR-0009, extended to the next available slot after tripplanner (:3010/:3011).

### API surface

```
GET  /api/commands                  # List all commands (name, description, path, tags)
GET  /api/commands/:name            # Full command detail + raw markdown
POST /api/commands                  # Phase 3: create command (write .md to .claude/commands/)
PUT  /api/commands/:name            # Phase 3: update command content

GET  /api/adrs                      # List ADRs (filterable by status, date)
GET  /api/adrs/:id                  # Full ADR detail
POST /api/adrs                      # Phase 3: create ADR (auto-number, write .md)
PATCH /api/adrs/:id                 # Phase 3: update status or content

GET  /api/okrs                      # List OKRs (filterable by quarter, status)
GET  /api/okrs/:id                  # Full OKR detail
PATCH /api/okrs/:id                 # Phase 3: update progress/status

GET  /api/roadmap                   # List roadmap items
GET  /api/roadmap/:id               # Item detail
PATCH /api/roadmap/:id              # Phase 3: update status, target date

GET  /api/docs                      # Directory tree of docs/ + domain-knowledge/
GET  /api/docs/*path                # Raw + rendered content by path
PUT  /api/docs/*path                # Phase 3: update doc content

GET  /api/search?q=&type=           # Cross-entity full-text search
GET  /api/tools                     # ADR-0007 capability manifest

WS   /ws                            # Filesystem change events (chokidar → push)
```

### Chat agent routing

The CoreReader chat panel connects to `frame-agent` POST `/api/chat` (same as shell), passing the active tab context in the conversation history. Frame-agent registers a `CoreReaderDomainAgent` that calls back to CoreReader's REST API as its tool layer. This maintains the single-gateway constraint (ADR-0002) without requiring CoreReader to speak to Claude directly.

### Implementation phases

| Phase | Scope | Unblocks |
|-------|-------|----------|
| 1 | Scaffold, read-only Commands + ADRs, Shell MF integration | Developer tool immediately usable |
| 2 | OKRs, Roadmap, Docs tabs; cross-entity links | Full read coverage |
| 3 | File write-back for all entities; chokidar + WebSocket live sync | Mutations from UI |
| 4 | LangGraph chat agent via frame-agent; global Cmd+K search | NL queries and mutations |
| 5 | Backlinks panel, drag-and-drop kanban, markdown editor, a11y audit | Polish |

---

## Consequences

### Gains

- Frame OS is self-describing — operators manage the framework from inside the framework
- ADR, OKR, and command workflows gain a visual layer on top of the existing `/adr`, `/techdebt` CLI commands
- Demonstrates the "application OS" concept with a domain that every hiring-panel viewer immediately understands (it's a tool for the tool)
- Phase 1 provides immediate value: browsing 30 commands and 10+ ADRs without opening a file editor

### Costs

- New repo to maintain; adds to the 7-repo cluster
- `CORE_REPO_PATH` creates a runtime coupling between `core-reader` and the `core` filesystem that doesn't exist for other sub-apps
- Phase 3 mutations introduce file write-back — requires careful API validation to prevent accidental data loss or malformed markdown
- frame-agent must register a `CoreReaderDomainAgent` — extends the routing layer that is already a refactor candidate (Phase 2 roadmap)

### Neutral

- Filesystem-backed persistence (no DB) is consistent with core's existing ADR/OKR storage
- Port 3015/3016 does not conflict with any existing service
- CoreReader has no end-user content — it is developer/operator tooling embedded in a portfolio product

---

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| CoreReader as packages inside the `core` monorepo | Mixes workflow framework packages with a demo sub-app; complicates installs into sibling repos; breaks the clean boundary between `core` (tooling) and sub-apps (demo products) |
| Read-only forever (no mutation phases) | Limits the demo value — a dashboard you can only read is less impressive than one you can mutate from; /adr and /techdebt already prove the write-back pattern works |
| Direct Anthropic calls in agent-graph | Violates ADR-0002; adds a second API key context outside frame-agent's single-gateway contract |
| SQLite database for parsed entities | Adds infra complexity with no benefit — the `core` filesystem IS the source of truth; caching can be in-memory if needed |
| iframe instead of Module Federation | Violates ADR-0001 |

---

## Open Questions

1. **frame-agent registration**: Does CoreReader register as a domain in frame-agent (alongside cv-builder, blogengine, etc.), or does the shell treat CoreReader as infrastructure that bypasses the MetaOrchestrator? Recommendation: register as a domain — consistent, discoverable, testable.

2. **Mutation safety**: Phase 3 file write-back — should mutations write directly to disk, or should the API stage changes in a git working tree and require explicit commit? Staging is safer but adds scope. Direct write is simpler and matches how the CLI commands work today.

3. **Phase priority**: CoreReader Phase 1 vs. TripPlanner Module Federation — which ships first? TripPlanner MF is needed for the hero demo (Phase 3 roadmap); CoreReader Phase 1 is a developer tool. Recommendation: TripPlanner MF first.
