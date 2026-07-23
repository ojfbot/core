---
type: wayfinder-map
slug: f1-learning-studio
tracker_issue: "#257"
status: working
---

# Wayfinder — F1 learning studio

## Destination

Both-coupled, 50/50 (operator-confirmed 2026-07-22): (a) a **learning engine** — Jim's race-engineering
and AI-development competency loop, practiced against real data through the F1 stack — and (b) a
**publishing pipeline** — claim-checked artifacts flowing substrate → pit-wall → press-room →
blogengine on a cadence. Arrived means both loops run and feed each other. Serves
`ns:l1-f1-pit-wall#P5` (every surface exports teachable, provenance-stamped material),
`ns:l1-f1-press-room#P1` (claims trace to bundled evidence), `#P2` (artifacts ship across two axes
and three registers), `#P3` (programmatic video); blogengine is the publishing surface.

## Notes

- All three F1 repos have GitHub remotes, northstars, and registered roadmaps (memory of press-room
  as local-only is stale — corrected 2026-07-22).
- The device/selfco-server initiative was explicitly ruled out as this map's subject (too
  hardware-dependent right now; Obsidian self-hosting judged over-engineered, migrating back to
  hosted sync).
- OPM composes as an instrument here (ADR-0102 merged): the pipeline-model ticket doubles the OPM
  pilot's evidence base beyond daily-logger (`rm:rm-l2-ojfbot#S31`).

## Decisions so far

(None — charted 2026-07-22; zero tickets resolved at charting, per "plan, don't do".)

## Tickets

| Ticket (refer by name) | Type | Blocked by | Status |
|------------------------|------|------------|--------|
| decide the shared spine — does every learning unit yield a publishable artifact? (#258) | grilling | — | open |
| seed OJF-OPL model of the substrate→pit-wall→press-room→blogengine pipeline (#259) | task | — | open |
| research: how do race-engineering and AI-dev learning programs structure curriculum and practice? (#260) | research | — | open |
| decide the publishing contract — how do press-room artifacts enter blogengine? (#261) | grilling | — | open |
| decide the unit of learning practice and where retention lives (#262) | grilling | shared spine (#258) | open |
| decide which press-room registers map to which blogengine outputs, at what cadence (#263) | grilling | shared spine (#258), publishing contract (#261) | open |
| decide which pit-wall/substrate surfaces double as practice harnesses (#264) | grilling | unit of practice (#262) | open |
| prototype: one end-to-end artifact — pit-wall export → press-room claim-check → blogengine draft (#265) | prototype | publishing contract (#261) | open |

Frontier at charting: shared spine (#258), OPM pipeline model (#259), learning-programs research
(#260), publishing contract (#261).

## Not yet specified

- How programmatic video / RPM-style shorts fit the publishing cadence — question becomes statable
  once the publishing contract and registers are decided.
- The portfolio/audience tie-in (hired-projects track) — whether studio outputs are explicitly
  shaped for it.
- Whether publishing cadence gets automated via day-run dispatch once the pipe exists.
- Whether the learning loop wants spaced-repetition tooling beyond what the practice harnesses
  provide (seh-study's Leitner machinery is adjacent but unproven here).

## Out of scope

- Building or configuring always-on hardware (Pi/Mac mini) — ruled by the operator at charting,
  2026-07-22.
- Self-hosted Obsidian sync — ruled by the operator at charting, 2026-07-22 (migrating back to
  hosted).
