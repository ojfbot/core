# Classification and routing rules

Reference for `/claude-md-audit`, moved verbatim from SKILL.md: the four buckets, the @import and delete-safety rules, classification guidance, destination naming, and apply-mode mechanics.

## The four buckets

| Bucket | Test: "Is this needed…" | Route to | Loads when |
|---|---|---|---|
| **Layer 0 — always** | …in *every* session, no matter which file is edited? | **stays in CLAUDE.md** | always |
| **Layer 1 — path-conditional** | …only when editing a specific subtree? | nested `<subtree>/CLAUDE.md` (default) or `.claude/rules/<x>.md` with `paths:` glob (cross-cutting) | on matching edit path |
| **Layer 2 — task reference** | …only when a specific task/skill runs (deep reference, not a rule)? | a repo-native tracked docs dir (`documentation/`/`docs/`); see Step 3 re `domain-knowledge/` | when read on demand |
| **Delete** | …provably stale, OR already present **verbatim** in another file that **actually exists**? | removed | never |

**Forbidden:** routing a block to an `@import` — imports load at startup, so they do **not** reduce the always-loaded footprint. That is theater (ADR-0081). If you're tempted to `@import`, the content is either Layer 0 (leave it) or genuinely conditional (Layer 1/2).

**Delete-safety (hard rule).** Never delete on an *assumption* of duplication. A block may be deleted only when you have **verified** the content lives elsewhere — the referenced file **exists** (don't trust a "see `X.md`" pointer; `ls` it) and **contains the same content**. If you cannot prove that, the block is a **relocate (Layer 1/2), not a delete** — relocation removes it from the always-loaded layer just the same, so the M1 footprint drop is identical and you lose nothing. "Derivable from config" (e.g. a tech-stack list vs `package.json`) is **not** verbatim duplication → relocate or fold, don't delete. When in doubt, relocate.

## Classifying conservatively (Step 2 detail)

Be conservative toward **Layer 0**: when unsure whether something is truly path-conditional, keep it always-loaded — a wrongly-evicted always-true rule is a *silent* failure (it gets missed on non-matching paths). The bar for moving a block out is "this clearly only matters in subtree X."

**Verify pointers before trusting them.** When a block says "see `X.md`" / "documented in `Y`" — and especially before classifying anything as **Delete** on the grounds that it's covered elsewhere — actually check the target exists (`ls`/read it). A broken or stale pointer (the target is missing, or lives at a different path) is itself a **finding**: report it and fix the pointer in the same pass. Do **not** let an unverified pointer justify a deletion (see Delete-safety above).

## Naming destinations (Step 3 detail)

Group related path-conditional blocks into one Layer-1 file per subtree, not one per block. Prefer nested `<subtree>/CLAUDE.md` when a subtree has one coherent rule set; use `.claude/rules/<concern>.md` when a concern (testing, security) spans multiple globs.

**Layer-2 destination must be git-tracked, repo-native.** Pick the docs dir the repo *already* uses (`documentation/`, `docs/`) and confirm it's tracked. **Do not write Layer-2 into `domain-knowledge/`** without checking `git check-ignore domain-knowledge` first — in fleet repos that dir is a gitignored farm of symlinks into `core/domain-knowledge/`, so writing there both fails to commit (broken pointer) and risks editing core. If the repo has no tracked docs dir, create `documentation/`.

## Projecting the after-footprint (Step 4 detail)

State the projected always-loaded tokens after routing (baseline minus what moves to Layer 1/2/delete). Note: a near-zero projected drop is a **valid, correct** result for a Layer-0-heavy repo (e.g. a command-catalog CLAUDE.md like core's) — say so; do not manufacture decomposition to hit a number.

## Apply mode (Step 6 detail)

Write the routed files, re-run `footprint.mjs`, and confirm the after-number matches the projection and that no block landed in an `@import`. Append a routing record for the rollout tracker.

## Composition

- Produces the per-repo decomposition for the ADR-0081 rollout; the gate (ADR-0081 §Decision) routes write-time hits *into* this skill / `/grill-with-docs`.
- `footprint.mjs` (measure) is deterministic; this skill (decide) is the judgment. Never merge them.
