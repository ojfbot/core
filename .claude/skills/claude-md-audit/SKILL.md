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

| Bucket | Test: "Is this needed…" | Route to | Loads when |
|---|---|---|---|
| **Layer 0 — always** | …in *every* session, no matter which file is edited? | **stays in CLAUDE.md** | always |
| **Layer 1 — path-conditional** | …only when editing a specific subtree? | nested `<subtree>/CLAUDE.md` (default) or `.claude/rules/<x>.md` with `paths:` glob (cross-cutting) | on matching edit path |
| **Layer 2 — task reference** | …only when a specific task/skill runs (deep reference, not a rule)? | a repo-native tracked docs dir (`documentation/`/`docs/`); see Step 3 re `domain-knowledge/` | when read on demand |
| **Delete** | …provably stale, OR already present **verbatim** in another file that **actually exists**? | removed | never |

**Forbidden:** routing a block to an `@import` — imports load at startup, so they do **not** reduce the always-loaded footprint. That is theater (ADR-0081). If you're tempted to `@import`, the content is either Layer 0 (leave it) or genuinely conditional (Layer 1/2).

**Delete-safety (hard rule).** Never delete on an *assumption* of duplication. A block may be deleted only when you have **verified** the content lives elsewhere — the referenced file **exists** (don't trust a "see `X.md`" pointer; `ls` it) and **contains the same content**. If you cannot prove that, the block is a **relocate (Layer 1/2), not a delete** — relocation removes it from the always-loaded layer just the same, so the M1 footprint drop is identical and you lose nothing. "Derivable from config" (e.g. a tech-stack list vs `package.json`) is **not** verbatim duplication → relocate or fold, don't delete. When in doubt, relocate.

## Steps

### 1. Measure the baseline
Run `node {core}/scripts/claude-md/footprint.mjs <repo>` to record current always-loaded tokens/lines and any existing conditional content. This is the before-number.

### 2. Read and classify
Read the target `CLAUDE.md` top to bottom. For each block (a heading + its body, or a logically coherent run), assign one bucket. Be conservative toward **Layer 0**: when unsure whether something is truly path-conditional, keep it always-loaded — a wrongly-evicted always-true rule is a *silent* failure (it gets missed on non-matching paths). The bar for moving a block out is "this clearly only matters in subtree X."

**Verify pointers before trusting them.** When a block says "see `X.md`" / "documented in `Y`" — and especially before classifying anything as **Delete** on the grounds that it's covered elsewhere — actually check the target exists (`ls`/read it). A broken or stale pointer (the target is missing, or lives at a different path) is itself a **finding**: report it and fix the pointer in the same pass. Do **not** let an unverified pointer justify a deletion (see Delete-safety above).

### 3. Name the targets
For each non-Layer-0 block, name the exact destination file and (for `rules/`) the `paths:` glob. Group related path-conditional blocks into one Layer-1 file per subtree, not one per block. Prefer nested `<subtree>/CLAUDE.md` when a subtree has one coherent rule set; use `.claude/rules/<concern>.md` when a concern (testing, security) spans multiple globs.

**Layer-2 destination must be git-tracked, repo-native.** Pick the docs dir the repo *already* uses (`documentation/`, `docs/`) and confirm it's tracked. **Do not write Layer-2 into `domain-knowledge/`** without checking `git check-ignore domain-knowledge` first — in fleet repos that dir is a gitignored farm of symlinks into `core/domain-knowledge/`, so writing there both fails to commit (broken pointer) and risks editing core. If the repo has no tracked docs dir, create `documentation/`.

### 4. Project the after-footprint
State the projected always-loaded tokens after routing (baseline minus what moves to Layer 1/2/delete). Note: a near-zero projected drop is a **valid, correct** result for a Layer-0-heavy repo (e.g. a command-catalog CLAUDE.md like core's) — say so; do not manufacture decomposition to hit a number.

### 5. Output the routing plan
A table: `block (heading) | bucket | destination | why`. Then the before→projected-after footprint line, and an explicit "blocks moved to @import: 0" assertion. End with the per-file diff preview (what each new/edited file would contain) — but in `propose` mode do **not** write anything.

### 6. (apply mode only) Apply + re-measure
Write the routed files, re-run `footprint.mjs`, and confirm the after-number matches the projection and that no block landed in an `@import`. Append a routing record for the rollout tracker.

## Output format

```
## /claude-md-audit <repo> (<mode>)

Baseline (M1): <N> always-loaded tokens / <L> lines

| Block | Bucket | Destination | Why |
|-------|--------|-------------|-----|
| ...   | L0/L1/L2/del | <file>[ paths: <glob>] | ... |

Projected after: <N'> always-loaded tokens  (Δ <N'-N>; @import blocks: 0)
Layer-1 files: <list with scopes>   Layer-2: <list>   Deleted (verified-duplicate only): <list, each with the existing file that holds it>

Findings (fix in same pass): <broken "see X" pointers, stale references, contradictions — or "none">

Verdict: <one line — e.g. "core is Layer-0-heavy; minimal routing, footprint ~unchanged, correct">
Next: <apply, or /grill-with-docs for contested blocks, or move to next repo>
```

## Constraints

- **The classification is judgment — that's why this is a skill, not a script.** Don't mechanize it with regex.
- **Conservative toward Layer 0.** Wrongly evicting an always-true rule is a silent failure; over-keeping costs only some footprint.
- **No `@import` as a routing target — ever.** Footprint is the metric, not line count.
- **Never delete on assumption.** Delete only with verified verbatim duplication in an existing file; otherwise relocate (Layer 1/2) — same footprint drop, no loss. Verify every "see `X`" pointer; a broken one is a finding to fix, not a license to delete.
- **`propose` writes nothing.** `apply` writes only the allowlisted paths in the target repo, then re-measures.
- Contested blocks (you genuinely can't tell L0 vs L1) → list them for `/grill-with-docs --scope=claude-md-routing`, don't guess.

## Composition
- Produces the per-repo decomposition for the ADR-0081 rollout; the gate (ADR-0081 §Decision) routes write-time hits *into* this skill / `/grill-with-docs`.
- `footprint.mjs` (measure) is deterministic; this skill (decide) is the judgment. Never merge them.

## See Also
- ADR-0081 (`decisions/adr/0081-path-scoped-rules-dir-adoption.md`) — the governing decision
- `scripts/claude-md/footprint.mjs` — the M1 measurement
- `/grill-with-docs` — where contested routing decisions go
