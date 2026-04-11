# ADR-0043: AgentBead Bridge

**Status:** Accepted
**Date:** 2026-04-10
**Deciders:** Jim Green
**Supersedes:** Partially supersedes ADR-0042 (session beads replaced by agent beads)

## Context

ADR-0042 introduced a two-tier session initializer that creates a `type: 'session'` bead for every Claude Code session. This works but produces anonymous, flat beads with no identity, role, hook pointer, or parent-child chain.

Meanwhile, the Gas Town A2/A3 primitives are fully implemented in TypeScript:
- `AgentBead` type with `role`, `app`, `agent_status`, `hook`, `reports_to`, `budget_*` labels
- `sling()` — assign work to an agent's hook
- `runPrimeNode()` — GUPP routing (hook, execute, mail, await)
- `nudge()` / `clearNudge()` — signal stalled agents

The gap: nothing in the hook/CLI layer uses them. The bridge between the CLI shim layer (`bead-emit.mjs`, `session-init.sh`) and the TypeScript domain layer doesn't exist.

## Decision

Replace anonymous session beads with proper AgentBeads. Every Claude Code session creates or resumes an AgentBead (worker role by default). When `/orchestrate` spawns child agents, they get their own worker AgentBeads with `reports_to` pointing to the parent.

### Key design choices

1. **Sessions are cattle, agents are pets.** Agent identity is per-app+role, not per-session. Opening two sessions in TripPlanner resumes the same `trip-agent-worker` bead (updating its `session_id` label). Agent beads persist across sessions with `agent_status` cycling `active -> idle -> active`.

2. **CLI-first bridge.** Three new `bead-emit.mjs` commands (`agent-create`, `agent-idle`, `agent-sling`) provide the CLI shim. They use raw SQL for ~200ms hook speed, matching the existing command pattern.

3. **No full Gas Town required.** We use the TypeScript types and functions already built, connecting them to the CLI layer. No `gt` CLI, no tmux session management, no Wasteland/DoltHub federation, no LangGraph agent-graphs.

4. **Task/PR beads slung onto agent hooks.** When `git commit` or `gh pr create` fires, the resulting task/PR bead is slung onto the agent's hook via `agent-sling`. This creates the Gas Town work-assignment chain.

## Agent identity model

| Scenario | Agent ID | Behavior |
|----------|----------|----------|
| Single session in TripPlanner | `trip-agent-worker` | Created on first session, resumed on subsequent |
| `/orchestrate` spawns worktree agents | `trip-agent-worker-<hex>` | Each with `reports_to: <parent>` |
| Shell session in core | `core-agent-worker` | Standard worker |
| Future: shell mayor | `hq-agent-mayor` | Cross-app coordinator |

## Changes

### bead-emit.mjs — 3 new commands

- `agent-create --role=worker --app=<app> --session-id=<sid> [--reports-to=<id>]` — create or resume agent
- `agent-idle --agent-id=<id>` — mark agent idle (session ending)
- `agent-sling --agent-id=<id> --bead-id=<id>` — assign work to agent hook

### session-init.sh — agent-create replaces session-start

The UserPromptSubmit hook now calls `agent-create --role=worker` instead of `session-start --skill=none`. The sentinel file (`/tmp/claude-bead-session-*`) contains the agent bead ID.

### bead-session.sh — agent context for task/PR beads

- `git commit` creates a task bead and slings it onto the agent's hook
- `gh pr create` creates a PR bead and slings it onto the agent's hook
- Skill invocations record on the session (backward-compat) and reference the agent

### /orchestrate — child agents with reports_to

Layer 3 worktree agents get their own AgentBead with `--reports-to=<orchestrator-agent-id>`. Tasks are slung onto child agent hooks and registered as convoy slots.

### /init — agent brief

Session brief shows agent identity: ID, role, hook status.

## Consequences

### Positive
- Every session has a persistent agent identity conforming to Gas Town norms
- Parent-child agent chains enable supervision (orchestrator -> workers)
- Task/PR beads on agent hooks create auditable work-assignment trails
- Existing convoy tracking integrates naturally (convoy slots reference agent IDs)

### Negative
- Agent bead resume logic adds a query on every session start (~50ms)
- Sentinel file now contains agent ID not session ID — any code reading it must adapt
- `active-sessions` command name is now slightly misleading (returns agents too)

### Risks
- Parallel sessions in the same repo both try to resume the same agent bead — mitigated by the `--reports-to` disambiguation suffix
- Agent beads accumulate over time — will need garbage collection for idle agents older than 7 days (maintenance-patrol, future work)
