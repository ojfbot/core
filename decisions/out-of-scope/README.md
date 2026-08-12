# Out-of-scope knowledge base

Fleet-level memory of **rejected feature requests** — one file per rejected concept.
Convention: `adr:out-of-scope-knowledge-base` (ADR-0107). Primary writer/reader:
`/triage` (wontfix route + prior-rejection check).

Visible in every repo through the `decisions/` symlink.

## File format

```markdown
# <Concept Name>

repos: <repo, repo | fleet>

<One-paragraph statement of what is not supported.>

## Why this is out of scope

<Substantive reasoning — scope/philosophy, technical constraint, or strategic choice.
Code samples where they make it concrete. Never temporary circumstances.>

## Prior requests

- owner/repo#42 — "original request title"
```

## Rules

- One file per **concept**, kebab-case name recognizable from the listing.
- Only rejected **enhancements**. Never record an already-implemented `wontfix` here —
  that poisons the dedup check; point at where the feature lives instead. Rejected bugs
  get a closing comment, no file.
- Match inbound requests by **concept, not keyword**; on a match, surface the prior
  decision and ask whether it still stands.
- Reconsideration deletes or updates the file; previously closed issues stay closed.
