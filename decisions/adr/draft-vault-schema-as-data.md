# ADR-XXXX: The vault schema is one machine-readable file; prose documents cite it, never restate it

slug: vault-schema-as-data
serial: draft
rev:
Date: 2026-07-30
Status: Proposed
domain: knowledge
type: architecture
OKR:
Commands affected: /vault
Repos affected: core, selfco
gate: shadow — `lint.py --schema` reports, never blocks
baseline: 14 findings across 668 pages at adoption, no false positives
traces:
  supersedes:
  amends: [selfco-vault-and-skill, obsidian-bases-views]
  relates-to: [lint-shadow-to-gate, stable-identity-and-facet-tags, defect-ledger-and-closure-loop]
  parent:
  part-of-series: selfco-ontology-program

---

## Context

The selfco schema was restated in prose in four places: `~/selfco/CLAUDE.md`,
`core/.claude/skills/vault/templates/vault-claude-md.md`,
`.../vault/knowledge/wiki-schema.md`, and `core/domain-knowledge/selfco-vault.md`.

A 2026-07-29 audit diffed them across nine schema facts. **Three were unanimous.** They
disagreed on whether `bases/` and `canvas/` exist, on which scripts ship, on the mode list,
and — most tellingly — on *which of themselves was canonical*: `wiki-schema.md` says the
vault's `CLAUDE.md` is the source of truth, while `CLAUDE.md` says the template is.

adr:obsidian-bases-views had already named this hazard and prescribed manual mirroring. The
obligation was stated and not honoured; the drift is measurable a month later. Prose copies
cannot be kept in step by discipline.

Independently, the corpus had outgrown its own declaration: **11 frontmatter keys in
production use appeared in no spec** (`tier`, `verdict`, `revive_trigger`, `created`,
`author`, `publication`, `published`, `path`, `repos`, `location`, `acquired`), several
carrying ratified decision state. A whole page type — `type: run`, with five extra keys and
its own Base view — was documented nowhere. Meanwhile two *declared* mechanisms had zero
adoption (`contradicts:`, `category: reference-data`).

## Decision

**1. `core/.claude/skills/vault/schema.yaml` is the source of truth.** The four prose
documents carry a readable summary and a citation; where they disagree with the YAML, the
YAML wins and the disagreement is a bug to file.

**2. It declares the schema as *measured*, not as previously written.** All 11 undeclared
keys are declared — they are load-bearing decision state, not drift to be punished. `run`
becomes a first-class page type.

**3. Enums resolve per page type.** `status:` means maturity on a concept and lifecycle on
an entity; one flat enum could never validate both.

**4. Where the observed schema is wrong, declare it and file it.** Entity `status:` carries
two orthogonal axes — lifecycle *and* relationship-to-fleet (`referenced`, `tracking`,
`incoming`). All nine values are declared so the linter stops reporting legitimate values as
errors, and the overload is filed as `dr-selfco-entity-status-overloaded`. **Declaring
reality is this decision's job; changing it is a later slice's.**

**5. An `@context` block maps local keys to standard vocabulary URIs** — Schema.org,
DCTERMS, SKOS, PROV-O, CiTO. JSON-LD's pattern, not YAML-LD's dependency (a Community Group
Final Report, not Rec-track). Only `depends_on` and `consumes` are locally minted.

**6. Validation is shadow.** `lint.py --schema` exits 0 always; promotion to a gate happens
on evidence, per adr:control-gated-slices.

## Consequences

**The parser is hand-rolled, and that required a discipline.** `lint.py` is deliberately
dependency-free and PyYAML is not installed, matching the fleet's existing convention
(`scripts/lib/northstar-fm.mjs`). But a constrained parser is only safe if the constraint is
enforced, so `load_schema` **parses and then verifies the document shape** and raises rather
than returning a half-read schema.

That caught two real bugs during authoring. A wrapped inline list failed loudly — good. Then
a comma-split shredded `{shape: enum, values: [a, b]}` into garbage *while still returning a
dict*, so a naive "is it a map?" check passed and the run emitted **447 nonsense findings**.
The visible absurdity is what exposed it. A schema validator that silently half-reads its own
schema would be the purest instance of the failure this program exists to remove.

**Findings name the admissible set.** "`status` is empty — allowed: unstarted | active |
paused | …" instead of "invalid". Structured feedback carrying the allowed values is what
lets an agent self-repair; the formatting is not the active ingredient.

**A false positive was found and fixed at adoption.** `hal-cover-letter-corpus` declares
`raw:` as a *block list*; a scalar-only reader scores it as having no origin. That same bug
lives in `lint.py`'s own raw-without-source check. Result: 14 findings, none spurious.

**`virtual: true` was added because the schema had no way to say something it always
permitted.** CLAUDE.md has always sanctioned "virtual sources" in prose while leaving them
indistinguishable from pages that lost their origin.

**Costs accepted.** One more file to keep current — but it is now the *only* one, and drift
against it is detectable rather than a matter of reading four documents. Adding a key does
not backfill it: migration stays forward-only, backfill-on-touch, so the shadow report will
carry a standing population of legitimately-unmigrated pages for some time.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Keep prose, mirror by discipline | Already tried and measured: 3 of 9 facts unanimous, one month after the obligation was written down. |
| JSON Schema / CUE per note type | Better tooling, but cannot express the cross-file graph rules (dangling links, supersession chains) that already live in `lint.py`, and would add a second schema language. |
| SHACL over an ephemeral RDF graph | The correct *model*, and the severity tiers were borrowed from it. Rejected as *implementation*: at 668 files it buys standards conformance, not guardrail value, at the cost of an RDF stack. Revisit only if the vault publishes. |
| Add PyYAML | Breaks the run-anywhere property every other vault script relies on, for one file. |
| Declare only the "clean" schema | Would report 11 keys of ratified decision state as errors, guaranteeing the report is ignored. |

## Implementation

Shipped 2026-07-30, core `4d821ed` + selfco `0aaf018`:
`schema.yaml` (6 page types, 43 keys, 5 enums, 31 `@context` terms) ·
`scripts/schema_check.py` · `lint.py --schema` · all four documents repointed.
