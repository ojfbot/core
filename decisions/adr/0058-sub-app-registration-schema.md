# ADR-0058: Sub-app registration schema

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /workbench, /install-agents
Repos affected: core (schema/, registrations/, .claude/skills/workbench)

---

## Context

The launcher in [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md) reads one JSON file per managed sub-app and brings up tmux windows, dev servers, and Claude sessions from those declarations. The schema is the contract between the launcher (mechanism) and each rig (configuration). It must cover the full cluster — Frame web apps (`shell`, `cv-builder`, `blogengine`, `tripplanner`), non-Frame rigs (`beaverGame`, `asset-foundry` per [ADR-0051](0051-rigprofile-workbench-partition.md)), Express APIs, and headless Claude sessions — without re-deriving rig identity or bead routing that other ADRs already settled.

Originally drafted as ADR-003 in the 2026-04-30 handoff; renumbered to fit `core/decisions/adr/` flat numbering. The master series lives at [ADR-0056](0056-developer-day-orchestration-master.md).

Two existing types in the cluster constrain the design:

- `RigProfile` from [ADR-0051](0051-rigprofile-workbench-partition.md) already partitions rigs into `frame` and `non-frame`. The launcher reads that profile to decide tmux placement and start-command dispatch. A registration schema that re-defined rig-level fields would fork that taxonomy.
- `BEAD_PREFIX_MAP` at `core/packages/workflows/src/types/bead.ts:95-105` is the single source of valid rig ids in the cluster. [ADR-0052](0052-bead-prefix-reservations-non-frame.md) reserves the non-Frame additions on top of it. A registration `id` field that drew from a parallel enum would let a typo in one file silently disagree with bead routing.

The schema reuses both.

## Decision

Publish two artifacts:

- `core/scripts/launcher/schema/registration.schema.json` — JSON Schema 2020-12 document.
- `core/scripts/launcher/REGISTRATION_GUIDE.md` — author-facing companion.

Per-rig registrations live at `core/scripts/launcher/registrations/<id>.json`. The schema defines structure; the guide defines intent.

### Schema shape (informal sketch; canonical form in the JSON Schema file)

```json
{
  "schema_version": "1.0.0",
  "id": "frame",
  "display_name": "Frame Shell",
  "rig_profile": "frame",
  "repo": {
    "url": "https://github.com/ojfbot/frame",
    "local_path": "~/code/ojfbot/frame",
    "branch": "main"
  },
  "priority_tier": "active",
  "panes": [
    {
      "name": "dev",
      "command": "pnpm dev:all",
      "size": "60%",
      "split": "horizontal",
      "ready_signal": { "type": "stdout_match", "pattern": "ready on http://localhost:4000" }
    },
    {
      "name": "claude-headless",
      "command": "claude --print --resume frame-headless --rig frame",
      "size": "20%",
      "split": "vertical"
    },
    {
      "name": "tests",
      "command": "pnpm test:watch",
      "size": "20%",
      "split": "vertical"
    }
  ],
  "claude_sessions": {
    "headless": { "rig": "frame", "role": "headless", "consume_beads": true },
    "interactive": { "rig": "frame", "role": "interactive", "auto_attach": false, "key_binding": "cmd+alt+1" }
  },
  "status_signals": {
    "needs_attention": [
      { "type": "bead_status", "value": "awaiting_review" },
      { "type": "process_exit", "any_pane": true }
    ]
  },
  "tags": ["frontend", "shell", "federated"]
}
```

### Extension relationship to RigProfile

The registration schema **extends** `RigProfile` ([ADR-0051](0051-rigprofile-workbench-partition.md)). It does not redefine the rig. The `rig_profile` field is the canonical `frame` / `non-frame` value from that ADR; the launcher reads it to dispatch the right start command and place the window in the right workbench partition. Launcher-specific concerns — `panes`, `claude_sessions`, `status_signals`, `priority_tier` — are the new fields this ADR adds on top.

### Field semantics

- `schema_version` — string, semver. Pinned at `1.0.0` from first publish so additive changes (ADR-0064 display fields) bump cleanly.
- `id` — primary key. Enum sources from `BEAD_PREFIX_MAP` at `core/packages/workflows/src/types/bead.ts:95-105` (`core`, `cv`, `blog`, `trip`, `pure`, `seh`, `lean`, `gt`, `hq`, plus reservations under [ADR-0052](0052-bead-prefix-reservations-non-frame.md)). Used in tmux window names, bead routing, and the skill-telemetry `repo` field at `~/.claude/skill-telemetry.jsonl` ([ADR-0037](0037-skill-telemetry-and-intent-matching.md)). No parallel id space.
- `rig_profile` — `"frame"` or `"non-frame"` from [ADR-0051](0051-rigprofile-workbench-partition.md). Drives workbench partition (`wb-frame` vs `wb-games`) and `frame-dev.sh` start dispatch.
- `priority_tier` — `"infrastructure" | "active" | "dormant"`. Drives launch order and default visual status.
- `panes` — ordered list. First pane is primary. The launcher creates one tmux pane per entry within the rig's window.
- `ready_signal` — the launcher reports a window as `started` only after the named pattern appears on stdout. Until then the pane glyph stays in the `pending` state from [ADR-0059](0059-tmux-topology-and-visual-status-language.md).
- `claude_sessions` — two roles only: `headless` (consumes the AgentBead queue per [ADR-0043](0043-agent-bead-bridge.md); details in [ADR-0060](0060-dual-claude-session-model.md)) and `interactive` (a Claude Code session attached to a tmux pane). The handoff's `mayor` and `polecat` enum values fold into these two; the Gas Town role labels stay on the AgentBead per [ADR-0056](0056-developer-day-orchestration-master.md)'s naming map.
- `status_signals.needs_attention` — declarative conditions that flip the window into the `needs_attention` glyph. Reuses the bead status taxonomy from [ADR-0016](0016-framebead-work-primitive.md).
- `tags` — free-form filter labels for `wb-list`, telemetry queries, and future surfaces.

### Validation

- A pre-commit hook runs the schema validator on changed registrations.
- CI runs the validator across all files in `core/scripts/launcher/registrations/`.
- The validator checks referential consistency: `id` is in `BEAD_PREFIX_MAP`, `rig_profile` matches the file's containing partition, `claude_sessions.*.rig` equals the top-level `id`.

### Forward-looking

`display.screen` and `display.space` are deferred to `schema_version: "1.1.0"` and shipped with [ADR-0064](0064-hammerspoon-workspace-orchestration.md). The v1.0.0 schema is tmux-only.

### Markdown guide structure

The `REGISTRATION_GUIDE.md` covers five sections:

1. What a registration is and how the launcher reads it.
2. Field-by-field walkthrough (mirrors the semantics list above with rationale).
3. Three worked examples: a Frame web app (`cv-builder`), an Express-only API (`shell` agent gateway port 4001), an infrastructure service (`daily-logger` cron worker).
4. New-app checklist (add the id to `BEAD_PREFIX_MAP` first; pick a `rig_profile`; declare panes; pick `priority_tier`; run the validator).
5. Anti-patterns (parallel id enums, `display.*` in v1.0, baking secrets into `command`, more than three panes per rig).

## Consequences

### Gains

- One contract describes every managed sub-app; adding a rig is one JSON file plus a validator pass.
- `id` cannot drift from bead routing. A typo fails CI rather than mis-routing AgentBeads at runtime.
- `rig_profile` reuse means [ADR-0051](0051-rigprofile-workbench-partition.md) stays the single taxonomy source; the launcher and the workbench partition agree by construction.
- The two-role `claude_sessions` enum closes the `mayor` / `polecat` ambiguity from the original handoff. Session-model details land in [ADR-0060](0060-dual-claude-session-model.md) without a schema change.
- `schema_version` pinned at `1.0.0` from publish lets [ADR-0064](0064-hammerspoon-workspace-orchestration.md) ship `display.*` as a clean `1.1.0` without retrofitting.

### Costs

- Adding a non-Frame rig requires editing `BEAD_PREFIX_MAP` first (an [ADR-0052](0052-bead-prefix-reservations-non-frame.md) reservation), then writing the registration. Two-file change instead of one.
- The schema cannot describe macOS Spaces or display assignment until v1.1. Multi-monitor users run a single tmux session in v1.0.
- The pre-commit hook adds an `ajv-cli` (or equivalent) dependency to the core repo.

### Neutral

- Registrations live in `core/scripts/launcher/registrations/`, not in each sibling rig. Co-location with the launcher matches the [ADR-0056](0056-developer-day-orchestration-master.md) "one bootstrap" principle.
- The `tags` field is free-form on purpose; it carries no validator semantics until a downstream skill reads it.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Define a fresh rig taxonomy on the registration | Forks `RigProfile` ([ADR-0051](0051-rigprofile-workbench-partition.md)). The launcher and the workbench partition would diverge as soon as a non-Frame rig joined. |
| Let `id` be a free string | A typo in `cv-buidler.json` mis-routes AgentBeads silently. Sourcing from `BEAD_PREFIX_MAP` ([ADR-0052](0052-bead-prefix-reservations-non-frame.md)) catches it at validation. |
| Keep the handoff's `mayor` / `polecat` role enum | The Gas Town vocabulary is internal to design notes per [ADR-0056](0056-developer-day-orchestration-master.md)'s naming map. The schema is a config surface; it uses `interactive` / `headless`. |
| Ship `display.screen` / `display.space` in v1.0 | macOS Space management belongs to [ADR-0064](0064-hammerspoon-workspace-orchestration.md). Coupling the tmux launcher to Hammerspoon blocks the v1.0 slice. |
| Register an OTLP endpoint per rig | The cluster's event substrate is `~/.claude/skill-telemetry.jsonl` per [ADR-0037](0037-skill-telemetry-and-intent-matching.md). Adding OTLP introduces a substrate the team does not run. |
| Co-locate each registration in its own rig under `.claude/launcher.json` | Forces the launcher to clone every rig before it can plan a session. A flat `registrations/` directory in core is one read. |

## Acceptance criteria

- `core/scripts/launcher/schema/registration.schema.json` exists and validates against the JSON Schema 2020-12 meta-schema.
- `core/scripts/launcher/REGISTRATION_GUIDE.md` covers the five sections (intent, field walkthrough, three worked examples, new-app checklist, anti-patterns).
- A test in `tests/registrations.test.ts` validates every JSON file in `core/scripts/launcher/registrations/` and fails CI on schema violation.
- The schema's `id` enum sources from `BEAD_PREFIX_MAP` programmatically; the test verifies the schema's `id` enum matches the keys in `core/packages/workflows/src/types/bead.ts:95-105`.
- An agent given the guide and schema produces a valid registration for a previously-unregistered rig on the first try.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent); slice zero-point `_pending_` |
| Schema version at first publish | `1.0.0` |
| Implementation start | `_pending_` |
| Implementation end | `_pending_` |
| Originally drafted as | ADR-003 (handoff message, 2026-04-30) |
