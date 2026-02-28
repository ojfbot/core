# Architecture

> For the "why" behind each decision, see [decisions/adr/](../decisions/adr/).
> For what we're trying to achieve, see [decisions/okr/2026-q1.md](../decisions/okr/2026-q1.md).

---

## What this is

**core** is a portable workflow framework: a set of slash commands for Claude Code, backed by a TypeScript engine. It systematizes the development lifecycle across the entire Frame OS cluster — from feature planning through deployment.

It is also the portfolio evidence for "I build AI tools, I don't just use them."

---

## Frame OS — the product context

Frame is an AI-native application OS. The shell is not an aggregator of tabs — it is a **compositor**: real React remotes loaded via Module Federation, a shared Redux store, and a single AI gateway.

```
frame.jim.software (shell — port 4000)
  Vite Module Federation HOST
  Shared React/Redux/RTK singleton

  ├── cv-builder     (cv.jim.software    — ports 3000/3001)
  ├── blogengine     (blog.jim.software   — ports 3005/3006)
  ├── tripplanner    (trips.jim.software  — ports 3010/3011)
  └── purefoy        (purefoy.jim.software)

frame-agent (port 4001)
  Single LLM gateway for the entire cluster
  MetaOrchestratorAgent → classifies NL → routes to domain
  ├── CvBuilderDomainAgent
  ├── BlogEngineDomainAgent
  └── TripPlannerDomainAgent
```

### Key architectural rules

- **No iframes.** Module Federation only. See [ADR-0001](../decisions/adr/0001-module-federation-not-iframes.md).
- **No direct Anthropic calls in sub-apps.** frame-agent is the single LLM gateway. See [ADR-0002](../decisions/adr/0002-single-llm-gateway.md).
- **Sub-app APIs are CRUD-only.** Domain intelligence lives in frame-agent. Sub-apps expose `GET /api/tools` capability manifests.
- **Conversation history is stateless server-side.** Clients send full `conversationHistory` in every request. Server holds no per-user state.

### Data model

```
AppType → Instance → Thread

AppType:  'cv-builder' | 'tripplanner' | 'blogengine' | 'purefoy'
Instance: named running context ("Berlin Interviews", "Tokyo 2025")
Thread:   named conversation within an instance ("Flights", "Cover letter")
```

Multiple instances of the same app type are supported. `activeAppType` is passed to frame-agent on every message — this is what enables domain routing.

---

## core — the workflow layer

core is a two-layer system:

### Layer 1: `.claude/commands/` — Claude Code slash commands

Each command is a **skill directory**:

```
.claude/commands/
  validate/
    validate.md          ← orchestration prompt (≤250 lines)
    knowledge/
      invariants-checklist.md   ← JIT-loaded reference
      auth-patterns.md
      framework-checks.md
```

The `<name>.md` file is the orchestration skeleton. Heavy reference material lives in `knowledge/` and is loaded on demand via explicit directives in the main prompt. This keeps each command's context footprint small and load fast.

See [ADR-0003](../decisions/adr/0003-skill-directories-over-flat-files.md) for why this structure was chosen over flat files.

### Layer 2: `packages/` — TypeScript engine

| Package | Role |
|---------|------|
| `@core/workflows` | Core library: types, parser, registry, LLM wrapper, file-backed workflow factory |
| `@core/cli` | `core-workflow` binary — joins argv, calls `runWorkflow`, prints output |
| `vscode-extension` | VS Code extension — `core.runSlashCommand` command, output channel |

The TypeScript engine reads the same `.claude/commands/<name>/<name>.md` files at runtime. Updating a command file updates both Claude Code and the CLI simultaneously.

---

## Domain knowledge

`domain-knowledge/` is the **machine context corpus** — reference files loaded by commands at runtime. They are not organized for human browsing; they are organized for JIT retrieval.

| File | What it covers |
|------|----------------|
| `frame-os-context.md` | Full product brief — read before any cross-repo work |
| `shared-stack.md` | Carbon, JWT, LangGraph patterns common to sub-apps |
| `cv-builder-architecture.md` | cv-builder agent graph, packages, open issues |
| `langgraph-patterns.md` | Node/routing invariants, checkpointer behavior, failure signatures |
| `tripplanner-architecture.md` | 11-phase SSE pipeline, 6 lens views, agent graph |
| `blogengine-architecture.md` | Multi-tab dashboard, ToneCheckerNode, media responder |
| `mrplug-architecture.md` | Extension package map, bundle limits, provider factory |
| `purefoy-architecture.md` | Python knowledge base, Pydantic models, MCP server |
| `app-templates.md` | Canonical file structures for /scaffold-app templates |
| `tbcony-dia-context.md` | TBCoNY AI-native product philosophy (Samir Mody talk) |
| `daily-logger-architecture.md` | 4-phase pipeline, council-of-experts pattern |
| `workbench-architecture.md` | 6-tile tmux development environment |

---

## Repo inventory

| Repo | Status | Key gap |
|------|--------|---------|
| cv-builder | Most active, CI green | — |
| shell | frame-agent shipped | App.tsx + main.tsx + index.html missing |
| blogengine | Partial | No Module Federation |
| tripplanner | Partial | No Module Federation |
| daily-logger | Scaffolded | articles/ is empty |
| core | Active | Phase 4B: make public |
| MrPlug | Builds clean | AI in content script (security), no /techdebt integration |
| purefoy | Exists | Not integrated into Frame |

For full phase roadmap, see `domain-knowledge/frame-os-context.md` § Roadmap phases.
