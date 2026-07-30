---
type: defect-report
slug: selfco-gcgcca-status-paused
class: false-assertion
severity: medium
status: open
disposition: needs-investigation
location: "selfco:wiki/entities/capture-agent.md:7"
claim: "status: paused"
actual: "3 commits since last_synced; HEAD 2026-07-28. last_synced is 2026-05-11 — 78 days behind. NB: the repo was renamed gcgcca -> capture-agent on 2026-07-30; the vault entity was migrated to capture-agent.md on the same date (dr-selfco-gcgcca-renamed-to-capture-agent, now verified-closed). Only the status: line remains at issue."
claim_probe: "grep -q '^status: paused' ~/selfco/wiki/entities/capture-agent.md"
truth_probe: "git -C ~/ojfbot/capture-agent log -1 --format=%cs"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit"
---

# `gcgcca` is marked paused with a commit from yesterday

`last_synced: 2026-05-11` against a HEAD of 2026-07-28 — the largest drift in the fleet at
**78 days**. The page body still quotes "Last commit `04aeafb` … (2026-04-07)" and a
"47-test pytest suite" (on-disk count: 67). Its `revive_trigger` reads "next real USGS
orthoimagery need … else archive-with-verdict at next quarterly review" — a condition that
appears to have **already fired**, since `entities/mirrorworld.md:37` names capture-agent a
live sibling.

## Why it matters

`disposition: needs-investigation`, deliberately — and this is the honest limit of the
deterministic engine. `paused` vs `active` is **operator intent, not git activity**. A
commit does not prove a repo is un-paused; it might be a drive-by fix. Git recency can
only ever raise the question. Auto-deriving `status:` from commit activity would replace a
stale truth with a confident guess, which is worse.

Nine repos are marked `active` with no commit in 60+ days (`mrplug` 108d, `TripPlanner`
108d, `frame-ui-components` 110d, `ojfbot` 117d) — the same class, inverted. All belong in
a review queue (EXPIRE), never in a generator.

## Repair

Operator decides: confirm `paused` (and the recent commits were incidental), flip to
`active`, or fire the `revive_trigger`. Then reconcile the body's stale commit/test claims,
which are `repair-doc` and mechanical once status is settled.

> **Probe revised 2026-07-30.** `gcgcca` was renamed to `capture-agent` on `main` hours
> after this report was filed, so `truth_probe` pointed at a directory that no longer
> exists. The sweep reported `PROBE EXIT 128` rather than a verdict — the loud-failure
> design working: a broken probe is never mistaken for a passing one. Repointed at the new
> name. The *claim* probe then still targeted `wiki/entities/gcgcca.md`, which was correct
> at the time: the page still existed under the old name, which was its own defect.
>
> **Probe repointed again 2026-07-30 (identifier migration).** The vault page was renamed to
> `wiki/entities/capture-agent.md` with `aliases: ["gcgcca"]`, closing
> `dr-selfco-gcgcca-renamed-to-capture-agent`. `claim_probe` follows the page to its new
> filename and still exits 0 — `status: paused` is untouched, because paused-vs-active is
> operator intent and this migration deliberately did not decide it.

## Closure

`claim_probe` exits non-zero once the status line changes. If the operator confirms
`paused` is correct, close this as `unreproducible` with a note rather than editing the
file to satisfy the probe — a defect that turns out not to be a defect should say so.
