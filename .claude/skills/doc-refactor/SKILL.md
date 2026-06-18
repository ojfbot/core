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

## Gotchas

- **"Update the docs" is not a license to invent architecture.** The strongest failure mode is writing confident prose about how a system works without verifying it against the code — producing docs that are *worse* than stale because they read as authoritative. When you can't confirm something from source, mark it `<!-- TODO: verify -->`; don't guess.
- **Never delete — stub or archive.** Removing an outdated section destroys the only record that the thing existed. Replace stale content or move it to an archive with a `# TODO` header; deletion loses information a future reader needs.
- **A gap is a stub, not a silent omission.** When a canonical doc/ directory or section is missing, create it with a `# TODO` header so the absence is visible and tracked. Leaving it out entirely makes the docs *look* complete while hiding what's undocumented.
- **Diagrams are Mermaid source, full stop.** No PNG/SVG generation — the constraint exists so diagrams stay diffable and editable in-repo. A generated image binary can't be reviewed in a PR or updated by the next refactor.
- **Syncing CLAUDE.md means verifying its commands run, not trusting them.** Build/test commands in CLAUDE.md drift silently after refactors. Confirm the current invocation (and pnpm-not-npm) against the actual scripts before declaring it synced.

---

$ARGUMENTS

## See Also
- Run `/adr` to document architecture decisions alongside docs.
- If preparing for handoff, run `/handoff` to generate runbooks.
