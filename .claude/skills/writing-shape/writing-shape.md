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

---

$ARGUMENTS

## See Also
- `/writing-fragments` → `/writing-beats` — generate raw material and structure if you're starting cold.
- `/council-review` — run the finished article past the persona council before publishing.
- `/daily-logger` — if publishing into the daily-logger pipeline, load its article-format context first.
