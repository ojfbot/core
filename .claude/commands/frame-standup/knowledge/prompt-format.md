# Subagent Prompt Format

Reference for `/frame-standup`. Defines the canonical structure for follow-up
prompts that spawn subagents. Every prompt must be self-contained — the agent
receiving it has no access to the current session.

---

## Canonical structure

````markdown
### Prompt N — <Short title>

**Tags:** `[repo:<repo-name>]` `[phase:<phase-number>]` `[type:<work-type>]` `[priority:P0|P1|P2]`
**Command:** `/<framework-command>`
**Context:** <URL to daily-logger post that surfaced this action>
**Deadline pressure:** <days remaining to March 25> days to application target

**Working directory:** `~/ojfbot/<repo-name>`

<3–5 sentences explaining what needs to be done, why it matters, and what
success looks like. Write as if the agent has never seen this codebase.>

**What to do:**
1. <Concrete step>
2. <Concrete step>
3. <...>

**Reference files:**
- `<absolute path>` — <one-phrase description of why it's relevant>
- `<absolute path>` — <one-phrase description>

**Do not:**
- <One hard constraint, e.g. "Do not change the existing API routes">

**When done:** Open a PR targeting `main`. Title format: `<type>(<scope>): <description>`
````

---

## Tag vocabulary

### `[repo:]`
Exact repo directory name: `cv-builder`, `shell`, `blogengine`, `TripPlanner`,
`mrplug`, `purefoy`, `daily-logger`, `core`

### `[phase:]`
Roadmap phase number from `frame-os-context.md`:
`0`, `1`, `1.5`, `2`, `2B`, `3`, `3B`, `4`, `4B`, `5`, `6`, `7`

### `[type:]`
| Value | When to use |
|-------|-------------|
| `module-federation` | Adding MF remote config or loading a remote in shell |
| `api-tools` | Implementing or fixing `GET /api/tools` |
| `frame-agent` | Changes to MetaOrchestratorAgent or domain agents |
| `visual-craft` | CSS, tokens, component design, motion |
| `adr` | Writing or updating an Architecture Decision Record |
| `plan` | `/plan-feature` spec work |
| `scaffold` | `/scaffold` skeleton generation |
| `security` | MrPlug AI migration, CSP, auth |
| `techdebt` | `/techdebt` scan or apply |
| `ci` | GitHub Actions, test pipeline, visual regression |
| `docs` | README, domain-knowledge, handoff |

### `[priority:]`
| Value | Meaning |
|-------|---------|
| `P0` | Blocks hero demo OR blocks the application deadline |
| `P1` | Scheduled this week in the 26-day plan, currently unblocked |
| `P2` | Useful, can slip 1–2 days without jeopardising the plan |

---

## Context URL conventions

Daily-logger post URLs follow Jekyll format:
`https://log.jim.software/<year>/<month>/<day>/<slug>`

The `find-latest-post.js` script derives the URL automatically. Always include
it so the spawned agent can read the full context that motivated the action.

For actions motivated by an ADR rather than the daily-logger, use:
`file://$HOME/ojfbot/core/decisions/adr/<filename>.md`

---

## Reference files — what to include

Always include at minimum:
1. The relevant architecture brief (`domain-knowledge/<repo>-architecture.md` if it exists)
2. The file that needs to be changed or created
3. A parallel implementation to follow (e.g. BlogEngine's version when building TripPlanner's)

Include `domain-knowledge/frame-os-context.md` for any cross-repo action.

---

## P2 stub format (abbreviated)

For P2 items, a stub is sufficient:

```markdown
### Prompt N — <title> [P2]
**Tags:** `[repo:<repo>]` `[phase:<N>]` `[type:<type>]` `[priority:P2]`
**Command:** `/<command>`
**Context:** <URL>

<2 sentences: what and why.>
```
