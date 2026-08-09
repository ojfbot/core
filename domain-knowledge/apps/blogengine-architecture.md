# BlogEngine Architecture

Source: https://github.com/ojfbot/BlogEngine

## Overview

An AI-powered blog content creation tool. Multi-tab dashboard covering content generation, chat, library management (PDFs/URLs), content management, and publishing. Key differentiator: a "Media/Podcast Responder" flow that generates blog posts in response to podcasts or articles — collaborative tone, not confrontational.

## Monorepo packages

Same structure as cv-builder: `packages/api`, `packages/agent-graph`, `packages/agent-core`, `packages/browser-app`. Carbon Design System frontend.

## Dashboard tabs

- **Generate** — content type selector (including Podcast Responder), generation flow
- **Chat** — conversational interface, media-aware for responder flow
- **Library** — PDF/URL/file storage with tags, annotations, file viewer, chat integration
- **Content** — manage generated drafts
- **Publishing** — publish to platforms with metadata

## Media/Podcast Responder (issue #11 — main epic)

The primary feature being built. Agent flow:

```
User Input (media URL/file + thoughts)
  → MediaIngestionNode  (extract metadata, transcript if available)
  → ConversationContextNode  (build context with quotes, timestamps)
  → PodcastResponderAgentNode  (generate collaborative response)
  → ToneCheckerNode  (ensure positive/exploratory tone)
  → EditorAgentNode  (refine and structure)
  → SEOOptimizerNode  (optimize for discovery)
  → Output: Responder Blog Post
```

Tone constraint: "yes, and..." / "interesting other direction" — collaborative and exploratory, never confrontational. `ToneCheckerNode` enforces this.

Media sources supported: Podcast URLs (RSS, Spotify, Apple), YouTube, Vimeo, article URLs, file uploads (MP3, MP4, M4A).

Phased delivery: #12 (data model), #13 (ingestion API), #14 (library tab integration), #15 (chat UI), #16 (PodcastResponderAgent).

## Library tab (issue #4)

Key data types:
- `LibraryItem`: id, type (url|pdf|note|json|md), title, sourceUrl?, filePath?, mimeType?, createdAt/updatedAt
- `LibraryMetadata`: canonicalUrl, authors, publishDate, siteName, hash/checksum, extractedAt
- `LibraryTag`: id/name/color
- `Annotation`: range anchors, freeform notes, tags, createdAt

Dev-mode storage (before real DB):
- Index + metadata: `packages/api/.data/library/<userId>.json`
- Binary files: `packages/api/.data/library/files/<userId>/...`

API endpoints: `GET/POST/PUT/DELETE /api/v2/library`, `GET /api/v2/library/:itemId`, `POST /api/v2/library/upload`.

**Security invariant for uploads:** No path traversal, extension/mime validation required.

## Authentication (issues #9 + #10)

Same JWT + thread ownership pattern as cv-builder. Currently uses `anon-{uuid}` in localStorage — explicitly marked as temporary MVP solution.

## Test coverage (issue #8)

Zero automated tests. Vitest is in devDependencies but unconfigured. Target: >80% coverage across API routes, services, validation schemas, utility functions, React components, Redux slices. Same P0-equivalent gap as cv-builder #52.

## Database persistence (issue #6)

Thread and message storage is in-memory only (lost on restart). Needs: database solution (PostgreSQL or similar), migration scripts, connection pooling, updated `thread-service.ts` and `chat-service.ts`.

## Key open issues

| # | Area | Description |
|---|------|-------------|
| #11 | Epic | Media/Podcast Responder full feature |
| #12–16 | Phases | Foundation → data model → API → library integration → chat UI → agent |
| #9 | Auth | User authentication (JWT, replace localStorage anon IDs) |
| #10 | Auth | Thread ownership middleware |
| #8 | Testing | Comprehensive test coverage (zero currently) |
| #6 | DB | Persistent thread/message storage |
| #4 | Library | Full library tab with PDF/URL ingestion |
| #7 | API | Pagination for all list endpoints |

## LangGraph / agent patterns

Agent flow uses the same LangGraph pattern as cv-builder. Key additional node: `ToneCheckerNode` — validates that generated content maintains the collaborative/exploratory tone. This node should have unit tests with both passing and failing tone examples.

**`/agent-debug` guidance:** If the Podcast Responder flow produces confrontational tone, check `ToneCheckerNode` first — it may be routing to `EditorAgentNode` before tone is validated, or its tone-assessment prompt may be insufficient.
