# ADR-0056: Developer Day Orchestration — Master

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /frame-standup, /diagram-intake, /workbench, /frame-dev, /orchestrate
Repos affected: core (skills, scripts, decisions), gastown-pilot (Intake tab), daily-logger (perRig schema), shell (registration map)
Supersedes: extends ADR-0038 (morning workflow); coordinates with ADR-0015, ADR-0016, ADR-0039, ADR-0043, ADR-0044, ADR-0051

---

## Context

The morning ritual produces three pencil bullets per rig on graph paper. The afternoon should turn those bullets into merged commits without intermediate copy-paste. Today the path runs through `/frame-standup` (ADR-0038) → `/diagram-intake` (ADR-0038) → `/orchestrate` (ADR-0038) → per-rig skills, but four pieces are missing:

1. The launcher that brings up tmux + dev servers + per-rig Claude sessions in a single command. ADR-0051 named the partition (`frame` vs `non-frame` workbench) but did not ship the implementation.
2. The visual status language so a glance answers "what is broken, what needs me, what is running."
3. The persistent Pilot intake surface so the photographed cards land in the same UI that watches the convoys roll in.
4. The reserved label keys on FrameBead (ADR-0016) that carry the *why*, the *priority*, and the *card image* across the morning's flow.

This master ADR sequences the ten child ADRs that close those gaps. None of them invent new substrate. Each one extends an existing skill, schema, or surface.

## Decision

Ship a series of ten child ADRs (0057–0065) that operationalize Developer Day on top of the existing infrastructure. The series treats the existing skills (`/frame-standup`, `/diagram-intake`, `/workbench`, `/orchestrate`) and types (FrameBead, AgentBead, RigProfile, ArticleDataV2) as load-bearing. New work fits into them.

| Child | Title | Scope |
| --- | --- | --- |
| ADR-0057 | Launcher mechanism under core/scripts/launcher | Implements `/workbench` (ADR-0051). tmux session builder + JSON registration schema. |
| ADR-0058 | Sub-app registration schema | Extends `RigProfile` (ADR-0051) with `panes`, `claude_sessions`, `status_signals`. Reuses `BEAD_PREFIX_MAP` ids. |
| ADR-0059 | tmux topology and visual status language | Five-state glyph + color set. Source lives at `.claude/skills/workbench/knowledge/status-language.md`. |
| ADR-0060 | Dual Claude session model | Headless polecat-equivalent consumes AgentBead queue (ADR-0043). Interactive attach is a Claude Code session in a tmux pane. |
| ADR-0061 | gastown-pilot Intake tab | Adds the seventh tab to gastown-pilot. Calls into the `/diagram-intake` parser (ADR-0038). Photo-only first slice. |
| ADR-0062 | Reserved FrameBead label keys | New reserved keys on the existing `labels: Record<string,string>` (ADR-0016): `why`, `priority_tier`, `source`, `card_image_uri`, `parent_id`, `decomposition_role`, `cross_rig_deps`. No type-shape change. |
| ADR-0063 | daily-logger perRig digest extension | Extends `ArticleDataV2` (`daily-logger/src/schema.ts`) with `perRig: Record<string, RigDigest>`. Same 09:00 UTC GitHub Action; no new schedule. |
| ADR-0064 | Hammerspoon workspace orchestration | macOS Spaces, displays, and key bindings. Lands after ADR-0057's tmux-only slice. |
| ADR-0065 | Zero-point and provenance convention | Empty commit per slice. Each slice runs on a branch in its target rig. Manifest at `core/decisions/orchestration/DD-2026-04-30.md`. |

### Naming map

The ojfbot tree keeps its on-disk names. Gas City vocabulary (Mayor, Polecat, Witness, Refinery) stays internal to design notes; user-facing surfaces continue to use `worker`, `witness`, `mayor` per gastown-pilot/CLAUDE.md:67.

| External design vocabulary | ojfbot on-disk / user-facing |
| --- | --- |
| Gas Town / Gas City | `gastown-pilot/`, `gastown_pilot` MF remote, `GasTownPilot` class |
| Mayor (workspace coordinator) | `mayor` role label on AgentBead (ADR-0043). No directory named "mayor". |
| Polecat (worker) | `worker` (ADR-0043 default). |
| Witness | `witness` per gastown-pilot vocabulary rule. |
| Refinery | The integration step. No process or directory needed. |
| Bead | `FrameBead` (ADR-0016). The "Frame" prefix stays on the type name. |

The map lives at `core/domain-knowledge/naming.md`. ADR-0057's first slice writes that file.

### Renumbering

The handoff message authored an external ADR-000..010 series. The series renumbers to ADR-0056..0065 to fit the existing `core/decisions/adr/` flat numbering. Cross-references in the children use the local numbers. The original handoff numbers appear once in each child's *Context* section as `(originally drafted as ADR-NNN)` for traceability.

## Consequences

### Gains
- One source-of-truth for the morning ritual that survives a fresh laptop and runs end-to-end.
- The launcher reuses `RigProfile` (ADR-0051) and `BEAD_PREFIX_MAP` (ADR-0052), so a new rig adds itself by editing one JSON file.
- The Intake tab consolidates planning, suggestions (ADR-0063), and convoy progress in one view.
- The reserved label keys (ADR-0062) keep FrameBead's flat `Record<string,string>` shape — zero migration cost across `core/packages/workflows`, `purefoy/packages/api/beads`, and `daily-logger/src/bead-store.ts`.

### Costs
- Ten ADRs ship together. Each one is small, but the orchestration manifest has to track them.
- The launcher introduces a Hammerspoon dependency (ADR-0064) on macOS; a fresh laptop runs `bootstrap.sh` and grants Accessibility, Screen Recording, and Automation permissions.
- gastown-pilot grows a seventh tab, with backend work to wire `/diagram-intake` parser into the API.

### Neutral
- The Gas Town adoption phases (ADR-0015 A1–A8) continue independently. This series neither accelerates nor blocks them.
- The skill telemetry substrate (`~/.claude/skill-telemetry.jsonl`, ADR-0037) is the event surface for the launcher; no OTLP / VictoriaMetrics introduction.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Treat the handoff ADR-000..010 as authored and merge them as-is. | Numbering collides with 0001–0055; a new repo (`daily-launcher/`) duplicates `/workbench` (ADR-0051); a `frame.*` namespace on FrameBead breaks ADR-0016's flat-labels shape; OTLP/VictoriaMetrics introduce a substrate the team does not use. |
| Build the launcher as a new ojfbot/daily-launcher repo. | One more repo to clone for the dev environment. The `/workbench` skill already lives in core; co-locating the implementation keeps one bootstrap. |
| Land everything as one big PR. | Loses the per-slice acceptance gate and the per-ADR Provenance trail (ADR-0065). |
| Skip the master and ship the children as ten unrelated ADRs. | Loses the "what is the developer day" framing that justifies any single child. The master is the index. |

## Acceptance criteria

- ADR-0056 lands on branch `adr-orchestration/dd-2026-04-30` in core/.
- The orchestration manifest at `core/decisions/orchestration/DD-2026-04-30.md` lists the zero-point SHA for this branch and one row per child ADR.
- Each child ADR carries the local frontmatter (Date, Status, OKR, Commands affected, Repos affected).
- Each child ADR's Context cross-references this master and at least one prior overlapping ADR (0015/0016/0038/0039/0043/0044/0051/0052/0053/0054/0055).
- A reader of this ADR alone can pick which child to start on and know what the end-of-day shape looks like.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` |
| Zero-point branch | `adr-orchestration/dd-2026-04-30` (off `main` at `c569cf4`) |
| Inspection plan | `~/.claude/plans/handoff-ojfbot-developer-velvet-rabin.md` |
| Manifest | `core/decisions/orchestration/DD-2026-04-30.md` |
| Originally drafted as | ADR-000 (handoff message, 2026-04-30) |
