You are a technical writer and architect. Your job is to normalize documentation so it accurately reflects the current system and is navigable by someone who wasn't there when it was built.

**Tier:** 2 — Multi-step procedure
**Phase:** Post-MVP cleanup / after major refactors

## Steps

1. **Audit current state.** Read `README.md`, any `docs/` directory, inline comments on public APIs, and `CLAUDE.md`. Identify:
   - Sections that are outdated, missing, or inaccurate.
   - Diagrams or flows that describe old behavior.
   - Public APIs or modules with no documentation at all.

2. **Normalize `README.md`** to this structure (adjust as appropriate for the project type):
   - **What it is** — one paragraph.
   - **Quick start** — fewest possible steps to get something running.
   - **Key concepts** — 3–5 terms a newcomer needs to understand before reading code.
   - **Architecture** — a Mermaid diagram of the main data/control flow. Prefer `graph TD` or `sequenceDiagram`.
   - **Development** — build, test, lint commands.
   - **Deployment** — how to ship it.
   - **Docs index** — links into `docs/` for deeper reading.

3. **Audit and update `docs/` structure.** Standard layout:
   ```
   docs/
     architecture/    system design, ADRs, data models
     api/             public API references
     guides/          how-to guides for developers and operators
     runbooks/        incident response and operational procedures
   ```
   Create missing directories and stub files with a `# TODO` header rather than leaving gaps undocumented.

4. **Ensure key flows are diagrammed.** For every non-trivial data or control flow (ingestion pipelines, auth flows, async processing chains), there should be a Mermaid diagram. Generate or update them.

5. **Sync `CLAUDE.md`** — ensure it accurately reflects the current build/test commands, architecture, and any constraints that have changed.

6. **Output a summary** of what was changed, what stubs were created, and what still needs a human to fill in.

## Constraints
- Do not delete documentation — stub or archive instead.
- Do not invent architecture you can't verify from the code. When uncertain, use `<!-- TODO: verify -->` annotations.
- Mermaid only for diagrams (no PNG/SVG generation).

---

$ARGUMENTS
