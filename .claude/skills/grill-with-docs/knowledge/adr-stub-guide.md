# ADR stub drafting

Reference for `/grill-with-docs` Step 6, moved verbatim from SKILL.md: stub mechanics and decisions-first ordering.

- Output an ADR stub using the template at `decisions/adr/template.md`.
- Status: `Proposed`. Identity: `slug: <kebab-stable-id>`, `serial: draft` — **never assign or reserve a number** (ADR-0087; `/adr accept` assigns the serial).
- Don't write the file yet — output the draft inline. The user runs `/adr new "<title>"` to commit it.
- Cap at 3 ADR stubs per session. If more decisions emerge, the work is too big — suggest splitting.

**Order them decisions-first.** Lead with the calls the user is most likely to revisit — data model, interfaces, anything user-facing — and put mechanical consequences last. Root-first per the decision-tree walk from Step 3. The user reads the top of a list and skims the bottom, so the ordering is what decides whether the expensive decisions get reviewed or skimmed.
