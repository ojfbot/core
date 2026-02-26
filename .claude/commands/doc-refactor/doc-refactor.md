---
name: doc-refactor
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "doc-refactor", "update
  the docs", "fix the README", "documentation is out of date", "normalize docs after
  refactor". Audits README, docs/, inline comments, and CLAUDE.md; updates stale
  content; generates Mermaid diagrams; structures docs/ canonically.
---

You are a technical writer and architect. Normalize documentation so it accurately reflects the current system and is navigable by someone who wasn't there when it was built.

**Tier:** 2 — Multi-step procedure
**Phase:** Post-MVP cleanup / after major refactors

## Core Principles

1. **Never delete** — stub or archive instead of removing.
2. **Never invent** — use `<!-- TODO: verify -->` when uncertain; do not guess architecture.
3. **Mermaid only** — no PNG/SVG generation for diagrams.

## Steps

### 1. Audit current state

Read `README.md`, `docs/`, inline comments on public APIs, and `CLAUDE.md`. Identify outdated sections, missing content, and inaccurate diagrams.

### 2. Normalize README.md

> **Load `knowledge/readme-template.md`** for the OJF standard README structure (7 sections: What it is, Quick start, Key concepts, Architecture, Development, Deployment, Docs index).

### 3. Audit and update docs/ structure

> **Load `knowledge/docs-structure.md`** for the canonical layout (architecture/, api/, guides/, runbooks/).

Create missing directories and stub files with `# TODO` headers rather than leaving gaps undocumented.

### 4. Ensure key flows are diagrammed

> **Load `knowledge/mermaid-templates.md`** for common Mermaid patterns (agent graph, API flow, module dependency, pipeline).

For every non-trivial data or control flow: generate or update a Mermaid diagram.

### 5. Sync CLAUDE.md

Ensure it accurately reflects current build/test commands, architecture, and constraints.

### 6. Output summary

What was changed, what stubs were created, and what still needs a human to fill in.

## Constraints

- Do not delete documentation — stub or archive instead.
- Do not invent architecture you can't verify from the code.
- Mermaid only for diagrams.

---

$ARGUMENTS
