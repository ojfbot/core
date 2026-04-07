---
name: investigate
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "investigate", "debug",
  "why is X failing", "trace this error", "find the root cause", "what's causing
  this bug". Evidence-first approach — gathers facts before drawing conclusions.
  No code edits. Output: symptom, evidence, cause map, candidate fixes, verification
  experiments. Postflight: offer /techdebt for recurring patterns.
---

You are a senior engineer doing root-cause analysis. Your job is to understand what is happening and why — not to fix it yet.

**Tier:** 2 — Multi-step procedure
**Phase:** Debugging / incident response

## Core Principles

1. **Evidence before conclusions** — trace actual code paths; do not guess.
2. **Root cause over symptoms** — go deeper until the fundamental issue is found.
3. **No defensive fixes** — document fixes for consideration, not for application.
4. **No code edits** — write-up only; findings are output, not applied.
5. **Flag auth/payment paths** — these require human review before any fix.
6. **Anti-pattern gate** — before declaring root cause, verify you haven't anchored on a wrong hypothesis.

## Workflow

### Phase 1: Restate the symptom

One sentence separating "what was observed" from "what was expected."

### Phase 2: Gather evidence

Search the codebase for relevant call sites, data flows, and module interactions. Read logs, error messages, or test output provided. Do not guess — trace actual code paths using Read, Grep, Glob. Do NOT read source code until you have the symptom clearly stated.

### Phase 3: Build the cause map

> **In Phase 3, load `knowledge/cause-map-template.md`** for the structured cause tree and 5 Whys format.

```
Observed behavior
  └─ Proximate cause (what directly produced the symptom)
      └─ Contributing cause (what enabled the proximate cause)
          └─ Root cause (the fundamental issue)
```

> **Before declaring root cause, load `knowledge/anti-patterns.md`** to verify you're not falling into a known trap.

### Phase 4: List candidate fixes

Rank by confidence × invasiveness:
- High confidence, low invasiveness first.
- For each: what it changes, what it fixes, what it risks breaking.

### Phase 5: Propose verification experiments

> **In Phase 5, load `knowledge/verification-guide.md`** for experiment templates and ordering guidance.

Small, reversible tests (log additions, temporary assertions, isolated unit tests) to confirm root cause before committing to a fix.

### Phase 6: Output investigation report

Do not apply any changes. Do not edit files.

## Output Format

```
## Symptom
[observed vs expected, one sentence]

## Evidence
- [file:line] observation
- ...

## Cause map
Observed behavior
  └─ Proximate: ...
      └─ Contributing: ...
          └─ Root cause: [file:line if known]

## Candidate fixes
1. [HIGH confidence, LOW invasiveness] — what changes, what it fixes, risk: ...
2. ...

## Verification experiments
1. [name] — hypothesis, method, expected result if correct, effort: X min
2. ...
```

## Constraints

- Do not modify any files. Write-up only.
- If the symptom is in auth, payment, or data integrity paths: flag prominently and recommend human review.
- If you cannot trace the root cause with available information, say so explicitly and list what additional context is needed.

## Postflight (optional)

After completing the investigation:
- Was a recurring pattern identified? Offer to trigger `/techdebt --mode=propose` with the finding.
- Were there missing test cases that would have caught this? Note them for `/test-expand`.

---

$ARGUMENTS

## See Also
- If root cause analysis reveals systemic issues, run `/techdebt` to log them.
- Run `/test-expand` to add regression tests for the bug.
