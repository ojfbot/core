---
type: defect-report
slug: selfco-index-reachability-invariant
class: false-assertion
severity: high
status: open
disposition: repair-mechanism
location: "selfco:wiki/index.md:7"
claim: "Every page in `wiki/` is reachable from here."
actual: "42 of 635 content pages (6.6%) are not reachable from index.md by any wikilink"
claim_probe: "grep -q 'Every page in' ~/selfco/wiki/index.md"
truth_probe: "sh scripts/probes/selfco-unlisted-pages.sh"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit (F-22)"
---

# The vault's most-repeated invariant is false, and a green lint is masking it

The claim appears in three documents (`wiki/index.md:7`, `selfco/CLAUDE.md:106`,
`core/domain-knowledge/selfco-vault.md:17`). **42 pages are not listed.**

> **Correction, filing day.** This report first said 87, taken from an audit pass that did
> not normalise folder-qualified links — a page listed as `[[sources/foo]]` was scored
> unlisted when searching for `[[foo]]`. The deterministic probe
> (`scripts/probes/selfco-unlisted-pages.sh`, which strips the prefix on both sides)
> returns **42**. Recorded rather than silently edited: a defect ledger that quietly
> revises its own numbers is the failure it exists to catch.

`lint.py` reports `orphan pages: 0` at the same time, because it counts inbound links from
*anywhere* — a page linked only by a sibling is not an orphan. So `0 orphans` and
`87 pages absent from index` are simultaneously true, and the green gate reads as
confirmation the invariant holds.

Largest cluster: all 21 `concepts/pattern-*.md` pages, whose own log entry
(`log.md:1217-1218`) claims "Lint gate: 0 broken links, 0 orphans (627 pages)". Three
separate log entries claim `- updated wiki/index.md` while leaving pages out — including
`log.md:1275` from **2026-07-29**, so the regression is 0 days old.

## Why it matters

`index.md` is the router: `/vault orient` and every cold-start agent reads it first. A page
absent from it is invisible to orientation even though it is link-reachable. And the
invariant has **no checker at all** — three documents assert it, and the one tool that
looks like it would catch it measures something else.

Secondary: `index.md` is 795 lines / 120KB, so it is also the progressive-disclosure
bottleneck. Repairing membership without addressing size makes the router bigger.

## Repair

Add an index-membership check to `lint.py` (distinct from the orphan check) and run it in
shadow. Then backfill the 87. Order matters — backfilling first just resets a counter that
will drift again by the next ingest.

## Closure

Weak probe, acknowledged: `claim_probe` tests only that the sentence is still present, so
it does **not** close on repair. `truth_probe` returns the live unlisted count — that is
the number a sweep should watch. This defect closes by operator judgment when
`truth_probe` reads 0 and a checker exists; it is an honest example of a defect whose
closure is not fully mechanical.
