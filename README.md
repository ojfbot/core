# OJF Workflow Framework

> Portable Claude Code workflow framework: 30+ slash commands for the full development lifecycle, backed by a TypeScript engine for CLI and CI use.

Part of [Frame OS](https://github.com/ojfbot/shell) — an AI-native application OS built as both a live product and an engineering portfolio. This repo is the shared development infrastructure that powers all Frame OS projects.

### Why this exists

Every repo in the Frame OS ecosystem needs the same development workflows — planning, scaffolding, validating, deploying, investigating. Instead of duplicating scripts or publishing packages, this is a portable framework that installs into any sibling repo via symlink. One `install-agents.sh` call gives any project the full lifecycle toolkit with zero build step and instant propagation.

### Design decisions

- **Skill directories over flat scripts** — each command is self-contained with its own orchestration prompt, knowledge files, and utility scripts
- **Symlink installation over package publishing** — zero build step, instant propagation across all ecosystem repos (shared UI components use [npm publishing](https://github.com/ojfbot/frame-ui-components) with Vite alias for local dev)
- **43+ ADRs** — every significant decision documented with context, alternatives considered, and rationale (see [ADR-0036](decisions/adr/ADR-0036.md) for the lock-file-rebuild protocol, [ADR-0037](decisions/adr/ADR-0037.md) for JSONL truncation, [ADR-0043](decisions/adr/ADR-0043.md) for the AgentBead bridge)
- **Self-improvement loop** — `/techdebt` proposes patches to the framework itself, never production code

## Features

- **30+ slash commands** — plan, scaffold, validate, deploy, investigate, harden, sweep, suggest-skills, and more
- **Skill-directory architecture** — each command is a self-contained directory with orchestration prompt, knowledge files, and scripts
- **TypeScript CLI** — `core-workflow` binary for CI/CD and terminal use
- **VS Code extension** — run any slash command from the editor
- **Cross-repo installation** — `install-agents.sh` and `session-init.sh` symlinks skills + domain knowledge into sibling repos (symlinks tracked in git to survive clone and branch-switch)
- **Self-improvement loop** — `/techdebt` records patterns and proposes patches to the framework itself
- **Architecture Decision Records** — 43+ ADRs documenting every significant decision across the ecosystem
## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | TypeScript, Anthropic SDK |
| CLI | `@core/cli` (`core-workflow` binary) |
| Editor | VS Code extension (`core.runSlashCommand`) |
| Testing | Vitest |
| Build | pnpm workspaces, TypeScript compiler (`tsc --noEmit` CI gate) |

---

## For humans

| I want to... | Start here |
|---|---|
| Understand what this project is and how it's structured | [docs/architecture.md](docs/architecture.md) |
| See why decisions were made the way they were | [decisions/adr/](decisions/adr/) |
| Understand current priorities | [decisions/okr/2026-q2.md](decisions/okr/2026-q2.md) |
| Set up and start using commands | [docs/getting-started.md](docs/getting-started.md) |
| Find the right command for a task | [docs/commands.md](docs/commands.md) |

## For Claude Code

| I need... | Read |
|---|---|
| Agent context before cross-repo work | [domain-knowledge/frame-os-context.md](domain-knowledge/frame-os-context.md) |
| Available commands and architecture | [CLAUDE.md](CLAUDE.md) |
| Skill reference material | `.claude/skills/<name>/knowledge/` |
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
./scripts/install-agents.sh lean-canvas
```

---

## What's in here

```
.claude/skills/     slash commands (skill directories with knowledge/ and scripts/; catalog includes suggested_after and layer_affinity fields)
packages/
  workflows/          @core/workflows — TypeScript workflow engine
  cli/                core-workflow binary
  vscode-extension/   VS Code extension
domain-knowledge/     Machine context corpus (loaded by commands at runtime)
decisions/
  adr/                Architecture Decision Records (ADR-0001 through ADR-0043+, including ADR-0037 JSONL truncation, ADR-0043 AgentBead bridge)
  okr/                Objectives and Key Results
docs/                 Human-readable documentation
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

## Contributing

All changes go through pull requests — never push directly to main.

```bash
git checkout -b feat/my-change
# make changes
git add <files>
git commit -m "feat: description of change"
git push -u origin feat/my-change
gh pr create
```

## License

MIT

## Frame OS Ecosystem

Part of [Frame OS](https://github.com/ojfbot/shell) — an AI-native application OS.

| Repo | Description |
|------|-------------|
| [shell](https://github.com/ojfbot/shell) | Module Federation host + frame-agent LLM gateway |
| **core** | **Workflow framework — 30+ slash commands + TypeScript engine + skill suggestion/telemetry (this repo)** |
| [FrameBus](https://github.com/ojfbot/FrameBus) | Event bus with ADR-0013, Playwright e2e |
| [cv-builder](https://github.com/ojfbot/cv-builder) | AI-powered resume builder with LangGraph agents |
| [gcgcca](https://github.com/ojfbot/gcgcca) | Pydantic + TypeScript type bridge |
| [blogengine](https://github.com/ojfbot/BlogEngine) | AI blog content creation platform |
| [TripPlanner](https://github.com/ojfbot/TripPlanner) | AI trip planner with 11-phase pipeline |
| [core-reader](https://github.com/ojfbot/core-reader) | Documentation viewer for the core framework |
| [lean-canvas](https://github.com/ojfbot/lean-canvas) | AI-powered lean canvas business model tool |
| [gastown-pilot](https://github.com/ojfbot/gastown-pilot) | Multi-agent coordination dashboard |
| [seh-study](https://github.com/ojfbot/seh-study) | NASA SEH spaced repetition study tool |
| [daily-logger](https://github.com/ojfbot/daily-logger) | Automated daily dev blog pipeline (Vercel serverless) |
| [purefoy](https://github.com/ojfbot/purefoy) | Roger Deakins cinematography knowledge base |
| [MrPlug](https://github.com/ojfbot/MrPlug) | Chrome extension for AI UI feedback |
| [frame-ui-components](https://github.com/ojfbot/frame-ui-components) | Shared component library (Carbon DS) — published to npm as `@ojfbot/frame-ui-components` |
| [beaverGame](https://github.com/ojfbot/beaverGame) | Terrain-to-dam beaver sandbox (Babylon.js) |
| [asset-foundry](https://github.com/ojfbot/asset-foundry) | AI-driven Blender asset pipeline (MCP platform) |
