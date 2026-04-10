# ADR-0038: Morning Workflow Progressive Agent Orchestration

Date: 2026-04-09
Status: Accepted
Commands affected: /frame-standup, /diagram-intake, /orchestrate
Repos affected: core, daily-logger, all consumer repos (via install-agents.sh)

---

## Context

JFO's daily workflow involves reviewing a daily-logger draft, hand-drawing
priorities on paper, and then executing those priorities across multiple repos.
Previously, `/frame-standup` produced flat prompts for individual framework
skills — no progressive decomposition, no parallel execution, no per-app
context extensions, and no image intake capability.

The gap: tasks ranging from high-level exploration to specific engineering
all received the same single-layer treatment, wasting context on execution
agents that don't need architecture docs, and starving planning agents that
do.

## Decision

Implement a 4-layer progressive decomposition pipeline with three new
capabilities:

1. **Daily-logger auto-merge** — the cron workflow enables `gh pr merge --auto
   --rebase` on article PRs so drafts are visible on log.jim.software without
   manual intervention.

2. **`/diagram-intake` skill** — reads a hand-drawn photo of priorities, maps
   informal app names to canonical repos, cross-references goals against
   roadmap phases and open blockers, outputs structured per-app priorities.

3. **Per-app standup extensions** — each repo owns an optional
   `.claude/standup.md` with blockers, priorities, and open work that
   `/frame-standup` reads via `read-app-standup.js`.

4. **`/orchestrate` skill** — the progressive decomposition engine:
   - Layer 0 (`/frame-standup`): full context, morning planning
   - Layer 1 (per-app orchestrator): one app's architecture doc + standup +
     CLAUDE.md + priorities → task decomposition
   - Layer 2 (task decomposer): specific source files + ADR/spec → execution
     instructions
   - Layer 3 (execution agent): exact files + expected behavior + test command
     → code + PR (worktree-isolated)

Each layer narrows context and increases specialization. The key constraint:
**no layer receives context it doesn't need.**

## Consequences

### Positive
- Morning workflow is structured and repeatable
- Image-based priority input works on any Claude surface (CLI, web, VS Code)
- Per-app standup extensions give each repo ownership of its own priorities
- Progressive decomposition prevents context dilution at execution time
- Parallel execution via worktree isolation maximizes throughput

### Negative
- More moving parts: 3 new skills, 1 new script, standup convention
- Per-app standup.md files need manual maintenance by JFO
- Layer boundaries are soft — agents may need to break budgets when docs are stale

### Risks
- Auto-merge on daily-logger: if the generation pipeline produces a broken
  article, it merges automatically. Mitigated by: existing test suite runs
  before commit, `--auto` respects future required checks, easy to revert.
- Diagram interpretation is inherently fuzzy — handwriting recognition may
  fail on unusual labels. Mitigated by: the skill asks for clarification
  rather than guessing.

## File inventory

| File | Purpose |
|------|---------|
| `.claude/skills/diagram-intake/diagram-intake.md` | Image → structured priorities |
| `.claude/skills/diagram-intake/knowledge/context-map.md` | Informal name → canonical repo mapping |
| `.claude/skills/orchestrate/orchestrate.md` | Progressive decomposition engine |
| `.claude/skills/orchestrate/knowledge/context-budgets.md` | What each layer receives/excludes |
| `.claude/skills/orchestrate/knowledge/decomposition-patterns.md` | Common task archetypes |
| `.claude/skills/frame-standup/scripts/read-app-standup.js` | Read per-app standup extensions |
| `.claude/skills/frame-standup/knowledge/orchestration-prompts.md` | Layer 1/2/3 prompt templates |
| `scripts/install-agents.sh` | Updated: creates standup.md templates |
| Per-repo `.claude/standup.md` | App-owned standup extensions |
