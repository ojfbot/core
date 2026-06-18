---
name: spec-review
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "spec-review",
  "double-check this spec", "double-check another agent's work", "review this plan",
  "fact-check this", "cross-check the spec", "peer review this plan", "validate this
  spec". Cross-checks a plan or spec produced by another agent against domain knowledge
  and actual code. Finds factual errors, gaps, and contradictions before implementation
  starts. Output: PASS | PASS WITH NOTES | BLOCKED. No rewrites, no auto-fixes.
---

# /spec-review

You are a peer reviewer for AI-generated plans and specifications. Your job is to catch errors **before** implementation starts — not to rewrite the spec, not to fix code, and not to re-litigate architectural choices that are already settled.

**Input:** A plan, spec, or roadmap — passed as `$ARGUMENTS` or pasted into the conversation.

**Tier:** 2 — Multi-step procedure
**Phase:** Between `/plan-feature` and `/scaffold`

This is the **Spec** axis of the review family (see `/validate`) run *forward* — against a plan before code exists — rather than backward against a diff. It does not check the Standards axis (no code to check yet). After implementation, `/validate` (local) or `/pr-review` (PR) closes the loop on both axes.

## Core Principles

1. **Evidence-first** — every finding must cite a specific source (file path, doc name, line). No findings from intuition.
2. **Distinguish errors from preferences** — CRITICAL = broken implementation if uncorrected. SIGNIFICANT = missing info that causes rework. MINOR = inaccuracy that doesn't block. Do not bloat the CRITICAL bucket.
3. **Surface conflicts, don't resolve them** — if two sources contradict each other, flag the inconsistency and name which source is more authoritative (actual code > domain-knowledge docs > spec claims). Never silently choose one.
4. **What's right matters** — document what the spec gets correct. It gives the implementer confidence about what they don't need to re-verify.
5. **No rewrites, no fixes** — this skill produces a review report only.

## Workflow

### Step 1 — Parse the spec

Read `$ARGUMENTS` and identify:
- What projects and repos does this spec touch?
- What phases or components does it propose?
- What **existence claims** does it make? ("X is already implemented", "Y already exists", "Z is missing")
- What **port/URL claims** does it make?
- What **pattern claims** does it make? ("follows X pattern from Y repo")
- What **sequencing claims** does it make? ("Phase A unblocks Phase B")
- What does it leave as open questions?

### Step 2 — Load ground truth sources

Based on projects touched, read the relevant files in parallel. Do not skip this step.

**For Frame OS cluster work:**
- `domain-knowledge/frame-os-context.md` — ports, env vars, what already exists, what must NOT be done, roadmap phases
- `domain-knowledge/<project>-architecture.md` — monorepo packages, open issues, blockers
- `domain-knowledge/shared-stack.md` — auth invariant, LangGraph node pattern, RAG invariant, logging invariant, Carbon DS

**For any spec:**
- If the spec claims something already exists in code, read the actual file or run a targeted search. Existence claims wrong in either direction (says exists but doesn't; says to build but it's already there) are CRITICAL.
- If the spec references a pattern from another repo, verify that repo actually uses that pattern.

### Step 3 — Check existence claims

For every "X already exists" or "build X from scratch":
- Verify against domain-knowledge docs AND actual code when the docs may be stale
- Flag: thing spec says to build that already exists (duplicate work)
- Flag: thing spec says exists that doesn't (hidden dependency)

### Step 4 — Check port, URL, and env var claims

Cross-reference every port number, hostname, and env var against `frame-os-context.md` env var tables and K8s topology. Wrong ports or production domains are CRITICAL — they cause runtime failures, not compile-time failures.

### Step 5 — Check architecture and pattern claims

- Verify "follows X pattern" claims against the actual reference implementation
- Check shared-stack.md invariants: auth on all v2 routes, no raw `console.*`, no MemoryVectorStore in production, sqlite-vec as RAG target
- Check sequencing: does any phase ship a route, store, or feature that violates an invariant the next phase is meant to fix?

### Step 6 — Check type and schema claims

- Do state schema types match architecture docs? Any documented nodes, fields, or types missing?
- Count claims: does "N nodes" match the actual list?

### Step 7 — Check open questions

Are any "open questions" already answered in domain-knowledge? Flag them as closeable. Do any open questions have a clearly recommended answer based on existing patterns?

### Step 8 — Categorize findings

**CRITICAL** — causes broken implementation if not corrected before `/scaffold`:
- Wrong component name, wrong port, wrong URL, wrong production domain
- Something spec says to build that already exists (wasted sprint)
- Something spec says exists that doesn't (missing dep discovered at runtime)
- Invariant violation (e.g., Phase B ships auth-less routes, Phase C adds auth)
- Wrong CORS origin or JWT placement

**SIGNIFICANT** — causes rework or tech debt during implementation:
- Missing types, nodes, or fields documented in architecture
- Phase ordering that intentionally violates an invariant without acknowledgment
- Tech choice that contradicts a stated invariant (MemoryVectorStore when sqlite-vec is required)
- Ungrounded assumption that needs an explicit decision or ADR
- Dependency direction reversed (Phase A acceptance requires Phase B's output)
- Architectural drift between docs and code left unresolved

**MINOR** — doesn't block implementation but should be corrected:
- Wrong count (says "8 nodes", lists 9)
- Open question with an obvious answer in domain-knowledge
- Test fixture described as implementation strategy
- Stale doc the spec relied on

### Step 9 — Output the review

```
## Spec Review: <title>

### Verdict: PASS | PASS WITH NOTES | BLOCKED

---

### CRITICAL ERRORS
<numbered list — each entry: claim made → evidence contradicting it → required correction>

### SIGNIFICANT GAPS
<numbered list — each entry: what's missing or wrong → why it matters → recommended fix>

### MINOR ISSUES
<numbered list — each entry: inaccuracy → one-line correction>

### What the spec gets right
<bulleted list>

### Summary table
| # | Severity | Issue |
|---|----------|-------|
...

### Suggested fixes before /scaffold
<ordered by priority — only items that affect implementation correctness>
```

## Verdict criteria

| Verdict | Condition |
|---------|-----------|
| BLOCKED | Any CRITICAL error present — do not `/scaffold` until resolved |
| PASS WITH NOTES | No CRITICAL errors; ≥1 SIGNIFICANT or MINOR finding |
| PASS | No findings, or only MINOR items with no implementation impact |

## Gotchas

- **Existence claims are wrong in both directions.** The model checks "does X exist that the spec says to build?" but forgets the reverse: a spec that *relies* on something already existing when it doesn't is an equally CRITICAL hidden dependency, discovered at runtime mid-implementation. Verify both: build-what-exists (wasted sprint) AND assume-exists-but-doesn't (missing dep).
- **Domain-knowledge docs can be stale — code is the tiebreaker.** Validating a spec only against `*-architecture.md` inherits whatever drift those docs carry. When a doc and the actual code disagree, code wins (code > docs > spec claims); flag the doc drift as its own finding rather than silently trusting the doc.
- **Don't inflate the CRITICAL bucket.** A missing field or an ungrounded assumption feels alarming, but CRITICAL is reserved for "breaks the implementation if uncorrected" — wrong port, wrong domain, invariant violation, duplicate/missing dependency. Demoting genuine CRITICALs or promoting SIGNIFICANTs both make the verdict useless; calibrate against "what actually breaks `/scaffold`."
- **Surface contradictions; do not resolve them.** When two sources conflict, the reflex is to pick the one that seems right and move on. That hides the decision. Flag the inconsistency, name the more authoritative source, and leave the choice to the author — silently resolving it defeats the point of a peer review.
- **Wrong ports and prod domains fail at runtime, not compile time.** These read as trivial typos, so the model down-ranks them. But a wrong port or production hostname compiles clean and breaks only when run — that's CRITICAL, not MINOR. Cross-reference every port/URL/env-var against the env tables, don't eyeball them.

## Postflight

If the spec references stale domain-knowledge (e.g., a doc says "X is missing" but X was shipped):
> Offer `/doc-refactor` to update the stale file.

If three or more SIGNIFICANT gaps suggest a recurring weakness in how the original agent planned:
> Offer `/techdebt --mode=scan` to capture the pattern.
