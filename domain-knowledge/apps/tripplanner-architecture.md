# TripPlanner Architecture

Source: https://github.com/ojfbot/TripPlanner

## Overview

An intelligent trip planning assistant. Users import trip planning conversations (e.g. ChatGPT transcripts about a holiday), which are processed through an 11-phase multi-agent pipeline to populate a structured itinerary dashboard.

## Monorepo packages

Same structure as cv-builder: `packages/api`, `packages/agent-graph`, `packages/browser-app`. Same Carbon Design System frontend.

## Core flow

```
User imports trip conversation (file upload / paste)
  → 11-phase processing pipeline (SSE progress updates)
      1. Storing conversation copy
      2. Extracting text content
      3. Creating semantic chunks
      4. Generating vector embeddings
      5. Updating RAG store
      6. Awaiting agent summaries
      7. Generating itineraries
      8. Creating vision tiles
      9. Analyzing integration needs
      10. Formatting responses
      11. Populating dashboard
  → Structured itinerary dashboard (6 lens views)
  → Persistent chat overlay for follow-up questions
```

## Agent graph (LangGraph)

Five agents coordinated by the Coordinator:
- **CoordinatorAgent** — orchestrates the 11-phase workflow
- **ExtractionAgent** — pulls structured data from conversation
- **ItineraryAgent** — generates day-by-day plans from extracted data
- **IntegrationAgent** — identifies gaps, suggests document requests
- **VisionAgent** — creates vision tiles for Trip Vision tab

State type: `TripPlannerState` in `packages/agent-graph/src/state/schema.ts`.

## Itineraries dashboard (issue #8)

6 lens views via Carbon `ContentSwitcher`:
- **Timeline** — `StructuredList` or `Accordion` grouped by date/time
- **By Day** — `Accordion` per day + `Tile` cards
- **Transit** — `DataTable` (From/To/Time/Mode/Confirmation)
- **Meals** — tiles grouped by day with meal-type `Tag`s
- **Reservations** — `DataTable` with status `Tag` (Confirmed/Pending/Cancelled)
- **Lodging** — `Tile` cards (check-in/out, address, booking status)

`CondensedChat` overlay persists across all lens views.

Key type: `ItineraryItem` in `packages/browser-app/src/types/itinerary.ts`:
- `dayIndex`, `startTime`, `endTime`, `category` (transit/meal/reservation/lodging/activity)
- reservation metadata + `status`

## RAG infrastructure (issue #7)

Document processing pipeline: import → parse → chunk → embed → store → extract → structure → populate.

Status: building from scratch. Intended store: sqlite-vec (same SQLite db as checkpointer). See `langgraph-patterns.md` for invariants.

## Auth (issue #4)

Same JWT + thread ownership pattern as cv-builder. Multi-user with sharing: allow sharing dashboard access with another user account (authn/authz foundation needed first).

## Key open issues

| # | Area | Description |
|---|------|-------------|
| #5 | Epic | Intelligent Trip Import — full multi-agent pipeline |
| #6 | UI/UX | 11-phase progress tracking with SSE, cancellation support |
| #7 | RAG | Document processing pipeline (chunk → embed → sqlite-vec) |
| #8 | UI | Itineraries Dashboard v1 (Carbon, 6 lens views, persistent chat) |
| #4 | Auth | Multi-user authn/authz foundation |

## Progress tracking specifics (issue #6)

The 11 `ProcessingPhase` enum values map to SSE events. Frontend listens and animates progress bar. Errors must surface with specific phase context: "Failed at: Generating vector embeddings". Users can cancel long-running imports.

**`/observe` guidance:** A stuck import is most likely a hang between phases — check which SSE event was last emitted and trace the corresponding agent node.
