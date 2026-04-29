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
3. **Priority is derived from active deadlines** — check `personal-knowledge/`
   for job targets and milestones to rank actions. Urgency is not guesswork.
4. **One claim per finding** — audit findings are concrete: "daily-logger
   says X; actual state is Y." Not vague summaries.
5. **Scripts don't consume context** — git sync and post discovery are scripts,
   not inline bash.

---

## Workflow

### Step 0.5 — Check active sessions

Query the Dolt bead store for concurrent Claude Code sessions:

```bash
node "$CLAUDE_PROJECT_DIR/scripts/hooks/bead-emit.mjs" active-sessions 2>/dev/null || echo '{"sessions":[]}'
```

If `sessions` is non-empty, output a warning:

```
### Active Claude sessions detected

| Session | Skill | Started | Repos touched |
|---------|-------|---------|---------------|
```

Note: "These sessions may be working on overlapping repos. Coordinate
before modifying shared files."

If Dolt is unreachable (command fails or returns empty), skip silently —
this is a best-effort check. Do not block the standup on this.

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

### Step 1.5 — Check for diagram input (optional)

If `$ARGUMENTS` contains an image reference or if `/diagram-intake` was run
earlier in this session, load the structured diagram priorities as the primary
planning input. Diagram priorities override daily-logger suggested actions
for ranking purposes, but the daily-logger audit (Step 3) still runs to
validate claims and surface context.

If no diagram input is present, skip to Step 2.

### Step 2 — Load daily-logger context (API-first)

**Primary path — structured API:**

```bash
node .claude/skills/frame-standup/scripts/read-api-context.js --json
# Returns: { apiAvailable, latestEntry, openActions, recentlyClosedActions, repoStats, staleDays }
```

If `apiAvailable` is true, use the structured data as the primary source:
- `latestEntry.decisions[]` — architectural context (title, summary, repo)
- `latestEntry.actions[]` — suggested actions (command, description, repo)
- `latestEntry.tags[]` — typed tags with `{ name, type }` for work stream context
- `latestEntry.activityType` — classifies the previous day (build/rest/audit/hardening/cleanup/sprint)
- `latestEntry.status` — article review status (draft/accepted/rejected)
- `openActions` — full cross-article action backlog (accumulated, filtered against done-actions)
- `recentlyClosedActions` — actions resolved in last 7 days (avoid re-suggesting)
- `staleDays` — how many days since the latest entry (>1 means a gap)

**Confidence based on article status:**
- `status: "accepted"` — claims are human-verified, treat as ground truth
- `status: "draft"` — AI-generated, not yet reviewed; add `[DRAFT]` caveat to all claims
- `status: "rejected"` — skip this article, find the previous accepted one

**Fallback path — raw markdown (when `apiAvailable: false`):**

```bash
node .claude/skills/frame-standup/scripts/find-latest-post.js --json
# Returns: { date, filePath, title, url } for the most recent article
```

Read the full file at `filePath`. Extract claims, suggested actions, and
"What's next" via text parsing (legacy path).

**In both paths**, also read the full markdown article for prose context:

```bash
node .claude/skills/frame-standup/scripts/find-latest-post.js --json
```

Read the file at `filePath` for the full narrative. The structured API
provides typed data; the markdown provides the "why" behind claims.

### Step 2.5 — Load per-app standup extensions

```bash
node .claude/skills/frame-standup/scripts/read-app-standup.js --json
# Returns: Array of { repo, found, blockers[], priorities[], openWork[], context }
```

For each repo with a standup extension (`found: true`):
- Merge blockers into P0 considerations (blockers from standup override P1/P2)
- Cross-reference priorities against daily-logger claims
- Surface open work (WIP branches) alongside sync status from Step 1
- Include the `context` field as supplementary planning input

Repos without a standup.md are silently skipped — this is expected and normal.

### Step 3 — Audit the post

> **Load `knowledge/audit-checklist.md`** for claim verification patterns and
> common daily-logger accuracy failure modes.

**When structured API is available**, audit using typed fields:
- Iterate `latestEntry.decisions[]` — verify each decision's `repo` has recent
  related commits via `git -C <repo> log --oneline -5`
- Iterate `latestEntry.actions[]` — verify target repo exists and the `command`
  maps to a valid skill in `.claude/skills/`
- If `codeReferences` are present in the article JSON (`api/articles/<date>.json`),
  use them for targeted verification:
  - `type: "commit"` → `git -C <repo> cat-file -t <hash>`
  - `type: "file"` → check file exists at path
  - `type: "component"` → grep for the component name in the repo

**When using fallback markdown path**, verify claims against actual repos:
- Git log: `git -C /path/to/repo log --oneline -5`
- File existence: does the file the post mentions actually exist?
- Branch/PR status: `gh pr list --repo ojfbot/<repo> --state merged --limit 3`

Produce an audit table:

| Claim | Source | Verified? | Notes |
|-------|--------|-----------|-------|

Verdict: **ACCURATE** / **PARTIALLY ACCURATE** / **STALE** (with specific
corrections).

### Step 4 — Load priorities and action backlog

Read `domain-knowledge/frame-os-context.md` (roadmap phases + repo inventory).

Check for active deadline context in `personal-knowledge/` — if a job target
or milestone file exists, extract the deadline and remaining days.

**When API is available**, also incorporate:
- `openActions` — the full open action backlog across all articles. Group by repo.
  Flag any action older than 7 days as `[STALE]`.
- `recentlyClosedActions` — recently resolved work. Do NOT re-suggest these.
- `repoStats` — per-repo commit velocity to identify active vs dormant repos.

**Activity type context:**
- If previous day was `activityType: "rest"` — prioritize catching up on oldest
  open actions and stale items
- If `activityType: "sprint"` — note potential overwork, suggest consolidation
- If `staleDays > 1` — note the gap, suggest a sweep of what happened in between

### Step 5 — Generate the day plan

Cross-reference: daily-logger suggested actions + open action backlog +
roadmap context + audit findings (corrected state).

Produce a ranked list of 3–6 actions for today:
- **P0** — blocks an active deadline or demo
- **P1** — scheduled this week, unblocked
- **P2** — useful but can slip a day

When structured actions are available, prefer them over free-text extraction.
Map each action's `command` field to the corresponding framework skill.

### Step 5.5 — Audit yesterday's pending suggestions (ADR-0054)

For the standup funnel measurement: walk yesterday's `standup:suggested`
events and emit `standup:closed` events for any whose `priority_id` is
absent from today's surfaced priorities (signal `c` "audit-disappeared"
per ADR-0054).

Build a semicolon-delimited string of today's priority IDs from Step 5
(the priority titles, exactly as they will be passed to `standup-emit`
in Step 7). Then call:

```bash
node "$CLAUDE_PROJECT_DIR/scripts/hooks/standup-audit.mjs" \
  --today-priorities="<priority1>;<priority2>;<priority3>" \
  --lookback-days=7 \
  || true   # never block the standup flow
```

The script reads `~/.claude/standup-telemetry.jsonl`, finds pending
suggestions (suggested but not closed) from the last 7 days, and emits
`standup:closed` events for any pending suggestion whose `priority_id`
is absent from today's list. Output is a JSON summary; log it but don't
parse it — the closures are written directly to the telemetry file.

Pass `--dry-run` during testing to preview without writing.

### Step 6 — Present interactive options

Do NOT generate full prompts yet. Output the day plan summary, then present
the ranked action list as interactive choices using `AskUserQuestion` with
`multiSelect: true`.

Each option label:
```
[P0] <short title> · <repo> · /<command>
```

When open action backlog contains stale items (> 7 days), append them:
```
[STALE] <description> · <repo> · /<command> (from <sourceDate>)
```

Always include "All P0 + P1 items" as a final option.

### Step 7 — Expand selected options and offer orchestration

**Funnel telemetry (per ADR-0054):** Before presenting options to the user,
emit a `standup:suggested` event for each generated option. This logs the
suggestion regardless of whether the user selects it — an ignored suggestion
is also signal about adoption.

Generate a single `standup_id` for this entire `/frame-standup` invocation:
```bash
STANDUP_ID="stnd-$(date +%Y-%m-%d)-$(node -e 'process.stdout.write(Math.random().toString(36).slice(2,6))')"
```

Then for each suggested option (P0/P1/P2 priority surfaced from Step 5/6),
emit one event:
```bash
node "$CLAUDE_PROJECT_DIR/scripts/hooks/standup-emit.mjs" suggested \
  --standup-id="$STANDUP_ID" \
  --suggestion-id="s<N>" \
  --skill="<the /skill that should run for this priority>" \
  --priority-id="<priority text or stable ID from Step 5>" \
  --rationale="<one-sentence why this suggestion>" \
  || true   # never block the standup flow if telemetry fails
```

`suggestion_id` is sequential per standup (`s1`, `s2`, ...). `priority_id` is
free-text (the priority's title or a stable hash of it). Telemetry lands in
`~/.claude/standup-telemetry.jsonl`. PR-X2 will compute the funnel by
correlating these events with `~/.claude/skill-telemetry.jsonl` (launched
within 24h, same session_id).

Then, for each selected option, generate a **Layer 1 orchestrator prompt**
suitable for `/orchestrate` consumption. The prompt format extends the
canonical structure from `knowledge/prompt-format.md`:

> **Load `knowledge/prompt-format.md`** for the base canonical structure.
> **Load `knowledge/orchestration-prompts.md`** for the Layer 1/2/3 templates.

Each Layer 1 prompt contains:
- The app's priorities (from Step 5, refined by diagram/standup input)
- Context file pointers (architecture doc, standup.md, CLAUDE.md)
- The daily-logger post URL and activity context
- The roadmap phase and priority level
- The specificity level of each goal (high/medium/low from diagram intake)

After generating prompts, present the user with execution mode options:

```
How should these priorities be executed?
  [plan-only]        — Decompose into tasks, review before any code
  [plan+execute]     — Full pipeline: plan → decompose → implement → PR
  [execute-selected] — Pick specific tasks from decomposition to implement
```

For `plan-only`: Spawn one Agent (type: Plan) per app with the Layer 1 prompt.
Report the task decomposition for user review.

For `plan+execute` or `execute-selected`: Invoke `/orchestrate` with the
Layer 1 prompts. The orchestrator handles Layer 2 decomposition and Layer 3
execution (see `/orchestrate` skill).

If `/orchestrate` is not yet available, fall back to the existing behavior:
invoke the appropriate framework command directly with rich context.

---

## Output template

```
## Frame Standup — <date>
Activity: <activityType> · Article status: <draft|accepted> · Stale: <N> day(s)
Open actions backlog: <N> (<repo1>: N, <repo2>: N, ...)
Recently closed: <N> in last 7 days
Diagram input: yes/no
Standup extensions: <N> repos with .claude/standup.md

### Repo sync
| Repo | Branch | Status |
|------|--------|--------|

### Standup extensions (if any)
| Repo | Blockers | Priorities | Open work |
|------|----------|------------|-----------|

### Daily-logger audit — "<title>"
Post: https://log.jim.software/articles/<date>
Verdict: ACCURATE | PARTIALLY ACCURATE | STALE

| Claim | Verified? | Correction |
|-------|-----------|------------|

### Today

P0  <title> · <repo> · /<command> · specificity: high|medium|low
P0  ...
P1  ...
P2  ...

[STALE] <title> · <repo> · /<command> (from <sourceDate>)
```

Then: `AskUserQuestion` (multiSelect) → user picks → choose execution mode → expand/orchestrate.

## Postflight

If audit finds stale claims in `frame-os-context.md`:
> Offer `/doc-refactor` to update it.

If audit finds shipped work not yet captured in an ADR:
> Offer `/adr new` to record the decision.

If P0 items are overdue (scheduled date passed):
> Surface days remaining to any active deadline alongside the P0 list.

If open action backlog has items older than 7 days:
> Surface them as `[STALE]` warnings and suggest triage.
