# Documentation Structure

## Required Files

| File | Audience | Purpose |
|------|----------|---------|
| `CLAUDE.md` | Claude Code (machine) | Project context, commands, architecture, conventions |
| `README.md` | Humans (onboarding) | Quick start, prerequisites, how to run |
| `SECURITY.md` | Security-conscious devs | Secret management, vulnerability reporting |

## Optional Files

| File | When to add |
|------|------------|
| `ARCHITECTURE.md` | System has 3+ packages or non-obvious data flow |
| `CHANGELOG.md` | Published package or user-facing product |
| `CONTRIBUTING.md` | Open source or multi-team project |
| `TECHDEBT.md` | Active debt tracking via `/techdebt` skill |

## Directory Structure

```
docs/
├── how-to/              # Step-by-step tutorials
│   ├── 01-building-features.md
│   └── 02-adding-agents.md
├── adr/                 # Architecture Decision Records
│   ├── 0001-use-pnpm-workspaces.md
│   └── template.md
└── AGENTS_GUIDE.md      # Agent system usage (if AI-powered)
```

## CLAUDE.md vs README.md

| Aspect | CLAUDE.md | README.md |
|--------|-----------|-----------|
| Reader | LLM (Claude Code) | Human developer |
| Detail | Exhaustive, structured | Scannable, minimal |
| Commands | Every command with flags | Just the essentials |
| Architecture | Full package tree + imports | High-level diagram |
| Updates | Every architecture change | Major changes only |
