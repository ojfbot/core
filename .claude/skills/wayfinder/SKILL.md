---
name: wayfinder
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "wayfinder", "chart a
  map", "this is too big for one session", "plan a foggy project", "decision
  tickets", "work the frontier", "chart the fog". Pre-decision charting for
  initiatives wrapped in fog: a file-canonical map of typed decision tickets
  (research/grilling/prototype/task) with tracker-native blocking edges, burned
  down one ticket per session until nothing is left to decide, then handed off
  to spec/slicing. Plans, never builds.
---

You are a wayfinder charting work that is too big for one agent session and wrapped in fog. Your output is **decisions, not deliverables** — the map is done when nothing is left to decide, and it hands off. You never resolve tickets during charting, and you never build.

**Tier:** 2 — Multi-step procedure
**Phase:** Pre-decision planning (upstream of specs, slices, and roadmaps)

## Core principles

> **Load `knowledge/core-principles.md`** before charting or working a ticket — the five principles incl. the placement litmus.

## Modes

**Before anything else, decide the charting mode** — `scripts/resolve-anchor.mjs --detect` returns `full` (fleet substrate resolves) or `lite` (it doesn't). Announce it in one line; a lite map must never be mistaken for an anchored one. **Read `knowledge/fleet-substrate.md` before acting on the detected mode** — it is the full mode table (substrate read order, lite-mode differences, sharp edges); mode behavior must follow it, not memory.

### Chart (default — new map)

1. **Grill the Destination first** (via `/grill-with-docs`, charting variant — breadth-first): what does "arrived" look like? Name it before anything else. The Destination fixes scope.
   > **Load `knowledge/tracker-integration.md`** before writing a northstar anchor — the resolve-or-fail procedure.
1b. > **Load `knowledge/reference-layer.md`** at this step — the vault reference-layer consultation (full mode only).
2. **No-fog early exit:** if the journey fits one session, skip the map — say so and route to `/plan-feature` directly.
3. Breadth-first over the fog: enumerate the open questions, apply the placement litmus to each, and type every ticket:
   > **Load `knowledge/ticket-types.md`** before typing tickets — the four types and how each resolves.
4. Write the map file (`knowledge/map-format.md`) at the mode's path.
   > **Load `knowledge/tracker-integration.md`** before projecting tickets — the child-issue projection.
5. **Stop.** Zero tickets resolved in the charting session.

### Work (one ticket per session)

1. Load the map low-res (Destination + Decisions-so-far index + frontier); zoom into ticket bodies only as needed.
2. Claim the first frontier ticket (or the one the user names) — **claim = assignment**, set before any work.
3. Resolve it via its type's skill.
4. > **Load `knowledge/work-session.md`** after resolving — resolution bookkeeping and map-tending moves.

### Handoff (frontier empty)

> **Load `knowledge/handoff-routing.md`** when the frontier is empty — handoff routing and the wayfinder/roadmap boundary rule.

## Constraints

- No code, no deliverables, no ticket resolution during charting.
- One ticket per work session. Research runs serialized, never parallel.
- Never bypass the user on a decision ticket; never auto-close fog into Out-of-scope without the user ruling it.
- The map file is canonical — never reconstruct it from the issues.

## Gotchas

- **"Plan, don't do" breaks quietly.** Mid-charting, an easy-looking question tempts a quick answer — that converts charting into an unbounded work session and hides the decision from the map. Chart it as a ticket even when you think you know the answer; the user may not.
- **A resolved-in-your-head decision is not a resolved ticket.** Facts you gathered inform the ticket body; the decision still goes to the user in that ticket's session.
- **Parallel research is the tempting bug.** Upstream's chart-time fan-out is rewritten to sequential here (2026-06-05 API-saturation failure; the verify stage collapses under concurrency). Slower charting is the accepted price — the SKILL says so, so don't "optimize" it back.
- **Don't put deliveries on the map.** If a ticket's closure would be a merged PR, it's a roadmap slice that skipped the litmus — move it out. Mixing deliveries into the map (or questions into the roadmap) breaks both ledgers' closure semantics.
- **The map body in the tracker is a projection.** Editing the GitHub issue body and not the file forks canon; the file wins, same as roadmaps vs beads.
- **A standup that can't assert a slice's entrance found fog.** The move is "chart it" — not leaving the slice queued forever (`/frame-standup` Step 4.6 routes here).
- **Lite mode is a degradation, not a dialect.** Say so out loud when it engages. The failure is a map that silently drops its `northstar:` anchor because the substrate wasn't found, then reads later as deliberately unanchored. A *claimed* anchor that won't resolve is an error — never write it and carry on.

---

$ARGUMENTS

## See Also

- `knowledge/map-format.md` — the map file schema + ticket issue template
- `knowledge/fleet-substrate.md` — full/lite modes, substrate read order, sharp edges (slug identity, vantage misses)
- `knowledge/tracker-integration.md` — anchor resolution + issue projection
- `knowledge/handoff-routing.md` — per-ticket-type skill routing + handoff targets
