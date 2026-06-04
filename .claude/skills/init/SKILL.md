---
name: init
description: Session initializer — load environment context, check services, show active sessions, suggest skills
triggers:
  - init
  - initialize
  - start session
  - set up
  - what should I work on
  - get started
---

# /init

Session initializer for the ojfbot ecosystem. Loads environment context,
checks service health, shows active parallel sessions, and suggests relevant
skills. Run at the start of any session for full situational awareness.

$ARGUMENTS is optional — a focus area like "shell" or "testing" to bias suggestions.

**Tier:** 0 (environment)
**Phase:** orientation

---

## Step 1 — Identify repos in scope

Detect the current repo from `$CWD` via `git rev-parse --show-toplevel`.
Check if additional working directories are configured (visible in the
system environment). List all ojfbot repos detected.

## Step 2 — Check environment health

Run these checks in parallel:

```bash
# Dolt (bead store)
lsof -i :3307 >/dev/null 2>&1 && echo "Dolt: running" || echo "Dolt: not running"
```

For each repo in scope, check its dev server port from the ecosystem table
in CLAUDE.md (e.g., shell=4000, cv-builder=3000, etc.):

```bash
lsof -i :<PORT> >/dev/null 2>&1 && echo "<repo>: running on :<PORT>" || echo "<repo>: not running"
```

Check git status:

```bash
git status --short
git log --oneline -5
```

## Step 3 — Load repo context

Read the relevant architecture file from `domain-knowledge/`:

| Repo | Architecture file |
|------|------------------|
| core | `domain-knowledge/frame-os-context.md` |
| cv-builder | `domain-knowledge/cv-builder-architecture.md` |
| blogengine | `domain-knowledge/blogengine-architecture.md` |
| TripPlanner | `domain-knowledge/tripplanner-architecture.md` |
| mrplug | `domain-knowledge/mrplug-architecture.md` |
| purefoy | `domain-knowledge/purefoy-architecture.md` |
| shell | `domain-knowledge/frame-os-context.md` |
| daily-logger | `domain-knowledge/daily-logger-architecture.md` |

If a `.claude/standup.md` exists in the repo, read it for current priorities.

## Step 4 — Show agent identity and active sessions

Read the agent bead ID from the session sentinel file:

```bash
AGENT_ID=$(cat "$(ls -t /tmp/claude-bead-session-* 2>/dev/null | head -1)" 2>/dev/null || echo "none")
```

If `AGENT_ID` is not "none", query the agent bead for role, hook, and status:

```bash
node "$(git rev-parse --show-toplevel)/scripts/hooks/bead-emit.mjs" active-sessions 2>/dev/null
```

Show the current agent identity and any other active agents. Warn about
agents in the same repo (potential merge conflicts).

## Step 5 — Check open issues

```bash
gh issue list --limit 5 --state open
```

Show the top 5 open issues for the current repo.

## Step 6 — Suggest skills

Based on the current state, suggest relevant skills:

| Condition | Suggestion |
|-----------|-----------|
| Dirty working tree | `/push-all` — safe commits with secret scanning |
| Many unpushed commits | `/push-all` |
| Open issues present | `/investigate` or `/plan-feature` |
| Recent deploy | `/handoff` |
| `$ARGUMENTS` contains "debug" | `/investigate` |
| `$ARGUMENTS` contains "test" | `/test-expand` |
| `$ARGUMENTS` contains "review" | `/pr-review` |
| No specific focus | Show top 3 by repo phase |

## Step 7 — Output session brief

Present a structured summary:

```
## Session Brief — <repo> (<branch>)

**Agent:** <agent-id> (role: <role>, status: <active|resumed>)
**Hook:** <bead-id on hook | empty>

**Environment**
  Dolt: running | not running
  Dev servers: <list with status>
  Git: <clean | N uncommitted changes>, <N unpushed commits>

**Active agents**: <count>
  <list if > 1, showing role + app + hook>

**Open issues** (top 5)
  <list>

**Suggested skills**
  /<skill> — <reason>
  /<skill> — <reason>

**Loaded context**
  <architecture file>
  <standup.md if present>
```

If `$ARGUMENTS` specified a focus area, weight the suggestions and context
loading toward that area.
