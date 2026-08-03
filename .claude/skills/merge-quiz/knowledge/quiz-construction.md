Reference for `/merge-quiz` steps 0–4: PR selection, change gathering, the briefing template, the fresh-context bank-generation brief, and the ask/teach loop — in full.

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
