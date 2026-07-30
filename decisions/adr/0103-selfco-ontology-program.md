# ADR-0103: selfco gains a typed ontology layer, sequenced behind a change-impact index

slug: selfco-ontology-program
serial: 0103
rev:
Date: 2026-07-30
Date accepted: 2026-07-30
Status: Accepted
domain: knowledge
type: architecture
OKR:
Commands affected: /vault, /selfco-ingest, /frame-standup
Repos affected: core, selfco
gate: per-slice; each names the competency questions it moves from unanswerable to answerable
baseline: 668 pages · 10,649 links · 36 typed edges · 988 tags (46% singletons) · 4 surfaces disagree on repo count
traces:
  supersedes:
  amends: [selfco-vault-and-skill]
  relates-to: [vault-schema-as-data, defect-ledger-and-closure-loop, stable-identity-and-facet-tags, lint-shadow-to-gate, control-gated-slices, semantic-link-suggester]
  parent:
  part-of-series: selfco-ontology-program

---

## Context

Prompted by Frank Coyle's *"Why Agentic Systems Need Ontologies"* (AI Engineer World's Fair
2026, Track 5) — specifically the slide arguing top-down and bottom-up ontology
construction are "not in conflict; meet in the middle, and reuse what already exists."

A full audit of the vault on 2026-07-29 measured where selfco actually stands. It is a
**well-run bottom-up folksonomy with a strong provenance habit and no top-down layer.**
Structural invariants are genuinely well enforced (`Up: [[index]]` at 666/666; `raw/`
immutability; append-only log). The *semantic* layer is entirely convention:

- **`tags:` carries five incompatible semantics** — domain, entity reference, page subtype,
  duplicated facet, and genuine topic. 988 distinct tags, **46% used exactly once**, and
  **114 tag strings duplicate existing page slugs**, so `tags: [microsoft]` and
  `[[microsoft]]` are two unreconciled naming systems for one referent.
- **Relations are absent as data but present as prose.** 10,649 wikilinks against 36 typed
  frontmatter edges (~0.3%). `contradicts:` is specified and used zero times; the body
  callout `> [!contradiction]` (11 uses) is what people reach for.
- **But the corpus already mined its own predicate vocabulary**: 124 `## Relationships`
  bullets open with a hyphenated predicate — `sibling` 25, `built-on` 22, `consumes` 20,
  `depends-on` 17, `part-of` 7 — unprompted. And **section position already types 2,490
  links** for free (`## Touched pages` = provenance, `## Sources` = citation), which nothing
  parses.
- **Nothing distinguishes a source-grounded claim from an LLM-synthesised one**, in a vault
  whose premise is that the LLM owns `wiki/`.
- **Derived facts rot silently.** Four surfaces report four different repo counts (46 / 44 /
  38 / 37); a live port collision; 12 of 40 repos with commits newer than their
  `last_synced`; nine repos marked `active` after 60+ days of silence.

Two independent research legs (one in-session, one operator-run) converged on the same
verdicts: OWL *infers* and never rejects, so validation must be closed-world; **LLMs should
populate but never author** an ontology (LLMs4OL relation-extraction F1 **0.078**; failure
modes scale with ontological complexity, not model size); markdown must stay canonical
(Logseq's DB migration bought a type system and lost agent-writability); and graph structure
pays off on multi-hop retrieval and almost nowhere else — but selfco has already paid the
construction cost, because a human authored the links.

## Decision

**The change-impact index is the spine.** Every other change earns its place by how much it
sharpens one question: *when the world changes, which pages are now suspect?* An ontology
proposal that cannot show that payoff is cut.

This reframes the work from "adopt an ontology" to something bounded and testable. "Re-verify
1,600 claims" needs judgement and never terminates. "This commit touched `asset-foundry` —
which pages assert something about it?" is a link-graph lookup that **works on free prose
without parsing it**, and the vault already holds the index: 10,649 hand-authored links.

Nine decisions frame the program:

1. **Deliverable** — design records and ADRs before code.
2. **Migration** — forward-only, backfill-on-touch, shadow before enforce. No 668-page diff.
3. **Priorities** — typed relations · provenance · tag vocabulary · schema drift · **plus
   derived-data freshness**, raised by the operator and treated as first-class.
4. **Determinism vs coverage** — hybrid, honestly bounded. A deterministic engine is the
   *guarantee*; an LLM pass runs in shadow, advisory, never a gate. Uncoverage is declared,
   not papered over.
5. **Scope** — fleet-wide registry; the vault is a *consumer*, not a second source of truth.
6. **Framing** — the impact index is the spine (above).
7. **State placement** — **the vault never copies fleet state.** Entity pages keep judgement
   and link to the registry for facts. This is the vault's *own* existing rule ("Link, don't
   copy"), already honoured for ADRs and beads and violated for fleet state.
8. **Defect reports live in core**, not the vault — a work-item lifecycle does not belong in
   the knowledge layer (see adr:defect-ledger-and-closure-loop).
9. **Filing policy** — deterministic findings auto-file; LLM findings enter as drafts.

**Vocabularies are reused, not minted.** Schema.org (`about`, `mentions`, `isBasedOn`),
DCTERMS (`replaces`/`isReplacedBy` — the supersession relation already in use), CiTO for
citation intent, PROV-O *terms* for provenance, SKOS for the eventual concept scheme. FOAF
rejected (v0.99, January 2014; superseded by Schema.org). Only `depends_on` and `consumes`
are locally minted. Existing local key names are kept and mapped to URIs in `schema.yaml`
rather than renamed across 668 pages.

**The CiTO subset is deliberately coarse** — `cites`, `uses`, `cites_as_evidence`,
`agrees_with`, `disagrees_with`, `extends` — because annotator agreement collapses on fine
rhetorical distinctions, and `uses` is the most-applied typed intent in every published
pilot. `critiques` is absorbed by `disagrees_with`. **Inverses are derived, never stored.**

**Competency questions are the acceptance test.** 18 CQs plus two *negative* CQs (the system
must decline: an unregistered repo answers "unregistered", an unverifiable claim answers
"unverifiable since ⟨date⟩"). **A predicate with no CQ behind it is a predicate that will
stop being maintained** — this is the stopping rule and the scope fence.

**Slices, ordered by dependency:**

| # | Slice | Status |
|---|---|---|
| S0 | Defect ledger + closure loop | **shipped** |
| S1 | Schema-as-data | **shipped** |
| S2 | Identity — `repo:` slugs, phantom entities, 669 numeric ADR refs → slug form | next |
| S3 | Fleet registry (State layer); consumers render, never restate | |
| S4 | Typed edges, additive; lift the mined predicates as *candidates* | |
| S5 | Impact index + detect-and-quarantine reconciler | |
| S6 | Provenance (`attributed_to`, `generated_by`) | |
| S7 | Vocabulary — SKOS-lite scheme over the ~130 head tags | |

**Identity precedes the index; tags come last.** Impact routing built on unstable identifiers
misses *silently* rather than failing loudly — and today `repo:` is not uniformly a slug, four
`kind: repo` entities have no repo on disk, and ADRs are referenced **669 times by number
against 3 times by slug** despite adr:stable-identity-and-facet-tags making the slug the
identity. Tags are last because they are the lowest-signal layer in the vault and the worst
possible dependency for a determinism mechanism.

## Consequences

**The maintenance evidence constrains this more than the ontology literature does.** The
single most-corroborated finding across every multi-year account of a personal knowledge
base: **conventions enforced at write time survive; conventions requiring a periodic
full-vault pass are abandoned.** What reliably dies is multi-level tag taxonomies, per-type
frontmatter schemas, and manually maintained indexes. selfco's tag profile already matches a
documented failure case almost exactly (1,000+ tags, ~5% essential, tooling eventually
written to *undo* the schema). This is why every slice ships shadow-first and forward-only,
and why S7 is last rather than first.

**No multi-year account of an LLM-maintained vault exists.** Reported agent wins are all bulk
one-time operations; reported failures are all ongoing integrity. The program is designed
around that asymmetry: agents do bulk lifts and file findings; deterministic mechanisms own
continuous integrity.

**The research itself demonstrated the problem.** An operator-run brief recommended making
the Notion promoter a pre-commit validator — a component paused 48 days earlier and formally
superseded 43 days earlier by the vault's own synthesis page. It read six stale documents and
produced a multi-day plan for a dead mechanism. This is the strongest available argument for
both the defect ledger and the freshness track.

**Costs accepted.** Seven slices is a long program, and shadow-first means months before
anything blocks. The impact index will have false positives (a page mentioning a repo is not
necessarily wrong about it). And the deterministic core will never cover the ~90% of claims
that live in free prose — that boundary is declared, not hidden, with progressive lifting of
*state-asserting* prose (lexicon-identifiable) rather than all prose.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Adopt OWL + a reasoner | OWL infers under open-world semantics; declaring a range and violating it produces an *entailment*, not an error. It cannot reject bad data — the guardrail must be closed-world. |
| Stand up a triplestore / graph DB | A second source of truth that can disagree with the files. Logseq's DB migration is the natural experiment: it bought exactly the type system wanted here and lost agent-writability. |
| Let the LLM author the ontology | LLMs4OL non-taxonomic relation F1 0.078; documented anti-patterns (hierarchy explosion, property sprawl, concept–instance confusion). LLMs populate; humans own the closed predicate list. |
| Reconcile entities to Wikidata now | Premature external dependency; coverage is biased toward public entities, so most of a work vault is unanchorable. Revisit only on publication. |
| Tag vocabulary first | Highest visible mess, but the lowest-signal layer and the worst foundation for impact routing. Sequenced last. |
| GraphRAG-style retrieval | +27 points on multi-hop and ~+0.5 elsewhere, at 40–57× indexing cost; the vault is explicitly not-RAG. The graph is for *impact*, not retrieval. |

## Implementation

S0 shipped `e475c82`; S1 shipped `4d821ed` + selfco `0aaf018`. Full diagnosis, both research
legs, the CQ grid and the layering model are recorded in
`selfco:wiki/synthesis/selfco-ontology-audit-2026-07.md`, with the four source artifacts
under `selfco:wiki/sources/`.
