---
name: claude-md-audit
description: >
  Audit a repo's CLAUDE.md for loading-discipline (ADR-0081): classify every block as
  always-relevant (Layer 0, stays) / path-conditional (Layer 1 → rules/ or nested CLAUDE.md) /
  task-conditional reference (Layer 2 → domain-knowledge + skill) / stale (delete), and propose a
  routing plan that shrinks the always-loaded footprint without @import theater. Use when the user
  says "audit CLAUDE.md", "decompose this CLAUDE.md", "is my CLAUDE.md too big", "route CLAUDE.md",
  "claude-md-audit", or when a CLAUDE.md is over ~200 lines. Default mode is propose (no edits);
  apply mode is path-restricted. The LLM judgment lives here — scripts only measure.
---

You are decomposing an oversized CLAUDE.md by **loading-discipline**, per ADR-0081. The goal is **not** a line count — it is to remove *conditional* content from the *always-loaded* layer. Line count is only the smell.

**Tier:** 2 — Multi-step procedure
**Phase:** Implementation (workflow-engine hygiene)
**Modes:** `propose` (default — output a routing plan, no edits) · `apply` (path-restricted: only writes `CLAUDE.md`, `.claude/rules/**`, nested `*/CLAUDE.md`, and a **repo-native, git-tracked docs dir** for Layer-2 — `documentation/` or `docs/`, whichever the repo already uses; **not** `domain-knowledge/` when it's a gitignored symlink farm — see Step 3)

## Core principle — the four buckets

Read every block of the target CLAUDE.md and assign exactly one:

> **Load `knowledge/routing-rules.md`** before classifying anything — the four-bucket table, the @import prohibition, and the delete-safety hard rule.

## Steps

### 1. Measure the baseline
Run `node {core}/scripts/claude-md/footprint.mjs <repo>` to record current always-loaded tokens/lines and any existing conditional content. This is the before-number.

### 2. Read and classify
Read the target `CLAUDE.md` top to bottom. For each block (a heading + its body, or a logically coherent run), assign one bucket.

> **Load `knowledge/routing-rules.md`** before classifying — the conservative-toward-Layer-0 bar and the verify-pointers-before-trusting-them rule.

### 3. Name the targets
For each non-Layer-0 block, name the exact destination file and (for `rules/`) the `paths:` glob.

> **Load `knowledge/routing-rules.md`** before naming destinations — grouping rules and the git-tracked Layer-2 destination requirement (`domain-knowledge/` trap).

### 4. Project the after-footprint

> **Load `knowledge/routing-rules.md`** before projecting — how to state the after-number and why a near-zero drop can be the correct result.

### 5. Output the routing plan

> **Load `knowledge/output-format.md`** before emitting the plan — what the routing plan contains and the exact output template.

### 6. (apply mode only) Apply + re-measure

> **Load `knowledge/routing-rules.md`** before applying — the apply-mode write/re-measure/record procedure.

## Constraints

- **The classification is judgment — that's why this is a skill, not a script.** Don't mechanize it with regex.
- **Conservative toward Layer 0.** Wrongly evicting an always-true rule is a silent failure; over-keeping costs only some footprint.
- **No `@import` as a routing target — ever.** Footprint is the metric, not line count.
- **Never delete on assumption.** Delete only with verified verbatim duplication in an existing file; otherwise relocate (Layer 1/2) — same footprint drop, no loss. Verify every "see `X`" pointer; a broken one is a finding to fix, not a license to delete.
- **`propose` writes nothing.** `apply` writes only the allowlisted paths in the target repo, then re-measures.
- Contested blocks (you genuinely can't tell L0 vs L1) → list them for `/grill-with-docs --scope=claude-md-routing`, don't guess.

## Composition

> **Load `knowledge/routing-rules.md`** when composing with the rollout — how this skill feeds the ADR-0081 rollout and the measure/decide split with `footprint.mjs`.

## Gotchas

- **Line count is the smell, not the target.** The reflex is to chase a smaller number, so the model invents Layer-1/Layer-2 splits for content that is genuinely always-relevant. A command-catalog CLAUDE.md (like core's) is *correctly* Layer-0-heavy — a near-zero projected drop is the right answer, not a failure to decompose harder.
- **A "see X.md" pointer is a claim, not evidence.** The most damaging move is deleting a block because it "looks duplicated elsewhere" without `ls`-ing the target. If the file is missing or the content differs, you have silently destroyed the only copy. Verify the file exists AND holds the same content; otherwise relocate (same footprint drop, zero loss).
- **`@import` feels like routing but isn't.** Imports resolve at startup, so moving a block to an `@import` leaves the always-loaded footprint unchanged — pure theater. Every non-Layer-0 block goes to a nested `CLAUDE.md`, a `rules/` glob, or a tracked docs dir; never to an import target.
- **`domain-knowledge/` is a trap as a Layer-2 destination.** In fleet repos it's a gitignored symlink farm into `core/`. Writing Layer-2 docs there fails to commit (broken pointer) and can corrupt core. Run `git check-ignore domain-knowledge` first; prefer the repo's existing tracked `documentation/`/`docs/`.
- **When unsure, over-keep — eviction is the silent failure.** Wrongly evicting an always-true rule means it's missed on every non-matching edit path, with no error to signal it. Over-keeping only costs some footprint. The bar to move a block out is "this *clearly* only matters in subtree X," not "this *might* be conditional."

## See Also
- ADR-0081 (`decisions/adr/0081-path-scoped-rules-dir-adoption.md`) — the governing decision
- `scripts/claude-md/footprint.mjs` — the M1 measurement
- `/grill-with-docs` — where contested routing decisions go
