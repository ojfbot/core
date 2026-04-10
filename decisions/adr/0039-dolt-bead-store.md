# ADR-0039: Dolt as BeadStore backend

Date: 2026-04-10
Status: Accepted
OKR: 2026-Q1 / O1 / KR3
Commands affected: /gastown, /frame-standup
Repos affected: core, gastown-pilot, shell

---

## Context

FilesystemBeadStore (ADR-0016) stores beads as JSON files under `~/.beads/`. This works for single-agent scenarios but has critical limitations for multi-agent coordination:

- **Last-write-wins**: No transaction semantics. Concurrent writes can corrupt bead state.
- **No queryability**: Every query requires scanning all JSON files in all prefix directories.
- **No history**: Changes are destructive overwrites. No rollback, no audit trail beyond the JSONL event log.
- **No branching**: Cannot experiment with bead state changes before committing them.

Gas Town v1.0 (Yegge) specifies Dolt as the storage backend — SQL queryability with Git-like version control. Every mutation becomes a Dolt commit, enabling save-game rollback and transparent multi-agent audit trails.

## Decision

Add DoltBeadStore as an alternative BeadStore implementation backed by Dolt (MySQL-wire-compatible). Dolt runs as a launchd daemon on port 3307 with the database at `~/.beads-dolt`. FilesystemBeadStore remains the default; `BEAD_STORE=dolt` switches to DoltBeadStore.

Security boundary: Only core (session/task beads via hooks) and shell/Mayor write to Dolt. Sub-apps expose read-only `/api/beads` projections over their own data — they never get direct Dolt access.

## Consequences

### Gains
- SQL queryability: `WHERE type = 'session' AND status = 'live'` instead of scanning files.
- Git-like history: Every bead mutation is a Dolt commit. Full audit trail with `dolt log`.
- Transaction safety: MySQL-level isolation prevents concurrent write corruption.
- Branching: Can create Dolt branches to experiment with state changes.
- GasTownPilot panels (BeadsView, AgentTree, ConvoyTracker) read from Dolt — real data instead of stubs.

### Costs
- New dependency: Dolt must be installed (`brew install dolt`) and running (launchd daemon).
- Port usage: 3307 is reserved for Dolt sql-server.
- Complexity: Two BeadStore implementations to maintain (filesystem + Dolt).
- mysql2 package added to core workspace.

### Neutral
- FilesystemBeadStore remains the default and is not deprecated. It's simpler for testing and CI.
- Sub-app bead projections are unchanged — they continue to serve their own data shapes.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| SQLite | No Git-like versioning, no branching. Would need custom audit log. |
| PostgreSQL | Heavier dependency, no built-in version control. Overkill for local-first. |
| Filesystem with JSONL changelog | Already have this — insufficient for concurrent multi-agent writes. |
| Direct Dolt access from sub-apps | Dolt lacks row-level security. Sub-app isolation would be convention-based, not a real security boundary. |
