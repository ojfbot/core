---
type: roadmap
slug: rm-kebab-stable-id           # immutable identity (ADR-0087). Convention: rm-<northstar-slug>.
northstar: kebab-stable-id         # the northstar this roadmap closes gaps against. Must be registered.
status: active                     # active | paused | done
phases:
  - id: PH1                        # stable phase id. Assigned once, never reused.
    name: "What this phase delivers as a whole"
    goal: "The observable end-state of the phase."
slices:
  - id: S1                         # stable slice id. Assigned once, never reused. Ref: rm:<slug>#S1
    phase: PH1                     # must resolve to a phases entry above
    title: "Imperative, one-session scope"
    advances: "ns:<northstar-slug>#P<n>"   # must resolve, and point into this roadmap's northstar
    moves_from: 0                  # property % this slice starts from
    moves_to: 0                    # property % it should leave behind (>= moves_from)
    deliverable: "The named artifact a reviewer can point at (PR, recording, file, endpoint)."
    entrance: "What must be true before dispatch (human-asserted when flipping status to ready)."
    success: "What the gate checks at the slice boundary — verifiable on the PR."
    autonomy: gate-0               # merge gate: gate-0 (human merges) | gate-1 | gate-2
    claimable_by: either           # optional: human_only | agent_eligible | either (default)
    kind: m                        # optional: s | m | l queue TTL class (default m)
    repo:                          # optional: repo the work lands in (default: the northstar's app)
    status: queued                 # queued | ready | dispatched | delivered | merged | dropped
    depends_on:                    # optional: rm:<slug>#S<n> that must be merged first
---

# Roadmap — <northstar name>

**Route.** <One paragraph: how these phases close the property gap(s), and why this order.>

## PH1 — <phase name>

<Prose: the slices in this phase, what each delivers, and how the phase's end-state is observable.>
