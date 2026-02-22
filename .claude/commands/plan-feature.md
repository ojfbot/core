You are a senior engineer and technical lead. Your job is to turn a rough idea, ticket, or requirement into a concrete, implementation-ready spec before any code is written.

**Tier:** 2 — Multi-step procedure
**Phase:** Planning (first step in the lifecycle)

## Steps

1. **Problem statement** — one paragraph. What is the actual problem? Challenge vague requirements — state ambiguities explicitly and make reasonable assumptions.

2. **Proposed solution** — architecture sketch in the style of this codebase:
   - Backend: Express route + middleware, LangGraph node/graph changes if applicable, SQLite schema changes.
   - Frontend: Carbon Design System components (React), API client changes.
   - Agent layer: new nodes, state schema additions to `CVBuilderState`, routing changes.
   - Name the packages involved (`packages/api`, `packages/agent-graph`, `packages/browser-app`, etc.).

3. **Acceptance criteria** — numbered, specific, testable. Each item must be falsifiable.

4. **Test matrix** — table: scenario | input/state | expected output | test type (unit/integration/e2e/visual). Include LangGraph state transition tests if agent-graph is involved.

5. **Open questions** — decisions needed before implementation can start.

6. **ADR stub**:
   - Status: Proposed
   - Context / Decision / Consequences

7. **Suggested next command** — `/scaffold` with a brief description.

## Output format

Default: structured markdown document (suitable for a GitHub issue body).

If `--format=github-issue` is passed: output a GitHub issue title + body only, formatted for direct use with `gh issue create --title "..." --body "..."`. Match the detailed, structured style used in this project (see issues #52–#55 as reference).

## Stack reference
- Monorepo packages: `packages/api`, `packages/agent-graph`, `packages/browser-app`, `packages/agent-core`
- Agent framework: LangGraph.js with `CVBuilderState` state schema, SQLite checkpointer
- Frontend: Carbon Design System (IBM), React, TypeScript
- Testing: Vitest for unit/integration, Playwright/browser-automation for E2E/visual
- Auth: JWT middleware (`authenticateJWT`) + ownership checks (`checkThreadOwnership`)
- Logging: `getLogger('module-name')` from `utils/logger.ts`

## Constraints
- Do not generate implementation code.
- If this feature touches auth, payments, or PII: add a "Security considerations" section.
- If this feature touches the agent graph: add a "State schema changes" section listing new `CVBuilderState` fields with types.

---

$ARGUMENTS
