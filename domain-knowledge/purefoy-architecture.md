# Purefoy Architecture

Source: https://github.com/ojfbot/purefoy

## Overview

A Python knowledge base for Roger Deakins cinematography content. Scrapes the rogerdeakins.com forums (bbPress), manages podcast episode transcripts, and scrapes articles. Fundamentally different from the other four projects — Python, no web server, no LangGraph, no Carbon Design System, no JWT auth.

MCP server already built (`deakins_forums/mcp_server.py`) — the planned Claude Code integration path is operational (stdio JSON-RPC).

## Package structure

```
deakins_forums/    Forum scraper — production v2.0. 3,075+ posts, 691 topics, 9 forums.
deakins_articles/  Articles scraper — prototype/beta.
download_episodes.py          Podcast episode downloader.
ingest_teamdeakins_downloads.py  Podcast transcript ingestion.
library/           Structured JSON leaf storage (agent-friendly).
  forums/          One JSON file per topic (TopicLeaf).
  articles/        One JSON file per article.
  episodes/        One JSON file per podcast episode.
documentation/     Architecture, roadmap, guides, example schemas.
```

## Data model (Pydantic v2)

All data stored as structured JSON "leafs" — deterministic slug-based paths, provenance-first.

```python
class PostLeaf(BaseModel):
    ids: PostIds          # post_id, topic_id, forum_id + threading fields
    post_type: PostType   # TOPIC | REPLY
    author: Author        # display_name, role
    timestamps: Timestamps  # raw + ISO + confidence
    content_text: str
    content_html: str
    blocks: list[ContentBlock]   # structured: text, code, blockquote
    quotes: list[Quote]          # extracted quoted replies
    links: list[Link]
    media: list[Media]
    provenance: Provenance       # source URL, scrape time, HTTP headers
    integrity: Integrity         # content_hash (SHA-256), parser_version

class TopicLeaf(BaseModel):
    # metadata, flat post_ids list, structured reply_tree dict
    reply_count: int
    max_depth: int

class ForumLeaf(BaseModel):
    # forum metadata, subforums, topic_refs
```

Threading model: `PostIds` includes `parent_post_id`, `parent_type`, `position` — full reply tree reconstructible from leaf data.

## Pipeline architecture

```
HttpClient → Parser (bbpress-v2) → Normalize → Store (JSON) → SQLite FTS5 index
```

- **HttpClient**: ETag caching, rate limiting (3s default delay), configurable retries/timeout.
- **Parser**: `parser_bbpress.py` — parses bbPress forum HTML, extracts `PostLeaf` fields.
- **Normalize**: canonical slugs, timestamp normalization, content hashing (SHA-256).
- **Store**: `store_json.py` — writes deterministic slug-based paths under `library/`.
- **Index**: `index_sqlite.py` — SQLite FTS5 full-text search across all content.

`DeakinsPipeline.scrape_forum()` → paginate forum → `scrape_topic()` per topic → paginates all pages → writes `TopicLeaf` with `build_reply_tree()` + `calculate_thread_stats()`.

## MCP server (deakins_forums/mcp_server.py)

stdio JSON-RPC server exposing 3 tools to Claude Code:

| Tool | Purpose |
|------|---------|
| `scrape_deakins_forum` | Scrape a forum with query provenance tracking |
| `get_coverage_report` | Coverage stats for all forums |
| `get_provenance_report` | Research lineage — which queries accessed which topics |

Query provenance is first-class: every MCP call requires `query_name`, `querier_role`, `querier_department`, `query_context`, `query_intent` fields. This enables a full audit trail of AI research sessions.

## Key design principles

- **Incremental / resumable**: ETags and content hashing mean re-runs only fetch changed content.
- **Deterministic slug-based paths**: `library/forums/<forum-slug>/<topic-slug>.json` — predictable, diffable.
- **Agent-friendly JSON**: leaf files designed to be directly consumable by LLMs without preprocessing.
- **Provenance-first**: every leaf records its source URL, scrape time, and HTTP headers.
- **No web server**: pure CLI + MCP. No authentication layer, no database migrations, no containers.

## Environment vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEAKINS_BASE_URL` | `https://rogerdeakins.com` | Target site |
| `DEAKINS_USER_AGENT` | — | HTTP user agent |
| `DEAKINS_DELAY_S` | `3` | Rate limit delay (seconds) |
| `DEAKINS_TIMEOUT_S` | `30` | Request timeout |
| `DEAKINS_MAX_RETRIES` | `3` | Retry count |
| `DEAKINS_OUT_DIR` | `library/` | Output root |

## CLI usage

```bash
python -m deakins_forums.cli scrape-forum <slug>
python -m deakins_forums.cli scrape-all
python -m deakins_forums.cli search <query>
python -m deakins_forums.cli export <slug> --format=json|csv
python -m deakins_forums.cli stats
```

## Roadmap

| Phase | Status | Key work |
|-------|--------|----------|
| v2.0 current | Complete | 3,075+ posts, FTS5, reply trees, HTTP caching, coverage tracking |
| Phase 1 | In progress | 6,000+ post target, articles scraper, podcast transcripts + search |
| Phase 2 | Planned | Advanced search filters, reply tree viz, author analytics, MCP operational |
| Phase 3 | Planned | Cross-reference linking (forums ↔ podcasts ↔ articles), entity extraction, AI summaries |
| Phase 4 | Ongoing | Automated scrapes, continuous validation |
| Phase 5 | Future | Semantic search (vector embeddings), RAG Q&A, topic modeling, YouTube transcripts |

## Key differences from TypeScript projects

| Dimension | cv-builder/TripPlanner/BlogEngine/MrPlug | Purefoy |
|-----------|------------------------------------------|---------|
| Language | TypeScript / Node.js | Python 3.9+ |
| Runtime | Web server or browser extension | CLI + MCP stdio |
| Auth | JWT or API key in extension storage | None |
| Data store | SQLite + in-memory vector / browser | JSON files + SQLite FTS5 |
| AI integration | LangGraph agent graph | MCP server (Claude reads leaf files) |
| Testing | Vitest | (pytest implied, not yet set up) |
| Deployment | Container / Chrome Web Store | Local CLI |
| Agent pattern | Programmatic LangGraph nodes | Claude reads JSON leafs via MCP |

## Relevant framework commands

- `/recon` — map the package structure, pipeline flow, library schema.
- `/observe` — monitor scraping coverage progress (use `get_coverage_report` MCP tool output as input).
- `/hardening` — HTTP timeout handling, retry logic, rate limiter correctness, error swallowing in pipeline.
- `/test-expand` — `deakins_articles/` prototype has no tests; `deakins_forums/` coverage is partial.
- `/handoff` — the MCP server is the primary handoff surface; `documentation/guides/mcp-integration.md` is the entry point.
- `/roadmap` — Phase 3 (cross-references + entity extraction) and Phase 5 (semantic search / RAG) are the highest-value next milestones.

## Open items

- No pytest suite yet (articles scraper, MCP server untested).
- MCP server is built but Phase 2 lists it as "operational" target — integration testing pending.
- Articles scraper (`deakins_articles/`) is prototype; authentication (`auth.py`) is partial.
- `library/articles/_site/session_cookies.json` is committed to the repo and contains a **live WordPress `wordpress_logged_in_*` session cookie**. This should be rotated (log out and log back in to invalidate the session) and the file removed from git history (`git filter-repo` or BFG). Add `library/articles/_site/` to `.gitignore`.
- Cross-reference linking (forums ↔ podcasts ↔ articles) has no data model yet.
