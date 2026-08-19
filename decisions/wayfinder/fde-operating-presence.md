---
type: wayfinder-map
slug: fde-operating-presence
northstar: l2-ojfbot
tracker_issue: "#319"
status: charting
---

# Wayfinder — FDE operating presence

## Destination

A stranger — a hiring manager for a Forward Deployed Engineer role — can verify from public
artifacts alone that Yuri already works like an FDE: portfolio repos that survive scrutiny,
published FDE-genre deliverables (discovery documents, eval harnesses with measured lift,
deployment runbooks, process-understanding artifacts of the "McKinsey consultant" kind), and a
**running content flywheel** — BlogEngine emitting to GitHub + Medium + blog.jim.software +
LinkedIn + X + Instagram + a new dedicated tech-blog domain — fed by **scheduled trend ingestion**
(thought leaders, model releases, harness-architecture changes) into selfco. The day job is the
enterprise-scale instance of the same posture ("what would an FDE team of 3 deliver, working with
a McKinsey-style consultant for process understanding"); this map covers the personal-stack half
only, and the employer boundary is decided in `adr:employer-evidence-boundary` — day-job material
enters public artifacts only de-identified, at pattern level. Offers are a lagging
indicator, not the success object. Serves `ns:l2-ojfbot#P1` (usable surfaces — the published
artifacts ARE surfaces shown where they live), `ns:l2-ojfbot#P2` (work is legible — the flywheel
publishes the legibility), and `ns:l3-shared#P1` (a stranger can be shown the cluster doing real
work end-to-end).

## Notes

- Charted 2026-08-01 (autonomous session; Destination + scope grilled via four operator answers).
- **Operator rulings at charting:** Destination = FDE-legible operating presence (not
  offer-in-hand, not product-business); the 2026-07-22 hired-projects track is **absorbed for
  re-audit** (not treated as settled); distribution scope = all of existing (GitHub/Medium/
  blog.jim.software) + LinkedIn + X + **Instagram** + new dedicated tech-blog domain; ingestion =
  **scheduled automation** feeding selfco. Handle constraint: succinct, ojfbot / jim.software
  variation namespace, ideally the same name available on IG and X.
- Prior audit superseded as ruler: `decisions/research/2026-07-22-hired-projects-gap-analysis.md`
  used the Bashiri 3-archetype checklist, itself verified as repackaged consensus with **no
  primary hiring-side evidence**; the re-audit ticket goes to primary sources (Anthropic FDE
  postings, Palantir FDSE canon, peers).
- Boundary with the `operating-surface-bonded-pair` map (#272): fleet integration
  (launch/front/talk, Arcade, registry taxonomy) is owned there; this map never charts it.
  Where the flywheel needs a fleet surface, it consumes what that map's tickets decide.
- BlogEngine ground truth at charting: `l1-blogengine` P1 = 15% — multi-platform publishing is
  Zod-schema-only; `publisher`, `notion-integration`, `rag-service` are `export {}` stubs; the
  only live loop segment today is daily-logger → log.jim.software.
- Vault reads (design-time, one-way, `adr:bonded-pair-division-of-labor` draft):
  `wiki/synthesis/hired-projects-gap-analysis` + `entities/bashiri-smith` (audit precedent and
  its credibility ceiling); `wiki/synthesis/value-proposition-canvas-bmc-fit` and
  `concepts/value-proposition-design` (positioning-narrative instrument for the venue-map
  ticket).
- **#328's ticket body is partly invalidated by #321's ruling (2026-08-01).** Its proposed public
  frame names the employer, which `adr:employer-evidence-boundary` now forbids; and the re-audit's
  §2.11 (paired non-engineering engagement owner, convergence 4) shows the consultant-pairing
  instinct is right but the role assignment inverted — the FDE is the *engineer* in that pair, so a
  narrative owning ROI and value cases pitches the Technical Deployment Lead role instead. The venue
  map half of that ticket is unaffected. Re-author the frame; do not trim it.
- Ingestion automation must respect the sequential-research rule (one deep-research cycle at a
  time; 2026-06-05 saturation failure) and shadow-first discipline (observe-only sweeps before
  unattended vault writes — ADR-0089 idiom).

## Decisions so far

Pre-map rulings (grilled at charting, recorded here — not closed tickets):

- Destination fixed: FDE-legible operating presence; offers are lagging indicators — Yuri, 2026-08-01
- Hired-projects track absorbed for re-audit rather than treated as settled — Yuri, 2026-08-01
- Distribution scope: existing three surfaces + LinkedIn + X + Instagram + new tech-blog domain — Yuri, 2026-08-01
- Trend ingestion is scheduled automation feeding selfco, not hardened manual ingest — Yuri, 2026-08-01

Closed tickets:

- Primary-source FDE checklist built (6 genres; eval frameworks = the hiring gate, "not a demo role"); H1 cost-orchestration REFUTED as FDE deliverable, H2 eval-gating MIXED (core supported, pr-quiz sub-claims unevidenced, capture loop runs vendor-ward), H3 customer-facing core SUPPORTED — FDE deliverables checklist + fleet re-audit (#320) → decisions/research/2026-08-01-fde-deliverables-audit.md (+ independent second cycle, corroborating and correcting → decisions/research/2026-08-01-fde-deliverables-audit-cycle-2.md)
- Day-job material is publishable only as de-identified patterns passing the **stranger test**, enforced by denylist lint (not discipline); HEAD scrubbed on decision, history rewrite staged — TeamBot public-evidence boundary (#321) → `adr:employer-evidence-boundary`, `adr:boundary-enforced-by-construction`, `adr:staged-history-remediation`

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| FDE deliverables checklist + fleet re-audit (#320) | research | — | closed |
| TeamBot public-evidence boundary (#321) | grilling | — | **closed** |
| Flywheel first loop (#322) | grilling | — | open |
| Ingestion source roster + cadence (#323) | grilling | — | open |
| Ingestion runtime + host (#324) | grilling | Ingestion source roster + cadence | open |
| Handle availability survey (#325) | task | — | open |
| Public identity + domain (#326) | grilling | Handle availability survey | open |
| Hired-projects track disposition (#327) | grilling | FDE deliverables checklist + fleet re-audit | open |
| Positioning narrative + venue map (#328) | grilling | FDE re-audit; Public identity + domain; TeamBot boundary | open |
| BlogEngine distribution seam (#329) | grilling | Flywheel first loop; Public identity + domain | open |
| Account provisioning (#330) | task | Public identity + domain | open |
| Sanitized pattern-flow loop (#342) | grilling | — | open |

Frontier at charting: FDE re-audit, TeamBot boundary, Flywheel first loop, Ingestion source
roster, Handle availability survey. Account provisioning is **user-performed** (agents never
create accounts or handle credentials); Handle availability survey is survey-only, no creation.

## Not yet specified

- **selfco L2 northstar** — the registry defers `l2-selfco`; scheduled ingestion may be the work
  that finally warrants it (ingestion properties need a home). Question statable after the
  ingestion roster + runtime tickets close.
- **Flywheel TPMs** — what audience/reach/compounding evidence is measured, and where it's
  recorded; statable after Flywheel first loop fixes the loop.
- **Voice consolidation** — whether f1-press-room and daily-logger output fold into the new FDE
  publication or stay separate voices; statable after Positioning narrative + venue map.
- ~~**Product/revenue pipeline beyond content**~~ — **graduated to its own map 2026-08-18** (Yuri
  ruled): the Upwork enterprising initiative made the question statable. Now charted as the sibling
  map `decisions/wayfinder/upwork-enterprising.md` (#472), which owns pipeline/delivery/revenue and
  consumes this map's identity/venue decisions; boundary noted on both maps.
- ~~**TeamBot↔personal-stack pattern flow**~~ — **graduated to a ticket 2026-08-01**: the boundary
  ruling (#321) made the question statable. Now "Sanitized pattern-flow loop" (#342).

## Out of scope

- Fleet integration surface (Arcade: launch/front/talk, registry taxonomy, headless components) —
  owned by `operating-surface-bonded-pair` (#272); boundary noted at charting 2026-08-01, not a
  new ruling.
- Agent-performed account creation, credential entry, or posting on the user's behalf — safety
  rule, standing; noted at charting 2026-08-01.
- Re-charting dive-briefing / switchboard / agent-anatomy *delivery slices* here — deliveries
  stay in their roadmaps; only the disposition decision (#327) is on this map. Noted at charting
  2026-08-01 (two-ledgers rule).
