# ojfbot/core

The fleet's skill home and decision registry. This file is the **glossary and nothing
else** — no implementation details, no specs, no status. Terms land here the moment they
are resolved (usually mid-grill), not in batches. A term MAY carry one `→ deeper:` pointer
to the page that holds its full treatment; the pointer is a citation, not content.
Convention: `adr:context-md-glossary-pointer-convention` (draft) /
`decisions/adopt-stack/pocock-skills-v1-2.md` D38.

## Language

**Bead**:
A small, dated markdown file in `.handoff/` carrying inter-session context — a brief,
report, or decision. Self-report, not ground truth: verify against git + tracker before
acting on one.
_Avoid_: handoff doc (that's `/handoff`, a post-ship runbook), note
→ deeper: `.claude/skills/bead/SKILL.md`

**Slice**:
A vertical, tracer-bullet unit of work — traverses every relevant layer, independently
demoable, fits one context window.
_Avoid_: task, ticket (a slice is scoped by demoability, not by tracker row)

**Northstar**:
A repo's single long-horizon aim, recorded in `decisions/northstar/`. Roadmaps hang under
it; slices move it.
_Avoid_: goal, vision

**Wayfinder map**:
A file-canonical chart of a foggy initiative at `decisions/wayfinder/<slug>.md`, burned
down via **decision tickets** — tracker issues holding *questions* whose resolution is a
decision, not a build.
_Avoid_: plan (a map precedes planning), roadmap (that's post-decision)

**Control gate**:
An entrance/success-criteria checkpoint between slices; promotion through it is data-gated
(RIDM), never vibes-gated.
→ deeper: `decisions/adr/` (adr:control-gated-slices)

**Absorb / Wrap / Reject**:
The three verdicts of an `/adopt-stack` pass over an external opinion: re-express it in
fleet primitives / isolate it behind an adapter / decline it with a recorded reason.
Vendoring is not a verdict.
→ deeper: `decisions/adopt-stack/`

**Skill**:
A packaged instruction set under `.claude/skills/<name>/`, catalog-registered, invoked as
`/<name>`. Git-canonical here; user-scope skills are symlinked to `~/.claude/skills/`.
_Avoid_: command, plugin (a plugin is a distribution channel, rejected — ADR-0083)

## Relationships

- A **Northstar** is moved by **Slices**; a roadmap orders them; **Control gates** sit between them
- A **Wayfinder map** precedes a roadmap; its **decision tickets** resolve into specs and slices
- A **Bead** carries context *between* the sessions that build slices
- An `/adopt-stack` pass produces **Absorb/Wrap/Reject** verdicts; absorbed opinions become or amend **Skills**

## Flagged ambiguities

- "handoff" — resolved: `/bead` owns inter-session continuity; `/handoff` owns post-ship
  runbook docs. Never interchangeable.
- "ticket" — an implementation unit lives in the tracker as an issue backing a **Slice**;
  a **decision ticket** is a wayfinder question. The qualifier is load-bearing.
