# ADR-0055: User-scope baseline for Pocock skills + principles

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 / KR5
Commands affected: /grill-with-docs, /tdd, /deepen, /triage
Repos affected: core (source), all Claude Code sessions on this Mac (consumer)

---

## Context

The Matt Pocock skills (`/grill-with-docs`, `/tdd`, `/deepen`, `/triage`) and three core principles (grill-by-default, narrow vertical slices, ubiquitous design language) shipped via PRs #81–#85 land at project scope: they live under `ojfbot/core/.claude/skills/` and propagate to sibling ojfbot repos via `install-agents.sh <repo>`. Sessions opened outside an ojfbot repo — anywhere on this Mac — inherit none of them.

The user wants those skills and principles to become baseline across **every** Claude Code session on this Mac, including non-ojfbot work. Project-scoped distribution doesn't reach those sessions; user-scope (`~/.claude/`) does.

Project memory (`feedback_grill_default.md`) already documents grill-by-default for ojfbot sessions, but project memory is per-project — sessions outside that project don't load it.

## Decision

Establish a **user-scope baseline layer** at `~/.claude/`, separate from per-project `.claude/` setups:

1. The 4 Pocock skills are exposed to every session via symlinks: `~/.claude/skills/<skill>` → `/Users/yuri/ojfbot/core/.claude/skills/<skill>`.
2. The 3 principles live in `~/.claude/CLAUDE.md`, which Claude Code loads for every session on this Mac.
3. `scripts/install-agents.sh --user-scope` is the canonical command for setting up or repairing this layer. It is idempotent and uses managed-block markers (`<!-- managed:start -->` / `<!-- managed:end -->`) so re-running refreshes the principle text without clobbering user-added content below it.

## Consequences

### Gains
- Pocock skills are available without `cd`-ing into an ojfbot repo first.
- The 3 principles apply to non-ojfbot work too (sandbox repos, work scripts, anything outside ojfbot).
- One source of truth: skills are symlinked, so updates to core's `.claude/skills/` reach user-scope automatically.
- Reproducibility on other machines is a single command: `core/scripts/install-agents.sh --user-scope`.

### Costs
- Symlinks dangle if `/Users/yuri/ojfbot/core/` is moved or deleted. Recovery: re-run the install command after the move.
- Single-machine scope: another Mac (e.g., a work computer) requires its own clone of core at the same path before the install will work. Acceptable scope; not solved here.
- Non-ojfbot sessions invoking a Pocock skill may hit references to `CONTEXT.md` / `GLOSSARY.md` that don't exist locally. Skills are designed to degrade gracefully but this hasn't been exhaustively tested outside ojfbot. Verify post-install; fix in a follow-up if any skill hard-fails.

### Neutral
- Project-scope `feedback_grill_default.md` memory becomes redundant with user-scope CLAUDE.md. Keep as belt-and-suspenders; remove or update description in a future cleanup if desired.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Copy skills into `~/.claude/skills/` (no symlinks) | Drifts as core evolves; requires manual sync. Symlinks are zero-maintenance. |
| Bake principles into each project's CLAUDE.md | Doesn't reach sessions in projects without ojfbot's CLAUDE.md (the whole point of this ADR). |
| Keep at project scope, accept that non-ojfbot sessions miss the baseline | Defeats the goal: the user explicitly wants baseline coverage everywhere. |
| Symlink CLAUDE.md too | Edits to `~/.claude/CLAUDE.md` would write back to the repo, surprising. Managed-block approach lets the user add their own content below without leaking it into the source-controlled template. |
