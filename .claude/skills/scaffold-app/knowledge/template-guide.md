Reference for `/scaffold-app` Step 1: template selection guidance.

## Choosing a template

The three templates and their use cases:

- `langgraph-app` — an agentic application built on a LangGraph state graph (agent flows, tool-calling backends).
- `browser-extension` — a browser extension (manifest, content/background scripts).
- `python-scraper` — a Python data-collection/scraping project.

The canonical file list, dependency versions, and configuration patterns for each template live in `domain-knowledge/app-templates.md` (read in Step 2) — that file, not this one, is the source of truth for what gets written to disk. If `domain-knowledge/app-templates.md` and `domain-knowledge/shared-stack.md` conflict, prefer app-templates.md.

## Common scaffolding pitfalls

See `## Gotchas` in SKILL.md — notably: never invent dependency versions (copy them from `app-templates.md`), stop on a non-empty target directory, use pnpm (never npm) in every generated file, and treat the Step 7 fleet registrations as mandatory checklist output.
