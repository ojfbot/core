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

> **Load `knowledge/core-principles.md`** before measuring or proposing — the depth model (interface simplicity × implementation richness, few-deep-over-many-shallow, shallow-and-painful trigger, ADR and no-edit rules).

## Steps

### 1. Establish scope and recon

If `--scope=<path>` is provided, restrict the audit to that path. Otherwise ask the user which area to audit (don't audit a whole repo by default — output is too large to act on).

`/recon` the target area first if you don't already have a mental model. Read the top-level structure, identify the entry points, note what depends on what.

### 2. Measure depth

Run `scripts/measure-depth.mjs --scope=<path>` to compute per-file metrics.

> **Load `knowledge/depth-metrics.md`** before interpreting the numbers — the full metric definitions (exports per file, lines per public function, import-to-export ratio, single-caller leaves), false-positive guards, and how to read the script's JSON output.

### 3. Cluster shallow modules by responsibility

Group the shallow files the metrics surfaced by what they're trying to do (type-shaping, validation, glue, persistence wrappers, logging, handlers, per-feature utilities). Within each cluster, look for the seam: what would the deep module's public surface look like? One function? Three functions? A class with a small interface?

> **Load `knowledge/ousterhout-summary.md`** for a one-page reminder of the Ousterhout depth model and information-hiding principles.

### 4. Propose deepening candidates

For each cluster that earned its way to a proposal, emit a proposal block. Cap at 5 proposals per session. More than that = either the scope was too wide (narrow it) or the codebase is mostly fine.

> **Load `knowledge/proposal-and-output-format.md`** before writing proposals — the per-proposal block (move, surface, cost, benefit, order), the report shape, and the ADR-stub rule for Step 5.

> **Load `knowledge/refactor-cost-model.md`** for the cost/benefit framework and how to weight risk against ergonomics.

### 5. Suggest ADR for any cross-package proposal

Every proposal where "ADR required" is yes gets a draft ADR stub inline (format in `knowledge/proposal-and-output-format.md`).

### 6. Postflight: route to /scaffold or /tdd

> **Load `knowledge/modes-and-composition.md`** when a proposal is accepted, when invoked with a flag, or when routing onward — modes (`--scope`, `--apply`, `--budget`), postflight routing to `/scaffold`/`/tdd`, composition, and the See-Also map.

## Constraints

- **No file edits in default mode.** Proposals only.
- **`--apply` is gated.** Even with the flag, the skill does not directly modify code — it routes to `/scaffold` and asks the user to drive the relocation.
- **Cap at 5 proposals.** More dilutes signal; user can re-run with narrower scope.
- **No proposals without metrics.** Every proposal cites which files measured shallow and why. No "this looks shallow to me" hand-waving.
- **Surface false positives explicitly.** Barrel re-exports, intentional thin facades around third-party libraries, and well-tested utility namespaces are not proposals — note them as filtered-out.

## Gotchas

- **Low export count is not depth.** The metrics flag thin public surface, but a barrel re-export, an intentional facade over a third-party lib, or a well-tested utility namespace all score "shallow" while being correct. Surface these as filtered-out false positives — proposing to consolidate them is the most common wrong output of this skill.
- **Shallow + comfortable is not a candidate.** The model wants to fix everything the metrics light up. But a thin module that is stable, tested, and pleasant to work with should be left alone — the trigger for a proposal is shallow *and painful*, not shallow alone. "Looks thin on the dashboard" is not a reason to refactor.
- **Whole-repo scope produces an unusable wall.** Running without `--scope` (or asking the user to narrow) yields a proposal list too large to act on; signal drowns. Narrow scope first, cap at 5 proposals — more than 5 means the scope was too wide, not that you found more.
- **Consolidation can manufacture a deep tangle.** Merging five thin wrappers into one module is usually a win, but if the wrappers serve genuinely different callers you've just created a god-module with a wide interface. Check the seam — the proposed public surface must actually be *small*, or you've traded shallow-many for shallow-one.
- **A proposal without a cited metric is hand-waving.** "This looks shallow to me" is exactly the intuition the script exists to discipline. Every proposal names which files measured shallow and on which metric; no metric, no proposal.

---

$ARGUMENTS
