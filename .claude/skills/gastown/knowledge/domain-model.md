# Gas Town Domain Model

Reference for `/gastown` all modes. Defines Gas Town's core terminology and maps each concept to its Frame equivalent.

---

## Gas Town at a glance

Gas Town is a multi-agent coding orchestrator by Steve Yegge. It manages 20–30+ parallel CLI coding agents (Claude Code, Codex, Gemini CLI) via tmux sessions. Roughly 2,400 PRs, 450+ contributors as of March 2026.

**Key insight:** sessions are cattle, agents are pets. The tmux session is ephemeral. The agent's identity, work state, and pending tasks are persistent.

---

## Core terminology

### Bead
The atomic unit of everything. Every work item, agent identity, hook, mail message, and workflow step is a Bead.

- **ID:** prefixed, e.g. `gt-abc12`, `hq-x7k2m`. Prefix routes to the rig.
- **Lifecycle:** `CREATE → LIVE → CLOSE → DECAY → COMPACT → FLATTEN`
- **Stored in:** Dolt database (Git-semantics SQL). Originally JSONL/SQLite.
- **Wisp:** ephemeral bead not persisted to Git. Used for patrol/maintenance work.
- **Frame mapping:** `FrameBead` — same shape, same lifecycle (simplified to 4 stages)

### Hook
A persistent pointer attached to each agent. Points to the bead the agent should be working on.

- Work gets on the hook via `gt sling`
- Checked by the agent at startup (GUPP rule)
- Only one bead on the hook at a time
- **Frame mapping:** `hook` field on `AgentBead`; persisted in `hooks.json`

### GUPP (Gas Town Universal Propulsion Principle)
"If there is work on your hook, YOU MUST RUN IT."

The single most important design principle. Eliminates central scheduling — each agent is self-propelled. The prime node implements GUPP.

### Agent roles

| Role | Purpose | Frame equivalent |
|------|---------|-----------------|
| **Mayor** | Town-level coordinator, creates convoys, slings beads, dispatches work | Shell `mayor` agent |
| **Deacon** | Infrastructure daemon, heartbeat monitor, health checks | Shell health monitoring |
| **Witness** | Per-rig supervisor, owns the merge queue, escalates problems | Per-app `witness` agent |
| **Refinery** | Merge processor — handles PRs, resolves conflicts | Built into `witness` |
| **Crew** | Persistent specialists (thinkers), long-running tasks | `crew` agent role |
| **Polecat** | Ephemeral workers, spawned for a single task | `worker` agent role |
| **Dog** | Maintenance agents — Wisp Reaper, Compactor, JSONL Dog | maintenance-patrol formula |
| **Boot** | Session initialization agent — bootstraps new sessions | prime node pattern |

### Rig
A codebase + its agent team. A rig has: a Witness, a Refinery, Crew, and a pool of Polecats.

Each rig has its own bead prefix (e.g., `gp-` for the Greenplace rig).
- **Frame mapping:** Each ojfbot sub-app is a rig (cv-, blog-, trip-, pure-)

### Convoy
A named group of related beads representing a logical feature or sprint.

```
gt convoy create "Auth feature" gt-abc gt-def gt-ghi
```

Convoys track progress: N/M beads done, M active, K blocked.
- **Frame mapping:** `FrameConvoy` — a bead of type `convoy` with `refs[]` to work beads

### Molecule
A chain of Beads representing a multi-step workflow with checkpointing.

- Instantiated from a **Formula** (TOML template)
- Frozen snapshots are called **Protomolecules**
- Each step has acceptance criteria
- Any agent can resume any molecule (molecule carries all context)
- **Frame mapping:** `FrameMolecule` — compiles to a LangGraph graph

### Formula
A TOML workflow definition. Formulas can extend other formulas, compose aspects, and expand macro steps.

```toml
formula = "my-workflow"
type = "workflow"   # or expansion | aspect | patrol
version = 1
[[steps]]
id = "step-1"
title = "Do thing"
needs = []
acceptance_criteria = ["thing done"]
```

Types:
- `workflow` — sequential/parallel multi-step process
- `expansion` — macro that expands into sub-beads
- `aspect` — mixin composed into other formulas
- `patrol` — maintenance work, usually runs as a wisp

### Mail
Inter-agent communication built on beads.

Delivery modes:
- **direct** — to a specific agent ID
- **queued** — first-come-first-served from a shared pool
- **broadcast** — to all agents on a channel

**Handoff mail:** When an agent's context fills up or finishes a task, it writes a summary mail to its own mailbox, kills the session. New session reads the handoff mail and continues.

`gt seance` — queries a predecessor session's conversation history.
- **Frame mapping:** `FrameMail` extends `FrameBead`, labels carry routing metadata

### NDI (Nondeterministic Idempotence)
Workflows are durable because molecule steps are atomic checkpoints. Any agent can resume any step. Crash between steps → restart at last checkpoint. No lost work.

### Dolt
A SQL database with Git semantics: branch, merge, PR, fork — on structured data. All Gas Town state lives in Dolt. DoltHub is the remote.

- MySQL-compatible SQL client
- `dolthub.com/repositories/steveyegge/beads` is the public bead store
- Each rig has its own Dolt branch
- **Frame consideration:** Long-term backend for `BeadStore` (replacing filesystem JSON)

---

## Wasteland (launched March 4, 2026)

Wasteland is Gas Town's federation layer — linking thousands of Gas Town instances via a shared Dolt "Commons" database.

### Key concepts

| Concept | Description |
|---------|-------------|
| **Wanted Board** | Shared work queue — anyone can post a work item for others to claim |
| **Stamp** | Reputation unit. Earned by completing Wanted items. Multi-dimensional: quality, reliability, creativity |
| **Character Sheet** | Per-rig profile: tier, total score, stamps, skills map, completed work count |
| **Trust Ladder** | Registered → Contributor → Maintainer (based on stamps + PRs) |
| **PR Protocol** | Wasteland work submitted as a PR to Commons Dolt DB. Validators stamp approved PRs |
| **Leaderboard** | Aggregated stamp scores across all Gas Town instances |

### `gt wl` commands
```bash
gt wl browse       # browse Wanted Board
gt wl claim <id>   # claim a Wanted item
gt wl done <id>    # submit completed work
gt wl stamps       # view your stamp history
gt wl sheet        # view character sheet
```

---

## `gt` CLI key commands

```bash
gt mayor attach          # tmux: talk to Mayor agent in NL
gt feed                  # TUI: Agent Tree + Convoy Panel + Event Stream + Problems View
gt dashboard             # htmx web dashboard (default port 8080)

gt sling <bead> <agent>  # assign bead to agent hook
gt nudge <agent>         # kick a stalled agent
gt handoff <agent>       # gracefully transfer agent work

gt convoy create <title> [beads...]   # create a convoy
gt convoy list                        # list active convoys

gt bead create <title>   # create a bead
gt bead close <id>       # close a bead
gt bead search <query>   # search beads

gt formula list          # list available formulas
gt formula pour <name>   # instantiate a formula as a molecule

gt doctor                # health check all agents and rigs
gt prime                 # initialize/resume the current agent
```

---

## Data flow in `gt dashboard` (SSE)

`gt dashboard` runs at `http://localhost:8080` and emits SSE events for:
- Agent state changes (idle → working → stalled)
- Bead creates, closes, slings
- Convoy progress updates
- Merge queue state changes
- Mail delivery events

GasTownPilot's API (port 3018) connects to this SSE stream and rebroadcasts it to the browser via WebSocket.

---

## Three-layer data architecture for GasTownPilot

```
GasTownPilot API (port 3018)
├── gt CLI adapter      — mutations: sling, convoy create, nudge, handoff
├── Dolt SQL client     — rich reads: bead search, agent aggregation, stats
└── gt dashboard SSE    — real-time: agent state, events, convoy progress
```

**Rule:** Mutations always go through the `gt` CLI adapter (uses Gas Town's own validation). Reads can go directly to Dolt for query flexibility. Real-time updates come from the SSE relay.

---

## Three-system vocabulary map

Frame adopts patterns from Gas Town and Paperclip. Frame's vocabulary wins at every boundary. Use this map when reading Gas Town docs, Paperclip docs, or when naming Frame types.

| Gas Town term | Paperclip term | **Frame term** | Notes |
|---------------|---------------|----------------|-------|
| polecat | employee (ephemeral) | `worker` agent | Spawned per task |
| crew | employee (permanent) | `crew` agent | Long-running specialist |
| mayor | CEO | `mayor` agent | Shell-level coordinator |
| witness | department head | `witness` agent | Per-app supervisor |
| deacon | n/a | deacon (health monitor) | Shell health watcher |
| refinery | n/a | built into `witness` | Merge conflict resolver |
| rig | department / team | sub-app domain | cv-builder, blogengine, etc. |
| convoy | project | `FrameConvoy` | Bead group, progress tracked |
| molecule | task sequence | `FrameMolecule` | Compiles to LangGraph graph |
| formula | template | `Formula` (TOML) | Declarative workflow definition |
| bead | task / work item | `FrameBead` | Universal work primitive |
| hook | assignment | agent hook | `hook` field on AgentBead |
| GUPP | autonomous execution | propulsion rule | "Work on hook → run it" |
| sling | hire / assign | `sling()` | Assign bead to agent hook |
| nudge | n/a | `nudge()` | Kick stalled agent |
| handoff | offboard | `handoff()` | Context-preserving session end |
| wisp | n/a | maintenance bead | Ephemeral, not git-persisted |
| protomolecule | n/a | formula snapshot | Frozen formula at pour time |
| company | workspace | workspace (future) | Not yet implemented |
| board / operator | user | user | Terminal authority node |
| n/a | heartbeat | `agent:heartbeat` event | 30s liveness signal |
| n/a | budget | `budget_limit`/`budget_spent` | Token spend governance |
| n/a | goal hierarchy | `goal_parent` label | OKR/Roadmap chain |
| Wasteland | n/a | Wasteland (future) | Federation layer |
| DoltHub | n/a | BeadStore backend (future) | Git-semantics SQL |

> See `knowledge/paperclip-patterns.md` for full G-series governance adoptions.

---

## Community projects (prior art)

| Project | Tech | Status | Steve's verdict |
|---------|------|--------|----------------|
| Avyukth/gastown_ui (issue #228) | SvelteKit | Mocked, no real data | "Great effort, lacks data connection" |
| web3dev1337/gastown-gui (PR #212) | Express + vanilla JS | Uses `gt` CLI as data source | "Impressive, publish as standalone companion" |

Both confirm community demand for a rich browser UI. Neither uses Module Federation, Carbon Design System, or LangGraph.
