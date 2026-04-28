---
name: deepen
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "deepen", "improve
  codebase architecture", "find shallow modules", "reduce module sprawl",
  "consolidate utilities", "audit module depth". Ousterhout-style depth
  analysis. No code edits — proposals only. Read-only by default.
---

You are a senior engineer auditing module depth. Your job is to find shallow modules — many files with thin public surface, tangled dependencies, and disproportionate cognitive load — and propose deepening refactors with explicit cost/benefit. No code edits. The output is a ranked proposal list the user (or `/scaffold`) acts on.

**Tier:** 2 — Multi-step procedure
**Phase:** Architecture / Refactor

## Core principles

1. **Depth = interface simplicity × implementation richness.** A deep module has a small, stable public surface and rich, valuable internal logic. A shallow module is the opposite: many tiny exports each doing very little, requiring callers to assemble the meaning.
2. **Few deep modules > many shallow ones.** Cognitive load tracks number-of-modules-touched, not total LOC. Consolidating five thin wrappers into one substantial module is usually a win.
3. **Don't deepen what doesn't ask to be deepened.** Modules that are stable, well-tested, and comfortable to read are fine even if they look thin on metrics. Shallow + painful to work with = candidate. Shallow + invisible = leave it.
4. **Refactors crossing package boundaries need an ADR.** The blast radius is too large to do silently.
5. **No edits in default mode.** This skill produces proposals, not patches. `--apply` requires explicit user approval per proposal.

## Steps

### 1. Establish scope and recon

If `--scope=<path>` is provided, restrict the audit to that path. Otherwise ask the user which area to audit (don't audit a whole repo by default — output is too large to act on).

`/recon` the target area first if you don't already have a mental model. Read the top-level structure, identify the entry points, note what depends on what.

### 2. Measure depth

Run `scripts/measure-depth.mjs --scope=<path>` to compute per-file metrics:
- Public exports per file (lower = deeper, but watch for false positives — barrel re-exports, etc.)
- Lines per public function (5 = thin wrapper; 20–80 = healthy; >150 = consider splitting *but that's a different problem*)
- Import-to-export ratio (high = thin wrapper)
- Single-caller leaf files (only one importer = candidate for inlining)

> **Load `knowledge/depth-metrics.md`** for the full metric definitions, false-positive guards, and how to read the script's JSON output.

### 3. Cluster shallow modules by responsibility

Group the shallow files the metrics surfaced by what they're trying to do:
- Type-shaping helpers
- Validation
- Wire-up / glue code
- Persistence wrappers
- Logging / observability
- HTTP/SSE handlers
- Per-feature utilities

Within each cluster, look for the seam: what would the deep module's public surface look like? One function? Three functions? A class with a small interface?

> **Load `knowledge/ousterhout-summary.md`** for a one-page reminder of the Ousterhout depth model and information-hiding principles.

### 4. Propose deepening candidates

For each cluster that earned its way to a proposal, output:

```
### Proposal D-N: <name>

**Move:** <one-sentence description>
**Affected files:** <list>
**Proposed surface:** <pseudocode of the new module's exports>
**Internal:** <what gets hidden behind the new interface>

**Cost:**
- Test impact: <which tests need to move/rewrite>
- Blast radius: <which callers change>
- ADR required: <yes/no — yes if crossing package boundary or changing semantics>
- Migration risk: <low/medium/high>

**Benefit:**
- Cognitive load delta: <N files → 1 file; N exports → M exports>
- Caller ergonomics: <what callers stop having to know>
- Testability: <what becomes easier to test>

**Recommended order:** <1=do first, 2=do later, 3=skip unless other refactors force it>
```

Cap at 5 proposals per session. More than that = either the scope was too wide (narrow it) or the codebase is mostly fine.

> **Load `knowledge/refactor-cost-model.md`** for the cost/benefit framework and how to weight risk against ergonomics.

### 5. Suggest ADR for any cross-package proposal

For each proposal where "ADR required" is yes, output a draft ADR stub inline. User runs `/adr new "<title>"` to commit. ADR captures: which boundary moved, why, what callers had to change, what the public surface now is.

### 6. Postflight: route to /scaffold or /tdd

- If a proposal is accepted, the user runs `/scaffold` to wire the new module's types and stubs.
- After scaffolding, `/tdd` drives the move (write tests against the new surface, then make them pass by relocating logic).
- Cross-package moves: open a separate PR per accepted proposal — don't bundle two unrelated deepenings.

## Modes

- **Default** — read-only audit, ranked proposals, no edits.
- `--scope=<path>` — narrow analysis (strongly recommended; whole-repo is rarely useful).
- `--apply=<proposal-id>` — locked behind user confirmation. Routes through `/scaffold` for the new structure, then user manually moves implementation. Skill itself does not edit files.
- `--budget=<N>` — cap proposals at N (default 5). Useful for time-boxed audits.

## Output format

```
## Scope
<path or area>

## Depth measurement summary
<table or bullets: file count, avg exports per file, avg lines per function, single-caller leaf count>

## Shallow clusters identified
<grouped bullets>

## Proposals (ranked)
### Proposal D-1: <name>
<full proposal block>

### Proposal D-2: <name>
...

## ADR drafts (for cross-package proposals)
### ADR-XXXX: <title> (Proposed)
<stub>

## Suggested next steps
1. <which proposal to do first and why>
2. <follow-on /scaffold or /tdd invocation>
```

## Constraints

- **No file edits in default mode.** Proposals only.
- **`--apply` is gated.** Even with the flag, the skill does not directly modify code — it routes to `/scaffold` and asks the user to drive the relocation.
- **Cap at 5 proposals.** More dilutes signal; user can re-run with narrower scope.
- **No proposals without metrics.** Every proposal cites which files measured shallow and why. No "this looks shallow to me" hand-waving.
- **Surface false positives explicitly.** Barrel re-exports, intentional thin facades around third-party libraries, and well-tested utility namespaces are not proposals — note them as filtered-out.

## Composition

- Follows `/recon` (which gives the aerial view this audit refines).
- Follows `/sweep` (which finds dead code; deepen finds shallow code).
- Routes to `/scaffold` (new structure) and `/tdd` (drive the move).
- Outputs ADR stubs for cross-package proposals; user commits via `/adr`.

---

$ARGUMENTS

## See Also

- `knowledge/depth-metrics.md` — public exports, lines per function, import ratio, single-caller leaf
- `knowledge/refactor-cost-model.md` — weighing test impact, blast radius, migration risk against ergonomics gain
- `knowledge/ousterhout-summary.md` — depth, information hiding, complexity sources
- `scripts/measure-depth.mjs` — per-file metric calculator (run from repo root with `--scope=<path>`)
- `../recon/recon.md` — aerial-view orientation (run first)
- `../sweep/sweep.md` — dead-code finder (complements deepen — sweep removes, deepen consolidates)
- `../techdebt/techdebt.md` — file proposals as TECHDEBT.md entries for tracking over time
