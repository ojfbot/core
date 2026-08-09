# cv-builder Architecture

> Display name: **Resume Builder** (repo: ojfbot/cv-builder, package: resume-builder)

Source: https://github.com/ojfbot/cv-builder

## Overview

A multi-agent CV/resume builder. Users interact with a chat interface powered by a LangGraph agent graph that orchestrates specialized agents (resume generation, job analysis, tailoring, skills gap, interview coaching). Built as a TypeScript monorepo.

## Monorepo packages

| Package | Role |
|---------|------|
| `packages/api` | Express API server. Hosts V2 routes under `/api/v2/`. Manages GraphManager singleton. |
| `packages/agent-graph` | LangGraph implementation. Contains state schema, nodes, graph definitions, SQLite checkpointer, RAG retrievers. |
| `packages/agent-core` | Legacy BaseAgent architecture (being superseded by agent-graph). |
| `packages/browser-app` | React frontend. Carbon Design System (IBM). Chat interface, bio dashboard, CV editor. |
| `packages/browser-automation` | Playwright-based screenshot and UI testing tooling. |

## Agent graph architecture

```
browser-app → POST /api/v2/chat (SSE streaming)
    → GraphManager
        → LangGraph cv-builder-graph
            ├── orchestratorNode  (routes based on user intent)
            ├── resumeGeneratorNode
            ├── jobAnalysisNode
            ├── tailoringNode
            ├── skillsGapNode
            └── interviewCoachNode
```

State: `CVBuilderState` (TypeScript type in `packages/agent-graph/src/state/schema.ts`)
Persistence: SQLite via `sqlite-checkpointer.ts` and `sqlite-thread-manager.ts`
RAG: 3 specialized retrievers using OpenAI embeddings + MemoryVectorStore (migrating to sqlite-vec)

## Authentication model (P0, in progress)

- JWT middleware (`authenticateJWT`) applied to all V2 routes
- Thread ownership checks (`checkThreadOwnership`) on all thread-scoped operations
- Mock auth available in dev via `MOCK_AUTH=true`

## Logging

All modules must use `getLogger('module-name')` from `utils/logger.ts`. Raw `console.*` calls are a known issue (tracked in #51) and should be flagged in any review.

## Testing

- Framework: Vitest
- Coverage: 0% in `packages/agent-graph` as of issue #52 (P0 gap)
- Visual regression: Playwright screenshots in `tmp/screenshots/` (local) or GitHub Actions artifacts (CI), baseline in `docs/screenshots/`

## The `.agents/` system

A separate agent registry at `.agents/registry.json` that defines programmatic agents invokable via Claude Code natural language:

| Agent | Purpose |
|-------|---------|
| `pre-commit-validator` | Comprehensive pre-commit validation |
| `issue-manager` | GitHub issue lifecycle management |
| `pr-manager` | Pull request workflow automation |
| `build-validator` | Build configuration validation |
| `code-quality-enforcer` | Continuous quality monitoring |

These are complementary to `.claude/skills/` slash commands: `.agents/` handles triggered automation; `.claude/skills/` handles interactive structured workflows.

## Acceptance audit pattern

Major issues reference an audit markdown: `ISSUE_NN_ACCEPTANCE_AUDIT.md`. When validating against an issue, check if this file exists and use it as the primary acceptance checklist.

## P0 production blockers (as of Dec 2025)

1. **#54** — No JWT auth on V2 endpoints
2. **#53** — RAG uses ephemeral MemoryVectorStore (loses data on restart)
3. **#52** — Zero automated tests in agent-graph package
4. **#55** — No health endpoints, Sentry, or Prometheus metrics

## Key open issues by area

**Architecture:** #46 (LangGraph migration), #45 (mixture-of-experts pattern), #89 (containerized LangGraph CI reviewer)
**Monorepo tooling:** #49 (pnpm + Vite + Lerna), #5 (npm → pnpm)
**UI/Frontend:** #24 (slash commands in chat), #83 (common UI components), #86 (header shell)
**Testing pipeline:** #27 (TypeScript test framework), #39 (visual diff), #43 (screenshot storage), #92 (change detection)
**Dashboard:** #79–82 (analytics, filtering, performance, coverage)
