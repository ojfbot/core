---
name: writing-beats
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "writing-beats", "outline this
  article as a journey", "structure my post", "what's the beat sheet for this piece", "turn
  my fragments into a structure", "develop this section by section". Structures an article as
  an ordered sequence of beats — each beat a decision point the reader passes through — then
  develops one beat at a time, getting sign-off before advancing. Output: a beat sheet, then
  drafted beats in order. Takes raw material from /writing-fragments; hands polished beats to /writing-shape.
---

# /writing-beats

You are structuring an article as a **journey**: an ordered list of beats, where each beat moves the reader from one state of understanding to the next. You develop them one at a time and don't advance until the current beat lands.

**Input:** $ARGUMENTS — a fragments file (from `/writing-fragments`), an outline, or a topic + pile of notes.

**Tier:** 2 — Multi-step procedure
**Phase:** continuous (writing pipeline, step 2 of 3: `/writing-fragments` → here → `/writing-shape`)

## Core Principles

1. **Every beat earns its place** — a beat either changes what the reader believes, gives them something they need to proceed, or pays off something promised earlier. If it does none of those, cut it.
2. **Order is the argument** — the sequence of beats *is* the article's logic. Get the spine right before writing any prose.
3. **One beat at a time** — draft the current beat, show it, get a yes, then move on. Don't run ahead.
4. **Branch points are explicit** — where a reader might object, get lost, or split ("if you already know X, skip to…"), name it as a beat decision, don't paper over it.
5. **Prose here is provisional** — beats are drafted in plain, slightly rough prose; final shaping is `/writing-shape`'s job.

## Workflow

### Step 1 — Read the material

Load the fragments file / notes. Identify the through-line: what does the reader believe at the start, what should they believe at the end?

### Step 2 — Lay the beat sheet

Produce an ordered list. Each entry:
```
### Beat N — <label>
Purpose: <belief-change | needed-info | payoff>
Reader goes from: <state> → <state>
Raw material: <which fragments feed this>
Risk: <where they might object / get lost — or "—">
```
Show the whole sheet. Get the user to approve / reorder before drafting anything.

### Step 3 — Develop beats one at a time

For the current beat: pull in its fragments, draft it in plain prose (a few paragraphs), show it, ask "does this land? next beat or revise?". Only advance on a yes. Track progress against the sheet.

### Step 4 — Hand off

When all beats are drafted:
```
## Beats: <title>
File: <path>
Beats: <N> drafted, in order
Next: run /writing-shape <path> to turn these beats into finished article prose.
```

## Gotchas

- **The "one beat at a time" rule breaks the instant you draft beat 3 while showing beat 2.** The strong pull is to keep momentum and run ahead — but the whole point of beat-at-a-time is that a rejected beat 2 invalidates the beats built on it. Draft, show, wait for the yes, *then* advance. Running ahead silently wastes the work you're proud of.
- **A beat sheet approved too fast is the expensive mistake.** Reordering beats is cheap on the sheet and ruinous after they're drafted as prose. If the user waves the sheet through, push once on the spine — "does this order actually carry the argument?" — because Step 3 assumes the sequence is settled.
- **Polishing prose here steals work from `/writing-shape` and wastes it.** Beats are *provisional, slightly rough* prose by design. Time spent perfecting sentences in a beat is time `/writing-shape` will overwrite when it decides the paragraph should be a table or a list. Draft for "does the idea land," not "does it read finished."
- **A beat that only summarizes earlier beats earns no place.** Every beat must change a belief, supply needed info, or pay off a promise (Core Principle 1). "Recap" beats and throat-clearing transitions feel safe but violate the rule — cut them, or fold them into the beat they're propping up.
- **Naming the Risk/branch point is the part most likely to get skipped.** Where a reader objects or gets lost is exactly where articles fail, and the beat-sheet template has a Risk field precisely so you confront it. Leaving it as "—" by reflex papers over the hard transitions; fill it honestly or the journey has a hidden cliff.

---

$ARGUMENTS

## See Also
- `/writing-fragments` — generate the raw material first if you don't have it.
- `/writing-shape` — turn the drafted beats into polished, formatted prose.
- `/council-review` — run the finished draft past the persona council before publishing.
