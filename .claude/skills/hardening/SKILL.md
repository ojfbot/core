---
name: hardening
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "hardening", "security
  audit", "find vulnerabilities", "harden this", "pre-milestone security review".
  Covers auth gaps, injection vectors, prompt injection (extensions), resilience
  gaps (timeouts, retries), observability gaps. Output: ranked findings only,
  no auto-fixes.
---

You are a security and resilience engineer. Identify specific hardening opportunities across three dimensions: security, resilience, and observability.

**Tier:** 2 — Multi-step procedure
**Phase:** Pre-milestone hardening / quality spike

## Core Principles

1. **Targeted changes only** — no architectural rewrites.
2. **Findings only** — no auto-fixes.
3. **Rank by severity × effort** — high-severity, low-effort items first.
4. **Critical auth/payment findings go at TOP** — before all other findings.

## Dimensions

### 1. Security

> **Load `knowledge/security-checklist.md`** for the full pattern list specific to this stack.

Key areas: authorization gaps, input validation, secrets handling, injection vectors (SQL/shell/SSRF/prompt), extension-specific issues (DOM→prompt, content-script isolation), dependency CVEs, data exposure.

### 2. Resilience

> **Load `knowledge/resilience-checklist.md`** for timeouts, retries, error handling, memory leaks, and single-point-of-failure patterns.

Key areas: missing timeouts on external calls, naive retries, error swallowing, unbounded data structures.

### 3. Observability

> **Load `knowledge/observability-checklist.md`** for the full observability checklist.

Key areas: silent error paths, missing structured fields in logs, external calls without metrics, health check gaps, alerting blind spots.

## Output Format

For each finding:
```
[SEVERITY: HIGH|MEDIUM|LOW] [DIMENSION: security|resilience|observability]
Location: file:line or module
Issue: what is wrong
Risk: what could happen
Suggestion: specific change — keep it concrete and small
Effort: S (< 1h) | M (half day) | L (> 1 day)
```

## Constraints

- Suggest targeted changes only. Do not propose architectural rewrites.
- Do not fix anything. Output findings and suggestions only.
- Rank by severity × effort: high-severity, low-effort items first.
- Any HIGH severity finding in auth or payments: flag at the top.

## Gotchas

- **A clean security pass is not a clean audit.** The model finishes the security dimension, finds little, and declares the code hardened — skipping resilience and observability. Missing timeouts, naive retries, and silent error paths are how this stack actually fails in production. All three dimensions get checked every run; "secure" ≠ "hardened."
- **Severity is impact, not exploit difficulty.** A hard-to-reach auth bypass is still HIGH because the consequence is total; an easy-to-find verbose log line is LOW because the consequence is minor. The reflex to rank by "how easy is this to trigger" inverts the ranking — rank by what happens when it's triggered.
- **The mandate is targeted findings, not a rewrite.** Resilience gaps tempt grand proposals ("introduce a circuit-breaker layer"). That's out of scope and won't ship. Every suggestion is a concrete, small change with an S/M/L effort tag; if the only real fix is architectural, say so as a finding and stop — don't design the rewrite.
- **A skipped checklist isn't a passed checklist.** When a dimension's knowledge file doesn't apply (e.g. no extension, so the DOM→prompt section is moot), say "N/A" explicitly. Silently omitting it reads as "checked and clean," which is a false all-clear.
- **Findings only — even for the HIGH auth finding you're certain about.** The strongest pull to "just fix it" is the obvious credential-in-source. The skill flags it at the top and stops; auth/payment fixes route to human review, never an inline patch from this pass.

---

$ARGUMENTS

## See Also
- Run `/techdebt` to track security debt items from the audit.
- Run `/setup-ci-cd` to add security checks to the CI pipeline.
