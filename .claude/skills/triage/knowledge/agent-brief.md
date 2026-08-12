# Agent briefs — the terminal artifact of `ready-for-agent`

Reference for the brief-emission step. Absorbed from upstream `AGENT-BRIEF.md`
(D45, `decisions/adopt-stack/pocock-triage-refresh.md`).

When an issue routes `ready-for-agent`, it carries a brief. **The brief is the contract;
the original report and discussion are only context.** With `--apply`, post it as an issue
comment (disclaimer first — see `operations.md`); in default mode, emit it in the proposal
output for the user to review.

## Principles

- **Durability over precision.** The issue may sit unclaimed for weeks while the code
  moves. Describe interfaces, types, signatures, config shapes, and behavioral contracts.
  **Never file paths, never line numbers** — they go stale and a wrong path misleads the
  agent more than no path.
- **Behavioral, not procedural.** What the system should do after the work, not how to
  implement it. The agent explores the codebase fresh and makes its own implementation
  decisions. "The `SkillConfig` type accepts an optional `schedule: CronExpression`" —
  not "open src/types/skill.ts and add a field."
- **Complete acceptance criteria.** Each independently verifiable; the `check:` command
  required by the routing rubric is the machine-runnable floor, the criteria list is the
  full definition of done.
- **Explicit scope boundaries.** State what is NOT in scope — the cheapest defense
  against gold-plating.

## Template

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** <one line>
**Check:** `<the machine-runnable command from the routing rubric>`

**Current behavior:**
<what happens now; for bugs, the broken behavior — with the code path found
during verification>

**Desired behavior:**
<what should happen after the work; specific about edge cases and errors>

**Key interfaces:**
- `TypeName` — what changes and why
- `functionName()` — current vs desired contract

**Acceptance criteria:**
- [ ] <falsifiable assertion>
- [ ] <falsifiable assertion>

**Out of scope:**
- <adjacent thing that stays untouched>
```

For a PR (`--prs` surface): "Current behavior" describes the state of the diff, and the
brief asks the agent to finish or fix it — not to build from nothing.

## Boundaries with sibling artifacts (recorded in D45 — don't "fix" either side)

- **Vertical-slice issues** (`/orchestrate --emit`) carry "Affected paths" *deliberately*:
  they are short-lived and consumed by L2 agents that need the file list. Triage briefs
  sit unclaimed indefinitely, so they follow the no-paths rule. Two artifacts, two
  lifespans.
- **Bead briefs** (`bead:templates/brief`) are the session-handoff equivalent; their
  Context/Goal/Acceptance-criteria/Flag-back spine maps onto this template. When a
  ready-for-agent issue becomes a roadmap slice, the day-runner's `renderBrief()` supplies
  fleet conventions and the slice-boundary contract — the triage brief supplies what the
  runner cannot derive: current/desired behavior and key interfaces.
