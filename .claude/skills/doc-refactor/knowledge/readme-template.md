# README Template

## Structure (Frame OS standard)

```markdown
# Project Name

One-line description.

## Prerequisites

- Node.js 24.11.1+ (`fnm use`)
- pnpm 9.0.0+ (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)

## Quick Start

\```bash
pnpm install
pnpm dev
\```

## Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | TypeScript check |
| `pnpm test` | Run tests |

## Architecture

[Brief description + Mermaid diagram if complex]

## Project Structure

\```
packages/
├── ...
\```

## Deployment

[How and where this deploys]

## Security

[Where secrets live, how to report issues]
```

## Gold Standard

See `cv-builder/CLAUDE.md` — comprehensive machine-readable project context
covering: package manager, dev commands, architecture, monorepo structure,
data models, agent system, environment setup, security practices.

## Key Principles

- Lead with "how to run it" — the most common question
- Commands in tables, not prose
- Architecture as diagram, not wall of text
- Security section always present (even if brief)
- Never document things derivable from code (file counts, line counts)
