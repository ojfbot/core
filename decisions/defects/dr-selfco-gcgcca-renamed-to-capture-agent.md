---
type: defect-report
slug: selfco-gcgcca-renamed-to-capture-agent
class: phantom-reference
severity: medium
status: open
disposition: repair-doc
location: "selfco:wiki/entities/gcgcca.md"
claim: "repo: gcgcca"
actual: "The repo was renamed gcgcca -> capture-agent on 2026-07-30 (core b0d7963/cbb91f6). ~/ojfbot/gcgcca no longer exists."
claim_probe: "grep -q '^repo: gcgcca' ~/selfco/wiki/entities/gcgcca.md"
truth_probe: "ls -d ~/ojfbot/capture-agent ~/ojfbot/gcgcca 2>/dev/null | tr '\\n' ' '"
filed: 2026-07-30
filed_by: "agent:claude-opus-5"
evidence: "caught by defects-lint --sweep, PROBE EXIT 128, 2026-07-30"
---

# The vault names a repo that was renamed out from under it

`core/CLAUDE.md` now reads *"capture-agent — Golf-course capture agent (renamed from gcgcca
2026-07-30)"*, and a sibling `fairway` was decomposed out of `mirrorworld`. The vault still
carries `wiki/entities/gcgcca.md` with `repo: gcgcca`, and `~/ojfbot/gcgcca` is gone.

## Why it matters

**This is the identity failure S2 exists to prevent, and it happened live, within a day of
the ledger being built.** A rename in one repo silently invalidated a probe in another:
`dr-selfco-gcgcca-status-paused`'s `truth_probe` began returning `PROBE EXIT 128: fatal:
cannot change to '/Users/yuri/ojfbot/gcgcca'`.

Two things went right and are worth recording as evidence for the design:

1. **The failure was loud.** The sweep reported a probe error and printed
   `⚠ 2 truth_probe(s) broken — fix these before trusting the verdicts above`. It did not
   report a verdict it could not justify. A checker that had silently treated the failed
   probe as "no longer reproducible" would have closed a live defect.
2. **The claim survived the rename because it is anchored to the vault page, not the repo.**
   `claim_probe` still greps `wiki/entities/gcgcca.md` and still exits 0 — correctly, because
   that page really does still say `gcgcca`.

The general lesson is the one the research already named: **no admission gate can catch a
rename that emits no event in the system that cares.** Only a reconciler holding its own
index notices. Here the "reconciler" was a weekly sweep and a human reading its output.

## Repair

Rename the entity page `gcgcca.md` -> `capture-agent.md`, set `repo: capture-agent`, add
`aliases: ["gcgcca"]` so old wikilinks and searches still resolve, and update inbound links
(`entities/mirrorworld.md` names it a live sibling). Then re-point
`dr-selfco-gcgcca-status-paused`'s `claim_probe` at the new filename.

Fold into **S2 (identity)**, which already owns `repo:`-slug normalisation and the four
phantom repo entities — this is a fifth instance of the same class, and the first one
observed happening rather than found by audit.

Do **not** repair by deleting the page: `fairway` was decomposed out of `mirrorworld` in the
same batch, so the vault also needs a new entity, and both changes belong in one pass with
the fleet registry (S3) in view.

## Closure

`claim_probe` exits 0 while the entity page still declares `repo: gcgcca`. `truth_probe`
lists which of the two directories exist, so the report shows the rename's state directly.
