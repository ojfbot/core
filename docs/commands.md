# Commands

All commands are available in Claude Code as `/command-name`. The TypeScript engine (`core-workflow` CLI) runs the same commands outside Claude Code.

## Recommended lifecycle order

```
/plan-feature → /scaffold → [implement] → /investigate (if needed)
→ /test-expand → /validate → /hardening → /deploy → /handoff
                                    ↑
                              /techdebt (continuous)
                              /sweep (weekly)
```

---

## Development lifecycle

| Command | When | What it does |
|---------|------|--------------|
| `/plan-feature` | Before writing code | Turns a rough idea into a spec: problem statement, architecture sketch, acceptance criteria, test matrix, ADR stub |
| `/scaffold` | After spec is approved | Generates types, skeleton implementations, test stubs, and wiring. No business logic. |
| `/investigate` | When something is broken | Evidence-first debugging: symptom → evidence → cause map → candidate fixes. No code edits. |
| `/validate` | Before merging | Checks spec coverage, universal invariants (TypeScript safety, auth, logging, tests), and project-specific framework rules |
| `/deploy` | Before releasing | Pre-flight checklist, blast radius, rollback plan, changelog. Requires /validate to pass first. |
| `/handoff` | After shipping | Runbook, debug guide, open items — reads actual code before writing |

## Supporting routines

| Command | Cadence | What it does |
|---------|---------|--------------|
| `/hardening` | Pre-milestone | Security, resilience, observability gap analysis. Ranked findings, no auto-fixes. |
| `/test-expand` | After milestones | Identifies untested branches; proposes (not writes) new tests |
| `/sweep` | Weekly | Stale TODOs, unused imports, debug logs, config duplication. `--apply` auto-fixes safe items. |
| `/techdebt` | Continuous | Scan → TECHDEBT.md; or propose/apply framework patches. The self-improvement loop. |
| `/doc-refactor` | Post-MVP, after refactors | Normalizes README, docs/, ADRs, inline comments; generates Mermaid diagrams |

## Discovery and analysis

| Command | What it does |
|---------|--------------|
| `/recon` | Dense technical overview of a codebase: structure, entry points, stack, architecture patterns, data flows |
| `/summarize` | Summarize a file or selection. `--style=brief` (default) or `--style=detailed` |
| `/observe` | Triage logs, metrics, alerts — Sentry, Prometheus, LangGraph-aware |
| `/roadmap` | Generate or update the product roadmap. `--format=github` or `--format=linear` |

## New projects

| Command | What it does |
|---------|--------------|
| `/scaffold-app` | Scaffold a complete new project from a canonical template |
| `/adr` | Create, list, search, or update architecture decision records |

**scaffold-app templates:**
- `langgraph-app` — Express + LangGraph + Carbon DS + SQLite + Vitest + pnpm
- `browser-extension` — Vite + 5-package extension (content-script/background/popup/options/shared)
- `python-scraper` — Python + Pydantic v2 + httpx + SQLite FTS5 + MCP server + typer

## Environment and workflow

| Command | What it does |
|---------|--------------|
| `/workbench` | Launch, stop, or inspect the 6-tile tmux multi-repo dev environment |
| `/push-all` | Safe commit with secret scanning and smart message drafting |
| `/setup-ci-cd` | Generate pre-commit hooks, GitHub Actions workflows, coverage gates |

## Project-specific (cv-builder)

| Command | What it does |
|---------|--------------|
| `/agent-debug` | Diagnose LangGraph state machine failures — graph map, cause trace, no code edits |
| `/pr-review` | PR audit: correctness, LangGraph invariants, auth, logging, test coverage |
| `/screenshot-audit` | Classify visual regression screenshots: regressions vs. intentional vs. false positives |
| `/rag-audit` | Audit chunking, embeddings, vector store persistence, retriever config |

## Meta and collaboration

| Command | What it does |
|---------|--------------|
| `/council-review` | Multi-persona critique of any draft doc — article, spec, PR description, README |
| `/skill-loader` | Examine a repo and produce an install plan: which skills to add, keep, or remove |
| `/daily-logger` | Load the daily-logger architecture context (orientation only) |
| `/plan-feature` | Write a spec. See also: `/scaffold` to implement it. |
