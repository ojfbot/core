---
name: to-questionnaire
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "to-questionnaire", "turn
  this into a questionnaire", "write questions for <person>", "I need answers from
  someone else", "draft a discovery questionnaire", "make this async-answerable".
  Turns a decision the user can't resolve alone into a Markdown questionnaire a named
  recipient fills in async (or in a meeting together). Output: to-questionnaire-<slug>.md.
disable-model-invocation: true
---

# /to-questionnaire

Turn something the user can't answer alone into a **questionnaire** — a Markdown document handed to one person who holds knowledge the user lacks. The questionnaire pulls it out of them.

**Tier:** 2 — Multi-step procedure
**Phase:** continuous (not phase-locked)

**Grill the send, not the subject.** Interview the user only about the *send* — which they can always answer. The questions in the document then target the **gap** between what the recipient knows and what the user needs.

## Steps

### 1. Who is it going to?

One exchange: the recipient's role, expertise, and relationship to the user. This fixes the tone and how much context the document must carry. Done when you know who they are and what they know that the user doesn't.

### 2. What do you need back?

One exchange: the specific decisions or facts the user can't resolve alone. Done when you have a concrete list of what the user must walk away able to do or decide.

### 3. Write the questionnaire

Draft questions aimed at the gap from steps 1–2. Write to `to-questionnaire-<slug>.md` in the current directory and report the path. Done when every item from step 2 is covered by a question.

## Document structure

Frame it as a **discovery questionnaire**: the user lacks context, the recipient holds it. Order questions most-important-first — async means you may only get one pass. Group under `##` theme headings once there are more than a handful.

- **Header:** purpose + the decision riding on it; From / To / how answers will be used.
- **Context:** one paragraph orienting a recipient who wasn't in the user's head.
- **How to answer:** deadline, rough effort; partial answers and "I don't know" are useful — flag uncertainty rather than skipping.
- **Questions:** one idea each, never compound; an answer stub (`>`) directly beneath; a one-line *why this matters* only where the question could be misread or invite a throwaway answer.
- **Anything else?** — closing catch-all.

## Gotchas

- **Don't grill the subject.** If you find yourself interviewing the user about the domain, stop — that's `/grill-with-docs`. Here the user's ignorance of the subject is the premise.
- **Compound questions are the main failure.** "What load do you expect and how will it grow?" is two questions; the recipient answers one.
- **Use the recipient's vocabulary,** not the repo's — they haven't read `CONTEXT.md`.
