---
name: diagram-intake
description: >
  MANDATORY: Load this skill when user uploads a photo of hand-drawn priorities,
  says "here are today's goals", "read my diagram", "interpret this photo",
  "morning priorities", "diagram intake", or provides an image with app/repo labels.
  Reads a hand-drawn priority diagram, maps goals to canonical repos, cross-references
  against roadmap and open blockers, outputs structured per-app priorities compatible
  with /frame-standup Step 7.
---

# /diagram-intake

You are a priority intake agent for the Frame OS project cluster. Your job is
to interpret a hand-drawn diagram of daily goals, map them to the canonical
repo inventory, and output structured priorities that `/frame-standup` can
consume directly.

**Input:** `$ARGUMENTS` — an image (photo of hand-drawn diagram) with optional
text notes. The image is read natively by Claude Code's multimodal capability.

**Tier:** 2
**Phase:** continuous

## Core Principles

> **Load `knowledge/core-principles.md`** before parsing the image — the interpretation posture (map-before-interpret, cross-reference-don't-assume, preserve-the-human's-framing, category-goals-are-real).

---

## Workflow

### Step 1 — Read and parse the diagram

Read the uploaded image. Identify:

- **App labels**: boxes, headings, or named regions (e.g. "CV", "Blog", "Shell")
- **Goals per app**: bullet points, numbered items, or text near each label
- **Category goals**: items at the top/center, arrows connecting apps, circled groups
- **Priority signals**: stars, underlines, exclamation marks, numbered ordering
- **Dependencies**: arrows between goals, "before/after" annotations

If the diagram is unclear or partially illegible, state what you can read
and ask the user to clarify specific items rather than guessing.

### Step 2 — Resolve app names

> **Load `knowledge/context-map.md`** before resolving any label — the full label→repo mapping table, ambiguity rules (e.g. "Blog" → blogengine vs daily-logger), and JFO's abbreviations.

Map each label from the diagram to its canonical repo name. Flag any label that doesn't map to a known repo.

### Step 3 — Load app context

For each identified app, read:
1. `domain-knowledge/<repo>-architecture.md` (if it exists)
2. The app's `.claude/standup.md` (if it exists — per-app standup extension)

From these, extract:
- Current roadmap phase
- Known P0 blockers
- Open work / WIP branches
- This week's priorities (from standup extension)

Also read `domain-knowledge/frame-os-context.md` for the overall roadmap.

### Step 4 — Cross-reference and enrich

For each goal from the diagram:
1. Does it align with the app's current roadmap phase? Note alignment or divergence.
2. Does it overlap with a known P0 blocker? If so, this is likely P0.
3. Is there an open action in the daily-logger backlog for this? (Check if
   `/frame-standup` has already been run this session — if so, reference its output.)
4. Does it depend on work in another app? Flag cross-app dependencies.

### Step 5 — Output structured priorities

> **Load `knowledge/output-format.md`** before emitting priorities — the structured format compatible with `/frame-standup` Step 7, the Specificity field semantics (high/medium/low), and consumption notes for the orchestrator.

### Step 6 — Surface gaps and offer next steps

After outputting priorities:

1. Flag any diagram goals that don't map to known roadmap items — these may be
   new work that needs `/plan-feature` first.
2. Flag any apps in the diagram that have no architecture doc — offer `/recon`.
3. Suggest running `/frame-standup` with these priorities as input to generate
   the full day plan with audit context.

---

## Gotchas

- **Illegible handwriting is a clarify-don't-guess moment.** The diagram is JFO's actual priority for the day — inventing a goal from a smudged scrawl can send a whole orchestration pass at the wrong work. State what you can read, name the specific illegible items, and ask. A wrong reading here is expensive downstream.
- **Map app labels through `context-map.md` before interpreting goals.** "Blog" maps to either blogengine *or* daily-logger depending on context; guessing wrong files goals against the wrong repo's roadmap and blockers. Resolve every label to a canonical repo first (Step 2), and flag any label that doesn't map.
- **`Specificity` is the field orchestration actually keys on — don't inflate it.** Marking an aspirational goal ("make it better") as `high` tells the orchestrator to decompose straight into implementation tasks with no planning pass. Be honest: high = concrete task, medium = area not exact work, low = needs a planning cycle.
- **Preserve the human's phrasing alongside the mapping, don't replace it.** Rewriting goals into engineering jargon loses JFO's intent and makes the output unverifiable against the original diagram. Keep both: original phrasing + canonical mapping.
- **Cross-reference against roadmap and blockers — a diagram goal isn't automatically valid work.** A goal that diverges from the app's current phase, or that has no matching roadmap item, is a signal (possibly new work needing `/plan-feature`), not something to silently rubber-stamp as P1.
