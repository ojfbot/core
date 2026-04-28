# ADR-0049: Pocock-style mode extensions on /plan-feature and /orchestrate

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR1 (cross-repo design language)
Commands affected: /plan-feature (extended), /orchestrate (extended)
Repos affected: all

---

## Context

Pocock's skill set includes `/to-prd` (turn a conversation into a PRD) and `/to-issues` (turn a PRD into vertical-slice issues). Both fill gaps in his linear flow:
- `/grill-me` produces alignment but not a spec → `/to-prd` synthesizes a PRD from the conversation.
- `/to-prd` produces one large spec → `/to-issues` decomposes it into bite-sized issues for an issue tracker.

In ojfbot's existing skill catalog, the analogous capabilities already exist:
- `/plan-feature` produces a spec — but not from a conversation. Default input is the user's `$ARGUMENTS` text.
- `/orchestrate` decomposes a priority into tasks via 4-layer progressive decomposition — but doesn't emit GitHub issues. Default behavior is to drive autonomous Layer-3 execution.

Two ways to bridge the gaps:
1. **Ship `/to-prd` and `/to-issues` as standalone skills.** Doubles the planning skills count; users have to learn which to call when.
2. **Extend `/plan-feature` and `/orchestrate` with new modes.** Reuses existing skill mental models; mode flags signal the variation.

We pick (2). Frame's skill catalog is already at 39+ entries; adding two more for behaviors that compose with existing skills dilutes the catalog without adding distinct mental models. Mode flags (`--from-conversation`, `--emit=github-issues`) signal the variation cleanly.

## Decision

Two mode extensions, no new skills:

### `/plan-feature --from-conversation`

When the flag is present, the skill replaces step 2 (Problem statement) with: synthesize problem from preceding conversation transcript (typically a `/grill-with-docs` session), surface 3 implicit assumptions back to the user, wait for confirmation, then proceed to step 3.

New knowledge file: `knowledge/conversation-synthesis-guide.md` — how to extract a spec from a Socratic transcript without losing nuance, what to do when the conversation didn't converge, how to handle contradictions in the transcript.

### `/orchestrate --emit=github-issues`

When the flag is present, after Step 3 (decomposition) the skill emits each vertical slice as a GitHub issue body — title, description, acceptance criteria, parent epic link — instead of (or before) executing. Default: outputs `gh issue create` invocations for the user to run; `--apply` actually creates them via `gh` CLI.

New knowledge file: `knowledge/vertical-slice-issue-template.md` — title format, body template, INVEST checklist per acceptance criterion, parent epic format, what gets emitted vs. what doesn't.

Cap at 12 issues per session; more indicates a multi-feature initiative that should be a parent epic + 3–5 children.

## Consequences

### Gains
- Frame's skill catalog stays smaller. Two new mode flags vs. two new skills.
- Mental model is preserved: "you go to `/plan-feature` for specs and `/orchestrate` for decomposition." Users learn one thing per skill, not two.
- The extensions compose naturally with each other and with the new Pocock skills:
  - `/grill-with-docs` → `/plan-feature --from-conversation` → `/scaffold` → `/tdd`
  - `/roadmap` → `/orchestrate --emit=github-issues` → `/triage` → execute selected
- `--from-conversation` makes `/grill-with-docs` immediately useful — its output flows into the existing planning lifecycle without requiring a separate "convert grill output to spec" step.
- `--emit=github-issues` makes `/orchestrate` useful for sprint planning (without forcing autonomous execution every time).

### Costs
- Mode flags accumulate. Each skill now has 2–4 modes; documentation gets denser. Mitigated by clear "Modes" sections in each skill body.
- The `--from-conversation` step requires the user to confirm 3 surfaced assumptions before proceeding — an extra interaction. That's the point (it's where misunderstandings surface) but it does slow the spec output.
- `--emit=github-issues` and the existing `plan-only` mode of `/orchestrate` overlap somewhat (both produce non-executing output). Documented distinction: `plan-only` outputs a markdown decomposition for human review; `--emit=github-issues` outputs GitHub-issue-formatted bodies ready for `gh issue create`.

### Neutral
- `/orchestrate --emit=github-issues --apply` does write to GitHub (creates issues). This is a side-effect operation; the skill prints the URLs of created issues so the action is visible.
- We could in the future add `--emit=linear` or `--emit=jira` if the team uses those trackers. The current scope is GitHub-only.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Ship `/to-prd` and `/to-issues` as standalone skills | Doubles the planning skill count; users have to learn one more mental model per skill. Mode flags accomplish the same with less catalog clutter. |
| Make `--from-conversation` automatic when a `/grill-with-docs` session is detected in the recent transcript | Implicit behavior; magic. Better to make it an explicit flag the user opts into; preserves predictability. |
| Auto-emit GitHub issues whenever `/orchestrate plan-only` is invoked | Conflates "plan for human review" with "plan for backlog tracking." Users may want one without the other. |
| Use `--mode=` instead of separate flags | Frame skills already use mixed `--mode=` (e.g., `/techdebt --mode=apply`) and individual flags (e.g., `/test-expand --write`). Stays consistent with existing conventions: `--mode=` for orthogonal alternatives, individual flags for opt-ins. |
| Defer until 30-day retro of the new Pocock skills | The mode extensions are minimal and unlock the composition between `/grill-with-docs` and `/plan-feature`. Deferring blocks the lifecycle. |

## Implementation notes

- `/plan-feature` body change is additive: the existing default flow continues to work; `--from-conversation` is opt-in.
- `/orchestrate` body change is additive: the existing default flow continues to work; `--emit=github-issues` adds a new terminal action after Step 3.
- No new skill catalog entries needed (the skills themselves remain the catalog primitives; modes are documented in the skill body and knowledge files).
- No heuristic-analysis rule needed — these modes are explicitly invoked, not auto-suggested.
- 30-day retro will measure: `/plan-feature --from-conversation` invocations relative to total `/plan-feature` invocations (target: ≥30% after the new Pocock skills land); `/orchestrate --emit=github-issues` invocation count and resulting issue creation rate.
