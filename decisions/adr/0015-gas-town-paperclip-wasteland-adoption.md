# ADR-0015: Gas Town + Paperclip + Wasteland as the multi-agent coordination layer

Date: 2026-03-09
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Commands affected: /gastown
Repos affected: core, core-reader, shell, cv-builder, blogengine, tripplanner, purefoy, gastown-pilot (future)

---

## Context

Frame is evolving from a UI shell hosting static sub-apps to a living multi-agent workspace where autonomous agents do real work, coordinate across app domains, and maintain persistent state between sessions. Two problems had no solution:

1. **Agent identity and work continuity.** Agents had no persistent identity across browser sessions. When the browser closed, all in-flight work was lost. There was no hook model, no crash recovery, and no way for an agent to resume where it left off.

2. **Multi-agent coordination.** The shell had no way to assign work to sub-app agents, track progress across app boundaries, or govern autonomous agent spending. Sub-apps operated as isolated islands with no shared work primitive.

We evaluated this with no prior budget and no formal decision process — the decision was made through rapid research and validated against our existing architecture. We are explicitly noting that this was adopted as an experiment direction that will be stripped out if it fails.

---

## Decision

Adopt Gas Town execution patterns (A-series), Paperclip governance patterns (G-series), and Wasteland federation (W-series) as Frame's multi-agent coordination layer, translated into Frame vocabulary and implemented as a three-layer model:

```
Governance plane  (shell)        ← Paperclip: goal_parent, budget, approval gates, audit trail
Execution plane   (agent-graphs) ← Gas Town: FrameBeads, hooks, GUPP, molecules, mail
Experience plane  (browser-apps) ← Frame: Carbon UI, Module Federation, human interaction
```

**Gas Town** provides the execution primitives: `FrameBead` as the universal work item, the hook model for work assignment, GUPP as the self-propulsion rule, and molecules for checkpointable multi-step workflows.

**Paperclip** provides the governance overlay: token budget tracking per agent, `goal_parent` links from work items up to OKRs, approval gates at sling time, and a heartbeat-based health protocol.

**Wasteland** provides the federation layer (deferred to Sprints 10+): a Dolt-backed shared work queue connecting Gas Town instances via a reputation system (stamps, character sheets, trust tiers).

Each layer has exactly one owner. Layers do not cross. Frame's vocabulary wins at all boundaries (e.g. Gas Town's "polecat" becomes Frame's `worker` agent; Paperclip's "CEO" becomes `mayor`).

---

## Consequences

### Gains

- **Agent persistence:** agents survive browser close via `AgentBead` + hook model. Work resumes without user prompt.
- **Crash recovery:** molecule checkpointing (NDI) means a crash between steps resumes at last completed step — no lost work.
- **Cross-app coordination:** Shell Mayor can sling beads to any sub-app witness. Mail and handoff enable inter-agent communication without tight coupling.
- **Governance without a control plane:** Paperclip's budget and approval patterns give the user oversight over autonomous spending without requiring a separate service.
- **Community contribution surface:** Wasteland federation lets Frame participate in a shared work queue (wanted items) with portable reputation. Frame can post its own roadmap items for community contribution.
- **Incremental adoption:** A-series is independent of G-series; G-series is independent of W-series. Each adoption delivers standalone value. Sequence is enforced: A(N) must be adopted in `core` before A(N+1) ships in any sub-app.

### Costs

- **New primitives to maintain:** `FrameBead`, `BeadStore`, `AgentBead`, `FrameMolecule`, `FrameConvoy`, `FrameEvent`, `FrameMail` — all owned by `core`. Any breaking change in `core` ripples to all sub-apps.
- **Vocabulary translation overhead:** Gas Town and Paperclip have strong domain vocabularies. Every agent reading source material must consult `domain-model.md` to map terms. Wrong vocabulary at boundaries is a persistent maintenance risk.
- **Dolt dependency (W-series):** Wasteland federation requires a local Dolt server and `gt` CLI installation. This is an external binary dependency, not a pnpm package. Operators must install it manually before W1 work begins.
- **Schema instability (W-series):** Wasteland schema is v1, early days. Yegge explicitly says they expect to rebuild it twice. All Dolt queries must be absorbed at the `WastelandDoltClient` layer, never coupled to `FrameBead` type definitions.
- **Experiment risk:** Gas Town and Paperclip are external projects with their own roadmaps. Breaking changes in `gt` CLI flags or Dolt schema could invalidate our integration layer with no warning.

### Neutral

- GasTownPilot will be a new sub-app (`gastown-pilot`, port 3017) — adds to the Frame app registry but follows established Module Federation remote patterns.
- The `/gastown` skill handles ongoing adoption auditing and sprint planning; it does not implement adoptions itself.
- W-series requires W0 (hands-on learning with actual Wasteland tools) before any code — this is a protocol requirement, not an engineering constraint.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Custom bead schema (no Gas Town dependency) | We would rebuild the same primitives (hooks, GUPP, molecules, NDI) with worse documentation and no community validation. Gas Town has 2,400 PRs of battle-testing. |
| Plain LangGraph state for agent coordination | LangGraph manages graph-level state, not cross-agent, cross-session work assignment. Hook model + GUPP fills the gap LangGraph doesn't address. |
| Linear / GitHub Issues as work primitive | Neither supports typed status lifecycle, molecule attachment, hook pointers, or agent-readable structured fields without significant wrapping. |
| Adopt Paperclip as runtime (npm install) | Paperclip is a control plane with its own React UI and Express server. Wrapping it as a Module Federation remote fights its architecture. Pattern adoption without package dependency is the right boundary. |
| Ignore Wasteland (local-only) | Wasteland is the only path to a portable contributor reputation system and community-contributed wanted items. The federation value doesn't exist without it. Deferred (not abandoned) — W0 is mandatory first. |
| Separate governance service (external API) | Adds network boundary for every hook assignment and approval. Paperclip patterns as in-process labels on `AgentBead` achieve the same governance without a service dependency. |

---

## Open questions (to resolve during execution)

1. **`gt wl` flag syntax:** Exact flags for `gt wl post` and `gt wl done` are assumed (`--title`, `--description`, `--effort`, `--commit`). Must be confirmed via `gt wl --help` during W0 before any CLI proxy code is written.
2. **Dolt database name:** The Wasteland Commons database name is assumed to be `wasteland_commons`. Confirm after first `gt wl join`.
3. **BeadStore backend migration:** A-series starts with a filesystem `FilesystemBeadStore` (JSON files in `~/.beads/`). Long-term migration to Dolt (Git-semantics SQL) is a known future path but is not part of this decision.
4. **Rollback trigger:** If the Gas Town hook model is found incompatible with LangGraph's checkpointer at A3, we will strip A3+ and keep only A1+A2 (FrameBead + AgentBead as typed primitives without the prime node pattern).
