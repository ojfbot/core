# ADR-0065: Zero-point and provenance convention

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /adr, /handoff
Repos affected: core (decisions/adr, decisions/orchestration), all rigs that host slice branches
Supersedes: clarifies the trail convention used implicitly across ADR-0040 (session beads), ADR-0042 (session initializer), ADR-0043 (AgentBead bridge)

---

## Context

The Developer Day series ([ADR-0056](0056-developer-day-orchestration-master.md)) hands work to Claude Code agents that may run in parallel, may take days to complete, and may resume on a different machine. Every agent's first commit needs to be a deterministic, traceable starting point that the rest of the work attaches to. Without that, the audit trail turns into archaeology when a slice picks up after a multi-day gap or when a fresh laptop replays the series.

The session-bead family already covers part of this ground. [ADR-0042](0042-session-initializer.md) defines how a Claude Code session opens with a bead that names its scope. [ADR-0043](0043-agent-bead-bridge.md) routes work between sessions through the AgentBead queue. Neither pins the git side: which branch, which empty commit, which message format, which manifest row. This ADR closes that gap.

`/Users/yuri/ojfbot` is not a git repo at the top level — it is a container of independent rig repos. The parent agent's zero-point lives on a `core` branch named `adr-orchestration/dd-<date>`. The 2026-04-30 instance landed at `5c2b13225c500af82431ea1a2c810951f9f8e895` on branch `adr-orchestration/dd-2026-04-30`. Each child slice runs on a branch in its target rig, where the target rig comes from the slice's `Repos affected` frontmatter line.

Originally drafted as ADR-010 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering.

## Decision

### The zero-point commit

Every Claude Code agent that picks up an ADR for execution makes its first commit before any substantive change. The commit:

- Touches no files (`git commit --allow-empty`).
- Carries this message format:
  ```
  chore(adr-0NNN): zero-point — <agent-id> <ISO-8601-UTC>

  ADR: decisions/adr/0NNN-<slug>.md
  Parent ADR: ADR-0056
  Commit policy: ADR-0065
  ```
- Targets the slice branch in the target rig. Branch naming: `adr-0NNN/<slug>` (four-digit number to match `core/decisions/adr/`).
- Carries the agent's signature when signing keys exist.

Examples of branch placement:

- ADR-0057 (launcher) → branch in core: `adr-0057/launcher-mechanism`
- ADR-0061 (Intake tab) → branch in gastown-pilot: `adr-0061/intake-tab`
- ADR-0063 (perRig digest) → branch in daily-logger: `adr-0063/perrig-digest`

### Recording the zero-point

The zero-point SHA lands in two places:

1. The slice ADR's Provenance table (the canonical record).
2. The orchestration manifest at `core/decisions/orchestration/DD-<date>.md`. The 2026-04-30 instance lives at `core/decisions/orchestration/DD-2026-04-30.md`. The manifest's slice table mirrors the zero-point and PR fields for at-a-glance status.

### Inspection-before-change

Slices that touch existing surfaces require an inspection commit between the zero-point and the first implementation commit. Inspection findings land at `core/decisions/inspections/0NNN-<slug>.md` (mirrors `core/decisions/adr/`). ADR-0061 reads the `/diagram-intake` parser and ADR-0062 reads FrameBead consumers — both ship an inspection commit. Slices that build only on green-field surfaces (ADR-0057's launcher scaffold, ADR-0058's registration schema) skip the inspection.

### Provenance section — required fields

Every ADR carries a Provenance table with at minimum:

- Zero-point SHA
- Inspection commit (if applicable)
- Implementation start (first non-empty commit on the slice branch)
- Implementation end (last commit before merge)
- PR number
- Convoy id (if landed via Gas City; otherwise blank)

### Why empty commits

An empty zero-point captures the state of the world before any change attributable to this slice. A `git log <branch>` on the slice branch shows the zero-point as the first row, the inspection commit (when present) as the second, and every implementation commit after. The branch reads like a timeline.

### Sub-agent fan-out

When a parent agent dispatches sub-agents (the master ADR's wave plan does this by design), the parent records the sub-agents' zero-point SHAs in the orchestration manifest's slice table — one row per sub-agent slice. The parent's own zero-point sits at the top of the manifest under "Parent zero-point SHA."

### Audit trail through skill telemetry

OTLP is not in the ojfbot tree (per the [ADR-0056](0056-developer-day-orchestration-master.md) inspection). The audit trail uses `~/.claude/skill-telemetry.jsonl` (ADR-0037). Every Claude Code skill invocation logs `{ts, skill, args, repo, session_id, source}`. This convention adds one rule on top: when a slice's branch lands, the merge commit message includes the line `ADR: 0NNN`. A `git log --grep "ADR: 0061"` in the gastown-pilot rig returns the slice's full timeline of commits.

### CI check

`core/scripts/check-provenance.sh` walks every ADR in `core/decisions/adr/`, parses its Provenance table, and verifies that each non-`_pending_` SHA exists in the matching rig's git history with a commit message matching the expected pattern. The script runs in core's PR CI on every PR that touches `core/decisions/adr/**`. A Provenance SHA that does not resolve fails the check.

## Consequences

### Gains

- Every slice has a deterministic starting commit. A reader of the ADR finds the zero-point SHA and replays the slice's history with `git log <sha>..HEAD`.
- The manifest at `core/decisions/orchestration/DD-2026-04-30.md` stays in sync with the slice ADRs because both record the same SHAs.
- `git log --grep "ADR: 0NNN"` in the target rig returns the slice's timeline without cross-repo joins.
- The CI check catches typo'd SHAs and forgotten Provenance updates before they merge.

### Costs

- One extra commit per slice (the empty zero-point). The cost is paid once per slice.
- The convention requires writing inspection commits for slices that touch existing surfaces, which adds one more commit before any implementation lands.
- Authors update both the ADR Provenance and the orchestration manifest in the same PR. Two file edits per landing.

### Neutral

- The convention does not require Gas City. Slices that ship through a bead get the AgentBead linkage from ADR-0043's `agent-sling` flow; slices that ship without a bead still produce a complete provenance trail through the ADR table and `git log`.
- The convention does not change FrameBead's shape. The reserved label keys in ADR-0062 are independent.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Single parent branch across all rigs | `/Users/yuri/ojfbot` is not a git repo. There is no top-level branch to land on. |
| Skip the empty zero-point; treat the first implementation commit as the start | Loses the "before any change" anchor. A reader cannot tell where the slice began without reading the diff of the first commit and inferring intent. |
| Record provenance only in the manifest, not in each ADR | The ADR is the durable artifact; the manifest is per-day. Six months from now the manifest is a historical document, the ADR is still the canonical record. |
| OTLP labels with `adr=NNN` | OTLP is not in the ojfbot tree (per ADR-0056). `~/.claude/skill-telemetry.jsonl` (ADR-0037) is the existing event surface. The merge-commit `ADR: 0NNN` line gives the same query power through `git log --grep`. |
| Bead evidence trail as a parallel record | The Provenance table on each ADR is the canonical record. ADR-0043's `agent-sling` flow already attaches commits to the agent hook when a bead exists for the slice — a separate convention duplicates the work. |

## Acceptance criteria

- Every ADR in `core/decisions/adr/` carries a Provenance section with at minimum: Zero-point SHA, Inspection commit (if applicable), Implementation start, Implementation end, PR number, Convoy id.
- A test slice runs the convention end-to-end. Proposal: ADR-0057 launcher first slice — empty zero-point on `core` branch `adr-0057/launcher-mechanism`, inspection-or-skip note, implementation commits, PR, manifest update.
- `core/scripts/check-provenance.sh` runs on every PR touching `core/decisions/adr/**` and fails if any Provenance SHA cannot be resolved in the target rig's history.
- The orchestration manifest at `core/decisions/orchestration/DD-2026-04-30.md` updates entry-by-entry as each slice progresses. The manifest update lands in the same PR as the slice itself.
- A `git log --grep "ADR: 0061"` in the gastown-pilot rig returns the ADR-0061 slice's full commit timeline.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (this slice; identical to the parent zero-point — this ADR is the convention) |
| Inspection commit | not applicable (green-field convention) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
| PR | _pending_ |
| First ADR to use this convention end-to-end | _pending — proposed: ADR-0057 launcher first slice_ |
| CI check version | `1.0.0` |
| Originally drafted as | ADR-010 (handoff message, 2026-04-30) |
