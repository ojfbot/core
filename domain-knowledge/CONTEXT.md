# CONTEXT.md — ojfbot ubiquitous language

Single source of truth for the language we use across ojfbot. Bounded contexts, the aggregates inside each, the workflows that cross them, and the invariants that must hold.

**Audience:** agents first, humans second. Dense bullets and short paragraphs. Skim from top; jump via anchors.

**Companion:** `GLOSSARY.md` (A→Z one-liners). `frame-os-context.md` (product layer — vision, demo tracks, roadmap). This file is the *language layer*.

**How to update:** add a term here only when it appears in code or docs and lacks a canonical definition. Cross-link to the source ADR or domain-knowledge file. When you add an ADR, ask whether a CONTEXT.md term needs to change — the heuristic-analysis Tier 1 rule will flag this on PR.

**Distributed:** symlinked into every sibling repo via `install-agents.sh`. Edit here; siblings see the live version.

---

## Bounded contexts

Six contexts, drawn by concern, not by repo. A repo may participate in multiple contexts (e.g. cv-builder lives in Agent Graph + Observation).

### 1. Shell + Host Composition

Where Frame OS apps are mounted, navigated, and rendered.

**Aggregates**
- `Shell` — Module Federation host (port 4000). Owns app registry, routing, layout, theme. Repo: `shell`.
- `App` (sub-app) — MF remote, identified by `appType` (`cv-builder`, `blogengine`, etc.). Each is a 4-package monorepo (`api`, `agent-graph`, `agent-core`, `browser-app`).
- `AppFrame` — runtime mount point in shell that loads a `RemoteComponent`. Wraps every app in `frame-fade-in` for swap animation.
- `frame-agent` — single LLM gateway (port 4001). All Anthropic calls go through it; sub-apps never call the SDK directly.

**Entities / value objects**
- `RemoteComponent`, `AppRegistry`, `SideNav`, `ShellHeader`, `CondensedChat`, `mayor` agent.

**Invariants**
- No iframes anywhere. Always Module Federation remotes.
- Sub-apps never import `@anthropic-ai/sdk` directly — calls go through `frame-agent`.
- App registry is the only source of truth for which apps exist; `frame-dev.sh` reads from it.

**See:** `frame-os-context.md`, `shell-mf-integration.md`, `shell-mayor-spec.md`, ADR-0001 (Module Federation), ADR-0029 (frame-agent gateway).

### 2. Agent Graph

LangGraph state machines that power cv-builder, blogengine, TripPlanner, purefoy. Shared patterns; per-app state schemas.

**Aggregates**
- `AgentGraph` — a compiled `StateGraph` instance. Has a state type, a set of nodes, a routing function, and a `Checkpointer`. Defined in `packages/agent-graph/`.
- `State` — the project-specific state schema. Each field has a reducer. Single source of truth for in-flight work; persisted by checkpointer.
- `Node` — async function `(state) => Partial<state>`. Owns a slice of state. Must handle LLM errors and return a valid partial — never throw into the graph.
- `Checkpointer` — persistence layer for state across runs. Default: `sqlite-vec` (same DB as RAG store).

**Entities / value objects**
- `Retriever` (RAG), `EmbeddingStore`, `SSEStream` (used to surface progress to browser), `ThreadId` (the unit of agent conversation continuity).

**Invariants**
- Every node returns a valid `Partial<State>` even on error. Errors are recorded as state, not thrown.
- Graph routing is pure — never mutates external systems; only reads state and returns the next node name.
- No `MemoryVectorStore` in production — sqlite-vec only. (Outstanding migration debt in 3 repos.)
- LangGraph state schemas live at `packages/agent-graph/src/state/schema.ts`.

**See:** `langgraph-patterns.md`, `shared-stack.md`, `cv-builder-architecture.md`, `tripplanner-architecture.md`, `blogengine-architecture.md`.

### 3. Workflow Engine (Skills + Hooks)

The infrastructure that turns prompts into structured workflows. Lives in core; symlinked into every sibling repo.

**Aggregates**
- `Skill` — orchestration prompt at `.claude/skills/<name>/<name>.md` plus optional `knowledge/` and `scripts/`. Invoked as `/<name>`. Source of truth for behavior.
- `SkillCatalog` — `.claude/skills/skill-loader/knowledge/skill-catalog.json`. Registry of all skills with triggers, tier, phase, tags. Drives the suggest-skill hook.
- `Hook` — shell script at `scripts/hooks/<name>.sh` bound to a Claude Code lifecycle event in `.claude/settings.json`. Three present: `log-skill.sh` (PostToolUse Skill — telemetry), `suggest-skill.sh` (UserPromptSubmit — recommendations), `pr-skill-audit.sh` (CI — coverage report). Fourth: `bead-session.sh` (PostToolUse Skill+Bash — session continuity).
- `Telemetry` — `~/.claude/skill-telemetry.jsonl` (invocations) and `~/.claude/suggestion-telemetry.jsonl` (suggestions). Append-only, JSONL, user-level.
- `WorkflowEngine` — TypeScript runtime in `packages/workflows/`. Provides `runWorkflow()` for CLI/CI use; reads the same `.claude/skills/` files via `fileBackedWorkflow`.

**Entities / value objects**
- `Tier` (1=mandatory, 2=recommended, 3=passive), `Phase` (planning, alignment, implementation, debugging, validation, release, etc.), `Trigger` (string array matched word-overlap by suggest-skill).

**Invariants**
- Every skill has both a `<name>.md` file and a `skill-catalog.json` entry, or the suggest-skill hook can't surface it.
- Skills are pure prompts — no side effects until the agent acts. The `$ARGUMENTS` placeholder is the user's text after `/<name>`.
- `mode=apply` skills (e.g. `/techdebt`) only patch paths in the allowlist (`packages/workflows/**`, `domain-knowledge/**`, `decisions/**`, `.claude/skills/**`).
- New skills land in core first. Sibling repos receive them via `install-agents.sh` symlinks.

**See:** ADR-0021–0026 (skill directory structure), ADR-0037 (skill telemetry), `skill-loader/knowledge/skill-catalog.json`, `agent-defaults.md` (default grilling posture for every session).

### 4. Gas Town Governance

The bead-and-hook protocol governing agent work, adopted from Steve Yegge's Gas Town. Frame's vocabulary wins at every boundary.

**Aggregates**
- `Bead` — atomic unit of all work, identity, mail, and workflow steps. Lifecycle: `CREATE → LIVE → CLOSE → DECAY → COMPACT → FLATTEN`. ID prefix routes to a rig (e.g. `gt-`, `hq-`, `cv-`).
- `Hook` (Gas Town sense) — pointer attached to an agent indicating which bead it should work on. **Distinct from Claude Code lifecycle Hooks (Workflow Engine context).** Disambiguate by context.
- `Convoy` — named group of related beads representing a feature or sprint. Tracks N/M progress.
- `Molecule` — chain of beads representing a multi-step workflow with checkpointing. Instantiated from a `Formula` (TOML template). Compiles to a LangGraph graph in Frame.
- `Rig` — a codebase + its agent team (witness, refinery, crew, polecats). Each ojfbot sub-app is a rig.

**Entities / value objects**
- Agent roles (mapped to Frame): `mayor`, `witness`, `worker` (polecat), `crew`, `deacon`, `dog` (maintenance). Routing: `mail` (direct/queued/broadcast), `sling` (assign), `nudge` (kick stalled), `handoff` (graceful session end).
- `Wisp` — ephemeral bead, not persisted to Git. Used for patrol/maintenance.
- `GasCity` — Wasteland-era federation node concept (forthcoming).
- `Wasteland` — federation layer linking Gas Town instances via shared Dolt Commons. `Stamp` (reputation), `Wanted Board` (shared queue), `Trust Ladder` (Registered → Contributor → Maintainer).

**Invariants — GUPP**
- *Gas Town Universal Propulsion Principle:* "If there is work on your hook, you must run it." Eliminates central scheduling. Every prime node implements GUPP.
- One bead on the hook at a time per agent.
- Mutations to bead state always go through the `gt` CLI (or its Frame equivalent), never direct DB writes.

**Frame mappings (source of truth: `gastown/knowledge/domain-model.md`)**
- `polecat` → `worker` agent. `crew` → `crew` agent. `mayor` → `mayor` agent. `witness` → `witness` agent.
- `bead` → `FrameBead`. `hook` (assignment) → `hook` field on `AgentBead`. `convoy` → `FrameConvoy`. `molecule` → `FrameMolecule`. `formula` → `Formula` (TOML).

**See:** `gastown/knowledge/domain-model.md`, `gastown/knowledge/wasteland-spec.md`, `gastown/knowledge/paperclip-patterns.md`, ADR-0033 (FrameBead), ADR-0034 (Mayor), ADR-0043 (agent-bead-bridge), `bead/references/bead-schemas.md`.

### 5. Observation

The observability layer. What gets seen, by whom, where it lands.

**Aggregates**
- `DailyLogger` — auto-committed dev log. 4-phase pipeline: collect → draft → council → synthesize. Output: an article a day at log.jim.software.
- `Council` — multi-persona review agents. Personas live in `personas/*.md`. Council critiques independently, then a synthesis pass. Used by daily-logger and `/council-review` skill.
- `BeadSession` — file-based per-session record produced by the `bead-session.sh` hook. Captures decisions, gotchas, and reports for inter-session continuity.
- `Telemetry` — same JSONL stores as Workflow Engine context (skill-telemetry, suggestion-telemetry). Read by `pr-skill-audit.sh` for coverage reports.

**Entities / value objects**
- `Persona` (council member with frontmatter + critique style), `Article` (daily-logger output), `Mermaid diagram` (auto-rendered in articles), `Heuristic` (rule in `heuristic-analysis.sh` mapping diff patterns to skill suggestions).

**Invariants**
- Every day without a daily-logger entry is lost signal. The pipeline must run daily.
- Council critiques are independent — no shared scratch context between personas.
- Skill telemetry is append-only, JSONL, never edited in-place.

**See:** `daily-logger-architecture.md`, ADR-0037 (skill telemetry), `bead/bead.md`, `council-review/council-review.md`.

### 6. UI Components

Carbon Design System usage and the shared component library that wraps it.

**Aggregates**
- `frame-ui-components` — shared Carbon-based component library. Repo: `frame-ui-components`. Consumed by every sub-app via MF or workspace dependency.
- `Carbon` — IBM Carbon Design System. Source of `ContentSwitcher`, `DataTable`, `Accordion`, `Tile`, `Heading`, `Button`, `Search`, `Tag`, `StructuredList`, `TextInput`, `SideNav`.
- `DesignToken` — Carbon design token (color, spacing, motion easing). Always preferred over custom CSS values.

**Entities / value objects**
- `Dashboard` (multi-tab shell pattern), `CondensedChat` (persistent chat overlay), `LensSwitcher` (TripPlanner itinerary lenses, BlogEngine tabs).

**Invariants**
- Use Carbon primitives before introducing custom components. Custom CSS uses Carbon tokens.
- `CondensedChat` must never block critical controls. Responsive layout required.
- Sub-apps reuse `frame-ui-components` — no per-app re-implementations of shared components.

**See:** `shared-stack.md` § Carbon Design System, ADR-0011 (component library), `frame-os-context.md`.

---

## Cross-context workflows

The interactions where contexts touch.

### Skill invocation lifecycle (Workflow Engine + Observation)

1. User types `/<skill> [args]` or trigger phrase. → `suggest-skill.sh` (UserPromptSubmit) matches against `skill-catalog.json` triggers; if match, may inject suggestion.
2. Claude Code loads `.claude/skills/<name>/<name>.md`, replaces `$ARGUMENTS`, executes the prompt.
3. Skill may load `knowledge/<file>.md` JIT, or run `scripts/<name>.<sh|mjs>`.
4. On Skill PostToolUse: `log-skill.sh` writes invocation to `~/.claude/skill-telemetry.jsonl` (async, non-blocking). `bead-session.sh` updates session state.
5. On PR open/sync: `pr-skill-audit.sh` (GitHub Action) reads telemetry + diff, posts coverage report comment.

### Bead session protocol (Gas Town + Observation)

1. Session start: agent reads its hook (Gas Town sense). If a bead is on the hook, GUPP applies — agent runs it.
2. Substantive work, decision, or gotcha → `/bead` skill captures it as a small dated markdown file with structured frontmatter.
3. Session end (context fills, task done): handoff mail written to mailbox, session closes.
4. Future session reads the most recent beads in `.handoff/` to reconstruct context. `gt seance` queries predecessor history.
5. Bead schema is compatible with Gas Town / Beads / GasCity — beads can be ingested by downstream Gas Town tooling.

### install-agents distribution (Workflow Engine + every context)

1. Edit happens in core: a skill, an ADR, a domain-knowledge file, CONTEXT.md.
2. `./scripts/install-agents.sh <repo> [--force]` symlinks the universal set into a sibling: `.claude/skills/`, `domain-knowledge/{frame-os-context.md, app-templates.md, shared-stack.md, langgraph-patterns.md, workbench-architecture.md, tbcony-dia-context.md, CONTEXT.md, GLOSSARY.md, agent-defaults.md}`, `decisions/core/`, repo-specific architecture file.
3. Symlinks (not copies) — siblings always read the live core file. Drift impossible without explicit `--force` re-run that breaks links.
4. `--force` removes stale symlinks and re-creates from current core state.

### Council review (Observation + any document)

1. Draft document (article, spec, PR description, README) is the input.
2. `/council-review` loads `personas/*.md`, runs each independently against the draft.
3. Each persona produces a critique. Final synthesis pass merges critiques into an improved version.
4. Used daily by daily-logger pipeline (Phase 3); on-demand for any draft via the skill.

---

## Universal invariants

Apply to every repo, every change, every session.

1. **No iframes.** Always Module Federation remotes for embedding apps in shell.
2. **No direct Anthropic SDK calls in sub-apps.** Always through `frame-agent` (port 4001).
3. **pnpm + Node 24.11.1** (`.nvmrc` via `fnm use`). Never `npm` or `yarn`. Never another Node version.
4. **Branch + PR for everything.** Never push to main, even on new repos. Initial commits get a PR.
5. **Never merge with failing CI.** Fix first.
6. **Auth is gospel.** Every `/api/v2/` route has `authenticateJWT`. Every route touching a thread has `checkThreadOwnership`. Missing either = blocking finding.
7. **Logging via `getLogger('module')`.** No raw `console.*` in `packages/`.
8. **No `MemoryVectorStore` in production.** sqlite-vec only.
9. **Skills land in core first**, propagate via `install-agents.sh`.
10. **Grilling is the default agent posture.** See `agent-defaults.md`. Restate, surface assumptions, ask the highest-leverage question, wait. Skip only for trivial work.
11. **ADRs for non-obvious architecture decisions.** `decisions/adr/`, sequential 4-digit IDs, established template. Use `/adr new "<title>"`.
12. **CONTEXT.md updated alongside ADRs that introduce new terms.** Heuristic Tier 1 rule fires when this is missed.

---

## Naming disambiguation

Same word, different contexts. Resolve by surrounding context.

| Word | In Workflow Engine | In Gas Town |
|------|-------------------|------------|
| **Hook** | Shell script bound to Claude Code lifecycle event (PostToolUse, UserPromptSubmit) | Pointer on an agent to the bead it should work |
| **Mail** | n/a | Inter-agent message built on beads (direct/queued/broadcast) |
| **Bead** | n/a | Atomic unit of work + the file produced by `/bead` skill |

When in doubt, prefix: "Claude Code hook" vs. "Gas Town hook"; "skill telemetry" vs. "bead telemetry."

---

## See also

- `frame-os-context.md` — product layer (vision, demo tracks, repos, status)
- `agent-defaults.md` — default grilling posture for every session
- `app-templates.md` — canonical scaffold patterns (langgraph-app, browser-extension, python-scraper)
- `shared-stack.md` — the auth/Carbon/LangGraph/SSE/RAG patterns shared across cv-builder, TripPlanner, blogengine
- `langgraph-patterns.md` — node design, routing, checkpointer invariants
- `workbench-architecture.md` — multi-repo dev environment, tmux orchestration
- `decisions/adr/` — architectural decision records (43+ as of 2026-04-28)
- `GLOSSARY.md` — A→Z one-liners for every term used in this file
