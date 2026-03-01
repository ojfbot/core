# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Before making any architectural decisions or writing code across any ojfbot repo, read `domain-knowledge/frame-os-context.md`.** It covers the product vision, demo tracks, repo inventory, roadmap phases, and hard constraints that apply to all work in this cluster.

## Commands

```bash
# Install commands + domain-knowledge into any sibling ojfbot repo
./scripts/install-agents.sh <repo-name>          # e.g. cv-builder, shell, blogengine
./scripts/install-agents.sh <repo-name> --force  # overwrite existing symlinks

pnpm install                    # install all workspace dependencies
pnpm build                      # compile all packages
pnpm test                       # run vitest
pnpm test:watch                 # vitest watch mode

pnpm --filter @core/workflows build   # build one package
pnpm vitest run packages/workflows/src/__tests__/parseCommand.test.ts

# CLI (after build)
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js "/plan-feature add user auth"
```

---

## Available slash commands

The primary interface is `.claude/commands/`. Each file is a `/command` in Claude Code. The TypeScript engine in `packages/` backs the same commands for CLI/CI use via `core-workflow`.

### Development lifecycle

| Command | Tier | Phase | Purpose |
|---------|------|-------|---------|
| `/plan-feature` | 2 | Planning | Spec → acceptance criteria → test matrix → ADR stub |
| `/spec-review` | 2 | Pre-kick-off | Fact-check a plan or spec before scaffolding — PASS / PASS WITH NOTES / BLOCKED |
| `/scaffold` | 2 | Kick-off | Types, skeleton implementations, test stubs |
| `/investigate` | 2 | Debugging | Cause map + candidate fixes — no code edits |
| `/validate` | 2 | Quality gate | Spec coverage, invariants, auth/data safety checks |
| `/deploy` | 2 | Release | Pre-flight checklist, blast radius, rollback plan, changelog |
| `/handoff` | 2 | Post-ship | Runbook, debug guide, open items |

### Supporting routines

| Command | Tier | When to run | Purpose |
|---------|------|-------------|---------|
| `/hardening` | 2 | Pre-milestone | Security, resilience, observability gap analysis |
| `/doc-refactor` | 2 | Post-MVP / after refactors | Normalize README, docs/, ADRs, Mermaid diagrams |
| `/test-expand` | 1/2 | After milestones | Identify untested branches, propose new tests only |
| `/sweep` | 1/2 | Daily/weekly | Stale TODOs, unused imports, debug logs, config duplication |
| `/techdebt` | 3 | Continuous | Scan for debt → TECHDEBT.md; or propose/apply framework patches |

### Environment

| Command | Purpose |
|---------|---------|
| `/workbench` | Launch / stop / inspect the 6-tile tmux multi-repo development workbench |
| `/frame-standup` | Sync repos, audit latest daily-logger post, present interactive prioritized day plan |
| `/frame-dev` | Start/stop/status all Frame OS dev servers; outputs clickable URL guide |

### Starting new projects

| Command | Purpose |
|---------|---------|
| `/scaffold-app` | Scaffold a brand-new application from a canonical template — creates files on disk |

Three templates available: `langgraph-app` (Express + LangGraph + Carbon + SQLite), `browser-extension` (Vite + 5-package extension), `python-scraper` (Pydantic + httpx + SQLite FTS5 + MCP). The template specs live in `domain-knowledge/app-templates.md`.

### Phase-based commands

| Command | Phase | Purpose |
|---------|-------|---------|
| `/push-all` | POC / rapid iteration | Safe commits with secret scanning and smart messages |
| `/setup-ci-cd` | POC → MVP | One-shot CI/CD: pre-commit hooks, GitHub Actions, coverage gates |

### Project-specific commands (cv-builder)

| Command | Purpose |
|---------|---------|
| `/agent-debug` | Diagnose LangGraph state machine failures — graph map, cause trace, no edits |
| `/pr-review` | PR audit: correctness, LangGraph invariants, auth checks, logging, test coverage |
| `/screenshot-audit` | Classify visual regression screenshots: regressions vs. intentional vs. false positives |

### Discovery and analysis

| Command | Purpose |
|---------|---------|
| `/recon` | Codebase reconnaissance report |
| `/summarize` | Summarize a file or selection |
| `/roadmap` | Generate or update product roadmap |
| `/adr` | Create, list, search, or update Architecture Decision Records in `decisions/adr/` |
| `/observe` | Triage logs/metrics/alerts (Sentry, Prometheus, LangGraph-aware) |

### Skill management

| Command | Purpose |
|---------|---------|
| `/skill-create` | Turn a reusable workflow or session pattern into a convention-compliant skill directory |
| `/skill-loader` | Examine a repo and produce an install plan: which skills to add, keep, or remove |
| `/daily-logger` | Load the daily-logger architecture context (4-phase pipeline, council-of-experts, personas) |

### Recommended lifecycle order

```
/plan-feature → /spec-review → /scaffold → [implement] → /investigate (if needed)
→ /test-expand → /validate → /hardening → /deploy → /handoff
                                    ↑
                              /techdebt (continuous)
                              /sweep (weekly)
```

---

## Architecture

**Two layers:**

### 1. `.claude/commands/*.md` — Claude Code slash commands (primary)
Pure prompt files. `$ARGUMENTS` is replaced by user input. No build step. Add a new command by creating a new `.md` file. Updating the `.md` file automatically updates both Claude Code and the `core-workflow` CLI (the TypeScript engine reads it at runtime).

### 2. `packages/` — TypeScript engine (supporting)

| Package | Role |
|---------|------|
| `@core/workflows` | Core library: types, parser, registry, LLM wrapper, file-backed workflow factory |
| `@core/cli` | `core-workflow` binary — joins argv, calls `runWorkflow`, prints output |
| `vscode-extension` | VS Code extension — `core.runSlashCommand` command, output channel |

**Key files in `@core/workflows`:**

| File | Role |
|------|------|
| `src/types.ts` | `WorkflowContext`, `WorkflowArgs`, `WorkflowSpec`, `WorkflowRegistry` |
| `src/parseCommand.ts` | `parseSlashCommand(raw)` |
| `src/registry.ts` | Maps slash names → `WorkflowSpec`. Register new workflows here. |
| `src/runner.ts` | `runWorkflow(raw, ctx)` — shared dispatch entry point |
| `src/llm.ts` | `callClaude(system, user)` — wraps `@anthropic-ai/sdk` |
| `src/fileBackedWorkflow.ts` | Factory: loads `.claude/commands/<name>.md`, replaces `$ARGUMENTS`, calls Claude |
| `src/subagent.ts` | `logTechDebtIncident(incident, cwd)` — programmatic `/techdebt` trigger |
| `src/utils/diff.ts` | `applyUnifiedDiff()` — pure TS, no external deps |
| `src/workflows/techdebt/schema.ts` | `TechDebtIncident`, `TechDebtProposal` types |
| `src/workflows/techdebt.ts` | `/techdebt` handler (scan / propose / apply modes) |

## Domain knowledge

`domain-knowledge/` contains reference files read by commands when context is needed:

- `frame-os-context.md` — **agent context brief**: product vision, two demo tracks, full repo inventory, shell blockers, roadmap phases, architectural decisions, env vars, constraints
- `cv-builder-architecture.md` — monorepo packages, agent graph structure, P0 blockers, `.agents/` system, open issues map
- `langgraph-patterns.md` — state schema rules, node/routing invariants, checkpointer behavior, common failure signatures
- `shared-stack.md` — Carbon Design System components, JWT auth pattern, LangGraph node signature, SSE, RAG, structured logging
- `tripplanner-architecture.md` — 11-phase SSE pipeline, 6 itinerary lens views, agent graph, issue index
- `blogengine-architecture.md` — multi-tab dashboard, media/podcast responder, ToneCheckerNode, library tab, issue index
- `mrplug-architecture.md` — browser extension package map, bundle limits, provider factory, prompt injection attack surface
- `purefoy-architecture.md` — Python knowledge base (Roger Deakins), bbPress scraper, Pydantic leaf models, MCP server, roadmap
- `app-templates.md` — canonical file structures, dependency versions, and config patterns for the three scaffold-app templates
- `tbcony-dia-context.md` — TBCoNY/Dia AI-native product philosophy (Samir Mody talk): assistant-centricity, model behavior discipline, eval/hill-climbing, prompt injection as UX, "internet computer" framing
- `daily-logger-architecture.md` — daily-logger pipeline (collect → draft → council → synthesize), persona format, council-of-experts pattern, CI orchestration, invariants
- `coding-standards.md` — TypeScript rules, forbidden patterns, naming conventions, skill file structure, PR standards, ADR quality guide

Always read `frame-os-context.md` first for cross-repo work. Commands that audit or debug project code should also read the relevant architecture file(s). The shared-stack file covers patterns common to cv-builder, TripPlanner, and BlogEngine. `/scaffold-app` reads `app-templates.md` directly. `/daily-logger` reads `daily-logger-architecture.md`.

## Personal knowledge

`personal-knowledge/` contains Jim Green's career and application context. **Not installed into sibling repos** (core only). Read when generating career artifacts, tailoring applications, or mapping Frame OS features to job requirements.

- `tbcony-job-target.md` — TBCoNY Design Engineer listing, requirements mapping, gap analysis, application strategy
- `jim-green-profile.md` — career profile, skills inventory, Concur tenure (stub — to be filled in), cv-builder agent instructions

## The `.agents/` system (cv-builder complement)

cv-builder has a separate `.agents/registry.json` that defines programmatic agents (`pre-commit-validator`, `issue-manager`, `pr-manager`, etc.) invokable via Claude Code natural language triggers. This is **complementary**, not competing:

- `.agents/` = triggered automation (runs automatically on events or NL invocation)
- `.claude/commands/` = interactive structured workflows (invoked explicitly with `/command`)

## Adding a new command

**Claude Code only:** Create `.claude/commands/mycommand/mycommand.md`. Done — available immediately as `/mycommand`. Add `knowledge/` subdirectory for reference material and `scripts/` for deterministic utilities.

**Also in CLI/TypeScript:** The file-backed factory picks it up automatically once registered in `src/registry.ts`:
```typescript
mycommand: fileBackedWorkflow("mycommand", "short description"),
```

## `/techdebt` path allowlist

`mode=apply` only patches `packages/workflows/**`, `domain-knowledge/**`, `decisions/**`, `.claude/commands/**`, `skills/**`. Enforced in `src/workflows/techdebt.ts:isAllowedPath()`. Full allowlist documented in `.claude/commands/techdebt/knowledge/allowed-paths.md`.
