# Northstar Roadtrip — itinerary

The map + the resume cursor for the fleet-wide northstar offsite. CC owns this file: it advances each
entry's `status` as legs complete. Drive clusters in order so cross-project synthesis compounds.

**Loop (Notion relay):** CC writes a briefing card into the app's Itinerary row (`## Briefing`, Status
`briefed`) → James + chat (voice) refine it → chat writes the fenced CONFIRMED block (`## Confirmed`,
Status `confirmed`) → CC lands `<app>/.claude/northstar.md`, registers it, runs lint, sets Status
`landed`, appends the `SYNTHESIS:` line to the ledger.

**Relay (Notion, workspace "James O'Connor's Notion"):**
- Parent — https://app.notion.com/p/38d54a8c53d7813b948eee86e231afa0
- Itinerary DB — https://app.notion.com/p/e923eaf2afc14685880b18488054c69a (data source `fd48db95-633e-4faf-a865-499d47b32b69`)
- Contract — https://app.notion.com/p/38d54a8c53d7816f91bbe170f85bd27f
- Synthesis Ledger — https://app.notion.com/p/38d54a8c53d78163ae03c10a93ffb872
- Leg 1 · f1-substrate row (briefed) — https://app.notion.com/p/38d54a8c53d78116ae90ce2b24995d8f

**Status values:** `queued` (no briefing yet) · `briefed` (card written, awaiting voice leg) ·
`confirmed` (voice output pasted back, awaiting landing) · `landed` (on disk + registered + lint-clean).

A `★` repo already has a first-cut northstar on disk → its leg is **review-and-refine**, not greenfield.

---

## Leg 1 — F1 stack  *(CO-AUTHORED pair: mutually defining, authored in one breath)*
| # | app | status | note |
|---|-----|--------|------|
| 1 | f1-substrate ★ | landed | data-truth substrate; on disk + registered (status reconciled 2026-07-02) |
| 2 | f1-pit-wall ★ | landed | renders substrate; P1 `depends_on: ns:l1-f1-substrate#P1` (the edge that introduced v1.1) |

## Leg 2 — Knowledge / RAG / eval  *(shared annotate·judge·calibrate machinery)*
| # | app | status | note |
|---|-----|--------|------|
| 3 | purefoy | briefed | Roger Deakins cinematography RAG; zero eval scenarios today |
| 4 | buddy-check ★ | briefed | SME-calibrated dive Q&A + eval pipeline |
| 5 | daily-logger | briefed | council-of-experts article pipeline |
| 6 | seh-study | briefed | NASA SEH glossary + spaced repetition |
| 7 | bldgblog-corpus | briefed | deterministic archive ingest + annotation |

## Leg 3 — Golf cluster (cluster-golf)  *(prompt's flagship synthesis; cluster declared 2026-07-27, landed 2026-07-30 — see offsite/confirmed/cluster-golf.md)*
| # | app | status | note |
|---|-----|--------|------|
| 8 | golf-platform-scripts / build-golf / mcp-golf | briefed | ONE card binding all three; cluster-golf P3 (reviving; coldest active-claim, lc 2025-07). OPEN OD (Q4): this row = the P3 anchor, or a new consolidated row — operator call, not resolved at the 2026-07-30 landing |
| 8a | capture-agent *(renamed from gcgcca 2026-07-30)* | landed | cluster-golf P1 + first principle (TX corpus → segmentation model → HF); l1-capture-agent REGISTERED 2026-07-30; was in Parked as gcgcca — fresh registration, never previously registered. NOTE: the landing prompt placed fairway/seeds in "Leg 4" but Leg 3 is the golf leg on disk — rows land here (discrepancy flagged in the PR) |
| 8b | fairway *(decomposed OUT of mirrorworld)* | landed | cluster-golf P2, the explorable twin; l1-fairway REGISTERED 2026-07-30 — ⚠ axes PROPOSED + ladder PROVISIONAL #P1 (Q2); mirrorworld = producer, NOT a member |
| 8c | golf-press | queued | SEED (no repo, no registry entry — CarrierPigeon 14a practice): publication pipeline, f1-press-room shape + formal doc generation via blogengine instances; pull condition UNRATIFIED (blogengine ingest blocker accounted for) |
| 8d | golf-runner | queued | SEED: GTM — 50/50 raffle wedge → ops-intel upsell → network moat; born-named (⚑ renamed from golf-sales pre-registration); pull condition UNRATIFIED |
| 8e | golf-research | queued | SEED: competitor + customer intelligence on the lean-canvas framework, one northstar (split only under strain); post-deployment feedback loop = later-phase; pull condition UNRATIFIED |
| 8f | hardware integrations | queued | SEED: edge AI devices (on-device video + radar ball detection); pulled hard by a signed 50/50 pilot |
| 9 | jocdive-sdi-mcp | retired | RETIRED 2026-07-02 — folds into buddy-check's roadmap (SDI portal = a buddy-check data-source concern); code + parking note kept |
| 10 | dms-core | retired | ARCHIVED (temporary) 2026-07-02 — membership inactive; reactivation re-enters as queued |

## Leg 4 — GameWorld cluster  *(James 2026-07-02: agentic/multi-agent game-dev cluster — rendered environments, game-state management, engine interactions, playtester-chat feedback loop. Run the CLUSTER card first; per-app ladders stay on L2 with intended cluster refs in SYNTHESIS — cluster tier is designed-not-built and this leg is its evidence.)*
| # | app | status | note |
|---|-----|--------|------|
| 11a | GameWorld (cluster) | briefed | THE cluster conversation — first real cluster-tier instance; CC lands its block as design evidence, not a v1.1 file |
| 11b | F1 (cluster) | briefed | PRE-DRAFTED quick-confirm from the landed f1 L1s (~5 min); decides ladder topology for all clusters. NOTE: f1's depends_on edge is schema-doc-only — not in pit-wall's file, not linted; retrofit lands in the cluster-tier build slice. UPDATE 2026-07-30: the member-definition question (sharp edge 4, repo vs app-path vs property-subset) is **DISSOLVED for golf by decomposition** (members are repos, uniformly; see confirmed/cluster-golf.md) — f1/gameworld ratification of repos-only as the all-cluster ruling still pends this sitting |
| 11 | asset-foundry | briefed | rendering/production arm; feeds beaverGame; sync seam untested |
| 12 | beaverGame (CozyBeaver) | briefed | 3D client; depends_on candidate edge to foundry |
| 13 | lofi-beaver | briefed | 1-bit iso story-world + sprite pipeline (2nd-consumer gate — CarrierPigeon is the candidate) |
| 14 | foundry-recipes | briefed | SUPPORT-MODE question resolves as a cluster-role question (knowledge arm?) |
| 14a | CarrierPigeon | briefed | next game; pre-code scaffold (asset-foundry dir + public/, no git); primary source = the voice conversation |

## Leg 5 — Frame OS surfaces  *(MF fleet; shared Carbon stack)*
| # | app | status | note |
|---|-----|--------|------|
| 15 | shell ("Frame") | confirmed | instance-federation compass voice-CONFIRMED 2026-06-28; **landing PR shell#79 open** — landed when merged + registered |
| 16 | cv-builder ★ | briefed | northstar file VANISHED from working tree (lint ERROR); recovery = rm:rm-l2-ojfbot#S1 (ready on the dispatch queue) |
| 17 | blogengine | confirmed | agent-factory compass voice-CONFIRMED 2026-06-28; **landing PR BlogEngine#58 open** — landed when merged + registered |
| 18 | lean-canvas | briefed | 9-section AI business canvas; stalled 4 months — paused is a legal outcome |
| 19 | core-reader | briefed | core repo browser; natural home for a northstar/roadmap tab |
| 20 | frame-ui-components | briefed | LIBRARY — threshold question: does it get an L1 at all? |
| 21 | landing | briefed | portfolio; candidate 3rd L2-P1 strain (gate trips at 3) |

## Leg 6 — Governance / legibility  *(the apps that measure the fleet → L2 P2)*
| # | app | status | note |
|---|-----|--------|------|
| 22 | core | briefed | workflow engine + delivery pipeline; shell's forward ref ns:l1-core#P-launcher waits on this leg |
| 23 | gastown-pilot | briefed | Gas Town bead/queue dashboard; boundary-with-cockpit question |
| 24 | morning-cockpit ★ | briefed | morning read-model dashboard; first-cut northstar + dogfood roadmap on disk |
| 25 | workstation-yuri | briefed | macOS workspace orchestration; named in shell's spawn triangle |
| 26 | github-actions | briefed | shared fleet CI; gate-1 of progressive-autonomy leans on it |

## Parked — confirm before adding
TripPlanner · mrplug · GroupThink · hailstone · todo-todo · virtualLight · core-library ·
selfco-box · newline-ai-course *(dormant, infra, or non-app; pull into a leg if you want one)*
*(gcgcca left this list 2026-07-30 — renamed capture-agent, landed as Leg 3 row 8a)*

---
_Generated 2026-06-28. Cursor = first non-`landed` entry. Active list is evidence-based (last-commit
activity + on-disk northstars + core/CLAUDE.md ecosystem table), not the offsite prompt's guess._
