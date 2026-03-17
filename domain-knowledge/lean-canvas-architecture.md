# Lean Canvas Architecture

Source: https://github.com/ojfbot/lean-canvas

## Overview

Frame OS sub-app providing AI-assisted Lean Canvas for business model value proposition design.
Migrated from the `ai-mcp-stack` sandbox prototype. Module Federation remote at `lean_canvas/remoteEntry.js`.

## Package structure

```
packages/
  shared/          CanvasSection types, Message, CanvasThread, ToolManifestEntry
  agent-graph/     LangGraph nodes — one canvasSectionNode with 9 domain system prompts
  api/             Express on :3021 — GET /api/tools + POST /api/canvas/:section/chat
  browser-app/     Vite + Carbon DS on :3020 — LeanCanvasGrid + LeanCanvasSectionPanel
```

## Canvas sections (9)

| Section | CSS Grid Area | Domain Focus |
|---------|---------------|--------------|
| PROBLEM | problem | Top 1-3 customer problems + existing alternatives |
| SOLUTION | solution | Simplest MVP solution per problem |
| VALUE_PROPOSITION | value | Single compelling value message |
| KEY_METRICS | metrics | AARRR metrics per lifecycle stage |
| CUSTOMER_SEGMENTS | segments | Early adopters first, then mass market |
| CHANNELS | channels | How to reach segments efficiently |
| COST_STRUCTURE | cost | Key cost drivers, burn rate optimization |
| REVENUE_STREAMS | revenue | Revenue models aligned to WTP |
| UNFAIR_ADVANTAGE | advantage | Genuinely defensible competitive moats |

## Agent routing

All LLM calls go to `frame-agent` at `http://localhost:4001/api/chat` with:
- `systemPrompt`: section-specific domain expert prompt
- `message`: user input
- `conversationHistory`: prior messages for this section's thread
- `context.section`: section identifier
- `context.app`: `'lean-canvas'`

No direct Anthropic SDK calls anywhere in this repo.

## Module Federation

- Remote name: `lean_canvas` (underscored — JS identifier safe)
- Filename: `remoteEntry.js`
- Exposes: `./Dashboard` → `LeanCanvasGrid`, `./Settings` → `Settings`
- Singletons: `react`, `react-dom`, `@carbon/react`
- Shell registers at `VITE_REMOTE_LEAN_CANVAS` env var

## API contract (ADR-0007)

```
GET  /api/tools                        — capability manifest (unauthenticated)
POST /api/canvas/:section/chat         — section chat (section = PROBLEM, SOLUTION, etc.)
GET  /api/canvas/state                 — canvas state (stub, full persistence TBD)
GET  /api/canvas/:section/threads      — section threads (stub)
GET  /health                           — health check
```

## Key ADRs

- ADR-0007: `GET /api/tools` capability manifest contract
- ADR-0019: isolated context windows — each section agent operates independently
- ADR-0020: no Redux imports inside `packages/browser-app/src/components/`

## Source migration

Prototype at `~/ojfbot/sandbox/ai-mcp-stack/packages/frontend-react/` and `packages/agent-orchestrator/`.
Key changes in migration:
- OpenAI direct calls → frame-agent routing
- Webpack → Vite
- Custom CSS → Carbon Design System tokens
- Monolithic Redux chatSlice → scoped canvasSlice (props-in/callbacks-out at component boundary)
- Per-section expansion state machine preserved in LeanCanvasSectionPanel local state
