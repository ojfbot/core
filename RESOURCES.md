# RESOURCES — shape-up

Vetted for the mission: *diagnose a planning system with Shape Up as the lens, and decide what to
adopt without cargo-culting it.* Internal-first per D19 — for a question about **this fleet's**
planning machinery, the fleet's own records are the primary sources, and a blog post about Shape Up
is not.

Five sources. Pruned, not collected.

## Primary — read for this lesson

**R1 · Shape Up §3.5 "Decide When to Stop"** — `raw/shape-up-ryan-singer.md`, SECTION 16 ·
https://basecamp.com/shapeup/3.5-chapter-14
*The one to go deeper on.* Contains the two named conditions under which the circuit breaker is
*not* applied (must-haves that survived scope hammering; all remaining work downhill), plus
compare-down-to-baseline as the stop heuristic. This is the chapter that turns "cancel by default"
from a slogan into a rule with an exception you can state. **Read verbatim, 2026-08-04.**

**R2 · Shape Up §1.2 "Set Boundaries"** — `raw/shape-up-ryan-singer.md`, SECTION 05 ·
https://basecamp.com/shapeup/1.2-chapter-03
Source of the cleanest formulation in the book: *"Estimates start with a design and end with a
number. Appetites start with a number and end with a design."* Also fixed-time/variable-scope, and
Singer's own worked example (writing this book: typos vs. an extra section, with one week left).
**Read verbatim, 2026-08-04.**

**R3 · Shape Up §2.2 "The Betting Table"** — `raw/shape-up-ryan-singer.md`, SECTION 10 ·
https://basecamp.com/shapeup/2.2-chapter-08
The circuit breaker's three stated effects: caps runaway investment, routes overrun back to
*shaping* rather than to more execution, and creates the pressure that makes scope-cutting
rational. **Read verbatim, 2026-08-04.**

## Internal — the system being diagnosed

**R4 · `~/selfco/wiki/concepts/control-gated-slices.md`** (core ADR-0086)
What Control-Gated Slices actually specifies: Entrance Criteria, Success Criteria as MOE→MOP→TPM,
Brassboard/shadow stage, RIDM promotions data-gated on measured TPMs, and — decisively for this
lesson — *"On breach → stay in Brassboard; corrective action prescribed; re-sample."* That is a
stopping rule for **measurement breach**. Reach for this when the question is what the fleet's
method does, not what it should do.

**R5 · `core/decisions/adr/draft-comprehension-heatmap-zpd-role.md`, R5**
*"A harness that is never invoked is theatre with a log file, and retiring it is the loop working."*
The fleet's own circuit-breaker rule, written without the name, at harness altitude rather than
project altitude. Reach for this when testing whether an adoption is genuine: the principle is
already accepted here, which changes the adoption question from "should we?" to "why only there?"

## Gaps — honest, and they bound the lesson

- **Parts 1 and 3 are read only in the sections above.** §1.1, §1.3–1.5, §3.1–3.4, §3.6–3.7 and
  all appendices are archived but unread. Anything this lesson says about shaping *technique*
  (breadboarding, fat marker sketches) would be uncited — so it says nothing about them.
- **No field evidence on Shape Up in practice outside Basecamp.** The book is n=1 by its own
  account, and `#383` (field evidence) has never been run. Appendix §4.1 "Adjust to Your Size" is
  the book's own answer to that objection and is unread. Any claim that the method transfers is
  currently unsourced in both directions.
- **`~/selfco/wiki/synthesis/shape-up-vs-control-gated-slices.md` is not a source, it is prior
  output** — written earlier today by the same agent authoring this lesson. Citing it as evidence
  would be circular. It is listed here only so a later session knows it exists and knows why it was
  deliberately not cited.
- **The termination test is a construct.** The three-question instrument in lesson 0001 is not
  Singer's framework. It is assembled from R1–R3 to serve this mission. A learner repeating it as
  "Shape Up's diagnostic" would be overstating the source — flagged in the lesson body too.
- **ADR-0086 is read through the vault page (R4), not the ADR itself.** The vault page's own Open
  Questions note that ADR-0086 "is referenced but not yet in the vault."
