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

## Core Principles

> **Load `knowledge/principles-and-scope.md`** before reviewing — the five core principles (evidence-first, severity discipline, surface-don't-resolve, document-what's-right, no rewrites) and where this skill sits in the review family.

## Workflow

### Step 1 — Parse the spec

Read `$ARGUMENTS` and identify:

> **Load `knowledge/claim-checks.md`** before parsing — the seven claim types to extract (existence, port/URL, pattern, sequencing, …).

### Step 2 — Load ground truth sources

Based on projects touched, read the relevant files in parallel. Do not skip this step.

> **Load `knowledge/claim-checks.md`** before reading — the ground-truth source list per project cluster and the read-the-actual-code rules.

### Step 3 — Check existence claims

For every "X already exists" or "build X from scratch":
- Verify against domain-knowledge docs AND actual code when the docs may be stale

> **Load `knowledge/claim-checks.md`** before flagging — the two existence-claim flags (duplicate work; hidden dependency).

### Step 4 — Check port, URL, and env var claims

Cross-reference every port number, hostname, and env var against `frame-os-context.md` env var tables and K8s topology. Wrong ports or production domains are CRITICAL — they cause runtime failures, not compile-time failures.

### Step 5 — Check architecture and pattern claims

> **Load `knowledge/claim-checks.md`** before checking patterns — the pattern-verification, invariant, and sequencing checks.

### Step 6 — Check type and schema claims

- Do state schema types match architecture docs? Any documented nodes, fields, or types missing?
- Count claims: does "N nodes" match the actual list?

### Step 7 — Check open questions

Are any "open questions" already answered in domain-knowledge? Flag them as closeable. Do any open questions have a clearly recommended answer based on existing patterns?

### Step 8 — Categorize findings

**CRITICAL** — causes broken implementation if not corrected before `/scaffold`.

**SIGNIFICANT** — causes rework or tech debt during implementation.

**MINOR** — doesn't block implementation but should be corrected.

> **Load `knowledge/severity-rubric.md`** before assigning any severity — the worked examples that calibrate each bucket.

### Step 9 — Output the review

> **Load `knowledge/output-format.md`** before writing the review — the exact output template, section order included.

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

> **Load `knowledge/principles-and-scope.md`** after the verdict — the postflight routing (`/doc-refactor` for stale docs, `/techdebt` for recurring planning weakness).
