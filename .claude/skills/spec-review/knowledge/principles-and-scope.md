# Principles and scope

Reference for `/spec-review`, moved verbatim from SKILL.md: where this skill sits in the review family, the five core principles, and the postflight routing.

## Position in the review family

This is the **Spec** axis of the review family (see `/validate`) run *forward* — against a plan before code exists — rather than backward against a diff. It does not check the Standards axis (no code to check yet). After implementation, `/validate` (local) or `/pr-review` (PR) closes the loop on both axes.

## Core principles

1. **Evidence-first** — every finding must cite a specific source (file path, doc name, line). No findings from intuition.
2. **Distinguish errors from preferences** — CRITICAL = broken implementation if uncorrected. SIGNIFICANT = missing info that causes rework. MINOR = inaccuracy that doesn't block. Do not bloat the CRITICAL bucket.
3. **Surface conflicts, don't resolve them** — if two sources contradict each other, flag the inconsistency and name which source is more authoritative (actual code > domain-knowledge docs > spec claims). Never silently choose one.
4. **What's right matters** — document what the spec gets correct. It gives the implementer confidence about what they don't need to re-verify.
5. **No rewrites, no fixes** — this skill produces a review report only.

## Postflight routing

If the spec references stale domain-knowledge (e.g., a doc says "X is missing" but X was shipped):
> Offer `/doc-refactor` to update the stale file.

If three or more SIGNIFICANT gaps suggest a recurring weakness in how the original agent planned:
> Offer `/techdebt --mode=scan` to capture the pattern.
