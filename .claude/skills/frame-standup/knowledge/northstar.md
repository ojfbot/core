# Northstar framing for the day plan

How `/frame-standup` Step 4.6 + Step 5 use the three-tier northstar. The canonical schema and
registry live in `core/decisions/northstar/` (README + `draft-three-tier-northstar`).

## What loads

`scripts/read-northstar.mjs` returns:
- `default` — the **L2 ojfbot** northstar, always. This is the day's baseline frame.
- `focus[]` — the **L1** northstar for each app passed via `--focus` (the apps surfaced in Step 4's
  priorities). Pass the app slugs from the ranked actions, comma-separated.

Each property carries `ref` (`ns:<slug>#P<n>`), `current` %, and `last_movement` (ISO date or null).

## Picking which property a priority advances

For each ranked action in Step 5:
1. If the action's app has a **focused L1** loaded, use the L1 property the work advances
   (e.g. `ns:l1-cv-builder#P1`). Prefer the most specific tier.
2. Else fall back to the **L2 ojfbot** property it advances (e.g. `ns:l2-ojfbot#P2` for any work that
   makes the fleet more legible/self-measuring).
3. If nothing fits, tag the action `[no-northstar]`. Don't force a bad fit — the tag is the signal
   that the work is either mis-scoped for today or its app needs a northstar.

Append the chosen ref + the property's current %: `· advances ns:<slug>#P<n> (NN%)`.

## The `ns:` URI

`ns:<slug>#P<n>` is the stable reference to a property (slug = the northstar's immutable id; `P<n>` =
the property id). It is the same form used in `ladders_up_to` and in `status.jsonl` movement lines, and
it must resolve to a real property on disk (lint enforces this). Use it verbatim — don't invent refs.

## Recording movement (postflight)

Movement is **recorded, not remembered.** When a property genuinely moved, append one line to
`core/decisions/northstar/status.jsonl`:

```json
{"date":"<today>","northstar":"<slug>","property":"P<n>","from":<old>,"to":<new>,"evidence":"<one phrase>","actor":"<who>","source":"frame-standup"}
```

…and bump that property's `current` in its northstar file. Only record real, defensible movement — a
fabricated bump is exactly the confabulation the northstar exists to prevent.

## Rollup is hand-asserted (Slice 1)

Each property's `current` is hand-written. `northstar-lint --format=summary` runs in shadow: it reports
how far a parent % drifts from the mean of its children, but never overwrites the asserted value. Treat
drift as information, not an error.
