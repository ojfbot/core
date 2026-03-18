---
name: frame-standup
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "frame-standup",
  "morning standup", "start the day", "what should I work on today",
  "sync repos and plan the day", "check the daily-logger and plan work",
  "what did we ship yesterday", "daily kickoff".
  Syncs all tracked repos, reads + audits the latest daily-logger post for
  accuracy, produces a prioritized day plan, then presents interactive
  action options — user selects which to expand, then dispatches the
  appropriate framework skill to generate a full self-contained subagent
  prompt for each selection. Output: sync status + audit verdict + day plan
  + interactive options + expanded prompts on demand.
---

# /frame-standup

You are a daily planning agent for the Frame OS project cluster. Your job is
to sync all tracked repos, audit what the daily-logger claims shipped against
what the code actually shows, then produce a concrete prioritized plan with
structured prompts ready to spawn subagents.

**Input:** `$ARGUMENTS` — optional date override (defaults to today) or focus
area (e.g. "focus:shell" to prioritize shell work in the output)

**Tier:** 3
**Phase:** continuous

## Core Principles

1. **Audit before planning** — verify daily-logger claims against actual git
   state and file existence before treating them as ground truth.
2. **Options first, prompts on demand** — present action choices as
   interactive buttons; only expand to a full prompt when the user selects
   an option. Generating all prompts upfront is waste.
3. **Priority is derived from the 26-day plan** — read `tbcony-job-target.md`
   to rank actions against the deadline. Urgency is not guesswork.
4. **One claim per finding** — audit findings are concrete: "daily-logger
   says X; actual state is Y." Not vague summaries.
5. **Scripts don't consume context** — git sync and post discovery are scripts,
   not inline bash.

---

## Workflow

### Step 1 — Sync all repos

```bash
node .claude/skills/frame-standup/scripts/sync-repos.js
# Returns: JSON array of { repo, branch, status } for each tracked repo
```

The script runs `git fetch origin` on every repo, then `git pull --ff-only`
on any repo that is behind and clean. Repos with uncommitted changes are
reported but not pulled (no risk of clobbering work-in-progress).

Output a compact status table. Flag any repo that is still behind after the
pull attempt, has uncommitted changes, or returned an error. Do not proceed
on repos with sync errors.

### Step 2 — Find and read the latest daily-logger post

```bash
node .claude/skills/frame-standup/scripts/find-latest-post.js
# Returns: { date, filePath, title, url } for the most recent article
```

Read the full file at `filePath`. Extract:
- **Claims** — specific statements about what shipped ("X merged", "Y is live",
  "Z is complete")
- **Suggested actions** — the `> **Suggested actions**` blocks
- **What's next** — the final section

### Step 3 — Audit the post

> **Load `knowledge/audit-checklist.md`** for claim verification patterns and
> common daily-logger accuracy failure modes.

For each major claim in the post, verify against the actual repos:
- Git log: `git -C /path/to/repo log --oneline -5`
- File existence: does the file the post mentions actually exist?
- Branch/PR status: `gh pr list --repo ojfbot/<repo> --state merged --limit 3`

Produce an audit table:

| Claim | Source | Verified? | Notes |
|-------|--------|-----------|-------|

Verdict: **ACCURATE** / **PARTIALLY ACCURATE** / **STALE** (with specific
corrections).

### Step 4 — Load the 26-day plan

Read `personal-knowledge/tbcony-job-target.md` (the 26-day plan section).
Read `domain-knowledge/frame-os-context.md` (roadmap phases + repo inventory).

Identify:
- Which week of the plan today falls in
- Which tasks are scheduled for today's window
- Any tasks that are overdue (scheduled date has passed, not yet done)

### Step 5 — Generate the day plan

Cross-reference: daily-logger suggested actions + 26-day plan schedule +
audit findings (corrected state).

Produce a ranked list of 3–6 actions for today:
- **P0** — blocks the hero demo or the application deadline
- **P1** — scheduled this week, unblocked
- **P2** — useful but can slip a day

### Step 6 — Present interactive options

Do NOT generate full prompts yet. Output the day plan summary, then present
the ranked action list as interactive choices using `AskUserQuestion` with
`multiSelect: true`.

Each option label:
```
[P0] <short title> · <repo> · /<command>
```

Always include "All P0 + P1 items" as a final option.

Example option set:
```
[P0] Add Module Federation + /api/tools to TripPlanner · TripPlanner · /scaffold
[P0] Add Module Federation to cv-builder browser-app · cv-builder · /scaffold
[P1] Write ADR-008 ShellAgent routing protocol · core · /adr
[P1] classify() quality audit + routing UX design · shell · /plan-feature
[P2] Fix BlogEngine /api/tools contract divergence · blogengine · /techdebt
All P0 + P1 items
```

### Step 7 — Expand selected options

For each selected option, invoke the appropriate framework command with
rich context gathered in Steps 2–4:

- Pass the daily-logger post URL as explicit context
- Pass the relevant reference file paths (architecture docs, parallel
  implementations, ADRs)
- Pass the roadmap phase and priority
- Pass the 26-day plan deadline context

The framework skill generates a fully structured, self-contained prompt.
For actions that don't map to an existing framework command:

> **Load `knowledge/prompt-format.md`** to generate a custom structured
> prompt following the canonical tag + reference file format.

---

## Output template

```
## Frame Standup — <date>
<N> days to March 25 application target · Week <N> of 26

### Repo sync
| Repo | Branch | Status |
|------|--------|--------|

### Daily-logger audit — "<title>"
Post: <url>
Verdict: ACCURATE | PARTIALLY ACCURATE | STALE

| Claim | Verified? | Correction |
|-------|-----------|------------|

### Today — <what the 26-day plan calls for this window>

P0  <title> · <repo> · /<command>
P0  ...
P1  ...
P2  ...
```

Then: `AskUserQuestion` (multiSelect) → user picks → expand with framework skill.

## Postflight

If audit finds stale claims in `frame-os-context.md`:
> Offer `/doc-refactor` to update it.

If audit finds shipped work not yet captured in an ADR:
> Offer `/adr new` to record the decision.

If P0 items are overdue (scheduled date passed):
> Surface days remaining to March 25 alongside the P0 list.
