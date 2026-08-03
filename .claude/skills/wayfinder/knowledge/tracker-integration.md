Reference for `/wayfinder`: northstar anchor resolution (charting Step 1) and the child-issue projection (charting Step 4).

- `scripts/resolve-anchor.mjs` — `--detect` (mode) and `--anchor=ns:<slug>#P<n>` (resolve-or-fail)

## Anchoring (Step 1)

If the map is anchored to a northstar, cite the properties (`ns:<slug>#P<n>`, resolve-or-fail — run `scripts/resolve-anchor.mjs --anchor=ns:<slug>#P<n>` and don't write the anchor if it exits non-zero).

## Issue projection (Step 4)

Then — **full mode only** — create the child issues labelled `wayfinder:<type>` in dependency order, wiring blocking edges with the tracker's native blocked-by relationship, so the **frontier** (open + unblocked + unclaimed) renders in the tracker. In lite mode the Tickets table *is* the frontier. Sized so each ticket fits one session.
