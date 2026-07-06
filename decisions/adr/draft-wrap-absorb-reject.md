# ADR-XXXX: Wrap, absorb, or reject — integrating a mature external harness into an opinionated stack
slug: wrap-absorb-reject
serial: draft
rev:
Date: 2026-06-26
Status: Proposed
domain: meta
type: process
OKR: —
Commands affected: /adopt-stack
Repos affected: core
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: []
  parent:
  part-of-series:

---

<!--
Identity (ADR-0087): `slug` is the permanent, immutable identity. Cross-refs use `adr:<slug>`.
-->

## Context

We periodically find a mature external project that solves something we want — and the instinct is
"adopt it." But "adopt" is not one decision. Adopting a dependency means importing its weight, its
transitive tree, its telemetry, its data-model opinions, and its output format into a stack that has
its own opinions (here: local-first source of truth, pnpm-only, name-by-purpose / ubiquitous language,
diffable artifacts that render anywhere). When the external project's opinions collide with ours, an
undifferentiated "adopt" silently lets the foreign opinions win.

The forcing case was a real dogfood of **BuilderIO's `agent-native`** (the engine behind its
`visual-plan` skill), evaluated 2026-06-26. The spike findings (full receipts in
`/adopt-stack` knowledge → `case-studies/agent-native.md`):

- `@agent-native/core` is **113.9 MB, 88 direct deps (~811 in the tree on install)**, with a native
  `better-sqlite3` postinstall — it is an *application shipped as an npm package*, not a library.
- It **bundles Amplitude + Sentry + rrweb telemetry** and **three database drivers** (Neon/libSQL/
  better-sqlite3) plus `better-auth` and a full browser editor.
- Its local-files mode genuinely runs **offline** (verified) — but its output is **MDX welded to a
  proprietary 20-block component vocabulary** that only renders in agent-native's own UI; in plain
  git/GitHub it is raw JSX.

A flat "adopt / don't adopt" axis could not express the right answer here, which was: *reject the
import, keep zero of its packages in our tree, but absorb the one genuinely good idea (structured
plan blocks) re-expressed in our own portable primitives (markdown + Mermaid).* We need a named
framework so this judgment is repeatable instead of re-derived each time.

## Decision

Adopt a three-way decision framework — **WRAP / ABSORB / REJECT** — applied per *opinion* an external
stack imposes, gated by a prior **library-vs-application** question:

1. **First question — is it a library or an application?** Measure before deciding: unpacked size,
   direct + transitive dep count, bundled telemetry/analytics SDKs, embedded servers/DBs/auth, native
   postinstall steps. An *application* (heavy tree, telemetry, its own persistence) is never `import`ed
   into our stack — the only honest boundaries for it are a **process/protocol boundary** (drive its
   CLI/MCP out-of-process, zero packages in our tree) or **reject**.
2. **Then, per opinion it imposes, choose:**
   - **WRAP** — adopt the dependency but confine the vendor to a single labeled adapter file; callers
     see only our domain interface (precedent: `packages/workflows/src/llm.ts`,
     `cv-builder/.../base-agent.ts`). The *driver-skill / thin-client-over-a-load-bearing-app* pattern
     ("thin client for capability, thick client for taste") is the WRAP branch at a process boundary.
   - **ABSORB** — take the *idea*, re-implement it in our own terms, drop the dependency. Correct when
     the idea is small and good but the carrier is heavy or opinion-laden (e.g. the structured-block
     concept → markdown + Mermaid).
   - **REJECT** — do not take it at all. Correct when the opinion fights a hard invariant (telemetry vs.
     local-first; hosted DB vs. committed source of truth) and isn't worth re-expressing.

The decision and its rationale are recorded as a wrap/absorb/reject table (see the case study). The
`/adopt-stack` skill operationalizes this framework; this ADR is its "why" layer.

## Consequences

### Gains
- "Adopt" stops being a single silent decision; each foreign opinion gets an explicit, recorded call.
- The library-vs-application gate prevents the most expensive mistake — `import`ing an application —
  before any adapter code is written.
- Produces a reusable, legible artifact (the wrap/absorb/reject table) that doubles as integration-
  judgment evidence.

### Costs
- More up-front measurement (dep audit, telemetry scan) before adopting — a real, if small, tax.
- Risk of over-applying the framework to trivial, obviously-safe dependencies. Reserve it for mature/
  heavy/opinion-laden stacks, not a one-function utility.

### Neutral
- The framework is descriptive of judgment we already exercised ad hoc (the `llm.ts`-style adapters);
  it names and routes that instinct rather than introducing new machinery.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Binary adopt / don't-adopt | Cannot express "reject the dependency but absorb its idea" — the actually-correct call in the forcing case. |
| Always wrap behind an adapter | Wrapping an *application* (113.9 MB, telemetry, 3 DBs) still drags it into the lockfile. WRAP is only safe once the library-vs-application gate passes. |
| Just write a blog post, skip codification | Loses repeatability; the next mature-harness evaluation re-derives the same reasoning from scratch. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-06-26 — agent-native dogfood (spike), reject-the-import gate verdict |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
