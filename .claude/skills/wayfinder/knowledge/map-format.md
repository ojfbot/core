# Wayfinder map format

The map is file-canonical at `core/decisions/wayfinder/<slug>.md`; GitHub child issues are the
projection (`adr:wayfinder-decision-maps`). Slug: kebab-case initiative name, no date.

## Map file

```markdown
---
type: wayfinder-map
slug: <initiative-slug>
northstar: <ns-slug or omit>          # optional anchor; resolve-or-fail when present
tracker_issue: <#NNN — the map's umbrella issue, labelled wayfinder:map>
status: charting | working | handed-off
---

# Wayfinder — <initiative name>

## Destination

Named FIRST — what "arrived" looks like, in one paragraph. When northstar-anchored, cite the
properties this initiative serves (`ns:<slug>#P<n>`). The Destination fixes scope: everything
below is judged against it.

## Notes

Free-form context: constraints discovered, links, background.

## Decisions so far

An INDEX, not a store — one line per closed ticket: gist + link to the ticket (and ADR when the
grilling staged one). The decision itself lives in the ticket/ADR.

- <one-line gist> — <ticket title> (#NNN) [→ adr:<slug> if applicable]

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| <title> (#NNN) | research \| grilling \| prototype \| task | <titles or —> | open \| claimed \| closed |

## Not yet specified

In-scope fog: things that belong to the Destination but whose QUESTION can't be stated precisely
yet. Graduates to a ticket the moment the question is statable (the test is the question, not the
answer). Reviewed every work session.

## Out of scope

Ruled beyond the Destination — closed, never graduates. Each line says who ruled it and when.
```

## Ticket issue template

Each child issue is labelled `wayfinder:<type>` and linked to the map issue as a sub-issue with
the tracker's native blocked-by relationship (so the frontier — open + unblocked + unclaimed —
renders in the tracker UI).

```markdown
## Question

The single decision this ticket exists to make, stated precisely. One ticket = one decision =
one session.

## Type

research (AFK, serialized deep-research → decisions/research/) | grilling (HITL, /grill-with-docs)
| prototype (HITL, /prototype) | task (manual unblocking work)

## Context

What's known; links to the map, prior closed tickets, and any facts already gathered.

## Blocked by

Native blocked-by refs to gating tickets, or "None — on the frontier".

## Resolution (filled at close)

The decision made (by the user, for grilling/prototype), evidence/artifact links, and which
blocked tickets this unblocks / which fog it graduates / what it invalidates.
```

## Invariants

- Claim = assignment, set before any work; one ticket per session.
- Charting session closes zero tickets.
- Research tickets: one deep-research cycle at a time, findings to `decisions/research/`.
- Answers never touch `status.jsonl` — decisions and deliveries are separate ledgers.
- On handoff: map `status: handed-off`, umbrella issue closed with a pointer to the spec/slices
  it refined into.
