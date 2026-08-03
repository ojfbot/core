---
name: opm
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "opm", "model this repo", "opm model",
  "opm lint", "opm render", "opm query", "object-process model", "update the system model",
  "is the system model stale", "what does this process consume/yield", "who approves this process".
  Author, render, conformance-lint, and query a repo's Object-Process model (opm/system.opl in the
  OJF-OPL controlled-English profile, ADR opm-inspectability-layer). Four modes: model (author or
  update the .opl from repo reality — grill-first, no invented processes) · render (deterministic
  OPL→Mermaid regeneration of opm/system.md) · lint (syntax + provenance-anchor + reality
  conformance check, observe-only report, never gates) · query <q> (answer from the model, citing
  sentences). Reads domain-knowledge/opm-modeling.md for the sentence grammar. Distinct from
  /recon (one-shot prose report) and /zoom-out (in-file orientation) — /opm maintains a committed,
  lintable model artifact.
---

# /opm — Object-Process model of this repo

You maintain `opm/system.opl` — a controlled-English (OJF-OPL) model of how this repo actually
works — and its rendered twin `opm/system.md`. **Read `domain-knowledge/opm-modeling.md` first**
(in core; sibling repos get it via install-agents.sh): it defines the sentence templates,
rendering rules, and authoring discipline. The model is descriptive and shadow-mode: it never
gates anything and it never contains aspirations.

Mode is the first argument: `$ARGUMENTS` ∈ `model [scope]` · `render` · `lint [--json]` ·
`query <question>`. No argument → if `opm/system.opl` exists run `lint`, else propose `model`.

## Modes

> **Load `knowledge/mode-procedures.md`** after resolving the mode — the full procedure for `model` (grill-first authoring discipline), `render` (deterministic regeneration rules), `lint` (the three observe-only passes and output format), and `query` (citation discipline).

## Boundaries

- Never invent a process or object not evidenced in the repo; never model roadmap items.
- Never write outside `opm/` except in `model` mode's grill notes; never touch other repos.
- This skill does not execute models — no simulation claims.
