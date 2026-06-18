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

## Gotchas

- **Smoothing the user's phrasing into your own voice destroys the one thing you're here to capture.** The reflex to "clean up" their answer strips the asset — their voice, their odd metaphor, their actual word choice. Write fragments verbatim-ish (lightly tidied at most); `/writing-shape` decides final phrasing later. A polished fragment in your voice is worse than a rough one in theirs.
- **Batching questions collapses the interview into a survey.** One pointed question at a time, building on the last answer, is what pulls out the material people don't know they have. A list of five questions gets five short, flat answers — the tangents that produce the best fragments only surface when you follow the previous answer.
- **Chasing depth on one thread starves variety, which is the actual goal.** When a great anecdote lands, the pull is to mine it dry. Resist — the brief is ~8–15 fragments across *kinds* (story, claim, example, definition, objection, metaphor). A file that's all stories and no objections gives `/writing-beats` nothing to build tension from.
- **Structuring while gathering is premature and contaminates the next step.** The urge to outline or order fragments as they arrive defeats the design — fragments are unordered on purpose so `/writing-beats` can find the spine fresh. Tag obvious pairs at consolidation, but don't sequence; an early outline anchors the article before you know what you have.
- **`mktemp` plus not reading an existing file clobbers prior material.** If a fragments file already exists for this project, append to it — read it first. Spinning up a fresh temp file mid-project silently abandons earlier fragments the user expects to still be there.

---

$ARGUMENTS

## See Also
- `/writing-beats` — turn this fragments file into a structured article journey.
- `/grill-me` — if the topic itself needs sharpening before you mine for material.
