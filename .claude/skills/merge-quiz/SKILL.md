---
name: merge-quiz
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "merge-quiz", "quiz me
  before merge", "quiz me on this PR", "do I understand this change", "test my
  understanding of this diff", "am I ready to merge". Generates a question bank
  from the diff and spec in a FRESH non-authoring context, asks a sampled subset
  one at a time, scores comprehension, and records it to the fleet heatmap.
  Advisory — reports a verdict, never blocks a merge. No code edits.
---

# /merge-quiz

You are teaching the **user** the change in front of them, and measuring what stuck. Your job is to leave them understanding a change they mostly didn't write — and to tell them honestly where they still don't.

**Input:** `$ARGUMENTS` — a PR number (`294`), `--branch` for the current branch vs its merge-base, or **empty to pick from open PRs**.
**Tier:** 2 — Multi-step procedure
**Phase:** Pre-merge

> **Load `knowledge/rationale-and-principles.md`** before generating or grading anything — the evidence base and the six core principles for question design, scoring, and teaching.

## Workflow

### 0. Pick the PR (default mode — no argument)

With no argument, **do not** silently quiz the current branch — enumerate open PRs and let the user choose. Quiz **one** PR per invocation.

> **Load `knowledge/quiz-construction.md`** before steps 0–1 — the enumeration and gather commands, presentation table, and selection rules.

### 1. Gather the change

Pull the diff, the log, and the spec if one exists. If the diff is trivial (a few lines, no behavioural change), say so and stop.

### 2. Brief the change before quizzing (default; skip with `--cold`)

Orient the user with a short structural briefing first — a briefed (`taught`) score and a `cold` score mean different things; record which happened.

> **Load `knowledge/quiz-construction.md`** before briefing — the briefing template, its rules, and taught-vs-cold semantics.

### 3. Generate the bank in a FRESH context — the anti-hack

Spawn **one Agent subagent with no Write/Edit tools** to produce ~15 questions with model answers. **If you wrote this code in this session, you may not write the questions.** No exceptions.

> **Load `knowledge/quiz-construction.md`** before spawning — the verbatim subagent brief, bank JSON schema, and degraded-mode fallback.

### 4. Ask, then teach — one question per turn

Sample **5** from the bank, spread across facets, easiest first. Ask, wait for a real answer, then teach — *always*, right or wrong.

> **Load `knowledge/quiz-construction.md`** before asking — the full ask/wait/teach loop and teaching calibration.

### 5. Score

Per question: **1.0** correct and complete · **0.5** right instinct, missing the mechanism · **0.0** wrong or "don't know". Score the *understanding*, not the phrasing.

> **Load `knowledge/scoring-and-recording.md`** before steps 5–7 — the report template, verdict ladder, mandatory "What to do next" remedy block, and capture/record commands.

### 6. Capture what was learned into the vault

Deposit the gap, not the transcript — only questions scored below 1.0. Skip the capture entirely on a clean sweep.

### 7. Record

Record the score to the fleet heatmap, with `--mode` reflecting what actually happened.

## Constraints

- **Never write or edit code.** This skill reads and asks.
- **Never merge.** Report the verdict; the merge is the user's action.
- **Never generate the bank in the authoring context.**
- **One question per turn.**
- Do not pad to 5 questions on a small diff — say the change is too small to quiz.

## Gotchas

- **The failure mode is a generous grader.** Scoring 0.5 for "close enough" a few times per quiz turns a 40% into an 80% and the number stops meaning anything. When torn between 0.5 and 1.0, take 0.5.
- **Questions about the code are not questions about the change.** "What does this function do" is answerable by reading. "Why is this function called before the guard, and what happens if that order flips" tests the model.
- **A perfect score every time means the quiz is too easy, not that comprehension is perfect.** If 20 merges pass at 100%, harden the bank or retire the routine — that is the retirement rule, and it applies to the quiz as much as to the gate.
- **Don't quiz on your own recall.** If the user asks "what did we change", that's `/summarize`. This skill asks *them*.
- **The examiner failure.** Asking five hard questions, scoring them, and handing back a percentage is the version of this skill nobody runs twice. If the user finishes a run without having learned the change, the run failed regardless of the number.
- **Don't let teaching inflate the score.** Explaining an answer and then crediting it because they now agree makes every quiz a 100%. Score the answer as given; teach afterwards.
- **A taught score is not a cold score.** Never compare them, never average them into one cell, and never quote a taught score as evidence of prior understanding.
