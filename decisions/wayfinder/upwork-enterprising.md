---
type: wayfinder-map
slug: upwork-enterprising
tracker_issue: "#472"
status: charting
---

# Wayfinder — Upwork enterprising

## Destination

A sustainable Upwork practice inside a ~10 hr/wk operator budget: browser-assisted capture feeds a
local opportunity tracker; agents draft proposals and delivery scaffolding; the operator closes,
delivers, and publishes. Arrived (90 days) = 2–3 five-star contracts + JSS established, ~$1–3k
revenue, rate at $140, and **every engagement emitting three outputs: revenue, a de-identified
public write-up feeding the `fde-operating-presence` (#319) flywheel, and G-genre evidence against
`~/selfco/career/fde-job-target.md` (G3 deployment arc first — the confirmed #1 gap — then G2/G1)**.
Charted deliberately **unanchored** (neistat precedent — no northstar property measures revenue
anywhere in the 21-entry registry); the anchor/registration question is itself a ticket
(Anchor + registration scheme).

## Notes

- Charted 2026-08-18 from a live operator session (Upwork profile built through 9/10 the same day;
  Heather-thread framing: portfolio tailoring · job tracking · wins→marketing · match-to-past-work ·
  repeatable delivery loops).
- **Boundary with `fde-operating-presence` (#319):** that map owns the content flywheel, public
  identity, and distribution surfaces; **this map owns pipeline, delivery, revenue, and the
  engagement arc.** Each consumes the other's closed decisions by name. This map graduated from
  #319's "Product/revenue pipeline beyond content" fog (Yuri ruled 2026-08-18).
- **Boundary with `texas-rr-engagement` (#344):** texas-rr remains a designated G3 vehicle;
  Upwork engagements supply real counterparties on a faster clock. Whether they share the
  `l1-fieldwork-N` registration scheme is decided in Anchor + registration scheme, not here.
- **Disclosure seam precedent (texas-rr ruling):** "the engagement map produces sanitized
  artifacts; #319 publishes them." Upwork work is real, so the SIMULATED label
  (`fde-gap-simulators-roadmap.md` honesty constraint) does NOT apply — the seam still does.
  The denylist lint declared in the #321 ruling is **still unbuilt**; it fails the placement
  litmus (machine-runnable check) so it is a prerequisite roadmap slice, not a ticket here.
- Vault reads (design-time, one-way, `adr:bonded-pair-division-of-labor`):
  `wiki/synthesis/marketing-and-growth-funnel-map` (funnel→loops: reviews/JSS are the compounding
  asset, hence the credibility-first ruling), `career/fde-job-target.md` (G1–G6 ruler),
  `career/fde-gap-simulators-roadmap.md` (honesty constraint).
- Facts gathered at chart time (2026-08-18 fleet inventory — these inform ticket bodies; they
  decide nothing):
  - `buddy-check/src/buddy_check/scraper/{fetch,storage}.py` — polite-fetch + enrichment-preserving
    upsert substrate, production-proven (12,760 records); recon-doc-first template at
    `buddy-check/docs/scraper-recon.md`.
  - `cv-builder` — LangGraph agent-graph emits 9 doc types; `*-why-anthropic.md` free-text pattern
    ≈ 80% of a proposal generator; headless CLI exists; `personal/jobs/*.json` is the listing
    schema to extend. No proposal or LinkedIn doc type exists.
  - `daily-logger` — live daily blog to log.jim.software with claim verification
    (`src/verify-claims.ts`) and council review; input contract is a GitHub-API sweep.
  - `landing/` serves jim.software (live). `blogengine/packages/publisher` is a **7-line stub** —
    nothing auto-distributes to LinkedIn/X today.
  - Headless-loop contract: `core/decisions/loops/loops.md` (verifier / stop_rule / evidence_ref)
    + `day-runner.mjs` dispatch; cockpit is the read-model surface. No pricing/freelance doctrine
    exists anywhere in the vault (greenfield for Rate & scoping doctrine).

## Decisions so far

Pre-map rulings (grilled at charting, recorded here — not closed tickets):

- Sibling map cross-linked with #319, not graduated inside it — Yuri, 2026-08-18
- Labor budget: ~10 hrs/week of operator hours — Yuri, 2026-08-18
- 90-day success = credibility-first: 2–3 five-star contracts, JSS established, ~$1–3k total,
  rate → $140 — Yuri, 2026-08-18
- Job-feed stance = browser-assisted capture; **no headless scraping of Upwork** — Yuri, 2026-08-18
- Profile-session rulings: employer named "SAP" on the public profile (operator override of the
  de-identify recommendation); rate ladder $110 → $140 — Yuri, 2026-08-18

Closed tickets:

- Tracking surface = a dedicated app, **dealdesk** (langgraph-app template minus Carbon; cockpit
  visual language + personal design-language seed; private repo; build forked to its own session)
  — Pipeline tracking surface (#483), ruled by Yuri 2026-08-18. Corollary: the #479 blocking edge
  inverts — the radar prototype now decides the *capture ergonomics feeding dealdesk's store*,
  not the surface.

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Profile publish + finishing pass (#473) | task | — | open |
| Anchor + registration scheme (#474) | grilling | — | open |
| Job selection + targeting doctrine (#475) | grilling | — | open |
| Rate & scoping doctrine (#476) | grilling | — | open |
| Engagement arc + evidence contract (#477) | grilling | — | open |
| Client-work disclosure seam (#478) | grilling | — | open |
| Opportunity radar capture seam (#479) | prototype | — | open |
| Proposal factory seam (#480) | prototype | Rate & scoping doctrine | open |
| Marketing loop wiring (#481) | grilling | Client-work disclosure seam | open |
| Pipeline tracking surface (#483) | grilling | — (edge inverted at close) | **closed** |

Frontier at charting: Profile publish + finishing pass (user-performed), Anchor + registration
scheme, Job selection + targeting doctrine, Rate & scoping doctrine, Engagement arc + evidence
contract, Client-work disclosure seam, Opportunity radar capture seam.

## Not yet specified

- **Productized repeatable services / Project Catalog listings** — the "identify loops for
  repeatable/scalable jobs" ambition; statable after 2–3 engagements reveal which deliveries repeat.
- **Business entity + tax posture** (LLC/S-corp, 1099 handling) — statable after first revenue.
- **Headless pipeline registration** — loops.md entry (verifier/stop_rule/evidence_ref) for the
  radar loop; statable once the Opportunity radar capture seam verdict lands. ~~Cockpit lane~~ —
  the tracking-UI half **graduated to a ticket 2026-08-18** (operator stated the requirement):
  now "Pipeline tracking surface" (#483).
- **Subcontracting / agency scaling** — far fog; statable only after sustained solo throughput.

## Out of scope

- Headless scraping of Upwork — ruled by Yuri 2026-08-18 (ToS + account risk while the account is
  the revenue channel).
- Agent-performed account actions, credential entry, or proposal **submission** — standing safety
  rule + Upwork ToS; noted at charting 2026-08-18.
- Content-flywheel surface decisions (venues, identity, distribution) — owned by
  `fde-operating-presence` (#319); boundary noted at charting 2026-08-18.
- Fleet Arcade integration — owned by `operating-surface-bonded-pair` (#272).
