---
name: daily-logger
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "daily-logger", "how does
  the council work", "explain the council of experts", "brief me on the article pipeline",
  "how do personas work", "what's the pnpm generate pipeline", or at the start of any
  session in the daily-logger repo. Dense orientation — no files modified.
---

# /daily-logger

Produce evidence-backed orientation for the requested daily workflow. This skill is read-only.

**Input:** `$ARGUMENTS`, the project checkout, and available workflow or task receipts.
**Tier:** 1
**Phase:** continuous
**Repo:** Resolve the daily-logger checkout. In the fleet it is core's sibling.

## Core principles

1. Workflow identity precedes claims about issue pickup or timing.
2. A saved prompt defines a scheduled task's intake and authority. A skill name does not.
3. Cite the revision or run that supports each operational claim. Mark predictions as expectations.
4. Orientation yields a report. Execution follows the separately authorized workflow.

## Workflow

### Step 1: Resolve the request

Classify the question as article pipeline, scheduled run, or queue follow-up.
With no arguments, select article-pipeline orientation.
For a scheduled run, identify the workflow file or saved task by name and intake.
If identity remains ambiguous, ask for its task name or latest receipt. Report
other established facts separately rather than substituting the article generator.

Completion: record the branch, project location, and workflow identity, or the
single missing identifier needed to continue.

### Step 2: Gather branch evidence

For article-pipeline questions:
> **Load `knowledge/architecture-brief.md`** for call sites and source contracts.

Inspect the sources relevant to the question at the recorded revision. For a
default orientation, cover phases, model-call inputs and outputs, call totals,
flags, invariants, and each current persona's slug, role, and review focus.

For scheduled-run or queue questions:
> **Load `knowledge/workflow-evidence.md`** for intake, timing, and gate evidence requirements.

Use project `docs/daily-cycle.md` as a source index when present. Otherwise inspect
the primary sources named in the loaded reference.

Completion: every requested claim has cited evidence or a named evidence gap.
Every queue item has its original identity and disposition, including retained gates.

### Step 3: Return the orientation

Answer the user's question first. Use the report fields below, omitting unrelated
branches. PASS means every requested claim is supported. PASS WITH NOTES means
the answer has explicit evidence gaps. BLOCKED means workflow identity or required
access prevents the requested determination.

Completion: expectations, observed receipts, and unknowns remain distinguishable.
Every retained gate includes its owner, decision, evidence, and checkpoint status.

## Gotchas

- The article collector truncates issue bodies. A gate can occur after the preview.
  Fetch the full relevant discussion before assessing work disposition.
- A declaration of 03:30 does not establish run start or publication time.
  Match receipts to the intended date and workflow.
- Local automation inventory can be incomplete. Ask for the missing task identity
  rather than claiming the user's scheduled worker does not exist.
- Council review adds N+1 calls to the draft, not N+1 total. Report nominal calls
  separately from retries, mock mode, and runs skipped before drafting.

## Output

```text
Daily-logger orientation: <question>
Verdict: PASS | PASS WITH NOTES | BLOCKED
Workflow: <name and defining source, or unresolved>
Evidence: <revision, observation time, run/task receipt if available>
Answer: <supported result, with expectations labeled>
Branch details: <pipeline facts, timing comparison, or item dispositions>
Retained gates: <item, owner, decision, packet, checkpoint requested/agreed/elapsed>
Gaps: <missing evidence and bounded next check, or none>
```

## Postflight

When reviewing a change to this skill, load `knowledge/review-cases.md` for
isolated behavioral cases. Report unexecuted cases as NOT RUN.
