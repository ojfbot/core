# Grilling patterns — question taxonomy and anti-patterns

A grilling question is high-leverage when its answer changes the implementation. Ask those. Don't ask the others.

## Three categories

### 1. Intent-shaping questions

Pin down what the user actually wants. Distinguish *what* from *how*.

- "Is the goal X (user outcome) or Y (technical capability)?"
- "Who's the user — the operator, the agent, an end-customer?"
- "What does 'done' look like? What's the smallest version that earns its keep?"
- "If we shipped this and used it once, what would convince us it worked?"

**Use when:** the request is vague, the user has been talking in implementation terms but the goal is fuzzy, or the same words could mean two different features.

### 2. Constraint-discovery questions

Surface invariants, performance budgets, deadlines, integration points the user hasn't said aloud.

- "What's the performance budget? Latency, memory, bundle size?"
- "Does this need to work offline / under flaky network / for N concurrent users?"
- "What systems does this need to talk to that we don't control?"
- "What can we *not* change — public APIs, on-disk formats, downstream consumers?"
- "What's the authentication model? Who's allowed to do this?"
- "Is there a deadline that determines scope?"

**Use when:** the spec sounds clean but you suspect hidden constraints. The number of constraint questions ≤ 2 unless the user keeps revealing new ones.

### 3. Tradeoff-revealing questions

Force the user to choose between two design directions before code locks one in.

- "Two roads: (A) cheap to ship now, expensive to extend. (B) more upfront work, easier to evolve. Which fits this moment?"
- "Strict consistency vs. eventually consistent — does this need real-time correctness or is staleness ok?"
- "Tightly typed contract vs. flexible payload — do callers know the schema, or does it vary?"
- "Build inside <existing module> vs. introduce a new boundary — which has the lower long-term cost?"

**Use when:** the implementation has a fork point that will be hard to reverse. Lay out the choice; let the user choose.

## Anti-patterns

**The interrogation cascade.** Five small questions when one well-aimed question would do. Combine. Cut.

**The performative grill.** Asking questions whose answers won't change your implementation. If you'd code the same thing either way, don't ask.

**The grill that ignores context.** Re-asking what's already in CONTEXT.md, an ADR, the user's previous turn, or plainly visible in the repo. Use what's in front of you first; ask only for what's missing.

**The grill that hides indecision.** Using questions to defer your own judgment call. If you have a strong recommendation, lead with it: "I'd do X because Y; ok?" — that's still a grill.

**The grill that exits too early.** Stopping after one acknowledgement when the user hasn't actually engaged with the deeper assumption. Watch for one-word "yes" answers; probe the most consequential one.

**The grill that exits too late.** Asking the 8th question when 5 was enough. The signal: you can already write a coherent design concept. Stop.

**The mock-grill.** Asking questions you've already answered to yourself, formatted as questions to look thorough. The user can tell.

## Question quality test

Before asking, run this: *"If the user answers either way, will my next action change?"*

- Yes → ask it.
- No → don't ask it. You're either being performative or you've already decided.

## Question ordering

Ask the *root* question first — the one whose answer changes the most downstream branches. Then walk the tree:

1. Intent (what are we even doing?)
2. Boundary (where does this live? which bounded context?)
3. Constraints (what can't change?)
4. Tradeoffs (where does the implementation fork?)
5. Edges (what happens when X breaks?)

Stop when each level is settled. Don't go deeper than the next 1-2 layers — depth that won't matter for v1 is just procrastination.

## When the user pushes back

If the user says "stop asking, just do X":

1. Respect it for that turn.
2. If the request is still genuinely ambiguous, ask the *single* most important remaining question — once. Don't grovel; don't apologize. State plainly: "Before I start: <one question>." Then build.
3. If even that gets a "just do it," make your best call and proceed. Note the assumption you made in your output so the user can correct course quickly.

## Length budget

A good grill is **3-7 question/answer pairs**, not 15. If you find yourself in the double digits, either:
- The work is too big — split it.
- You're being performative — stop and write the design concept.
- The user keeps revealing new constraints — that's a constraint-discovery problem; output what you have and tell the user the spec is still moving.
