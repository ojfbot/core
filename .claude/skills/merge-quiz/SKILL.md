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

**Teaching is the product. The score is a by-product.** In a fleet where an agent writes most of the code, "you scored 40%, go read something" is a useless output — it names a deficit and hands back no remedy. Every question you ask must leave the user knowing more than before they answered it, whether they got it right or wrong.

**Input:** `$ARGUMENTS` — a PR number (`294`), `--branch` for the current branch vs its merge-base, or **empty to pick from open PRs**.
**Tier:** 2 — Multi-step procedure
**Phase:** Pre-merge

## Why this exists

A diff shows lines changed. It does not show what was understood. In a fleet where an agent writes most of the code, correctness is covered by tests but *your model of the system* decays silently — Simon Willison's **cognitive debt**: *"When we lose track of how code written by our agents works we take on cognitive debt."* You cannot self-assess it, by construction: not knowing is exactly the state that feels like knowing.

**What the evidence actually supports — and where this skill goes beyond it.**

The comprehension gap is real and measured. Anthropic's RCT (52 engineers learning an unfamiliar async library, AI-assisted vs hand-coding) found the AI group scored **50% vs 67%** on a comprehension quiz — *"participants in the AI group scored 17% lower than those who coded by hand"* — Cohen's d=0.738, p=0.01, while the small speed gain was not significant. Beginners judging LLM-code correctness manage ~32.5% per-task success (arXiv:2504.19037), with automation bias named explicitly.

Read those honestly: the Anthropic study is not peer-reviewed, comes from a lab with a commercial stake, skews junior, and measures *skill acquisition on a new library* rather than *review adequacy on a PR*. And there is a real counterweight — "Echoes of AI" (arXiv:2507.00788, 151 participants, 95% professionals) found **no significant downstream maintainability penalty** from AI co-developed code.

**The honest limit: no study quizzes a professional reviewer on a real pull request, and nothing shows that gating on such a quiz improves downstream outcomes.** This skill is a reasonable extrapolation from adjacent evidence, not a validated intervention. That is exactly why it is advisory rather than blocking, why Stage A can end in retirement, and why the heatmap is worth more than any single score — the fleet's own data is the only evidence that will ever tell us whether this works.

For rubric design, the **"Explain in Plain English"** tradition in CS education (e.g. arXiv:2403.06050) is a decades-old validated instrument for assessing human code comprehension by explanation. Borrow question types from it rather than inventing them.

## Core principles

1. **Quiz the human, then teach them.** Every question is for the user. Never answer your own questions before they try — but *always* explain after, right or wrong. An unexplained question is a wasted one.
2. **The quiz must come from a session that did not write the code.** Non-negotiable — see Step 2.
3. **Ask what matters, not what's checkable.** "What line did the import move to" tests nothing. "What breaks if this runs twice" tests the model.
4. **Advisory, never blocking.** You report a verdict; the user decides. ADR-0086 — no automated control gates before its shadow stage says so.
5. **Score honestly.** A generous score is worse than no score: it converts a comprehension gate into a rubber stamp with a number attached. Scoring honestly and teaching generously are not in tension — mark the answer 0.0 and then make sure they'd get it next time.
6. **"I don't know" is the most teachable moment, not a failure.** It is scored 0.0 and answered in full, warmly. If the user learns that admitting it produces a good explanation, they stop bluffing — and bluffing is what makes the number lie.

## Workflow

### 0. Pick the PR (default mode — no argument)

With no argument, **do not** silently quiz the current branch. The branch you happen to be standing on is rarely the change you want to review, and quizzing it by accident is how the skill gets a reputation for wasting a turn.

Enumerate what's actually open and let the user choose:

```bash
gh pr list --state open --json number,title,author,additions,deletions,updatedAt,isDraft \
  --jq 'sort_by(.updatedAt) | reverse'
```

Present them compactly, **largest-signal first** — a reviewer's attention should go to the change most worth understanding, not the most recent:

```
| # | PR | Title | Size | Updated | Draft |
```

Then ask which to start with, using `AskUserQuestion` when there are ≤4 candidates (offer the largest non-draft first, marked `(Recommended)`), or a plain numbered ask when there are more. Always include an option to quiz the **current branch** instead.

Rules for this step:

- **Sort by diff size, not recency**, when recommending. `additions + deletions` is the proxy for how much understanding is at stake.
- **Flag drafts** and don't recommend one — a draft is not about to merge.
- **Say so and stop** if there are no open PRs, offering `--branch` instead. Don't invent something to quiz.
- If `gh` fails or the repo has no remote, fall back to `--branch` mode and say that's what you did.
- Quiz **one** PR per invocation. If the user wants several, they invoke it again — batching turns the quiz into a form to fill in.

### 1. Gather the change

- PR chosen or given: `gh pr diff <N>`, plus `gh pr view <N> --json title,body`.
- `--branch`: resolve the merge-base (`git merge-base HEAD origin/main`), then `git diff <base>...HEAD` and `git log <base>..HEAD --oneline`.
- Pull the spec if one exists — the linked issue, the roadmap slice (`rm:<slug>#S<n>`), the ADR, `implementation-notes.md`.

If the diff is trivial (a few lines, no behavioural change), say so and stop. Quizzing someone on a typo fix trains them to skip the skill.

### 2. Brief the change before quizzing (default; skip with `--cold`)

Most changes in this fleet were written by an agent, not by the user. Quizzing someone cold on code they've never read isn't measurement, it's an ambush — it produces a low number and no understanding, and they stop running the skill.

So orient them first. Short, concrete, and structural — this is an audit of the change, not a summary of the diff:

```
## What this change does — <PR>

**In one sentence:** <the actual behavioural change, not the commit title>

**The 3 things that carry the weight**
1. <mechanism> — `file.ts:fn()` — <what it does and why it's here>
2. …

**What it touches** — <blast radius: which callers, which stored state, what a rollback would leave behind>

**What's load-bearing now** — <invariants a future edit could silently violate>

**Where the risk is** — <the part most likely to be wrong; say so plainly>
```

Rules:

- **Read the code, don't paraphrase the PR body.** The PR description is the author's claim; the diff is the evidence. Where they disagree, say so — that disagreement is itself a finding.
- **Point at files.** Every mechanism gets a `path:symbol` the user can open.
- Keep it under ~300 words. This is a map to orient by, not a replacement for reading.
- Then say plainly: *"Now I'll ask you five questions about it."*

**`--cold` skips this** — use it for code the user wrote themselves, where a briefing would just hand them the answers.

**This changes what the score means, so it is recorded.** A briefed score measures *"can you understand this when it's explained"*; a cold score measures *"did you already understand it"*. Both are worth knowing and they are not comparable, so `--record` carries `--mode=taught|cold` and the heatmap keeps them apart. Never mix them into one cell and never present a taught score as if it were cold.

### 3. Generate the bank in a FRESH context — the anti-hack

Spawn **one Agent subagent with no Write/Edit tools** to build the question bank. Give it the diff, the spec, and the commit list; it reports ~15 questions with model answers.

This separation is load-bearing and is the single easiest thing to get wrong. An implementer that writes its own quiz asks about what it did, not about what matters — it reliably tests the parts it is most confident about, which is textbook self-preference bias, and it converts this whole routine into theatre. Anthropic's own guidance is explicit that a fresh context improves review "since Claude won't be biased toward code it just wrote."

**If you wrote this code in this session, you may not write the questions.** No exceptions, and no "but I'll be careful."

(If the Agent tool is unavailable — subagent context, headless CI — degrade to a strictly separated run with the same self-contained brief, e.g. `claude -p`. Never collapse it into the authoring context.)

Brief for the subagent:

> Read this diff and spec. Produce ~15 questions that test whether a reviewer *understands the change*. Weight toward: what breaks if this is wrong, why this approach over the obvious alternative, what the blast radius is, which invariant is now load-bearing, what happens on the failure path. Do NOT ask questions answerable by reading a single line. Do NOT ask about formatting, naming, or line numbers.
>
> For each question also produce the material needed to TEACH it, because the reviewer probably did not write this code: `model_answer` (the mechanism, concretely, citing `file:symbol`), `why_it_matters` (what breaks or what it protects — one sentence), `reasoning_path` (how someone who didn't know could have worked it out from the diff), and `difficulty` (1 easy … 3 hard).
>
> Return JSON: `[{question, model_answer, why_it_matters, reasoning_path, facet, difficulty}]` where facet is one of `behaviour|failure-mode|blast-radius|design-rationale|invariant`.

### 4. Ask, then teach — one question per turn

Sample **5** from the bank, spread across facets. Sampling from a bank rather than asking all 15 means repeated merges over the same subsystem probe different ground.

Order them **easiest first**. Opening with the hardest question is how you convince someone they understand nothing; opening with one they can get gives the later ones something to build on.

Each turn is a loop of three parts, and the third is the one that matters:

1. **Ask** — one question, no preview of the next, no model answer up front.
2. **Wait** for a real answer. "I don't know" ends the wait; a hedge ("something about ordering?") gets one nudge, not a second question.
3. **Teach** — *always*, right or wrong:
   - say whether they had it, in one clause, without ceremony;
   - give the **mechanism**: what actually happens, step by step, citing `file:symbol`;
   - say **why it matters** — what breaks, what it costs, what it protects;
   - if they were partly right, name exactly which part and what was missing.

Calibrate the teaching to the answer. A correct answer gets two sentences of confirmation plus the one nuance they didn't mention. A wrong answer gets the full mechanism. "I don't know" gets the full mechanism *and* the reasoning path that would have gotten there — that path is the transferable part.

Never make the user feel caught out. The failure mode at this step isn't being too soft, it's being a smug examiner: revealing an answer as a gotcha teaches nothing and guarantees they never run this again.

### 5. Score

Per question: **1.0** correct and complete · **0.5** right instinct, missing the mechanism · **0.0** wrong or "don't know".

Score the *understanding*, not the phrasing. A correct answer in sloppy words is correct. A fluent answer that misses the mechanism is 0.5 at best.

Report:

```
## Quiz result — <repo> / <PR or branch>

**Score: <n>/5 (<pct>%)** · mode: `taught` | `cold`

| # | Facet | Verdict | What was missed |
|---|-------|---------|-----------------|
```

Then the honest verdict — and with every verdict, the remedy:

- **100%** — merge. The understanding is there.
- **60–99%** — mergeable. Name the specific gap and the one file to read first.
- **<60%** — say plainly: *this change isn't understood well enough to merge yet.* Do not soften it, and do not merge on the user's behalf.

A verdict without a remedy is the failure mode this skill was rewritten to fix. Every run — including a 100% — ends with:

**What to do next**
- the **one file** to read, and what to look for in it;
- the **one question** worth asking the author (or the agent) about this change;
- if <60%: an offer to walk the riskiest mechanism in depth, right now.

Score the answers they gave, not the answers they'd give after your explanations. The teaching does not retroactively raise the number — that would make every score a 100% and the heatmap worthless.

### 6. Capture what was learned into the vault

The quiz just produced the single most depositable artifact in the harness set: an explanation
of a mechanism the user did not know, written at the exact moment they found out they didn't
know it. That is deposit-library material, and before this step it evaporated when the turn ended.

**Deposit the gap, not the transcript.** Capture only the questions scored below 1.0 — the
mechanism that was missed, and the explanation that closed it. A question answered correctly
teaches nobody anything later; depositing it bulks the vault with confirmations of what the
user already knew, which is how a knowledge base becomes a log nobody reads.

**Skip the capture entirely on a clean sweep.** If every answer scored 1.0, say so and write
nothing. An empty deposit is the right output.

Compose the block, then pipe it in:

```bash
cd ~/ojfbot/core && node scripts/hooks/merge-quiz.mjs --capture \
  --repo=<repo> --domain=<subsystem> --score=<0-100> --mode=taught|cold [--pr=<N>] <<'EOF'
**Gap:** <the mechanism the user did not have — one line, stated as a fact about the system,
not as a fact about the user>

**Mechanism:** <what actually happens, concretely, citing `file:symbol`>

**Why it matters:** <what breaks, what it costs, what it protects>

**Generalizes to:** <the transferable rule, if there is one — the reason this is worth keeping
beyond this PR. If it doesn't generalize, say "specific to this change" and keep it short.>

Links: [[<entity-or-concept>]] [[<other>]]
EOF
```

On wikilinks: propose `[[…]]` for pages that plausibly exist or should exist, and don't
agonise — an unresolved link is a valid marker of something worth writing, not an error. Prefer
linking the **repo entity** (`[[core]]`, `[[morning-cockpit]]`) and the **concept**, not the PR.

This appends to `~/selfco/wiki/log.md`, the vault's append-only ledger — the same seam
`vault-session.sh` uses. It does **not** write wiki pages: `/vault` owns those, and folding the
deposit into `concepts/` or an entity page happens on the next `/vault sync`. Writing pages
directly from here would bypass the vault's schema and its link discipline.

If the vault ledger doesn't exist, the command no-ops with a message. Don't treat that as a
failure and don't fall back to writing somewhere else.

### 7. Record

```bash
cd ~/ojfbot/core && node scripts/hooks/merge-quiz.mjs --record \
  --score=<0-100> --repo=<repo> --domain=<subsystem> --questions=5 \
  --mode=taught|cold [--pr=<N>] [--human-delta=true]
```

`--mode` is required and must reflect what actually happened: `taught` if Step 2 briefed them, `cold` if `--cold` skipped it. The heatmap keeps the two apart, because a briefed 80% and a cold 80% are different facts about the same person.

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
- **The examiner failure.** Asking five hard questions, scoring them, and handing back a percentage is the version of this skill nobody runs twice. If the user finishes a run without having learned the change, the run failed regardless of the number.
- **Don't let teaching inflate the score.** Explaining an answer and then crediting it because they now agree makes every quiz a 100%. Score the answer as given; teach afterwards.
- **A taught score is not a cold score.** Never compare them, never average them into one cell, and never quote a taught score as evidence of prior understanding.

## See also

- `/pr-review` — reviews the code. This reviews the reviewer.
- `scripts/hooks/merge-quiz.mjs` — the Stage A observer (passive) and `--record`/`--report` (this skill's ledger).
- adr:harness-loop-instrumentation — why the fresh-context rule and the retirement rule are non-negotiable.
