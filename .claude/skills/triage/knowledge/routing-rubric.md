# Routing rubric — verification, the four routes, needs-info discipline

Reference for the verify and route steps. Sources: Pocock triage state machine (pinned
`84fdeff`, absorbed D46/D48/D50 in `decisions/adopt-stack/pocock-triage-refresh.md`);
ojfbot S15 verifiability-sorted dispatch.

## Verify before you route (gates `ready-for-agent`)

Before assigning a route, check that the claim holds. For a bug, reproduce it from the
reporter's steps. For a PR (`--prs`), check the branch out and run the relevant tests.
Three outcomes — report which one happened:

1. **Confirmed** — with the code path where it lives. Makes a far stronger brief.
2. **Failed to reproduce** — say what you tried.
3. **Insufficient detail to try** — itself the strongest `needs-info` signal there is.

Verification here is deliberately shallow: "is this real, and roughly where does it
live" — not a root cause. If it won't reproduce in a few minutes, the honest move is
`needs-info`, or hand off to `/investigate` if the user wants to chase it now.

## The routes (exactly one per issue)

`needs-triage` is the **entry state**, not a route — it's what `/orchestrate --emit` and
`/plan-feature` apply at issue creation. Routing an issue clears it (`--apply`).

- **`ready-for-agent`** — ALL of: (a) acceptance is machine-checkable — a runnable
  test/command exists or can be stated as a one-line `check:`; (b) the claim is
  **verified** (outcome 1 above — never route an unverified claim to an unattended
  agent); (c) scope bounded to one session. State the `check:` command in the route
  reason — it becomes the roadmap slice's `check:` field, which the day-runner's shadow
  stage executes at the slice boundary. Carries an agent brief
  (`knowledge/agent-brief.md`).
- **`ready-for-human`** — real work whose acceptance is judgment-shaped (design, taste,
  ambiguous scope, cross-repo architecture) or whose claim can't be machine-verified.
  Not a demotion; the compiler enforces the same split (`agent_eligible` without
  `check:` is demoted to `human_only`). Same brief structure, plus one line on why it
  can't be delegated.
- **`needs-info`** — can't classify or verify without answers. Name the missing fact;
  post Triage Notes (below) with `--apply`.
- **`wontfix`** — will not be actioned. Three-way split (already-implemented / rejected
  bug / rejected enhancement → KB) in `knowledge/out-of-scope-kb.md`.

Anything routed `ready-for-agent` without a stated check command is a rubric violation —
surface it as an anomaly instead. The route is what an orchestrator/day-runner consumes;
severity ranking alone doesn't tell it what is safely delegable.

## Needs-info discipline

Post (with `--apply`, disclaimer first):

```markdown
## Triage Notes

**What we've established so far:**
- <everything resolved, so the work isn't lost>

**What we still need from you (@reporter):**
- <specific, actionable question — never "please provide more info">
```

**Resuming:** if prior Triage Notes exist on the issue, read them, check which questions
the reporter answered, and present the updated picture. Don't re-ask resolved questions.
`needs-info` returns to the triage queue when the reporter replies.
