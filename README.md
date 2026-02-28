# OJF Workflow Framework

A portable Claude Code workflow framework: slash commands for the development lifecycle, backed by a TypeScript engine for CLI and CI use.

Part of [Frame OS](docs/architecture.md) — an AI-native application OS built as both a live product and an engineering portfolio.

---

## For humans

| I want to... | Start here |
|---|---|
| Understand what this project is and how it's structured | [docs/architecture.md](docs/architecture.md) |
| See why decisions were made the way they were | [decisions/adr/](decisions/adr/) |
| Understand current priorities | [decisions/okr/2026-q1.md](decisions/okr/2026-q1.md) |
| Set up and start using commands | [docs/getting-started.md](docs/getting-started.md) |
| Find the right command for a task | [docs/commands.md](docs/commands.md) |

## For Claude Code

| I need... | Read |
|---|---|
| Agent context before cross-repo work | [domain-knowledge/frame-os-context.md](domain-knowledge/frame-os-context.md) |
| Available commands and architecture | [CLAUDE.md](CLAUDE.md) |
| Skill reference material | `.claude/commands/<name>/knowledge/` |
| ADR for a specific decision | [decisions/adr/](decisions/adr/) |

---

## Quick start

```bash
pnpm install && pnpm build
```

Commands are available immediately in Claude Code — no build step required:

```
/plan-feature add auth to the API
/validate
/investigate why is the LangGraph node failing
/push-all
/adr new "server-side session storage over JWT"
```

Install into a sibling repo:

```bash
./scripts/install-agents.sh cv-builder
```

---

## What's in here

```
.claude/commands/     28 slash commands (skill directories)
packages/
  workflows/          @core/workflows — TypeScript workflow engine
  cli/                core-workflow binary
  vscode-extension/   VS Code extension
domain-knowledge/     Machine context corpus (loaded by commands at runtime)
docs/                 Human-readable documentation
decisions/
  adr/                Architecture Decision Records
  okr/                Objectives and Key Results (technical track)
personal-knowledge/   Career context (not tracked publicly)
```

---

## The self-improvement loop

`/techdebt` is the meta-command. Other workflows trigger it when they encounter patterns worth recording. It proposes patches to `packages/workflows/**`, `domain-knowledge/**`, or `skills/**` — never production code.

When a mistake is caught, write it in 3 places:
1. Update or add the ADR in `decisions/adr/`
2. Update the relevant `knowledge/` file in the affected command
3. Update `memory/MEMORY.md`

See [decisions/README.md](decisions/README.md) for the full write-back protocol.
