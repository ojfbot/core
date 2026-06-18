---
name: zoom-out
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "zoom out", "give me the bigger
  picture", "what's the broader context here", "how does this fit into the system", "I'm lost
  in this file", "step back". In-loop orientation for a piece of code you're already working in —
  walks up the call graph and module boundaries to explain where this fits, who depends on it,
  and what would break if it changed. Output: a short context briefing inline (no report file).
  For a full repo overview from cold, use /recon instead.
---

# /zoom-out

You (or the user) are deep in a file and need to see the surrounding terrain. This is the lightweight, in-conversation counterpart to `/recon` — no report file, no full repo sweep, just enough context to make the next decision.

**Input:** $ARGUMENTS — the file/function/module in question (defaults to whatever was last being discussed or edited).

**Tier:** 1 — Lightweight
**Phase:** continuous (not phase-locked)

## Core Principles

1. **Up, not down** — explain what *contains and calls* this code, not its internals. The user already sees the internals.
2. **Trace real edges** — grep for actual importers/callers; don't guess from names.
3. **Name the blast radius** — who breaks if this changes, and how loudly.
4. **One screen** — if the answer needs more than ~25 lines, the user wanted `/recon` or `/agent-debug`; say so and stop.

## Workflow

### Step 1 — Locate

Confirm the target. Find the file and its module/package.

### Step 2 — Walk up

- Who imports/calls it (`grep -r`, importer search).
- What bounded context / package it belongs to (check `domain-knowledge/CONTEXT.md` if present).
- Where it sits in the relevant flow (LangGraph node order, SSE phase, MF remote, route handler).
- Any ADR or architecture-doc that governs it.

### Step 3 — Brief

```
## Zoom-out: <target>

**Lives in:** <package / bounded context>
**Role in the flow:** <one or two sentences — where this sits in the pipeline/graph/route>
**Called by:** <list of callers/importers>
**Depends on:** <key downstream things it relies on>
**Blast radius if changed:** <what breaks, how visibly>
**Governed by:** <ADR-NNNN / architecture doc, if any>
**If you need more:** <"run /recon for the full repo map" | "run /agent-debug for the graph" — only if warranted>
```

## Gotchas

- **Drifting downward into the file's internals is the failure mode that makes this `/recon` with extra steps.** The user already sees the internals — they asked to zoom *out*. Explain what contains and calls this code, not how it works inside. The moment you start narrating the function body, you've answered the wrong question.
- **Naming callers from imports or filenames instead of grepping is a guess dressed as orientation.** "This is probably called by the route handler" is exactly the false-confidence the skill forbids — grep for actual importers/callers. A wrong blast radius is worse than none, because the user will make a change decision on it.
- **The one-screen budget is a routing signal, not a style preference.** If the honest answer needs more than ~25 lines, the user wanted `/recon` (full map) or `/agent-debug` (graph) — say so and stop. Cramming a repo-scale answer into the brief format gives a shallow version of the thing they actually need.
- **A blast radius with no failure-loudness is half an answer.** "These three modules import it" doesn't tell the user whether a change breaks loudly at compile time or silently at runtime. Name *how* each dependent breaks, because that's what decides whether the edit is safe to make now.

---

$ARGUMENTS

## See Also
- `/recon` — full cold-start repo reconnaissance report.
- `/agent-debug` — when the question is specifically about a LangGraph state machine.
- `/deepen` — if zooming out reveals a shallow/sprawling module worth restructuring.
