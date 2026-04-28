# GLOSSARY.md — ojfbot terms A→Z

One entry per term. Definition first (≤2 sentences), source/file in parentheses, example or cross-reference where helpful. Companion to `CONTEXT.md` (which gives the relationships).

**Editing rule:** add a term here when it appears in code, ADRs, or skills and its meaning isn't obvious from context. Remove or supersede when the term is renamed or retired (note the supersession in-line).

---

## A

**ADR (Architecture Decision Record)** — A dated, sequentially-numbered markdown file documenting a non-obvious architectural decision: context, decision, consequences, alternatives. Lives in `decisions/adr/`. Template: `decisions/adr/template.md`. Created via `/adr new "<title>"`.

**Agent (Claude Code)** — A specialized subagent invoked via the `Agent` tool with a `subagent_type` (Explore, Plan, general-purpose, etc.). Distinct from Gas Town agents.

**Agent (Gas Town)** — A persistent worker with an identity and a hook. Roles: mayor, witness, worker (polecat), crew, deacon, dog. See CONTEXT.md § Gas Town Governance.

**AgentGraph** — A compiled LangGraph `StateGraph` with state schema, nodes, routing, checkpointer. Lives in each app's `packages/agent-graph/`. (`langgraph-patterns.md`)

**App / sub-app** — A Module Federation remote that mounts in shell. 4-package monorepo (`api`, `agent-graph`, `agent-core`, `browser-app`). Examples: cv-builder, blogengine, TripPlanner.

**App registry** — Single source of truth for which apps exist in the Frame OS. Read by shell at startup and by `frame-dev.sh`. (`shell-mf-integration.md`)

**AppFrame** — Runtime mount point in shell that loads a `RemoteComponent` and wraps it in `frame-fade-in` for swap animation.

## B

**Bead** — Atomic unit of work, identity, mail, and workflow steps. Lifecycle: CREATE → LIVE → CLOSE → DECAY → COMPACT → FLATTEN. ID prefix routes to a rig. (`gastown/knowledge/domain-model.md`, ADR-0033)

**Bead (skill artifact)** — A small dated markdown file produced by the `/bead` skill capturing a decision, gotcha, or report for inter-session continuity. Compatible with Gas Town bead schema. (`bead/bead.md`)

**BeadPrefixReservation** — Reserved prefix mapping rigs to their bead namespace (`core-`, `cv-`, `blog-`, `trip-`, `pure-`, `lean-`, `seh-`, `hq-`, `fnd-`, `bvr-`, `lib-`). Extends adoption-plan A1 prefix routing; works today with `/bead` markdown, migrates cleanly to A1 FrameBead. See CONTEXT.md §4 and ADR-0052.

**bead-session.sh** — Hook bound to PostToolUse(Skill) and PostToolUse(Bash) that captures session state for inter-session continuity.

**Bounded context (DDD)** — A region of the system where a particular language is consistent. ojfbot has six (CONTEXT.md): Shell + Host Composition, Agent Graph, Workflow Engine, Gas Town Governance, Observation, UI Components.

## C

**Carbon Design System** — IBM's design system. Source of every primitive UI component used in ojfbot. (`shared-stack.md`)

**Catalog (skill catalog)** — `.claude/skills/skill-loader/knowledge/skill-catalog.json`. Registry of all skills with triggers, tier, phase, tags. Drives `suggest-skill.sh`.

**Checkpointer** — LangGraph state persistence layer. Default: sqlite-vec (same DB as RAG). Allows resuming agent state across sessions.

**CLAUDE.md** — Per-repo file loaded into every Claude Code session. Holds repo-specific guidance, ecosystem table, skill list, defaults reference. Top of every session's context.

**ClosureSignal** — Evidence that a `StandupSuggestion` was correctly resolved. Two kinds: `bead-status` (linked bead lifecycle reached closed) and `audit-disappeared` (priority absent from next standup). Combined: bead-status when `bead_id` linked; audit-disappeared otherwise. See CONTEXT.md §5 and ADR-0054.

**Convoy** — A named group of related beads representing a feature or sprint. Tracks N/M progress. Frame term: `FrameConvoy`.

**Council** — Multi-persona review system. Personas in `personas/*.md` critique independently; synthesis merges. Used by daily-logger and `/council-review`.

**Crew** — Persistent specialist agent (long-running). Frame mapping of Gas Town `crew`.

## D

**Daily-logger** — Auto-committed dev log app at log.jim.software. 4-phase pipeline: collect → draft → council → synthesize. (`daily-logger-architecture.md`)

**Deacon** — Infrastructure daemon agent (heartbeat, health checks). Gas Town role; Frame mapping is shell health monitoring.

**Decisions/** — Repo directory containing `adr/` and `okr/`. In core, real directories. In siblings, symlinked from core for cross-repo read-only access.

**Deepen** — Skill `/deepen` (Phase 3, scaffolded as of 2026-04-28). Ousterhout-style depth analysis: find shallow modules, propose deepening refactors. Read-only by default.

**Dolt** — SQL database with Git semantics (branch/merge/PR/fork on tables). Backing store for Gas Town beads. DoltHub is the public remote.

**Dog** — Maintenance agent (Wisp Reaper, Compactor, JSONL Dog). Gas Town role; Frame `maintenance-patrol` formula.

## F

**Formula** — A TOML workflow definition that compiles to a molecule (chain of beads). Types: `workflow`, `expansion`, `aspect`, `patrol`. (`gastown/knowledge/domain-model.md`)

**Frame OS** — The Module-Federation-based application OS. Shell hosts; sub-apps are remotes. (`frame-os-context.md`)

**FrameBead** — Frame's adaptation of Gas Town's bead. Same shape and lifecycle (simplified to 4 stages). (ADR-0033)

**FrameDev** — Multi-app dev-server orchestrator (`scripts/frame-dev.sh`, surfaced as `/frame-dev`). Registers each runnable rig with start/stop/status; logs at `/tmp/frame-dev-logs/<app>.log`. Dispatches by `RigProfile`. See CONTEXT.md §3 and ADR-0051.

**frame-agent** — Single LLM gateway service (port 4001). All Anthropic calls in Frame OS go through it.

**frame-fade-in** — CSS class + `@keyframes` (150ms, Carbon easing) applied to every AppFrame swap for fade animation.

**frame-ui-components** — Shared Carbon-based component library consumed by every sub-app.

## G

**Gas Town** — Steve Yegge's multi-agent coding orchestrator. Manages 20-30+ parallel CLI coding agents. Source of bead/hook/GUPP/molecule vocabulary adopted by Frame.

**GasCity** — Wasteland-era federation node concept (forthcoming).

**Game Library** — TBD-named Frame sub-app for switching between game projects (beaverGame and future siblings). On the roadmap; not yet scaffolded. Reserved bead prefix: `lib-`. See ADR-0052.

**Glossary** — This file. Companion to CONTEXT.md.

**Grill / Grilling** — Default agent posture: restate the request, surface 2–3 assumptions, ask the highest-leverage clarifying question, wait. (`agent-defaults.md`)

**`/grill-with-docs`** — Skill that drives a Socratic alignment conversation while updating CONTEXT.md and staging ADR drafts in-loop. (Phase 1, scaffolded 2026-04-28; full body in this PR.)

**GUPP (Gas Town Universal Propulsion Principle)** — "If there is work on your hook, you must run it." The most important Gas Town design principle. Eliminates central scheduling.

## H

**Hook (Claude Code lifecycle)** — Shell script bound to a Claude Code event (PostToolUse, UserPromptSubmit, etc.) in `.claude/settings.json`. Examples: `log-skill.sh`, `suggest-skill.sh`, `bead-session.sh`. Distinct from Gas Town hooks.

**Hook (Gas Town)** — Pointer attached to an agent indicating which bead it should work on. Distinct from Claude Code hooks.

**Heuristic-analysis.sh** — Shell library sourced by `pr-skill-audit.sh`. Maps PR diff patterns to skill suggestions with tiers (1=mandatory, 2=recommended, 3=passive).

## I

**install-agents.sh** — Script in core that symlinks `.claude/skills/`, universal `domain-knowledge/` files, `decisions/`, and the repo-specific architecture file into a sibling repo. Run with `--force` to re-create stale links.

**Invariant** — A rule that must hold across the codebase. Universal invariants in CONTEXT.md § Universal invariants.

## L

**LangGraph** — The framework used to build agent state machines. Core abstraction: `StateGraph` with typed state, nodes, routing. (`langgraph-patterns.md`)

**Lens (UI)** — A viewing mode for the same underlying data, switched via `ContentSwitcher`. TripPlanner has 6 itinerary lenses; BlogEngine has tab-style lenses.

**log-skill.sh** — Hook bound to PostToolUse(Skill) that appends each invocation to `~/.claude/skill-telemetry.jsonl`. Async; never blocks.

## M

**Mail (Gas Town)** — Inter-agent message built on beads. Modes: direct, queued, broadcast. Distinct from email. Frame mapping: `FrameMail extends FrameBead`.

**Mayor** — Town-level coordinator agent that creates convoys, slings beads, dispatches work. Gas Town role; Frame implementation in shell.

**Module Federation (MF)** — The Webpack/Vite mechanism for runtime composition of separate apps into a single shell. ojfbot uses it instead of iframes. (ADR-0001)

**Molecule** — Chain of beads representing a multi-step workflow with checkpointing. Instantiated from a Formula. Frame: compiles to a LangGraph graph.

## N

**NDI (Nondeterministic Idempotence)** — Workflows are durable because molecule steps are atomic checkpoints. Any agent can resume any step.

**Nudge** — Operation to kick a stalled agent back into action. `gt nudge <agent>`.

## O

**OKR** — Objective + Key Results. Lives in `decisions/okr/`. Tracked alongside ADRs.

**Orchestrate** — Skill `/orchestrate`. 4-layer progressive decomposition pipeline: priorities → plan → execute via worktree-isolated agents.

**Ousterhout depth** — Module quality metric from "A Philosophy of Software Design": deep = simple interface × heavy implementation. Used by `/deepen`.

## P

**Paperclip** — Governance pattern source (separate from Gas Town). Frame adopts G-series patterns from Paperclip. (`gastown/knowledge/paperclip-patterns.md`)

**Persona** — Council member with a frontmatter + critique style, in `personas/<name>.md`.

**Polecat** — Ephemeral worker agent (single task). Gas Town role; Frame mapping is `worker` agent.

**pr-skill-audit.sh** — Hook (also runnable standalone) that analyzes a PR to suggest relevant skills. Two modes: telemetry (skills actually used) and heuristic (skills that should have been used given the diff).

**Prime node** — Pattern: agent reads its hook on startup and runs whatever's there. Implements GUPP.

## R

**RAG (Retrieval-Augmented Generation)** — Vector-store-backed retrieval used by every agent-graph app. Default store: sqlite-vec.

**Refinery** — Merge processor agent. Handles PRs, resolves conflicts. Gas Town role; built into Frame `witness`.

**RemoteComponent** — Module Federation remote loaded at runtime by AppFrame.

**Rig** — A codebase + its agent team (witness, refinery, crew, polecats). Each ojfbot sub-app is a rig.

**RigProfile** — Rig categorization (`frame` vs `non-frame`). Drives `install-agents.sh` skill applicability and `FrameDev` dispatch. See CONTEXT.md §4 and ADR-0051.

## S

**Seance (gt seance)** — Query a predecessor session's conversation history.

**Shell** — Module Federation host (port 4000). Owns app registry, routing, layout, theme. Repo: `shell`.

**Sibling repo** — Any ojfbot repo other than core. Receives skills + domain-knowledge + decisions/ via `install-agents.sh` symlinks.

**Sling** — Operation to assign a bead to an agent's hook. `gt sling <bead> <agent>`.

**Skill** — Orchestration prompt at `.claude/skills/<name>/<name>.md` plus optional `knowledge/` and `scripts/`. Invoked as `/<name>`. The user-facing primitive of the workflow engine.

**Skill catalog** — see *Catalog*.

**Skill telemetry** — `~/.claude/skill-telemetry.jsonl`. Append-only JSONL of every skill invocation.

**SSE (Server-Sent Events)** — Streaming pattern used to surface agent progress to the browser. Used by every agent-graph app.

**Stamp** — Reputation unit in Wasteland federation. Multi-dimensional: quality, reliability, creativity.

**StandupFunnel** — Measurement of `/frame-standup` Step 7 suggestions through four stages (suggested → launched → addressed → closed). Drop-off rates expose adoption vs. efficacy gaps. Telemetry in `~/.claude/standup-telemetry.jsonl`. See CONTEXT.md §5 and ADR-0054.

**StandupSuggestion** — A single follow-up action emitted by `/frame-standup` Step 7. Carries `suggestion_id`, `standup_id`, target `skill`, `priority_id`, `rationale`, optional `bead_id`. Logged via `scripts/hooks/standup-emit.mjs`. See CONTEXT.md §5 and ADR-0054.

**standup-emit.mjs** — Pure-Node JSONL appender at `scripts/hooks/standup-emit.mjs`. Commands: `suggested` (PR-X1) and `closed` (PR-X2). Writes to `~/.claude/standup-telemetry.jsonl`. Never blocks the skill flow — exits 0 on any error path.

**Standup telemetry** — `~/.claude/standup-telemetry.jsonl`. Append-only JSONL of `standup:suggested` and `standup:closed` events. Read by `/skill-metrics --funnel=standup` (PR-X2).

**suggest-skill.sh** — Hook bound to UserPromptSubmit. Matches user prompt against `skill-catalog.json` triggers; injects skill suggestions.

## T

**TDD** — Test-driven development. Skill `/tdd` (Phase 2, scaffolded 2026-04-28) enforces red-green-refactor.

**Telemetry** — Append-only JSONL stores at user level. `skill-telemetry.jsonl` (invocations); `suggestion-telemetry.jsonl` (suggestions).

**Tier (skill)** — 1 = mandatory suggestion, 2 = recommended, 3 = passive. In `skill-catalog.json` and in `heuristic-analysis.sh` rules.

**`/triage`** — Skill (Phase 4, scaffolded 2026-04-28) for issue-tracker triage with severity/effort/domain rubric.

**Trigger (skill)** — String in a skill's `triggers` array. Matched word-overlap by `suggest-skill.sh` against user prompts.

## U

**Ubiquitous language (DDD)** — Shared vocabulary used consistently in code, docs, prompts, conversations. CONTEXT.md + this glossary are the canonical artifacts. (Pocock framing.)

## V

**Validate** — Skill `/validate`. Pre-merge quality gate: spec coverage, TypeScript safety, auth, logging, tests.

## W

**Wanted Board** — Wasteland's shared work queue. Anyone can post; anyone can claim. (`gastown/knowledge/wasteland-spec.md`)

**Wasteland** — Gas Town's federation layer. Links thousands of Gas Town instances via shared Dolt Commons.

**Wisp** — Ephemeral bead, not persisted to Git. Used for patrol/maintenance.

**Witness** — Per-rig supervisor agent. Owns the merge queue, escalates problems. Gas Town role.

**Workflow Engine** — TypeScript runtime in `packages/workflows/` plus `.claude/skills/` files. Bounded context #3.

**Worker** — Frame mapping of Gas Town `polecat`. Ephemeral, spawned per task.

**Worktree (git)** — Isolated copy of the repo at a separate path. Used by `/orchestrate` for parallel agent execution without conflicts.
