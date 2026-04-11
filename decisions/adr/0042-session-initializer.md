# ADR-0042: Two-tier session initializer

Date: 2026-04-10
Status: Accepted
OKR: 2026-Q1 / O1 / KR3
Commands affected: /init
Repos affected: core (all repos via user-level hook)

---

## Context

Session beads (ADR-0040) are only created when a `/skill` is explicitly invoked. The `bead-session.sh` PostToolUse hook checks `$TOOL_NAME == "Skill"` before creating a session bead. Plain natural language sessions — which account for a significant portion of Claude Code usage — leave no trace in Dolt: no session bead, no task tracking, no PR tracking.

This was confirmed empirically: a TripPlanner session fixed a bug and opened a PR via plain prompt, but Dolt had zero record of the session. The hooks deployed correctly (no errors), but silently no-op'd because no skill was invoked.

The deeper issue: sessions across the ojfbot ecosystem should self-initialize into a consistent environment. Not just "create a bead" but establish a pattern where every session becomes visible to the ecosystem, loads relevant context, and can be coordinated with parallel work.

## Decision

Implement a two-tier session initializer:

### Tier 0: `session-init.sh` (free, silent, universal)

A **UserPromptSubmit** hook that creates a session bead on the first user message in any Claude Code session, regardless of whether a skill is invoked.

**Why UserPromptSubmit:**
- SessionStart is async/fire-and-forget — cannot inject `additionalContext` for parallel session warnings
- PostToolUse (bead-session.sh) fires *after* a tool call — the first tool call would have no bead context
- UserPromptSubmit fires before Claude starts reasoning, is synchronous, and can inject context

**Behavior:**
1. Check sentinel file `/tmp/claude-bead-session-<SESSION_ID>` — if exists, exit (~1ms)
2. If Dolt running: create session bead with `skill=none`, write bead ID to sentinel
3. If Dolt not running: write `none` to sentinel (commit/PR tracking still works via file-exists check)
4. Query active sessions — if >1, inject parallel session warning via `additionalContext`
5. Inject `[Session initialized — run /init for full environment context]` nudge

**Install:** User-level `~/.claude/settings.json`, first entry in UserPromptSubmit array (runs before suggest-skill.sh). Deployed by `install-agents.sh`.

### Tier 0.5: Upgrade pattern in `bead-session.sh`

When a skill is later invoked in the same session, `bead-session.sh` upgrades the Tier 0 bead rather than creating a duplicate:
- Sentinel contains `none` (Dolt was down) → create real bead, update sentinel
- Sentinel contains a bead ID → `session-update --skill=<name>` to add skill label
- No sentinel (defensive, shouldn't happen) → create bead as before

One session = one session bead, always.

### Tier 1: `/init` skill (interactive, token cost, rich context)

An explicit skill for sessions that benefit from full environment setup:
1. Detect repos in scope from `$CWD` and additional working directories
2. Check environment health: Dolt, dev server ports, git status
3. Load repo-specific architecture docs from `domain-knowledge/`
4. Show active parallel sessions with repo conflict warnings
5. List open GitHub issues for focused repos
6. Suggest relevant skills based on git state and skill catalog

### Auto-suggestion (no forcing)

Three reinforcing mechanisms make `/init` the path of least resistance without forcing it:
1. `session-init.sh` injects a nudge via `additionalContext` on first message
2. `suggest-skill.sh` suggests `/init` when no other skill matches and it's the first prompt
3. CLAUDE.md can optionally note `/init` as a recommended session start

## Consequences

### Gains
- Every session gets a bead — whether plain prompt, skill invocation, or mixed
- Parallel session awareness: second session sees warning about the first
- `/init` provides structured orientation without being mandatory
- Upgrade pattern prevents duplicate beads while allowing progressive enhancement
- Zero cost for Tier 0 (shell script, ~250ms first message, ~1ms subsequent)

### Costs
- ~250ms latency on first user message per session (Dolt query + bead creation)
- `/init` skill consumes tokens when invoked (~120 lines of prompt)
- Three UserPromptSubmit hooks now chain sequentially (session-init → mrplug-inject → suggest-skill)
- Sentinel file pattern (`/tmp/claude-bead-session-*`) accumulates — cleaned on reboot

### Neutral
- Existing bead-session.sh PostToolUse hooks remain for commit/PR tracking
- Sessions without Dolt still get a sentinel file (graceful degradation)
- `/init` is optional — Tier 0 guarantees the bead regardless

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Patch bead-session.sh to create bead on first Bash call | Misses sessions that only use Read/Glob. PostToolUse fires after work starts, not before. |
| Use SessionStart hook | Cannot inject `additionalContext`. Async — bead might not exist by first tool call. |
| Force `/init` via CLAUDE.md instruction | Easily ignored. Cannot guarantee compliance across all sessions and repos. |
| Block prompts until `/init` runs | Too disruptive. Many sessions are short, focused tasks that don't need full context loading. |
| Create bead in every PostToolUse call | Would fire on every Read, Glob, Grep — massive overhead. Sentinel check avoids this. |
