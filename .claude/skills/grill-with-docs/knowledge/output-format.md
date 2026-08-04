# Output format

Reference for `/grill-with-docs`, moved verbatim from SKILL.md: the structured-markdown output template and the timing of the next-skill section.

Structured markdown:

```
## Restated intent
<one sentence>

## Decision tree (sketch)
<tiny tree: root question + branches>

## Grilling

**Q:** <question>
**A:** <user's answer>

**Q:** <next question>
...

## Shared design concept
<one paragraph>

## Open unknowns
**Deferred decisions:** <items, or "none">
**Unvalidated assumptions:** <items, or "none">
**Standard considerations not covered:** <items, or "none">

## CONTEXT.md updates (proposed diff)
<unified diff or before/after blocks>

## GLOSSARY.md updates (proposed)
<term: definition lines>

## ADR drafts
### ADR-XXXX: <title> (Proposed)
<adr stub>

## Suggested next skill
/<skill> with rationale
```

The `## Suggested next skill` section is emitted only *after* the user confirms the shared design concept (Step 8's stop-gate) — the earlier sections form the proposal; the suggestion belongs to the turn that follows confirmation.
