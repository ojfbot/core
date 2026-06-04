---
name: council-review
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "council-review", "run the
  council", "get expert feedback", "review through personas", "multi-perspective review",
  "council of experts", or "what would [persona] think". Loads all personas from
  personas/*.md, produces an independent critique from each, then synthesizes a final
  improved version. Works on any draft document — article, spec, PR description, README.
---

You are a council of expert reviewers. You embody each persona in `personas/` sequentially, critique the draft independently, then synthesize a final improved version that preemptively addresses the council's key questions.

**Tier:** 2 — Multi-step procedure
**Phase:** Pre-publish, pre-submit, or whenever a draft needs multi-perspective stress-testing

## Core Principles

1. **Independent voices first** — each persona reviews the draft without seeing others' feedback.
2. **Honest over diplomatic** — each persona speaks with their own directness, not generic niceness.
3. **Synthesis preserves structure** — the final article keeps the original sections; it does not become a different document.
4. **What lands is protected** — things reviewers praised must be kept, not edited out.

## Steps

### Phase 1: Load context

Read: `personas/*.md` in the current repo.

> **Load `knowledge/persona-format.md`** for the YAML frontmatter spec and section expectations for persona files.

For each persona file, extract:
- `slug` — identifier
- `role` — full title/context line
- Body sections: Background, Their lens, What they typically challenge, What lands for them

If no `personas/` directory exists: halt and inform the user — council-review requires at least one persona file.

### Phase 2: Receive the draft

The draft to review is provided via `$ARGUMENTS`:
- If a file path is given: read the file.
- If the argument is a URL or PR number: fetch/read the content.
- If no argument: ask the user to paste the draft or provide a path.

### Phase 3: Independent critiques

For each persona (in order of `personas/` directory listing):

**Adopt the persona fully.** You are this person — their background, their professional lens, their specific concerns. Produce a critique with exactly three sections:

**Questions you'd ask** (3-5 questions): Gaps or claims the article leaves unanswered, from this persona's specific vantage point. Be precise — name the exact decision, gap, or claim.

**Gaps you'd flag** (2-3 items): What is missing that would make this more credible or useful from this persona's POV.

**What lands** (1-2 items): What works and must be preserved.

Output each persona's critique before moving to the next.

### Phase 4: Synthesize

Produce a final version of the document that:
1. Preemptively answers questions raised — if the information exists in context, add it explicitly.
2. Honestly acknowledges gaps where information is unavailable — one sentence is enough.
3. Sharpens framing based on what landed — make praised elements more prominent.
4. Preserves the original structure and sections — this is a revision, not a rewrite.
5. Does not add marketing language or fluff to cover gaps.

> **Load `knowledge/synthesis-guide.md`** for output format rules and what "honest acknowledgment of gaps" looks like in practice.

## Output Format

```
## Council Review — [document title or path]

---

### Persona: [slug] — [role]

**Questions I'd ask**
1. ...

**Gaps I'd flag**
- ...

**What lands**
- ...

---

[repeat for each persona]

---

## Synthesized Final Version

[full revised document]

## Change log
- Added: [what was added and why]
- Removed: [what was cut]
- Preserved: [what was explicitly kept]
```

## Constraints

- Do not fabricate facts. If a reviewer asks a question that cannot be answered from available context, acknowledge the gap honestly.
- Do not merge persona voices — each critique must be distinct.
- The synthesized version must not be longer than 150% of the original draft unless the gaps were structural.

---

$ARGUMENTS
