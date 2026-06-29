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
| 1 | f1-substrate ★ | briefed | data-truth substrate; everything depends on its truth-or-NULL |
| 2 | f1-pit-wall ★ | briefed | renders substrate; P1 `depends_on: ns:l1-f1-substrate#P1` (the edge that introduced v1.1) |

## Leg 2 — Knowledge / RAG / eval  *(shared annotate·judge·calibrate machinery)*
| # | app | status | note |
|---|-----|--------|------|
| 3 | purefoy | queued | Roger Deakins cinematography RAG; zero eval scenarios today |
| 4 | buddy-check ★ | queued | SME-calibrated dive Q&A + eval pipeline |
| 5 | daily-logger | queued | council-of-experts article pipeline |
| 6 | seh-study | queued | NASA SEH glossary + spaced repetition |
| 7 | bldgblog-corpus | queued | deterministic archive ingest + annotation |

## Leg 3 — Imagery / classifier / domain MCPs  *(prompt's flagship synthesis)*
| # | app | status | note |
|---|-----|--------|------|
| 8 | golf-platform-scripts / build-golf / mcp-golf | queued | aerial-imagery classifier + annotation + UI (confirm repo split) |
| 9 | jocdive-sdi-mcp | queued | scuba SDI MCP; annotation component reuse |
| 10 | dms-core | queued | dms domain MCP |

## Leg 4 — 3D / asset / game
| # | app | status | note |
|---|-----|--------|------|
| 11 | asset-foundry | queued | Blender asset pipeline (LangGraph + bpy); feeds beaverGame |
| 12 | beaverGame | queued | cozy 3D beaver sim; consumes asset-foundry .glbs |
| 13 | lofi-beaver | queued | 1-bit iso story-world + sprite pipeline |
| 14 | foundry-recipes | queued | confirm active vs support |

## Leg 5 — Frame OS surfaces  *(MF fleet; shared Carbon stack)*
| # | app | status | note |
|---|-----|--------|------|
| 15 | shell ("Frame") | briefed | MF host compositor + frame-agent gateway. **"Frame" = shell**; focus-swap actually lives in morning-cockpit (non-Frame) — see card |
| 16 | cv-builder ★ | queued | on origin/main; resume builder MF remote |
| 17 | blogengine | briefed | "agent factory" is aspirational — ships markdown only; 3 stub packages; no teaching-artifact ingestion — see card |
| 18 | lean-canvas | queued | 9-section AI business canvas |
| 19 | core-reader | queued | core repo browser |
| 20 | frame-ui-components | queued | shared Carbon DS library |
| 21 | landing | queued | portfolio landing page |

## Leg 6 — Governance / legibility  *(the apps that measure the fleet → L2 P2)*
| # | app | status | note |
|---|-----|--------|------|
| 22 | core | queued | workflow engine + skill catalog (this is the L2-adjacent meta-repo) |
| 23 | gastown-pilot | queued | Gas Town bead/queue dashboard |
| 24 | morning-cockpit ★ | queued | morning read-model dashboard |
| 25 | workstation-yuri | queued | macOS workstation orchestration |
| 26 | github-actions | queued | shared fleet CI |

## Parked — confirm before adding
TripPlanner · mrplug · GroupThink · gcgcca · hailstone · todo-todo · virtualLight · core-library ·
selfco-box · newline-ai-course *(dormant, infra, or non-app; pull into a leg if you want one)*

---
_Generated 2026-06-28. Cursor = first non-`landed` entry. Active list is evidence-based (last-commit
activity + on-disk northstars + core/CLAUDE.md ecosystem table), not the offsite prompt's guess._
