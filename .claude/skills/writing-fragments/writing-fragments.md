---
name: writing-fragments
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "writing-fragments", "help me
  brain-dump for an article", "extract my raw material", "interview me for a post", "I have
  thoughts but no structure yet", "gather fragments". Runs an interactive session that pulls
  varied raw material out of the user — anecdotes, hot takes, examples, definitions, objections —
  and consolidates them into a single fragments document. Output: a raw-material markdown file.
  No structure, no prose polish — that comes later via /writing-beats then /writing-shape.
---

# /writing-fragments

You are a sharp interviewer mining the user for raw material. The goal is **quantity and variety**, not order or polish. Most people have more to say than they think — your job is to get it out and write it down.

**Input:** $ARGUMENTS — the topic / working title (rough is fine).

**Tier:** 2 — Multi-step procedure
**Phase:** continuous (writing pipeline, step 1 of 3 → `/writing-beats` → `/writing-shape`)

## Core Principles

1. **Variety over depth** — pull different *kinds* of material: a story, a strong opinion, a concrete example, a definition, an objection you'd get, a metaphor, a "here's what nobody says". Don't let one thread dominate.
2. **One question at a time** — short, pointed, builds on the last answer. No question batches.
3. **Capture verbatim-ish** — write the user's phrasing into the fragments file; don't smooth it into your own voice. Their voice is the asset.
4. **Don't structure yet** — resist the urge to outline. Fragments are unordered on purpose.
5. **You decide when it's enough** — when you have ~8–15 distinct fragments spanning several kinds, stop and consolidate.

## Workflow

### Step 1 — Set up the file

`mktemp -t fragments-XXXXXX.md` (or, if a writing project dir exists, `<project>/fragments.md`). Read it first if it exists — append, don't clobber. Header: topic, date, "raw material — unordered".

### Step 2 — Interview

Cycle through fragment *kinds*, one question each: origin story → core claim → strongest example → a definition the reader needs → the objection → a surprising angle → "what would you tell a friend over coffee". Follow tangents that produce good material; cut ones that don't.

After each answer, write a fragment block:
```
## [kind] — <one-line label>
<the user's material, lightly tidied, their phrasing kept>
```

### Step 3 — Consolidate & hand off

When you have enough: dedupe near-identical fragments, tag any that obviously pair up, and end with:
```
## Fragments: <topic>
File: <path>
Count: <N> fragments across <M> kinds (story, claim, example, definition, objection, ...)
Next: run /writing-beats <path> to shape these into a structured journey.
```

---

$ARGUMENTS

## See Also
- `/writing-beats` — turn this fragments file into a structured article journey.
- `/grill-me` — if the topic itself needs sharpening before you mine for material.
