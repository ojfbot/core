# Vertical-slice issue template

Format for issues emitted by `/orchestrate --emit=github-issues`. Each issue is a *vertical slice* — independently shippable, exercises a full path through the system.

## What "vertical slice" means

Vertical slice cuts top-to-bottom through the layers your code already has. For an agent-graph app:
- UI element exists → user can interact with it
- API route exists → request reaches the agent
- Agent node runs → returns a response shape the UI knows how to render
- Persistence step (if any) → state survives a page refresh

A horizontal slice (just the API; just the UI; just the agent node) is *not* an issue from this skill. Horizontal cuts hide their value behind sibling work that hasn't shipped yet, and they accumulate as half-built features.

If the work is genuinely horizontal (a refactor, an infra change, a new package), emit through `/plan-feature` directly, not `--emit=github-issues`.

## Title

`<verb> <object>` form. ≤70 characters. Lowercase except acronyms and proper nouns.

Good:
- `add session resume to cv-builder chat panel`
- `block multi-page export when total >50MB in TripPlanner`
- `surface frame-agent latency in shell mayor heartbeat`

Bad:
- `Session resume` — no verb, scope unclear
- `Implement comprehensive session management infrastructure...` — too vague, too long
- `cv-builder: chat: session: resume` — colon-stacking is hard to scan

## Body template

```markdown
## Problem

<one paragraph: what's missing/broken from the user's perspective. Don't describe the implementation; describe the gap.>

## Acceptance criteria

1. <falsifiable assertion>
2. <falsifiable assertion>
3. <falsifiable assertion>

## Affected paths

- `packages/<pkg>/<path>` — <what changes>
- `packages/<pkg>/<path>` — <what changes>

## Parent epic

<#NNN if part of a multi-issue initiative; omit if standalone>

## Out of scope

- <thing the reader might assume is in but isn't>
- <thing that's a follow-up issue>

## Suggested labels (for /triage)

`domain/<...>`, `type/<bug|feature|refactor>`. Severity and effort assigned by /triage.
```

## INVEST check (per acceptance criterion)

Each criterion should be:
- **I** — Independent. Doesn't require simultaneous changes elsewhere to be falsifiable.
- **N** — Negotiable. Phrased as outcome, not implementation.
- **V** — Valuable. Loss of this criterion would matter to a user.
- **E** — Estimable. The reader can roughly tell how big the work is.
- **S** — Small. One criterion = one assertion, not a multi-step plan.
- **T** — Testable. There's a way to verify it after merge.

Failing one or two letters is OK; failing four or more means the criterion is a paragraph in disguise — split it.

## Parent epic format

When a priority decomposes into 3+ vertical slices, emit a parent epic first:

```markdown
## Epic: <priority name>

<one paragraph: what this whole effort gives the user>

## Vertical slices

- [ ] #NNN <title>
- [ ] #NNN <title>
- [ ] #NNN <title>

## Suggested labels

`domain/<...>`, `type/feature`, `epic`.
```

The epic itself is also an issue — it gets a number, child issues link back to it via "Parent epic: #<epic-num>".

## Out of scope is mandatory

Always include the "Out of scope" section. It's the cheapest way to prevent scope creep during implementation. If the section is empty, write "Nothing — this issue is the whole work."

## What `/orchestrate --emit=github-issues` skips

The skill does *not* emit:
- **Refactors** (no user-visible change). Those go through `/deepen` proposal flow or `/plan-feature` for non-trivial restructure.
- **Infrastructure** (CI, build tooling, env config). Those go through `/setup-ci-cd` or direct PR.
- **Pure documentation**. Those go through `/doc-refactor` or direct PR.
- **Architecture decisions**. Those need an ADR via `/adr new`, not an issue.

The criterion: would a *user* notice this issue shipping? If no, it's not vertical-slice material; route elsewhere.

## Cap and overflow

Max 12 issues per session. If decomposition produces more, the priority is actually a multi-feature initiative — emit a parent epic + 3–5 child issues, and tell the user the rest will surface as the epic unfolds.

## Example output block

```bash
gh issue create --title "add session resume to cv-builder chat panel" --body "$(cat <<'EOF'
## Problem
Users lose chat context when they close the cv-builder tab and reopen it.
The agent loses thread state; the user has to re-explain what they were working
on. This is a friction point that compounds for users iterating on a resume
across multiple sessions.

## Acceptance criteria
1. Closing the tab and reopening within 24h restores the last 10 messages.
2. The agent's working state (current resume draft, retrieval context)
   restores alongside messages.
3. If session storage is unavailable, the panel renders with an empty state
   and a "session not found" notice.

## Affected paths
- packages/browser-app/src/ChatPanel.tsx — session-restore on mount
- packages/api/src/routes/v2/sessions.ts — new GET /sessions/:id endpoint
- packages/agent-graph/src/state/checkpointer.ts — wire to sqlite-vec

## Parent epic
#127

## Out of scope
- Cross-device sync (separate issue)
- Per-message edit history (separate issue)

## Suggested labels (for /triage)
domain/agent-graph, type/feature
EOF
)"
```
