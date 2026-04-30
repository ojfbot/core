# ADR-0060: Dual Claude session model

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /workbench, /orchestrate
Repos affected: core (.claude/skills/workbench, scripts/launcher, packages/workflows)

---

## Context

Each registered rig runs two Claude sessions with different lifecycles, different permission scopes, and different relationships to the bead queue. A headless session consumes work items autonomously. An interactive session sits dormant and attaches on demand for human review.

A single session that toggles between modes loses the distinction between "this is happening because the developer asked" and "this is happening because work was queued." Permission grants made for interactive review then leak into autonomous execution. The split keeps that boundary inspectable.

Originally drafted as ADR-005 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering. The series master is [ADR-0056](0056-developer-day-orchestration-master.md). The launcher that spawns these sessions is [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md). The agent identity model the headless session adopts is [ADR-0043](0043-agent-bead-bridge.md), which partially supersedes the session-bead model in [ADR-0042](0042-session-initializer.md).

## Decision

Each rig launched by `core/scripts/launcher/scripts/launch.sh` spawns one headless Claude session and reserves one interactive attach point. Both sessions run inside the same tmux window for the rig.

### Headless session

The headless session is an AgentBead consumer per [ADR-0043](0043-agent-bead-bridge.md). The launcher reads the rig's `claude_sessions.headless` block from its registration (ADR-0058) and:

- Issues `agent-create --role=worker --app=<rig> --session-id=<sid>` per [ADR-0043](0043-agent-bead-bridge.md). The agent identity is `<rig>-agent-worker`. Re-spawning the session resumes the existing AgentBead — sessions are cattle, agents are pets.
- Reads task beads from `~/.beads/<rig>/` per ADR-0016 and ADR-0039. Falls back to `DoltBeadStore` per ADR-0039 when the registration sets `bead_store: dolt`.
- On task completion, slings the resulting task or PR bead onto the agent's hook via `agent-sling` per [ADR-0043](0043-agent-bead-bridge.md).
- Emits skill-telemetry to `~/.claude/skill-telemetry.jsonl` per ADR-0037. That stream drives the window status transitions in ADR-0059.

The headless session has no interactive prompt. Output streams to the pane for visibility.

### Interactive session

The interactive session attaches via a tmux pane in the rig's window. The launcher does not pre-spawn it. It is created on demand by one of three triggers:

- `prefix + a` inside the rig's tmux window (ADR-0059).
- A registration-declared key binding routed through Hammerspoon (ADR-0064).
- A click on a needs-attention item in the gastown-pilot Intake tab (ADR-0061).

On any trigger, the launcher splits a new pane in the rig's window and runs `claude` with the rig's working directory as cwd. The pane closes when the developer detaches; the AgentBead identity persists per [ADR-0043](0043-agent-bead-bridge.md).

### Permissions

The headless session never runs with `--dangerously-skip-permissions`. The launcher passes a per-rig permission policy derived from the registration:

- Read everywhere inside the rig's worktree.
- Write only inside the rig's worktree.
- Network restricted to the registration's `network.allowlist` (ADR-0058). The default allowlist is the npm registry, the rig's GitHub remote, and the Anthropic API.
- Credential reads route to interactive approval.

A blocked operation surfaces as an approval prompt. If the interactive session is attached, the prompt renders in its pane. If not, the prompt queues to the gastown-pilot Intake tab as a needs-attention item per ADR-0061. The headless session blocks until the prompt resolves.

### Lifecycle

| Event | headless | interactive |
| --- | --- | --- |
| `launch.sh` start | Spawned per registration | Not spawned |
| First bead picked up | Window goes blue (ADR-0059) | No effect |
| Developer runs `prefix + a` | No effect | Attaches in new pane |
| Bead reaches `awaiting_review` | Emits a needs-attention signal; window goes yellow (ADR-0059) | Receives signal if attached; otherwise queues in the gastown-pilot Intake tab (ADR-0061) |
| Developer responds and detaches | No effect | Pane closes; agent identity persists per [ADR-0043](0043-agent-bead-bridge.md) |
| `launch.sh` stop | SIGTERM, releases bead claims | If attached, also stopped |

There is no per-rig coordinator process. The cross-rig coordinator role lives in `/orchestrate` per ADR-0038 when it is invoked. Auto-merge stays off across the launcher; PRs land via standard GitHub flow with one human review.

## Consequences

### Gains

- The permission boundary is inspectable. A headless session that needs to write outside the worktree must surface that fact to a developer.
- Agent identity persists across session restarts per [ADR-0043](0043-agent-bead-bridge.md). A crash of the headless session does not orphan its in-flight bead claim; restart resumes the same `<rig>-agent-worker`.
- The interactive attach is cheap. No long-lived idle Claude process per rig; the pane and process spawn at attach time.
- One bootstrap path. The launcher is the single entry to both sessions; there is no separate CLI to learn.

### Costs

- Two session lifecycles to reason about per rig. A developer debugging "why didn't this commit happen" must distinguish a headless block on permissions from an interactive session that was detached.
- The needs-attention queue (ADR-0061) becomes load-bearing. If gastown-pilot is down, queued approval prompts are not visible.
- Per-rig allowlist drift. Each registration declares its own `network.allowlist`; reviewing the fleet's network exposure means reading every registration.

### Risks

- A headless session that mis-classifies a write as in-worktree gains write access it should not have. Mitigation: the launcher resolves the worktree path at spawn and passes it as an absolute prefix; the policy compares against the resolved path, not a symlink.
- Two interactive sessions on the same rig (developer attaches twice) both resume the same AgentBead. ADR-0043 disambiguates with a `--reports-to` suffix; this ADR inherits that mitigation.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| One session per rig, toggle modes | Loses the permission boundary. Approvals granted for interactive review carry into autonomous execution. |
| Headless session as a long-running daemon outside tmux | Output disappears from the developer's view. The window status language (ADR-0059) depends on a visible pane. |
| Pre-spawn the interactive session at launcher start | Wastes an idle Claude process per rig. Fifteen rigs means fifteen idle sessions burning context. |
| Reuse [ADR-0042](0042-session-initializer.md)'s session beads instead of AgentBeads | ADR-0043 partially supersedes ADR-0042 for exactly this case. AgentBead carries `role`, `reports_to`, and `hook` that the launcher needs. |
| Route permission prompts to the macOS notification center | The notification disappears. The Intake tab persists the queue and survives a restart. |

## Acceptance criteria

- A registered rig launched via `launch.sh` has exactly one headless Claude session attached to its rig per [ADR-0043](0043-agent-bead-bridge.md).
- `prefix + a` inside the rig's tmux window opens an interactive Claude session in a new pane with the rig's worktree as cwd.
- A write outside the rig's worktree triggers an approval prompt that surfaces in the interactive session if attached, or in the gastown-pilot Intake tab otherwise.
- A network call to a host outside the registration's `network.allowlist` triggers the same approval flow.
- Closing the launcher gracefully releases all bead claims; the AgentBead transitions to `idle` per [ADR-0043](0043-agent-bead-bridge.md).
- No `gt` CLI is required to run the dual sessions.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent); slice zero-point `_pending_` |
| Zero-point branch | `adr-orchestration/dd-2026-04-30` |
| Claude CLI version pinned | `_pending_` |
| Permissions allowlist version | `1.0.0` |
| Originally drafted as | ADR-005 (handoff message, 2026-04-30) |
| Master | [ADR-0056](0056-developer-day-orchestration-master.md) |
