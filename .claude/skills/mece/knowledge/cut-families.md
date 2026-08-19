# Cut families and test procedure

Reference for `/mece`. Self-contained for headless reads (dealdesk PM agents load this
file from disk at prompt-assembly time); the canonical concept pages live in the vault:

- `~/selfco/wiki/concepts/mece.md` — the concept of record
- `~/selfco/wiki/concepts/minto-pyramid-principle.md` — the framework this test serves
- `~/selfco/wiki/entities/barbara-minto.md` — provenance

Source canon: codified by Barbara Minto at McKinsey (*The Pyramid Principle*).

## The two tests

| Test | Procedure | Fail signal |
|---|---|---|
| **ME** (mutually exclusive) | For each bucket pair, try to name one concrete item that fits both. | A named item in two buckets; or filing needs a tie-breaking rule. |
| **CE** (collectively exhaustive) | Try to construct a realistic case that fits no bucket; open any "other" bucket and inspect what actually accumulated there. | A named orphan case; or an "other" bucket holding real, recurring items. |

Verdicts are per bucket: `clean` (survived both hunts) · `overlapping` (named item
shared with another bucket) · `gap` (the bucket set misses a named case — attach the
gap verdict to the bucket nearest the orphan, or to a synthetic `<missing>` row).

## Cut families (the repair menu)

When a grouping fails, re-cut along a different family instead of patching buckets:

| Family | Shape | Reach for when |
|---|---|---|
| **Process stages** | sequential phases (before/during/after; acquire → activate → retain) | items are events or steps in a flow |
| **Stakeholder / segment** | who is affected (buyer, user, operator; by size, geography) | items differ by whose problem they are |
| **Quantitative buckets** | non-overlapping ranges of one variable (deal size, tenure, latency) | items differ by magnitude of one measurable |
| **Formula decomposition** | an arithmetic identity (profit = revenue − cost; revenue = price × volume) | the parent question is about a number; CE by construction |
| **Binary opposites** | X / not-X (internal/external, organic/paid) | a first coarse split; MECE trivially, insight depends on the variable |
| **Structural** | parts of a defined whole (regions, product lines, system components) | the whole has an agreed part list |

## Choosing among passing cuts

Two questions, in order:

1. **Does the family match the parent question?** A "why did revenue drop?" question
   wants formula decomposition; a "who do we tell first?" question wants stakeholder.
2. **Would the owner act differently per bucket?** If two buckets get the same
   treatment, merge them — actionability beats granularity.

## Worked micro-example

Grouping "why the pitch lost": {price too high, wrong stakeholder in the room, demo
crashed, they went with the incumbent}. Parent question: "what should we change for the
next pitch?" — *ME fail*: "went with incumbent" overlaps all three others (it is an
outcome, not a cause). *Re-cut by process stage*: targeting (wrong stakeholder) →
demo execution (crash) → commercial terms (price). The outcome item is parked as the
result, not a peer. Three buckets, each with a distinct next action — passes both tests
and the actionability check.
