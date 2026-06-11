# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Before making any architectural decisions or writing code across any ojfbot repo, read `domain-knowledge/frame-os-context.md`.** It covers the product vision, demo tracks, repo inventory, roadmap phases, and hard constraints that apply to all work in this cluster.

> **Default agent posture: grill before coding.** See `domain-knowledge/agent-defaults.md`. Before any non-trivial change, restate the request in one sentence, surface 2–3 assumptions, and ask the highest-leverage clarifying question. Skip only for trivial tasks (typos, direct lookups, explicit "just do it"). Cost of one question is far below cost of building the wrong thing.

> **Use pnpm, never npm.** Every install/run/test/exec invocation in this repo and across the ojfbot ecosystem uses pnpm — in CI workflows, scripts, READMEs, ADRs, commit messages, and any one-off bash. Add new sub-packages to `pnpm-workspace.yaml` and invoke them via `pnpm --filter <name> <script>`; do not shell out to `npm install` in a subdirectory. Use `pnpm dlx` instead of `npx`. CI uses `pnpm install --frozen-lockfile`. The presence of `pnpm-workspace.yaml` or `pnpm-lock.yaml` is the decisive signal. If a tool genuinely requires npm, surface it explicitly and ask before shipping the change.

> **User-scope baseline.** Grill posture, vertical-slice discipline, and ubiquitous-language sourcing (look for `CONTEXT.md` / `GLOSSARY.md`) are documented at user scope in `~/.claude/CLAUDE.md`, which applies to every Claude session on this Mac (including non-ojfbot work). The 4 Pocock skills (`/grill-with-docs`, `/tdd`, `/deepen`, `/triage`) are symlinked into `~/.claude/skills/`. Run `scripts/install-agents.sh --user-scope` to set up or repair the user layer. Add `--with-selfco` to also install the `/vault` skill at user scope, scaffold the `~/selfco` knowledge vault, register new repos as vault entities at spawn (ADR-0088), and add the opt-in `vault-session.sh` SessionEnd hook (see ADR-0085). See ADR-0055.

## Ecosystem

| Repo | Port(s) | Description | Phase | Status |
|------|---------|-------------|-------|--------|
| shell | 4000, 4001 | MF host compositor + frame-agent LLM gateway | 1.5 | active |
| cv-builder | 3000, 3001 | AI resume builder, MF remote | 1B | active |
| blogengine | 3005, 3006 | AI blog dashboard, Notion integration | 1B | active |
| TripPlanner | 3010, 3011 | AI trip planner, 11-phase SSE pipeline | 1B | active |
| lean-canvas | 3025, 3026 | 9-section AI business canvas | scaffold | active |
| purefoy | 3020, 3021 | Roger Deakins cinematography RAG | — | active |
| gastown-pilot | 3017, 3018 | Gas Town 6-tab dashboard, bead adapters | scaffold | active |
| seh-study | 3030, 3031 | NASA SEH glossary, Leitner spaced repetition | scaffold | active |
| core-reader | 3015, 3016 | Core repo browser, commands + ADRs tabs | 1A | active |
| core | — | Workflow engine, skill catalog + telemetry | — | active |
| daily-logger | — | Auto-committed dev log at log.jim.software | — | active |
| mrplug | — | Chrome extension MV3, AI UI/UX analysis | 2B | active |
| frame-ui-components | — | Shared Carbon DS component library | — | active |
| landing | — | Personal portfolio landing page | — | active |
| beaverGame | 5173 | Cozy 3D beaver simulator (Babylon.js migration) — consumes asset-foundry .glbs | 0 | active |
| asset-foundry | 3035 | AI-driven Blender asset pipeline (LangGraph + bpy) — Frame MF remote | 0 | active |
| github-actions | — | Shared GitHub Actions + reusable workflows for fleet CI (ADR-0067) | — | active |
| workstation-yuri | — | macOS workstation automation: Focus modes, wallpapers, iTerm2, Hammerspoon, future Swift app. Reads `core/scripts/launcher/registrations/`. Supersedes core ADR-0064. | 0 | scaffold |

## Skills

> **Note:** `.claude/commands/` has been renamed to `.claude/skills/` across all repos (see ADR-0021–0026). References below use the current `skills` convention.

```bash
# Install commands + domain-knowledge into any sibling ojfbot repo
./scripts/install-agents.sh <repo-name>          # e.g. cv-builder, shell, blogengine
./scripts/install-agents.sh <repo-name> --force  # overwrite existing symlinks

pnpm install                    # install all workspace dependencies
pnpm build                      # compile all packages
pnpm test                       # run vitest
pnpm test:watch                 # vitest watch mode
pnpm lint                       # ESLint (typescript-eslint)
pnpm lint:fix                   # ESLint with auto-fix
pnpm format                     # Prettier format all TS files
pnpm format:check               # Prettier check (CI-friendly)
pnpm typecheck                  # tsc --noEmit

pnpm --filter @core/workflows build   # build one package
pnpm vitest run packages/workflows/src/__tests__/parseCommand.test.ts

# CLI (after build)
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js "/plan-feature add user auth"
```

---

## Available slash commands

The primary interface is `.claude/skills/`. Each file is a `/command` in Claude Code. The TypeScript engine in `packages/` backs the same commands for CLI/CI use via `core-workflow`.

### Development lifecycle

| Command | Tier | Phase | Purpose |
|---------|------|-------|---------|
| `/grill-with-docs` | 2 | Alignment | Socratic alignment before planning. Updates CONTEXT.md, drafts ADR stubs in-loop. No code. ADR-0045 |
| `/plan-feature` | 2 | Planning | Spec → acceptance criteria → test matrix → ADR stub |
| `/spec-review` | 2 | Pre-kick-off | Fact-check a plan or spec before scaffolding — PASS / PASS WITH NOTES / BLOCKED |
| `/scaffold` | 2 | Kick-off | Types, skeleton implementations, test stubs |
| `/prototype` | 2 | Kick-off | Throwaway code that answers one question — terminal harness for logic edge cases, or N UI variants by URL param. Record the verdict, then delete. ADR-0083 |
| `/tdd` | 2 | Implementation | Red-green-refactor loop. Writes failing test first, verifies red, minimal change to green. Guidance only. ADR-0046 |
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
| `/deepen` | 2 | Architecture | Find shallow modules, propose Ousterhout-style deepening refactors. No edits. ADR-0047 |
| `/triage` | 2 | Backlog | Apply severity/effort/domain rubric to issues. Output: ordered backlog. ADR-0048 |
| `/techdebt` | 3 | Continuous | Scan for debt → TECHDEBT.md; or propose/apply framework patches |

### Environment

| Command | Purpose |
|---------|---------|
| `/workbench` | Launch / stop / inspect the 6-tile tmux multi-repo development workbench |
| `/frame-standup` | Sync repos, audit daily-logger, load standup extensions + diagram input, present prioritized day plan with orchestration dispatch |
| `/frame-dev` | Start/stop/status all Frame OS dev servers; outputs clickable URL guide |
| `/diagram-intake` | Read hand-drawn priority diagram, map to canonical repos, output structured per-app goals |
| `/orchestrate` | Progressive decomposition engine: plan → decompose → execute via 4-layer agent pipeline |

### Frame alignment (Gas Town / Paperclip / Wasteland)

| Command | Tier | Purpose |
|---------|------|---------|
| `/gastown` | 3 | Audit Gas Town adoption progress, plan sprint work, review GasTownPilot panels, sync GitHub roadmap issues. Four modes: `audit` (default) · `plan --sprint=N` · `pilot --panel=<name>` · `sync`. See ADR-0015. |

### Starting new projects

| Command | Purpose |
|---------|---------|
| `/scaffold-app` | Scaffold a brand-new application from a canonical template — creates files on disk |
| `/scaffold-frame-app` | Scaffold a new Frame sub-app (Module Federation remote) with 28-item validation checklist covering shell registration, Vercel deployment, MF config, and Carbon tokens |

Three templates available: `langgraph-app` (Express + LangGraph + Carbon + SQLite), `browser-extension` (Vite + 5-package extension), `python-scraper` (Pydantic + httpx + SQLite FTS5 + MCP). The template specs live in `domain-knowledge/app-templates.md`.

### Phase-based commands

| Command | Phase | Purpose |
|---------|-------|---------|
| `/push-all` | POC / rapid iteration | Safe commits with secret scanning and smart messages |
| `/setup-ci-cd` | POC → MVP | One-shot CI/CD: pre-commit hooks, GitHub Actions, coverage gates |
| `/git-guardrails` | Any time | State the dangerous-git policy; audit or wire `.claude/settings.json` deny/ask rules + an optional pre-push hook. ADR-0083 |

### Project-specific commands (cv-builder)

| Command | Purpose |
|---------|---------|
| `/agent-debug` | Diagnose LangGraph state machine failures — graph map, cause trace, no edits |
| `/pr-review` | PR audit: correctness, LangGraph invariants, auth checks, logging, test coverage |
| `/screenshot-audit` | Classify visual regression screenshots: regressions vs. intentional vs. false positives |

### Discovery and analysis

| Command | Purpose |
|---------|---------|
| `/recon` | Codebase reconnaissance report (full, cold-start) |
| `/zoom-out` | In-loop orientation for code you're already in: who calls this, what it depends on, blast radius if changed. No report file. ADR-0083 |
| `/summarize` | Summarize a file or selection |
| `/roadmap` | Generate or update product roadmap |
| `/adr` | Create, list, search, or update Architecture Decision Records in `decisions/adr/` |
| `/observe` | Triage logs/metrics/alerts (Sentry, Prometheus, LangGraph-aware) |
| `/caveman` | Ultra-compressed communication mode — drops filler, keeps technical accuracy. Stays on until "normal mode". ADR-0083 |

### Skill management

| Command | Purpose |
|---------|---------|
| `/skill-create` | Turn a reusable workflow or session pattern into a convention-compliant skill directory |
| `/skill-loader` | Examine a repo and produce an install plan: which skills to add, keep, or remove |
| `/daily-logger` | Load the daily-logger architecture context (4-phase pipeline, council-of-experts, personas) |
| `/vault` | Maintain the `selfco` **LLM Wiki** (`~/selfco`) — a Karpathy-style Obsidian vault (append-only `raw/` + LLM-owned `wiki/` of source/entity/concept/synthesis pages + `index.md` + `log.md`; the schema is `~/selfco/CLAUDE.md`). Thin wrapper. Modes: `init` · `ingest <path\|url>` · `research <topic>` · `query <q>` · `lint [--gate]` · `sync [--since=7d]` (folds the ojfbot activity feed into repo entity pages) · `orient` · `note` · `cultivate` (embedding-driven candidate suggestions via `semantic-suggest.py`). Distinct from `/daily-logger` (chronological blog) and `/bead` (per-repo handoff). See ADR-0085, `domain-knowledge/selfco-vault.md`, the Karpathy gist. |

### Writing pipeline

A three-step article pipeline (ADR-0083). Lives in `core` and is synced to sibling repos that publish prose (e.g. daily-logger, landing).

| Command | Step | Purpose |
|---------|------|---------|
| `/writing-fragments` | 1 — raw material | Interview the user to extract varied fragments (stories, claims, examples, objections); consolidate into a fragments file. No structure yet. |
| `/writing-beats` | 2 — structure | Structure the article as an ordered sequence of beats (reader-journey decision points); develop one beat at a time with sign-off. |
| `/writing-shape` | 3 — prose | Turn beat drafts into finished article prose, deciding the form (prose/list/table/callout/code/heading) of every paragraph. |

```
/writing-fragments → /writing-beats → /writing-shape → /council-review → publish
```

### Recommended lifecycle order

```
/plan-feature → /spec-review → /scaffold → /prototype (if a design branch is unclear)
→ [implement via /tdd] → /investigate (if needed)
→ /test-expand → /validate → /hardening → /deploy → /handoff
                                    ↑
                              /techdebt (continuous)
                              /sweep (weekly)   /zoom-out (any time you're lost in a file)
```

---

## Architecture

**Two layers:**

### 1. `.claude/skills/*.md` — Claude Code slash commands (primary)
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
| `src/fileBackedWorkflow.ts` | Factory: loads `.claude/skills/<name>/SKILL.md` (legacy `<name>.md` fallback), replaces `$ARGUMENTS`, calls Claude |
| `src/subagent.ts` | `logTechDebtIncident(incident, cwd)` — programmatic `/techdebt` trigger |
| `src/utils/diff.ts` | `applyUnifiedDiff()` — pure TS, no external deps |
| `src/workflows/techdebt/schema.ts` | `TechDebtIncident`, `TechDebtProposal` types |
| `src/workflows/techdebt.ts` | `/techdebt` handler (scan / propose / apply modes) |

## Skill telemetry and hooks

Three Claude Code hooks power skill observability across the Frame OS cluster (see ADR-0037):

| Hook | Event | Purpose |
|------|-------|---------|
| `scripts/hooks/log-skill.sh` | PostToolUse (Skill) | Logs every skill invocation to `~/.claude/skill-telemetry.jsonl` (async) |
| `scripts/hooks/suggest-skill.sh` | UserPromptSubmit | Matches prompt against `skill-catalog.json` triggers, injects skill suggestions |
| `scripts/hooks/pr-skill-audit.sh` | Standalone / GitHub Action | Analyzes PR diff to suggest relevant skills; cross-references telemetry for missed opportunities |

**Telemetry:** `~/.claude/skill-telemetry.jsonl` — central JSONL store. Each line: `{ts, skill, args, repo, session_id, source}`.

**GitHub Action:** `.github/workflows/claude-skill-audit.yml` — runs heuristic skill audit on every PR and posts a comment.

**Install:** `install-agents.sh` deploys hooks to sibling repos (section 6) and merges hook config into `.claude/settings.json`. The suggest-skill hook is installed at user level (`~/.claude/settings.json`) once.

**Opt-in hook:** `scripts/hooks/vault-session.sh` (SessionEnd, async) appends a one-line stub per session to `~/selfco/Inbox/session-stubs.md` for the `/vault` skill to fold in later. Not installed by default — `install-agents.sh --user-scope --with-selfco` adds it. No-ops if `~/selfco` isn't initialized. See ADR-0085.

## Claude Code configuration

This repo uses Claude Code's full feature surface beyond skills:

### Reusable prompts (`.claude/prompts/`)

Lightweight, composable prompts for recurring patterns that don't need a full skill directory. Invoked inline via prompt picker, complementing the skill catalog.

| Prompt | Purpose |
|--------|---------|
| `code-review.md` | TS quality checklist — types, errors, tests, security |
| `commit-message.md` | Conventional commit format with scope |
| `adr-review.md` | ADR completeness check (context, decision, consequences) |
| `type-safety-audit.md` | Audit for `any`, loose records, missing unions |
| `security-scan.md` | OWASP top-10 scan for files/diffs |
| `explain-for-pr.md` | Generate PR description from branch changes |

### MCP servers (`.claude/.mcp.json`)

Project-level MCP servers available to all sessions in this repo:

| Server | Purpose |
|--------|---------|
| `notion` | Read/write Notion docs — project documentation, roadmap sync |
| `github` | Typed PR/issue/repo access — richer than `gh` CLI for audit workflows |

### Hooks (`.claude/settings.json`)

| Hook | Event | Behavior |
|------|-------|----------|
| Auto-format | `PostToolUse` on `Write\|Edit` | Runs `prettier --write` on `.ts` files after every edit |

### Permissions

- **Deny rules**: Blocks editing `.env*`, `*.pem`, `*credentials*`, and running `rm -rf`
- **Allow list**: Scoped to install scripts, builds, tests, GitHub CLI, git operations

### Memory system

Persistent file-based memory at project scope (`.claude/projects/`) tracks user preferences, feedback, project context, and references across sessions. Index in `MEMORY.md`.

## Domain knowledge

`domain-knowledge/` contains reference files read by commands when context is needed:

- `CONTEXT.md` — **ubiquitous language layer (ADR-0044)**: 6 bounded contexts (Shell+Host Composition, Agent Graph, Workflow Engine, Gas Town Governance, Observation, UI Components), aggregates inside each, cross-context workflows, universal invariants, naming disambiguation
- `GLOSSARY.md` — A→Z one-liners for every non-obvious term, with source ADR/file cross-references
- `agent-defaults.md` — default grilling posture: restate, surface assumptions, ask the highest-leverage question, wait. Applies to every ojfbot session
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
- `selfco-vault.md` — the `selfco` LLM Wiki (`~/selfco`, Karpathy pattern: `raw/` + `wiki/`) and the `/vault` skill: layers, page schemas, the in-vault `CLAUDE.md` schema, modes (ingest/research/query/lint `--gate`/sync/cultivate/…), graph-UI config, opt-in `vault-session.sh` hook, semantic-suggest.py embeddings channel. ADR-0085, ADR-0088–0091
- `coding-standards.md` — TypeScript rules, forbidden patterns, naming conventions, skill file structure, PR standards, ADR quality guide

Always read `frame-os-context.md` first for cross-repo work. Commands that audit or debug project code should also read the relevant architecture file(s). The shared-stack file covers patterns common to cv-builder, TripPlanner, and BlogEngine. `/scaffold-app` reads `app-templates.md` directly. `/daily-logger` reads `daily-logger-architecture.md`.

## Personal knowledge

`personal-knowledge/` contains Jim Green's career and application context. **Not installed into sibling repos** (core only). Read when generating career artifacts, tailoring applications, or mapping Frame OS features to job requirements.

- `tbcony-job-target.md` — TBCoNY Design Engineer listing, requirements mapping, gap analysis, application strategy
- `jim-green-profile.md` — career profile, skills inventory, Concur tenure (stub — to be filled in), cv-builder agent instructions

## The `.agents/` system (cv-builder complement)

cv-builder has a separate `.agents/registry.json` that defines programmatic agents (`pre-commit-validator`, `issue-manager`, `pr-manager`, etc.) invokable via Claude Code natural language triggers. This is **complementary**, not competing:

- `.agents/` = triggered automation (runs automatically on events or NL invocation)
- `.claude/skills/` = interactive structured workflows (invoked explicitly with `/command`)

## Adding a new command

**Claude Code only:** Create `.claude/skills/mycommand/SKILL.md` (canonical body; ADR-0084). Done — available immediately as `/mycommand` and as `Skill(mycommand)`. Add `knowledge/` subdirectory for reference material and `scripts/` for deterministic utilities.

**Also in CLI/TypeScript:** The file-backed factory picks it up automatically once registered in `src/registry.ts`:
```typescript
mycommand: fileBackedWorkflow("mycommand", "short description"),
```

## `/techdebt` path allowlist

`mode=apply` only patches `packages/workflows/**`, `domain-knowledge/**`, `decisions/**`, `.claude/skills/**`, `skills/**`. Enforced in `src/workflows/techdebt.ts:isAllowedPath()`. Full allowlist documented in `.claude/skills/techdebt/knowledge/allowed-paths.md`.
