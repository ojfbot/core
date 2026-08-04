# MISSION interrogation, RESOURCES vetting, and the glossary gate

D18–D20 and D24 from `decisions/adopt-stack/pocock-skills-teach.md`.

## MISSION.md — interrogated first, never assumed

The mission is written **before** any resource is gathered and any lesson is placed. It is built by
asking one question at a time, in conversation — not by inferring a topic from the session and
proceeding.

Ask, in roughly this order:

1. **What do you want to be able to do that you can't do now?** Push until the answer is a
   capability. "Understand EWMA" is a subject; "read a heatmap cell and say whether to worry" is a
   mission. Subjects produce surveys; missions produce lessons.
2. **What have you already tried?** This is where the real ZPD signal lives — a failed attempt names
   the frontier far more precisely than a self-assessment does.
3. **What's the forcing function?** A deadline, a PR, a conversation they have to hold. It sets the
   depth and it decides what to cut.
4. **Where do you suspect your model is wrong?** Often the most useful answer in the interview, and
   it is never volunteered unprompted.

Record the answers in their words. `MISSION.md` is read at every subsequent placement decision, so
paraphrasing it into agent-voice loses the signal you gathered.

## RESOURCES.md — never trust parametric knowledge

The first job on any topic is finding high-trust sources. Not recalling them — finding them.

**Fleet-internal artifacts are first-class primary sources** (the local amendment to D19). For a
topic internal to this system — a hook, a ledger, an ADR's reasoning, a wayfinder ruling — the
fleet's own artifacts *are* the primary sources, and an external link is at best background. Reach
for `decisions/adr/`, `decisions/wayfinder/`, `domain-knowledge/`, repo `CONTEXT.md`, and
`~/selfco/wiki/synthesis/` pages first.

Every entry is annotated:

```markdown
- **<source>** — what it covers · when to reach for it · trust basis
```

**Prune ruthlessly.** Five sharp sources beat thirty mediocre ones; a long list is a way of avoiding
the judgment call about which source is actually good.

Keep an explicit section:

```markdown
## Gaps
- <what you could not source, and what you'd need to answer it>
```

The gaps section is not an apology. It is the honest record of where the lesson is standing on
thinner ground, it drives the next search, and it is what stops an unsourced claim from being
smoothed into the lesson prose.

### Community delegation — external domains only

For external domains (systems engineering, F1, golf CV, FDE practice) wisdom comes from real-world
interaction: attempt an answer, then point at a high-reputation community for the judgment calls
that reading cannot settle. Respect opt-out.

**Omit this entirely for fleet-internal topics.** There is no community for this system's own code,
and a subreddit recommendation inside a lesson about `merge-quiz.mjs` is noise that costs the
lesson's credibility.

## The reference/lesson split

Lessons are rarely revisited; reference documents are (D24). Build both, and know which you are
writing: a lesson creates the understanding once, a reference is what stays on the desk.

## Glossary — the understanding gate

The glossary is opinionated canonical language, and its growth rule is the interesting part:

**A term is added only once the learner understands it.** Definitions use only terms already in the
glossary. So the glossary cannot run ahead of comprehension, and its size is itself evidence of
learning rather than evidence of coverage.

This is a direct extension of the fleet's ubiquitous-language invariant (`domain-knowledge/
CONTEXT.md`, `GLOSSARY.md`, ADR-0044) — reuse those terms where they apply rather than minting
parallel vocabulary for the same concept.
