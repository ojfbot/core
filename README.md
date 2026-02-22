# OJF Workflow Framework

A portable framework for extending the `/` commands available in Claude Code, plus a supporting TypeScript engine for running those same workflows from a CLI or VS Code extension.

## How it works

Custom Claude Code slash commands live in `.claude/commands/`. Each `.md` file in that directory becomes a `/command` available in this repo when working inside Claude Code. The `$ARGUMENTS` placeholder is replaced by whatever you type after the command name.

```
.claude/commands/
  techdebt.md    →  /techdebt --mode=propose --incident='...'
  summarize.md   →  /summarize src/app.ts --style=detailed
  recon.md       →  /recon packages/
  roadmap.md     →  /roadmap --format=github
  observe.md     →  /observe <logs or alert>
```

The `packages/` directory provides a TypeScript engine (`@ojf/workflows`) for the same workflows — useful for CI/CD, automation, or running outside Claude Code via the `ojf-workflow` CLI.

---

## Claude Code commands (primary interface)

Available as soon as you clone the repo — no build step required.

| Command | Purpose |
|---------|---------|
| `/techdebt` | Meta-workflow: analyze incidents and propose/apply improvements to the framework itself |
| `/summarize` | Summarize a file or selected text |
| `/recon` | Reconnaissance report of a codebase or directory |
| `/roadmap` | Generate or update a product roadmap |
| `/observe` | Triage logs, metrics, or alerts |

### Starting a new project

`/scaffold-app` generates a complete project skeleton from a canonical template and writes the files to disk.

```
/scaffold-app --type=langgraph-app --name=my-service --description="Resume builder API"
/scaffold-app --type=browser-extension --name=my-ext --org=myorg
/scaffold-app --type=python-scraper --name=my-scraper --description="Film database scraper"
```

Three templates are available:

| Template | Stack | Based on |
|----------|-------|----------|
| `langgraph-app` | Express + LangGraph + Carbon DS + SQLite + Vitest + pnpm | cv-builder, TripPlanner, BlogEngine |
| `browser-extension` | Vite + pnpm + Lerna, 5-package extension (content-script/background/popup/options/shared) | MrPlug |
| `python-scraper` | Python + Pydantic v2 + httpx + SQLite FTS5 + MCP server + typer | purefoy |

Each template includes: project structure, `package.json`/`pyproject.toml`, TypeScript/Python stubs, auth and logging wiring, GitHub Actions CI, `CLAUDE.md`, `.env.example`, and a next-steps checklist.

The canonical template specs live in `domain-knowledge/app-templates.md`. Updating that file updates the templates for all future scaffolds.

### Adding a new command

Create `.claude/commands/mycommand.md` with a prompt. Use `$ARGUMENTS` anywhere you want user input injected. That's it — the command is immediately available as `/mycommand` in Claude Code.

---

## `/techdebt` — the self-improvement loop

`/techdebt` is the meta-command. Other workflows can trigger it whenever they encounter errors, surprising behavior, or capability gaps. It operates in two modes:

### `mode=propose` (default)
Accepts a `TechDebtIncident` JSON and returns a `TechDebtProposal` with concrete improvement suggestions and file patches.

```
/techdebt --mode=propose --incident='{
  "timestamp": "2024-01-01T00:00:00Z",
  "workflowName": "summarize",
  "triggerReason": "bad_outcome",
  "shortTitle": "Summary misses TypeScript-specific detail",
  "contextSummary": "The summarize prompt does not mention types or interfaces."
}'
```

### `mode=apply`
Takes a `TechDebtProposal` and applies its `filePatches` to disk.

```
/techdebt --mode=apply --proposal='{...}' --dryRun
/techdebt --mode=apply --proposal='{...}'
/techdebt --mode=apply --proposal='{...}' --select=0
```

**Safety:** `mode=apply` only patches files inside `packages/workflows/**`, `domain-knowledge/**`, or `skills/**`. Any other path is skipped.

---

## TypeScript engine (supporting layer)

For running workflows outside Claude Code:

```bash
cp .env.example .env   # add ANTHROPIC_API_KEY
pnpm install
pnpm build

# CLI
node packages/cli/dist/index.js "/summarize packages/workflows/src/types.ts"
node packages/cli/dist/index.js --help
```

### Programmatic subagent trigger

From inside another workflow, call `/techdebt` programmatically:

```typescript
import { logTechDebtIncident } from "@ojf/workflows";

const proposalJson = await logTechDebtIncident({
  timestamp: new Date().toISOString(),
  workflowName: "my-workflow",
  triggerReason: "error",
  shortTitle: "Unexpected failure",
  contextSummary: "The workflow failed with...",
  errorMessage: err.message,
}, ctx.cwd);
```

### Adding a workflow to the TypeScript engine

1. Create `packages/workflows/src/workflows/myworkflow.ts` exporting a `WorkflowSpec`.
2. Register it in `packages/workflows/src/registry.ts`.

---

## Safety guarantees

`/techdebt --mode=apply` only modifies:
- `packages/workflows/**`
- `domain-knowledge/**`
- `skills/**`

Production business code (`src/**`, `app/**`, etc.) is never touched.

---

## Project structure

```
.claude/commands/      Claude Code slash commands (primary interface)
packages/
  workflows/           @ojf/workflows — TypeScript workflow engine
  cli/                 @ojf/cli — ojf-workflow binary
  vscode-extension/    VS Code extension
domain-knowledge/      Allowed patch target for /techdebt
skills/                Allowed patch target for /techdebt
```
