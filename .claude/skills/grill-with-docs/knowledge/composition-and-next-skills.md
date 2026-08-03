# Composition and next skills

Reference for `/grill-with-docs`, moved verbatim from SKILL.md: post-confirmation next-skill routing, composition notes, and related files.

## Next-skill suggestions (Step 8, after confirmation)

Then suggest:
- `/plan-feature --from-conversation` if the work needs a spec.
- `/scaffold` if the design is concrete enough to skip the spec (rare).
- `/investigate` if the conversation revealed the real question is "why is X broken" rather than "let's build Y".
- `/deepen` if the conversation revealed shallow modules in the affected area.

## Composition

- This skill is the heavyweight version of the default grilling posture in `agent-defaults.md`. Default posture fires every session; this skill is invoked when the work warrants formal artifacts (CONTEXT.md updates, ADR stubs).
- Composes with `/plan-feature --from-conversation` (consumes the design concept) and `/spec-review` (peer-reviews the resulting spec).
- **Charting variant:** when invoked from a wayfinder grilling ticket (`adr:wayfinder-decision-maps`), grill breadth-first across the map's open questions — the goal is to resolve *that ticket's* decision and surface which blocked tickets it unblocks, not to drill depth-first into implementation detail that belongs to a later spec.
- Anti-pattern: chaining this skill back-to-back without the user actually doing work in between. If you finish a grill and immediately want to grill again, the first grill failed.

## See Also

- `domain-knowledge/CONTEXT.md` — bounded contexts and aggregates
- `domain-knowledge/GLOSSARY.md` — A→Z definitions
- `domain-knowledge/agent-defaults.md` — default grilling posture (lighter version)
- `decisions/adr/template.md` — ADR format
- `/plan-feature` — successor skill (consume design concept via `--from-conversation`)
- `/adr` — commit ADR stubs to `decisions/adr/`
