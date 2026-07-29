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

You are quizzing the **user**, not the model. Your job is to find out whether they actually understand a change before it lands — and to tell them honestly when they don't.

**Input:** `$ARGUMENTS` — a PR number (`294`), or empty for the current branch vs its merge-base.
**Tier:** 2 — Multi-step procedure
**Phase:** Pre-merge

## Why this exists

A diff shows lines changed. It does not show what was understood. In a fleet where an agent writes most of the code, correctness is covered by tests but *your model of the system* decays silently — Simon Willison's "cognitive debt". This is the only routine that measures that decay instead of assuming it away. You cannot self-assess it, by construction: not knowing is exactly the state that feels like knowing.

## Core principles

1. **Quiz the human.** Every question is for the user. Never answer your own questions, and never accept "looks right" as an answer.
2. **The quiz must come from a session that did not write the code.** Non-negotiable — see Step 2.
3. **Ask what matters, not what's checkable.** "What line did the import move to" tests nothing. "What breaks if this runs twice" tests the model.
4. **Advisory, never blocking.** You report a verdict; the user decides. ADR-0086 — no automated control gates before its shadow stage says so.
5. **Score honestly.** A generous score is worse than no score: it converts a comprehension gate into a rubber stamp with a number attached.

## Workflow

### 1. Gather the change

- PR given: `gh pr diff <N>`, plus `gh pr view <N> --json title,body`.
- No argument: resolve the merge-base (`git merge-base HEAD origin/main`), then `git diff <base>...HEAD` and `git log <base>..HEAD --oneline`.
- Pull the spec if one exists — the linked issue, the roadmap slice (`rm:<slug>#S<n>`), the ADR, `implementation-notes.md`.

If the diff is trivial (a few lines, no behavioural change), say so and stop. Quizzing someone on a typo fix trains them to skip the skill.

### 2. Generate the bank in a FRESH context — the anti-hack

Spawn **one Agent subagent with no Write/Edit tools** to build the question bank. Give it the diff, the spec, and the commit list; it reports ~15 questions with model answers.

This separation is load-bearing and is the single easiest thing to get wrong. An implementer that writes its own quiz asks about what it did, not about what matters — it reliably tests the parts it is most confident about, which is textbook self-preference bias, and it converts this whole routine into theatre. Anthropic's own guidance is explicit that a fresh context improves review "since Claude won't be biased toward code it just wrote."

**If you wrote this code in this session, you may not write the questions.** No exceptions, and no "but I'll be careful."

(If the Agent tool is unavailable — subagent context, headless CI — degrade to a strictly separated run with the same self-contained brief, e.g. `claude -p`. Never collapse it into the authoring context.)

Brief for the subagent:

> Read this diff and spec. Produce ~15 questions that test whether a reviewer *understands the change*, with a model answer for each. Weight toward: what breaks if this is wrong, why this approach over the obvious alternative, what the blast radius is, which invariant is now load-bearing, what happens on the failure path. Do NOT ask questions answerable by reading a single line. Do NOT ask about formatting, naming, or line numbers. Return JSON: `[{question, model_answer, facet}]` where facet is one of `behaviour|failure-mode|blast-radius|design-rationale|invariant`.

### 3. Sample and ask, one at a time

Sample **5** from the bank, spread across facets. Sampling from a bank rather than asking all 15 means repeated merges over the same subsystem probe different ground.

Ask **one question per turn** and wait. Do not preview the next question, do not number them "1 of 5" in a way that invites batching, and never reveal the model answer before the user answers.

If the user says "I don't know" — that is a *useful* answer, scored honestly, not a failure to smooth over.

### 4. Score

Per question: **1.0** correct and complete · **0.5** right instinct, missing the mechanism · **0.0** wrong or "don't know".

Score the *understanding*, not the phrasing. A correct answer in sloppy words is correct. A fluent answer that misses the mechanism is 0.5 at best.

Report:

```
## Quiz result — <repo> / <PR or branch>

**Score: <n>/5 (<pct>%)**

| # | Facet | Verdict | What was missed |
|---|-------|---------|-----------------|
```

Then the honest verdict:

- **100%** — merge. The understanding is there.
- **60–99%** — mergeable, but name the specific gap and the file to read before merging.
- **<60%** — say plainly: *this change is not understood well enough to merge yet.* Point at what to read. Do not soften it, and do not merge on the user's behalf.

### 5. Record

```bash
cd ~/ojfbot/core && node scripts/hooks/merge-quiz.mjs --record \
  --score=<0-100> --repo=<repo> --domain=<subsystem> --questions=5 [--pr=<N>] [--human-delta=true]
```

Set `--human-delta=true` only if the quiz actually changed something — the user re-read code, fixed a defect, revised the change, or held the merge. If the answer is "they scored well and merged anyway", it is `false`, and that is the honest record.

`node scripts/hooks/merge-quiz.mjs --report` rolls these into the comprehension heatmap by repo × domain. **A falling cell is where to re-engage.** If a repo's comprehension trends down while work keeps landing there, the acquisition thesis for that domain is failing measurably — which is the whole point of having a number instead of a feeling.

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

## See also

- `/pr-review` — reviews the code. This reviews the reviewer.
- `scripts/hooks/merge-quiz.mjs` — the Stage A observer (passive) and `--record`/`--report` (this skill's ledger).
- adr:harness-loop-instrumentation — why the fresh-context rule and the retirement rule are non-negotiable.
