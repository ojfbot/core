# ADR-0040: Claude session beads for meta-coordination

Date: 2026-04-10
Status: Accepted
OKR: 2026-Q1 / O1 / KR3
Commands affected: /frame-standup, /orchestrate
Repos affected: core

---

## Context

When multiple Claude Code sessions work in parallel (e.g. two `/frame-standup` runs across different repos, or a session implementing features while another runs audits), they have no awareness of each other. This leads to:

- **Conflict risk**: Two sessions modify the same file or create PRs against the same branch.
- **Duplicate work**: Sessions re-discover context that another session already surfaced.
- **No audit trail**: After sessions end, there's no record of what was attempted, what succeeded, and what was abandoned.

Beads (ADR-0016) already model work primitives. Extending them with `session` and `pr` types creates a natural coordination layer.

## Decision

Add `session` and `pr` to the BeadType union. Claude Code hooks emit beads to Dolt on skill invocation, git commits, and PR creation. Session beads act as convoys wrapping task-level beads.

Hook integration (synchronous, ~200ms per tool call):
- **PostToolUse (Skill)**: Create session bead if none exists for this Claude session.
- **PostToolUse (Bash: git commit)**: Create task bead, link to session bead.
- **PostToolUse (Bash: gh pr create)**: Create PR bead, link to session bead, increment session pr_count.

Cross-session awareness: Before starting work, `/frame-standup` queries `SELECT * FROM beads WHERE type = 'session' AND status = 'live'` to surface active sessions and prevent conflicts.

## Consequences

### Gains
- Parallel Claude sessions can detect each other and avoid conflicts.
- Every session produces a bead trail — what skills were invoked, what was committed, what PRs were created.
- Session beads enable retrospective analysis: which sessions were productive, which abandoned work.
- GasTownPilot can visualize active sessions in real time.

### Costs
- ~200ms latency added to each Skill, git commit, and gh pr create call (synchronous hook).
- Requires Dolt sql-server running (ADR-0039).
- Session tracking file at `/tmp/claude-bead-session-<id>` — ephemeral, cleared on reboot.

### Neutral
- Session beads are closed when the session ends. Stale sessions (process crash) remain `live` until manual cleanup or maintenance patrol.
- Hook only fires when `.claude/settings.json` is configured — opt-in per repo.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Shared lock file | No audit trail, no queryability, single point of contention. |
| Redis pub/sub | External dependency, ephemeral (no history), overkill for local dev. |
| Filesystem marker files | Same problems as FilesystemBeadStore — no transactions, no query. |
| Async hooks | Risk of bead not existing when next action checks for it. Synchronous guarantees ordering. |
