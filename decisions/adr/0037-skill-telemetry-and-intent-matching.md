# ADR-0037: Skill telemetry, intent matching, and PR audit

Date: 2026-04-06
Status: Accepted
OKR: 2026-Q2 / O2 / KR3
Commands affected: all /skills, /skill-loader, /push-all
Repos affected: core, all sibling repos (via install-agents.sh)

---

## Context

Frame OS has 34 production skills installed across 8 repos. Each skill has `MANDATORY` trigger directives in its YAML description, but these are metadata for Claude Code's system prompt only. There is no tracking of whether skills actually get invoked, no mechanism to proactively suggest skills, and no audit trail of which skills contributed to a PR.

The existing `runs/` directory (via `writeRun()` in `packages/workflows/src/utils/runs.ts`) tracks CLI/programmatic invocations but NOT interactive Claude Code `/skill` invocations — which is the primary usage path.

Without telemetry, we cannot answer: Which skills are used most? Which are never used? Are the right skills being applied to the right work? Are developers remembering to run quality gates before opening PRs?

## Decision

Implement three Claude Code hooks and one GitHub Action:

1. **`scripts/hooks/log-skill.sh`** — PostToolUse hook (matcher: `Skill`, async) that appends a JSONL line to `~/.claude/skill-telemetry.jsonl` for every interactive skill invocation. Cross-repo, central storage.

2. **`scripts/hooks/suggest-skill.sh`** — UserPromptSubmit hook (user-level) that matches the user's prompt against `skill-catalog.json` trigger phrases and injects a skill suggestion into Claude's context via `additionalContext` JSON output.

3. **`scripts/hooks/pr-skill-audit.sh`** — Standalone script with two modes: `local` (reads telemetry JSONL for skills actually used) and `heuristic` (analyzes PR diff to suggest skills that should have been used).

4. **`.github/workflows/claude-skill-audit.yml`** — GitHub Action triggered on PR open/sync that runs heuristic mode and posts a skill audit comment.

Hooks are deployed to sibling repos via `install-agents.sh` (new sections 6–7: symlink hook scripts, merge hook config into `.claude/settings.json`).

## Consequences

### Gains
- Visibility into skill usage patterns across the entire Frame OS cluster
- Proactive skill suggestions reduce reliance on user memory
- PR-level audit creates accountability for quality gate usage
- Telemetry data enables skill consolidation and discoverability improvements
- Foundation for auto-invocation: future hooks can invoke skills directly, not just suggest

### Costs
- UserPromptSubmit hook adds latency to every prompt (~50ms for trigger matching)
- Telemetry file grows unbounded (mitigated: JSONL lines are small, ~200 bytes each)
- Hook config merge in `install-agents.sh` adds complexity to an already complex script
- False positives in intent matching may be noisy until trigger phrases are refined

### Neutral
- `.claude/settings.json` is gitignored, so hook config is per-machine (matches existing pattern)
- Telemetry lives outside repos (`~/.claude/`), so no gitignore changes needed
- GitHub Action runs on every PR but is lightweight (no API calls, just diff analysis)

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Track via TypeScript `writeRun()` only | Doesn't capture interactive Claude Code invocations (primary path) |
| Cloud telemetry service | Overkill for single-developer workflow; adds infrastructure dependency |
| LLM-based intent detection | Adds API cost and latency to every prompt; static matching is sufficient for curated trigger phrases |
| Pre-commit hook instead of PR Action | Can't analyze full PR context (only staged changes); PR-level is the right granularity |
| Prompt hook that auto-invokes skills | Too aggressive for V1; start with suggestions, graduate to auto-invocation after validating the matching quality |
