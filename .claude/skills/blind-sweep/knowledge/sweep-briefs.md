# Sweep briefs — territory reading, entry angles, and the per-sweep brief

Reference for `/blind-sweep` Steps 1–2, moved verbatim from SKILL.md.

## Read the territory first

Before any sweep: read the area. Entry points, dependencies, tests, recent commits, any `CONTEXT.md` / `GLOSSARY.md` / architecture doc / ADRs touching it. Anything you can answer by looking, answer by looking — a sweep that "surfaces" a fact sitting in the README wastes the user's attention and inflates the result.

## The three entry angles and the brief

Vary the entry angle so they don't converge by construction:

- **Sweep A — operational:** what breaks in production; failure modes, limits, ops burden.
- **Sweep B — integration:** what this touches; contracts, callers, migration, blast radius.
- **Sweep C — domain-convention:** what work of this kind conventionally handles that this area doesn't visibly handle.

Brief for each:

> You are doing a blind-spot pass on `<area>` in this repo. Read it. Report: (1) the domain-standard considerations work of this kind usually covers, and whether this area visibly covers each; (2) questions someone experienced would ask that a newcomer wouldn't know to; (3) what you could NOT determine from the repo. Be concrete and cite files. Do not speculate about intent. If you don't know, say so — a short honest list beats a long plausible one. Return JSON: `[{item, box, evidence, confidence}]` with box ∈ `known-unknown|unknown-known|domain-standard`.

(If the Agent tool is unavailable, degrade to three strictly separated runs. Never collapse them.)
