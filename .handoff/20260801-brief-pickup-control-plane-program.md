---
id: 20260801-brief-pickup-control-plane-program
type: brief
title: "Pickup: control-plane program — conductor map charted, pane 08 shipped, bead-stability plan staged"
actor: code-claude
session_id: 2026-08-01-routines-dev-cycle
refs:
  - file:core/decisions/wayfinder/control-plane-conductor.md
  - file:core/decisions/adr/draft-bead-substrate-stability.md
  - file:morning-cockpit/prototypes/control-plane/FINDINGS.md
  - file:core/decisions/loops/loops.md
  - issue:core#307
hook: "Read the wayfinder map FIRST (decisions/wayfinder/control-plane-conductor.md) — it is canonical; the GitHub issues are projections. One ticket per session."
status: live
labels:
  domain: workflow-engine
  project: control-plane-conductor
  priority: P1
---

## For the next agent

One session (2026-08-01, remote container) produced three linked artifacts. All work is on
branch `claude/routines-dev-cycle-jnz1yd` in BOTH `core` (3 commits) and `morning-cockpit`
(3 commits). **No PRs opened; nothing merged** — the merge ritual is the operator's.

1. **Wayfinder map — the control-plane conductor** (`decisions/wayfinder/control-plane-conductor.md`,
   umbrella core#307, 9 tickets #308–#318). Destination: one loop that conducts the others,
   built for Claude Routines but re-pointable off them (portability seam is a standing
   constraint on every ticket: each decision answered twice — once for routines, once for
   "cost to re-point at another stack"). Frontier: **#315 census** + **#308 primitive research**.
   Charting closed zero tickets. Note: native GitHub blocked-by edges could NOT be wired from
   the remote MCP surface — dependencies are declared in issue bodies + the map table only.

2. **Cockpit pane 08 — Control plane** (morning-cockpit). First surface ever to read
   `core/decisions/loops/loops.md`. Adapter resolves `evidence_ref:` (`file:`/`git-branch:`/
   `dolt:` probe; `gh:` deliberately unresolved). Headline is watched vs unobserved: live
   against the real registry — **32 loops, 7 watchable, 25 unobserved, 9 with no verifier**.
   Also fixed Fleet (01) conflation: `basis: 'activity' | 'no-data'`, `noData` subset of dark.
   Key negative result (prototypes/control-plane/FINDINGS.md): **connectedness-by-reference
   does not work** — 7/23 "orphans" became 0/23 once the search bugs were fixed; naming is not
   reading. Never add a consumption column without a consumer-written signal (feeds #316).

3. **Bead-substrate stability plan** (`decisions/adr/draft-bead-substrate-stability.md`,
   DRAFT). Audited-then-planned: emissions silenced in the *wrappers* (`bead-session.sh:238–319`),
   emitter already loud; **the bead store has NO second copy anywhere** (zero dolt
   push/pull/remote/backup in the cluster). Slices DS1–DS5 with entrance criteria + TPMs
   pre-committed. DS1 (loud wrappers) and DS3 (backup proven by restore) are independent and
   Mac-bound; DS5 is a human RIDM gated on DS2–DS4 evidence.

## Vantage warning

This session ran in a cloud container: Dolt DOWN, `~/.claude`/`~/selfco` telemetry absent,
`telemetry/daily` unfetched. Every "unverifiable" figure above understates real health.
**The census (#315) and all DS entrance checks must run on the operator's Mac.**

## Next sessions (any order; one slice/ticket each)

- **#315 census** (Mac) — unblocks #313/#316/#317. Read-only, produces
  `decisions/loops/census-2026-08-01.md`.
- **DS3 entrance + slice** (Mac) — `dolt backup` surface check, then backup + restore drill.
- **DS1 entrance + slice** (Mac) — reproduce the silent drop, then loud wrappers.
- **#308 research** (anywhere) — scheduled-agent primitives, generic-vs-vendor two-column sort,
  ONE deep-research cycle, findings to `decisions/research/`.
