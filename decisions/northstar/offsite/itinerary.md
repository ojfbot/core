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

## Leg 3 — Imagery / classifier / domain MCPs  *(prompt's flagship synthesis)*
| # | app | status | note |
|---|-----|--------|------|
| 8 | golf-platform-scripts / build-golf / mcp-golf | briefed | ONE card for the cluster; repo-split = sharp edge #1 (cluster-tier evidence gate) |
| 9 | jocdive-sdi-mcp | briefed | scuba SDI MCP; parked on account-email blocker, 1 tool live |
| 10 | dms-core | briefed | EMPTY DIRECTORY — card offers retirement as a first-class outcome |

## Leg 4 — 3D / asset / game
| # | app | status | note |
|---|-----|--------|------|
| 11 | asset-foundry | briefed | Blender asset pipeline (LangGraph + bpy); feeds beaverGame; sync seam untested |
| 12 | beaverGame | briefed | cozy 3D beaver sim; depends_on candidate edge to foundry |
| 13 | lofi-beaver | briefed | 1-bit iso story-world + sprite pipeline (brassboard, 2nd-consumer gate) |
| 14 | foundry-recipes | briefed | active-vs-support = sharp edge #1; status doc may be stale |

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
TripPlanner · mrplug · GroupThink · gcgcca · hailstone · todo-todo · virtualLight · core-library ·
selfco-box · newline-ai-course *(dormant, infra, or non-app; pull into a leg if you want one)*

---
_Generated 2026-06-28. Cursor = first non-`landed` entry. Active list is evidence-based (last-commit
activity + on-disk northstars + core/CLAUDE.md ecosystem table), not the offsite prompt's guess._
