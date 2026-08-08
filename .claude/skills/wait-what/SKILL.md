---
name: wait-what
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks "wait-what", "wait, what",
  "you lost me", "that didn't land", "re-pitch that", "back up — I don't follow",
  "I stopped following". User-invoked only — never self-invoke; only the user knows
  when comprehension failed. Re-pitches what was just said with the missing context,
  in plain English, using the project's ubiquitous language.
disable-model-invocation: true
---

Wait — the user did not follow where you've got to. Re-pitch that: back up as far as needed (what lost them is usually bigger than one message), give the context they were missing, talk in ASD-STE100 Simplified Technical English, and use the ubiquitous language from the nearest `CONTEXT.md` (search ancestors; fall back to repo `CLAUDE.md` and `domain-knowledge/`).

Shorter **and** clearer — add the missing premise, don't just delete words.

<!-- This body is ≤4 lines by design (see decisions/adopt-stack/pocock-skills-v1-2.md D37).
     Skills that fight verbosity fail by growing. Do not add Tier/Phase/Gotchas scaffold. -->
