---
name: writing-shape
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "writing-shape", "shape this into
  an article", "turn my notes into prose", "polish this draft", "make this read like a finished
  post", "format this article". Transforms unstructured or beat-drafted markdown into finished
  article prose — making a deliberate formatting decision at every paragraph (prose vs. list vs.
  callout vs. code block vs. heading) instead of defaulting to walls of text or bullet soup.
  Output: a polished markdown article. Last step of the writing pipeline (/writing-fragments → /writing-beats → here).
---

# /writing-shape

You are turning rough material into a **finished article**. The defining discipline: at every paragraph you make a conscious choice about *form* — does this idea want to be flowing prose, a tight list, a callout, a code block, a sub-heading, a pull quote? The enemy is autopilot (everything becomes either a wall of prose or a bulleted list).

**Input:** $ARGUMENTS — a beats file (from `/writing-beats`), a fragments file, or any rough markdown draft.

**Tier:** 2 — Multi-step procedure
**Phase:** continuous (writing pipeline, step 3 of 3: `/writing-fragments` → `/writing-beats` → here)

## Core Principles

1. **Form is a decision, per paragraph** — never let a unit of content keep its incoming form by default. Ask: what shape serves the reader here? Then commit.
2. **Prose for arguments, lists for enumerations** — if items have a logical sequence or build on each other, that's prose. If they're parallel and order-independent, that's a list. Don't mix.
3. **Preserve the author's voice** — shape the structure, not the personality. Keep their phrasings, jokes, asides.
4. **Cut, don't pad** — shaping usually *removes* words. If a sentence restates the previous one, kill it.
5. **One pass per section, shown** — shape a section, show it, take edits, move on. Don't shape the whole thing silently.
6. **Headings earn their place** — a heading promises a chunk of related content. Don't sprinkle them to break up text; use them to signal real structure shifts.

## Workflow

### Step 1 — Read the source

Load the beats/fragments/draft. Note the existing structure and where it's clearly wrong (list that should be prose, prose that should be a table, missing headings, etc.).

### Step 2 — Shape section by section

For each section: decide the form of each paragraph (prose / ordered list / unordered list / table / callout / code block / heading), rewrite accordingly, tighten, and keep voice. Show the shaped section. Take edits. Advance.

> If formatting conventions exist for the destination (e.g. the daily-logger article format, a blog's house style), follow them. Check the relevant `domain-knowledge/*-architecture.md` if publishing into a known pipeline.

### Step 3 — Whole-article pass

Once all sections are shaped: read it top to bottom for flow, fix transitions between sections, check the open and close land, verify headings form a coherent skim-path.

### Step 4 — Output

```
## Shaped: <title>
File: <path>
Sections: <N> shaped
Notable form decisions: <e.g. "turned the 'reasons' section from bullets into prose; pulled the config into a table">
Next: /council-review for a multi-persona pass before publishing, or ship it.
```

## Gotchas

- **Autopilot turns everything into bullets — that IS the failure this skill exists to prevent.** The default LLM move is bullet soup (or, for prose-mode users, an undifferentiated wall). The discipline is a *conscious* form choice per paragraph; if you find yourself bulleting because it's faster, stop. Arguments and sequenced ideas are prose; only parallel, order-independent items are lists.
- **Letting a unit keep its incoming form is the silent default that defeats the skill.** A beats file arrives as prose; a fragments file arrives as fragments. Inheriting that form without asking "what shape serves the reader here?" means you reformatted nothing. Every paragraph's form is a decision made fresh, not inherited from the source.
- **Shaping should remove words; if your output is longer, you padded.** The reflex to "improve" prose by elaborating runs opposite to Core Principle 4. Restated sentences die, hedges die, transitions tighten. A shaped section that grew is a section you embellished instead of shaped.
- **Rewriting the author's jokes and asides into neutral prose is over-shaping.** You shape *structure*, not personality — their voice, humor, and digressions survive the pass intact. The trap is treating voice as noise to clean up; it's the reason anyone reads the piece over a generic explainer.
- **Sprinkling headings to break up text makes a fake skim-path.** A heading promises a chunk of related content (Core Principle 6). Adding one every few paragraphs to relieve visual density creates headings that lie about structure — the whole-article pass (Step 3) checks that headings form a *coherent* skim-path, so don't manufacture ones that don't.

---

$ARGUMENTS

## See Also
- `/writing-fragments` → `/writing-beats` — generate raw material and structure if you're starting cold.
- `/council-review` — run the finished article past the persona council before publishing.
- `/daily-logger` — if publishing into the daily-logger pipeline, load its article-format context first.
