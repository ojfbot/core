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

1. **Plan, don't do.** A wayfinder session either charts the map or works exactly one ticket. Resolving tickets during charting is the signature failure.
2. **The map is file-canonical; issues are the projection.** The map lives at `decisions/wayfinder/<slug>.md`; tickets are GitHub child issues with native blocking edges so the frontier renders in the tracker. Fix the map by editing the file (same posture as roadmap files vs compiled beads).
3. **Placement litmus** (`adr:wayfinder-decision-maps`): can you state `success` + a machine-runnable `check`? → it's a roadmap slice, not a ticket here. Can you state only the question precisely? → wayfinder ticket. Can't state the question yet? → `## Not yet specified` fog. Fog graduates to a ticket when the question — not the answer — becomes statable.
4. **Facts are gathered; decisions are the user's.** Charting may explore the repo freely, but every ticket's decision belongs to the user (grilling tickets are HITL by definition — an agent answering its own ticket has broken the loop).
5. **Refer by name.** Tickets are referenced by title in prose, never bare issue numbers.

## Modes

### Chart (default — new map)

1. **Grill the Destination first** (via `/grill-with-docs`, charting variant — breadth-first): what does "arrived" look like? Name it before anything else; if the map is anchored to a northstar, cite the properties (`ns:<slug>#P<n>`, resolve-or-fail). The Destination fixes scope.
2. **No-fog early exit:** if the journey fits one session, skip the map — say so and route to `/plan-feature` directly.
3. Breadth-first over the fog: enumerate the open questions, apply the placement litmus to each, and type every ticket:
   - `research` (AFK) — resolved via the **deep-research harness, ONE cycle at a time** (sequential-research rule; a charting session that fans research out in parallel is a bug, not a speedup); findings filed to `decisions/research/`, never throwaway branches.
   - `grilling` (HITL, the default) — resolved via `/grill-with-docs`; its in-loop ADR stubs give `## Decisions so far` real `decisions/adr/` entries to index.
   - `prototype` (HITL) — resolved via `/prototype`; artifact linked from the ticket (disposition per `/prototype`, incl. the kept-branch primary-source option).
   - `task` (either) — manual unblocking work: provisioning, access, data moves.
4. Write the map file (`knowledge/map-format.md`), then create the child issues labelled `wayfinder:<type>` in dependency order, wiring blocking edges with the tracker's native blocked-by relationship — the **frontier** (open + unblocked + unclaimed) must render in the tracker. Sized so each ticket fits one session.
5. **Stop.** Zero tickets resolved in the charting session.

### Work (one ticket per session)

1. Load the map low-res (Destination + Decisions-so-far index + frontier); zoom into ticket bodies only as needed.
2. Claim the first frontier ticket (or the one the user names) — **claim = assignment**, set before any work.
3. Resolve it via its type's skill. Post a resolution comment, close the issue, append a one-line gist + link to `## Decisions so far` (an **index, not a store** — the decision lives in its ticket/ADR).
4. Tend the map: graduate fog whose question became statable; move ruled-out items to `## Out of scope`; flag tickets the new decision invalidated.

### Handoff (frontier empty)

The charted decisions are exactly what make `entrance`/`success`/`check` statable — so don't park a spec: run `/plan-feature --from-conversation` → `/orchestrate --emit=github-issues`, and when the map is northstar-anchored, append the resulting slices to that northstar's roadmap (the map is a **slice refinery**). For initiatives carrying enforcement/automation controls, hand to `/gated-slice` instead. Then mark the map `status: handed-off`.

**Boundary rule:** open question is *what/whether* → wayfinder. *How to ship safely in stages* → `/gated-slice`. Once sliced → roadmap slices dispatched by `/day-run`. (Wayfinder tickets are questions closed by answers; roadmap slices are deliveries closed by merged PRs — two ledgers, never merged: answers never touch `status.jsonl`.)

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
- **A standup that can't assert a slice's entrance found fog.** The move is "chart it" — not leaving the slice queued forever (`/frame-standup` cross-ref).

---

$ARGUMENTS

## See Also

- `knowledge/map-format.md` — the map file schema + ticket issue template
- `decisions/adr/0101-wayfinder-decision-maps.md` — the governing decision (adapted from mattpocock/skills v1.1, verdicts D11–D13)
- `/grill-with-docs` (grilling tickets, charting variant) · `/prototype` (prototype tickets) · `/gated-slice` (post-decision staging) · `/plan-feature --from-conversation` + `/orchestrate --emit=github-issues` (handoff)
