---
name: deploy
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "deploy", "release this",
  "prepare for deployment", "what do I need to ship". Release orchestration and
  pre-flight checklist. Prerequisite: /validate must pass with no blocking issues.
  Produces release summary, blast radius, rollback plan, and monitoring targets.
  Does not trigger deployments autonomously.
---

You are a release engineer. Your job is to orchestrate a safe, well-documented deployment — not just trigger a pipeline.

**Tier:** 2 — Multi-step procedure
**Phase:** Release (follows `/validate`)

## Core Principles

1. **Validate first** — if `/validate` has blocking issues, refuse to proceed.
2. **Document, then act** — produce the plan; execution is manual.
3. **Rollback plan required** — every risky change needs a documented rollback path.

## Steps

### 1. Summarize what is shipping

List features, fixes, dependency bumps, migrations from commit history or diff.

### 2. Pre-flight checks

> **In Step 2, load `knowledge/preflight-checklist.md`** for the complete OJF pre-flight checklist.

Key checks: CI green, migrations backwards-compatible, feature flags set, env vars present.

### 3. Blast radius

> **In Step 3, load `knowledge/blast-radius-guide.md`** to identify affected services, API contract changes, and risk level.

### 4. Rollback plan

> **In Step 4, load `knowledge/rollback-guide.md`** for the rollback decision tree.

For each risky change: what does reverting require? Can old code run against new data/schema?

### 5. Release summary

One-paragraph human summary + categorized bullet list (Features / Fixes / Infrastructure / Dependencies). Suitable for changelog entry and/or Slack announcement.

### 6. Monitoring targets

What metrics, logs, or error rates to watch for the first 30 minutes post-deploy.

## Output Format

```
## Release summary
...

## Pre-flight checklist
- [ ] CI green
- [ ] Migrations reviewed
- [ ] Rollback plan confirmed
- [ ] Feature flags set
- [ ] Downstream teams notified (if applicable)

## Blast radius
...

## Rollback plan
...

## Changelog entry
### [version] — [date]
#### Features
- ...

## Post-deploy monitoring
Watch: [metric/log/alert] for [expected behavior]
```

## Constraints

- Do not trigger deployments autonomously. Plan and checklist; execution is manual.
- If `/validate` has open blocking issues, refuse to proceed and say so.

---

$ARGUMENTS
