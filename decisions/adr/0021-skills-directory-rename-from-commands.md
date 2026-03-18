# ADR-0021: Rename .claude/commands/ → .claude/skills/

Date: 2026-03-18
Status: Accepted
Supersedes: ADR-0003
OKR: 2026-Q1 / O2 / KR2
Commands affected: all 31 slash commands
Repos affected: core, and all 8 sibling repos via install-agents.sh

---

## Context

ADR-0003 established the skill-directory layout (`.claude/commands/<name>/`) and explicitly
rejected a top-level `skills/` name on the grounds that it would "break Claude Code
`.claude/commands/` autodiscovery." That rejection assumed Claude Code only scanned
`.claude/commands/`. The normative Claude Code project structure uses `.claude/skills/` as the
canonical location for reusable AI workflows — making our `commands/` naming non-standard and
inconsistent with how the broader Claude Code ecosystem names this concept.

Additionally, the directory name `commands/` conflated two different things: the slash-command
invocation surface (`/plan-feature`) and the underlying skill definition (a reusable, structured
prompt with knowledge and scripts). Calling them "skills" is semantically correct; calling them
"commands" describes how they are invoked, not what they are.

## Decision

Rename `.claude/commands/` → `.claude/skills/` in core and all 8 sibling repos. Add a
backward-compatibility symlink `.claude/commands → skills/` in every repo so that:

1. Claude Code continues to discover skills via its `.claude/commands/` scan path (the symlink
   makes the directory appear at the expected location).
2. Existing relative symlinks in sibling repos (`../../../core/.claude/commands/<name>`) continue
   to resolve — they traverse the compat symlink into `core/.claude/skills/<name>`.
3. `install-agents.sh` is updated to create `.claude/skills/` as the real directory and
   `.claude/commands → skills/` as a compat symlink in each target repo.
4. The TypeScript engine (`fileBackedWorkflow.ts`, `techdebt.ts`) is updated to resolve skill
   files from `.claude/skills/`.

The internal file naming convention (`<name>.md` within each skill directory) is unchanged.
The image-pattern convention of `SKILL.md` is not adopted — Claude Code discovers skills by
directory name, not by a fixed filename inside the directory.

## Consequences

### Gains
- Naming is consistent with the normative Claude Code project structure.
- "Skills" is semantically correct: the things in this directory are reusable AI workflows
  (skills), not commands (a UI/invocation concept).
- New contributors familiar with canonical Claude Code conventions will find the layout
  immediately recognisable.

### Costs
- ADR-0003 explicitly rejected this layout. Superseding it acknowledges that the original
  rejection reason was based on an incomplete understanding of Claude Code's symlink behaviour.
- The `install-agents.sh --force` migration path now carries a second migration layer
  (`.claude/commands/` real dir → `.claude/skills/`) which future maintainers must be aware of.

### Neutral
- The backward-compat symlink makes this a zero-downtime rename: nothing breaks at any point
  during or after the migration. ADRs that reference `.claude/commands/` remain historically
  accurate for the period they describe.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep `.claude/commands/` as canonical, add `.claude/skills/` alias | The alias direction should match the normative name — `skills/` is real, `commands/` is the compat alias. Reversing it would require updating this decision again when compat is removed. |
| Rename files to `SKILL.md` inside each skill directory | Claude Code does not key on a fixed filename inside the directory; it keys on the directory structure and the primary `.md` file matching the directory name. Renaming to `SKILL.md` would break skill discovery without adding value. |
| Leave as-is | Accumulates naming debt as the Claude Code ecosystem standardises on `skills/`. |
