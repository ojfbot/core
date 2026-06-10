# ADR-0088: Obsidian Bases as the vault's dynamic browsing layer
slug: obsidian-bases-views
serial: 0088
rev:
Date: 2026-06-10
Date accepted: 2026-06-10
Status: Accepted
domain: observation
type: tooling
OKR: 2026-Q2 / O-Knowledge / KR-cross-project-recall
Commands affected: /vault (init template, knowledge note)
Repos affected: selfco (bases/, canvas/, CLAUDE.md — already enacted), core (vault skill template + schema note)
traces:
  amends: selfco-vault-and-skill
  relates-to: [control-gated-slices, vault-staleness-scanner]

---

## Context

The selfco vault's best-practices audit against kepano/obsidian-skills
(`selfco/wiki/synthesis/selfco-vault-best-practices-audit.md`, 2026-06-10) found the `bases`
core plugin enabled but zero `.base` files, while every human browsing surface (`index.md`,
`_hot.md`, `_lint-report.md`) is a hand- or Python-generated static snapshot. The vault's
frontmatter (`type`/`kind`/`status`/`last_synced`/`revive_trigger`) is exactly what Obsidian
Bases query on. The decision was enacted in `ojfbot/selfco` (PR #5: six starter `bases/*.base`
views, a first `canvas/kepano-adoption.canvas`, an `aliases` backfill, and the matching
`CLAUDE.md` schema rows) — but the canonical schema source in core that `/vault init`
regenerates the vault `CLAUDE.md` from did not carry the additions, so a future `init` would
silently drop them. A wrinkle surfaced while patching: the in-vault `CLAUDE.md` claimed it is
regenerated from `knowledge/wiki-schema.md`, but `init-vault.py` actually reads
`templates/vault-claude-md.md` — the wrong pointer is itself a silent-loss vector.

## Decision

Adopt `.base` files as the vault's *human* browsing layer, additive to — not a replacement
for — the Python scripts (which stay authoritative for the headless selfco-box because they
emit committed, diffable artifacts); keep `bases/` and `canvas/` **outside `wiki/`** so the
`wiki/`-scoped lint invariant is structurally untouched; and mirror the schema additions
(`bases/` + `canvas/` folder roles, the `aliases` entity line, the Bases & Canvas browsing
section) into `core/.claude/skills/vault/templates/vault-claude-md.md` and
`knowledge/wiki-schema.md`, correcting the template's self-reference to name the file `init`
actually reads.

## Consequences

### Gains
- Live dashboards over existing frontmatter at zero scripting cost; the structured frontmatter pays off for the human, not just the lint engine.
- No change to the headless loop or the lint invariant (`bases/`/`canvas/` are outside `wiki/`).
- A future `/vault init` regenerates a `CLAUDE.md` that keeps the adopted layer instead of silently dropping it.

### Costs
- Bases need a recent Obsidian and render only in-app — render-correctness cannot be verified headlessly; visual confirmation of the 6 views + the canvas is a manual gate on the Mac.
- Two surfaces (scripts + bases) over the same data — mitigated by the explicit "scripts = headless/audited, bases = human/live" split.

### Neutral
- The template and the live vault `CLAUDE.md` still evolve semi-independently; the template row now states the mirroring obligation explicitly.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Replace the Python scripts with Bases | Bases are recomputed live and leave no history — wrong for the headless box's committed, diffable maintenance signal (ADR-0086 shadow-audit trail). |
| Put `.base` files inside `wiki/` | `lint.py` is scoped to `wiki/`; a `.base` is not a wiki page and must never be linted as one. Obsidian indexes the whole vault regardless of folder. |
| Skip the upstream template patch | A future `/vault init` regenerates `CLAUDE.md` without the `bases/`/`canvas/`/`aliases` additions — silent schema loss. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | selfco `wiki/synthesis/adr-draft-obsidian-bases-views.md` (2026-06-10, vault best-practices audit) |
| Implementation start | 2026-06-10 (selfco PR #5: bases/canvas/aliases; core: template + schema-note patch) |
| Implementation end | _pending_ (manual Obsidian render check on the Mac outstanding) |
