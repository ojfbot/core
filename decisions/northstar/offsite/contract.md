# Relay output contract (captured from Notion)

> Git backup of the Northstar Roadtrip relay's **Contract** page (the format chat writes confirmed blocks
> against). Captured 2026-06-29. Notion is the live relay; this is the durable copy.
> Source: https://app.notion.com/p/38d54a8c53d7816f91bbe170f85bd27f

When a leg is confirmed, chat writes EXACTLY this block — the entire thing inside one fenced code block —
into the row's `## Confirmed` section:

```
CONFIRMED NORTHSTAR
app: <app-slug>
schema: v1
vision: <one paragraph>
P1 | name: <…> | target: <…> | current: <0-100> | verification: <…> | ladders_up_to: ns:l2-ojfbot#P1
P2 | name: <…> | target: <…> | current: <0-100> | verification: <…> | ladders_up_to: ns:l2-ojfbot#P2 | depends_on: ns:l1-<other-app>#P<n>
LADDER_STRESS: l2#P1=clean; l2#P2=strain — <reason; one verdict per parent property the app ladders to>
SYNTHESIS: <cross-project connections — feeds the ledger>
```

### Rules
- **Fence the whole block** (header → SYNTHESIS). Notion reflows loose pipe-delimited lines into tables; fenced code survives intact for Code's parser.
- `app:` must equal the row's **App Slug**. `schema:` pins the parser version (lets the format evolve without silent drift).
- Every property's `ladders_up_to` is either `ns:l2-ojfbot#P1` (the fleet ships demoable surfaces) or `ns:l2-ojfbot#P2` (work traces to a measurable property).
- `current` (0–100) is **honest and evidence-based, never aspirational**. The briefing card carries the evidence; chat verifies the *reasoning*, not ground truth. An unsupported % gets flagged, not rubber-stamped.
- Property ids `P1…Pn` are assigned once and never reused. Add as many properties as the app needs.

### `depends_on` — horizontal peer edge (optional per-property)
A property may declare `depends_on: ns:<other-app>#P<n>` — a horizontal edge to a sibling property in another app, orthogonal to `ladders_up_to` (vertical). **Linter owns the syntactic half** (resolve-or-fail, like `ladders_up_to`). **The cap is SHADOW, not a block**: `current(dependent) > current(dependency)` is reported as a "dependency inversion" warning (hand-asserted %s across non-commensurable axes), never a land-time rejection; hard enforcement is a later data-gated promotion.

### `LADDER_STRESS` — the kickback channel (mandatory, never empty)
The roadtrip stress-tests the L2 parent while authoring L1s. One verdict **per parent property touched** (`clean` / `strain` / `break`); reason required for anything but `clean`. **Semantic judgment is chat's, not the linter's** — a forced-fit property resolves syntactically and the linter greenlights it; only the verdict surfaces the buried failure. The linter only enforces the field is present/well-formed. **Gate:** one `break`, or N `strain`s against the *same* parent property (N starts at 3), freezes the roadtrip for a deliberate, versioned parent revision. The L2 parent is never hot-patched mid-leg.

> **NOTE (git ↔ Notion drift):** the live relay block has graduated **`schema: v1.1`** + semver-pinned refs (`@0.1.0`) + a cluster tier (`ns:cluster-<name>@<semver>#P<n>`) in the confirmed Frame/blogengine blocks — those extensions are **designed, not yet in `schema.md`/lint**. This contract copy shows the v1 shape; see `confirmed/*.md` for the v1.1 usage and `schema-evolution-log.md` for status.
