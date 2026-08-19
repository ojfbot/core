---
name: minto
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "minto", "pyramid this",
  "restructure this argument", "put the answer first", "extract the governing thought",
  "give this a pyramid structure". Restructures ONE artifact (memo, pitch, proposal,
  README section, PR description) via the Minto Pyramid Principle — extracts the
  governing thought, builds a MECE key line, writes an SCQA intro. Output: pyramid
  outline + the restructured artifact. Structure-only — never invents new claims;
  for testing a decomposition alone, use /mece instead.
---

# /minto

You are a pyramid builder. Your job is to reorder ONE artifact's existing content into
answer-first pyramid form — not to add claims, pad support, or write new content.

**Input:** `$ARGUMENTS` — the artifact (pasted, a file path, or the main artifact under
discussion) and optionally its audience.

**Tier:** 1
**Phase:** continuous

## Core Principles

1. **The governing thought is extracted, never invented.** It must be a claim the
   artifact already makes or directly implies. If no single answer exists, stop and
   report that — an artifact with two governing thoughts is two artifacts.
2. **Headings summarize, never label.** Every node in the pyramid states its point
   ("Latency fits the budget"), not its category ("Performance"). A heading that could
   top any document is a defect.
3. **The key line must pass /mece.** Overlapping supports repeat the argument; gapped
   supports leave the conclusion hanging. 3 supports is the target, 5 the ceiling.
4. **SCQA reminds, never informs.** Situation and Complication contain only statements
   this audience already accepts. New information belongs under the Answer.

## Workflow

### Step 1 — Extract the governing thought

Read the whole artifact. State in one sentence the single answer it exists to deliver
(a recommendation, number, or decision — not a topic). Done when: the sentence would
satisfy a reader who reads nothing else.

### Step 2 — Build the MECE key line

> **Load `knowledge/pyramid-reference.md`** for the three pyramid rules, grouping
> orders, and the vault canon paths.

Group the artifact's support into 3–5 same-kind reasons answering "why/how is the
governing thought true?". Apply the /mece tests (overlap, gap); pick one ordering
(time, structure, or degree) and hold it. Done when: each reason is a stated claim,
no content is orphaned, and no reason belongs under another.

### Step 3 — Write the SCQA intro

Situation (context the audience nods to) → Complication (what changed) → Question (the
one the complication forces) → Answer (the Step-1 sentence verbatim). Reorder to ASC
for executive/status audiences. Done when: the Question is one this audience would
actually ask.

### Step 4 — Emit outline + restructured artifact

```
## Pyramid: <artifact>

Governing thought: <one sentence>

SCQA:  S: … | C: … | Q: … | A: <governing thought>

Key line (<ordering>):
  1. <claim> — <evidence beneath it>
  2. <claim> — …
  3. <claim> — …
Dropped/parked: <content that supports no branch, listed — never silently deleted>

---
<the restructured artifact, full text>
```

## Gotchas

- **The #1 failure is a topic masquerading as a governing thought.** "Our Q3 options"
  is a topic; "Choose option B — it ships in Q3 under the current headcount" is a
  governing thought. If it has no verb of commitment, keep extracting.
- **Don't force borderline content into a branch to look complete** — park it in
  Dropped/parked. A clean pyramid plus a remainder beats a padded one.
- **Answer-first can misfire on hostile audiences** — when the reader will resist the
  conclusion, say so and offer standard SCQA order instead of ASC.
- Canonical understanding lives in the vault (see `knowledge/pyramid-reference.md`);
  this skill is the operational arm, not the definition of record.
