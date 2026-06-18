---
name: recon
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "recon", "map the codebase",
  "understand this project", "get oriented", "what does this repo do", or mentions
  exploring an unfamiliar repo for the first time. Produces a dense technical overview:
  structure, entry points, stack, architecture patterns, data flows, notable observations.
  Read-only — no files modified.
---

Perform a reconnaissance of the codebase or specified path. Produce a structured report for an engineer who needs to get productive quickly.

**Tier:** 1 — Read-only analysis
**Phase:** Orientation / first contact with a codebase

## Core Principles

1. **Dense and technical** — this is for engineers, not executives.
2. **Read-only** — no files modified.
3. **Notable over obvious** — call out what's unusual, concerning, or worth investigating.

## Steps

### 1. Discover structure

Read `CLAUDE.md` first if it exists. Then survey: directory layout, key directories, `package.json`/`pyproject.toml`/etc., `.github/workflows/`, CI/CD.

### 2. Identify entry points

Main binaries, exported packages, CLI commands, API surfaces, HTTP routes.

### 3. Map the technology stack

Languages, frameworks, key dependencies and their roles. Runtime version constraints.

### 4. Understand architecture patterns

How is the code organized? Monorepo? Layered? Event-driven? Agent graph?

> **If the project uses LangGraph or agent graphs, note the graph structure, nodes, and routing in the Architecture section.**
> **If the project is an OJF repo, also read `domain-knowledge/frame-os-context.md` for cross-repo context.**

### 5. Trace data flows

How does data move through the system? What enters and what exits? Where is state stored?

### 6. Notable observations

Unusual patterns, tech debt hot-spots, security surface, missing tests, dead code, configuration gaps.

## Output Format

```
## [Repo name] — Reconnaissance Report

### Directory structure
[annotated tree of key directories]

### Entry points
- [binary/command/route]: [description]

### Technology stack
| Layer | Technology | Role |
|-------|-----------|------|

### Architecture
[2-3 paragraphs with Mermaid diagram if non-trivial]

### Data flows
[key flows described concisely]

### Notable observations
- [HIGH concern] description
- [observation] description
```

## Gotchas

- **A directory tree restated in prose is not reconnaissance.** The model's default is to walk the folder structure and narrate it — which any `ls` could do. The value is in the "Notable observations": what's unusual, where the tech debt clusters, which entry point is load-bearing. If every line could be derived from the file listing, you haven't read the code.
- **Trace data flow from the entry points, not from the file you opened first.** Recon that starts deep in a util file and works outward maps the codebase the model happened to land in, not the one that exists. Start at the real entry points (binaries, routes, exported packages) and follow data through — that's how you find where state actually lives.
- **`CLAUDE.md` is the map, not the territory — read it first, then verify it.** It tells you the intended architecture, but recon's job is partly to catch where the code has drifted from it. A report that just paraphrases CLAUDE.md misses stale docs, which are themselves a notable observation worth flagging.
- **"Dense and technical" is a constraint against executive-summary drift.** The audience is an engineer who needs to be productive in an hour, not a stakeholder who needs reassurance. Skip the "this is a well-structured modern codebase" filler; every sentence should name a file, a pattern, or a concrete risk.

$ARGUMENTS
