Reference for `/merge-quiz`: the evidence base the skill rests on, the core principles that govern question design, scoring, and teaching, and cross-references.

**Teaching is the product. The score is a by-product.** In a fleet where an agent writes most of the code, "you scored 40%, go read something" is a useless output — it names a deficit and hands back no remedy. Every question you ask must leave the user knowing more than before they answered it, whether they got it right or wrong.

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

## See also

- `/pr-review` — reviews the code. This reviews the reviewer.
- `scripts/hooks/merge-quiz.mjs` — the Stage A observer (passive) and `--record`/`--report` (this skill's ledger).
- adr:harness-loop-instrumentation — why the fresh-context rule and the retirement rule are non-negotiable.
