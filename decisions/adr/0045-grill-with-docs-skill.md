# ADR-0045: Skill /grill-with-docs for pre-planning Socratic alignment

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR1 (cross-repo design language)
Commands affected: /grill-with-docs (new), /plan-feature, /scaffold, /investigate
Repos affected: all (core ships it; sibling repos receive via install-agents.sh)

---

## Context

The Frame skill lifecycle was non-interactive at the front: `/plan-feature → /spec-review → /scaffold`. Each step expects to be handed a coherent intent. The user's actual intent is rarely fully formed before they call `/plan-feature`; the spec ends up encoding ambiguity instead of resolving it, and the agent commits to a design path that the user may not have actually wanted.

Matt Pocock's `/grill-me` and `/grill-with-docs` skills (from `mattpocock/skills`) address this by inserting a Socratic alignment loop *before* planning. The agent grills the user — restate intent, surface assumptions, walk decision dependencies, converge on a shared mental model — and only then is `/plan-feature` invoked. Pocock's framing: *"design concept is shared and invisible; reach it before code."*

We also adopted a separate "default grilling posture" for every session (`agent-defaults.md`) — a lightweight version that fires automatically. The skill version is the heavyweight: invoked when the work warrants formal artifacts (CONTEXT.md updates, ADR drafts).

ADR-0044 introduces `CONTEXT.md` and `GLOSSARY.md` as the ubiquitous language layer. `/grill-with-docs` is the primary skill that updates them. Without the skill, CONTEXT.md drift becomes a manual chore; with the skill, language updates happen as a side-effect of the grilling that already needed to happen.

## Decision

Ship `/grill-with-docs` at `.claude/skills/grill-with-docs/grill-with-docs.md` with three knowledge files:

- `knowledge/grilling-patterns.md` — question taxonomy (intent-shaping / constraint-discovery / tradeoff-revealing) and anti-patterns
- `knowledge/decision-tree-method.md` — how to walk decision dependencies top-down
- `knowledge/context-md-update-rules.md` — when to add a CONTEXT.md term, when to revise, when to deprecate

The skill is **conversation-only — no code, no silent edits.** CONTEXT.md / GLOSSARY.md / ADR changes are output as proposed diffs; the user applies. ADR stubs are inline drafts; user runs `/adr new "<title>"` to commit.

Modes:
- Default: full grill, updates CONTEXT.md, drafts ADRs.
- `--no-docs`: pure conversation, no doc output (for short-cycle alignment).
- `--scope=<area>`: narrow to a bounded context (`shell`, `agent-graph`, `workflow-engine`, `gas-town`, `observation`, `ui-components`).

Composition:
- Precedes `/plan-feature` (which gains `--from-conversation` mode in ADR-0049).
- Layered over `agent-defaults.md` — the default posture is the lightweight version that fires every session.
- Anti-pattern: chaining `/grill-with-docs` back-to-back without intervening work.

Cap on output:
- 3-7 question/answer pairs per session.
- Maximum 3 ADR stubs per session (more = work is too big, suggest splitting).
- Single design-concept paragraph at the end.

## Consequences

### Gains
- Pre-planning ambiguity surfaces in conversation, not in code or specs.
- CONTEXT.md / GLOSSARY.md updates happen organically as a side-effect of the grilling that already needed to happen.
- ADR creation is no longer a separate step — drafts come out of the alignment session.
- Composes with the lighter default posture in `agent-defaults.md`: same philosophy at two intensities.
- Telemetry on `/grill-with-docs` invocations becomes a leading indicator of careful planning. If we see it precede most `/plan-feature` runs, the discipline is taking. If not, the heuristic Tier 1 rule (PR with >3 files and no ADR/CONTEXT changes) will surface the gap.

### Costs
- One more skill in a catalog already at 39 entries. Mitigated by clear layer-affinity (it's tier 2, only fires before substantial planning) and by the `/skill-loader` tier filter.
- Risk that the user feels grilled without progress. Mitigated by the question quality test ("if the user answers either way, will my next action change?") and the 3-7 question cap.
- Risk of "performative grilling" — asking questions for show. Mitigated explicitly in `knowledge/grilling-patterns.md` § Anti-patterns.

### Neutral
- The skill duplicates *intent* with `agent-defaults.md` but *not behavior* — defaults are inline, the skill is structured with formal artifact output. They compose.
- Pocock's separate `/grill-me` skill is folded into `--no-docs` mode rather than shipped as a second skill.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Ship `/grill-me` and `/grill-with-docs` as two skills | They are 90% identical (same questions, same flow); the only difference is whether docs get updated. `--no-docs` flag covers it without skill duplication. |
| Make grilling part of `/plan-feature` itself | Conflates two concerns: pre-planning alignment vs. spec writing. Users sometimes want one without the other. Separate skills compose better. |
| Rely solely on `agent-defaults.md` (no skill) | The default posture is the right baseline, but it doesn't produce CONTEXT.md updates or ADR drafts. The skill is needed for formal artifact output. |
| Use a generic AskUserQuestion-style flow | AskUserQuestion is a tool, not a skill — it doesn't carry the methodology (decision-tree walk, anti-pattern guards, output structure). The skill captures the *method*; AskUserQuestion is a delivery mechanism the skill may use internally. |
| Defer until 30-day retro of agent-defaults.md | The skill is needed *now* to seed the initial CONTEXT.md (which itself is the seed for everything else). Deferring delays the rest of the Pocock work. |

## Implementation notes

- Skill catalog entry: tier 2, phase `alignment`, layer-affinity `[0]`, no `suggested_after` (it's a starter).
- Heuristic rule (Phase 2 of Pocock work): Tier 1 suggestion when PR diff includes `>3 files` AND no ADR or CONTEXT.md changes.
- Telemetry expectation: at least 50% of `/plan-feature` invocations are preceded by `/grill-with-docs` within 1 hour (correlated by session_id). Measured at the 30-day retro.
- 30-day retro lives at ADR-0050 (forthcoming).
