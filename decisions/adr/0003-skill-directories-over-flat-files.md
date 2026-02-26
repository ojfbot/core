# ADR-0003: Skill directories over flat command files

Date: 2026-02
Status: Accepted
OKR: 2026-Q1 / O2 / KR2
Commands affected: all 28 slash commands
Repos affected: node-template, and all sibling repos via install-agents.sh

---

## Context

The original `.claude/commands/` structure used flat `.md` files — one file per command. As commands matured, they accumulated reference material (checklists, schemas, templates) inline, making files unwieldy (400–600 lines). Claude Code has a context window budget; loading a 600-line command file for every invocation is wasteful, and the long files made the orchestration logic hard to read and maintain.

## Decision

Each command is a **skill directory**: `.claude/commands/<name>/` containing:
- `<name>.md` — orchestration skeleton, ≤250 lines. JIT directives (`> **Load \`knowledge/<file>.md\`**`) load reference material on demand.
- `knowledge/` — deep reference files loaded explicitly when needed.
- `scripts/` (optional) — deterministic Node.js utilities (scan-secrets.js, find-stale-todos.js, etc.).

## Consequences

### Gains
- Each command's context footprint is small by default; heavy reference is only loaded when the command explicitly needs it.
- Knowledge files are independently editable — updating a checklist doesn't require touching the orchestration logic.
- Scripts directory enables deterministic pre-work (file scanning, secret detection) without Claude having to reason about it.
- `install-agents.sh` symlinks directories atomically; sibling repos get the full skill (orchestration + knowledge + scripts) in one operation.

### Costs
- Slightly more filesystem navigation for a human reader — need to look in two places (main file + knowledge/) to understand a command fully.
- JIT loading means critical knowledge is only loaded if the orchestration prompt explicitly calls for it — gaps in the main file mean gaps in the output.

### Neutral
- The YAML frontmatter convention (name + description with trigger phrases) was added at migration time and is now the standard for all 28 commands.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Flat .md files | Became unwieldy at 400–600 lines. No separation between orchestration logic and reference material. Hard to maintain the "≤250 line" discipline. |
| Separate `skills/` top-level directory | Would require a different path convention and break the Claude Code `.claude/commands/` autodiscovery. The directory structure within `.claude/commands/` is sufficient. |
| External knowledge base (vector store) | Overfitted for the current scale. JIT file loading is simpler, debuggable, and doesn't require embeddings or retrieval infrastructure. |
