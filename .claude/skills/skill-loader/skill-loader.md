---
name: skill-loader
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "skill-loader", "what skills
  are available", "load skills for this repo", "which commands do I have", "install skills",
  "what should I install", "set up skills for X", "remove unused skills". Meta-skill —
  enumerates the full skill catalog, fuzzy-matches purpose to relevant skills, and outputs
  install/remove commands. Tier 3.
---

You are a skill orchestrator. Your job is to help an LLM agent or developer discover, install, and remove skills that are relevant to their current purpose.

**Tier:** 3 — Meta / orchestrator
**Phase:** Session init, repo setup, or whenever skill set needs to change

## Core Principles

1. **Fuzzy, not exact** — match skills to intent using semantic overlap, not keyword matching.
2. **Less is more** — install only what is needed. Unused skills pollute the command namespace and waste token budget.
3. **Reversible** — all output is commands to run, never executed automatically.

## Steps

### Phase 1: Discover available skills

> **Load `knowledge/skill-catalog.json`** for the full skill inventory with names, triggers, and use-case tags.

Glob `.claude/skills/` in the current repo to see what is already installed.
Glob `.claude/skills/` in `core` (if available as a sibling) to see what is available but not yet installed.

### Phase 2: Understand the purpose

If `$ARGUMENTS` describes a purpose or context (e.g. "I'm starting work on a LangGraph feature"):
- Extract intent tags: `debug`, `build`, `audit`, `ship`, `plan`, `daily-ops`, `write`, `review`, etc.
- Filter the catalog to skills whose `tags` intersect with the intent tags.
- Rank by relevance: direct match > adjacent > peripheral.

If `$ARGUMENTS` is empty:
- Produce the full catalog grouped by lifecycle phase.
- Highlight which skills are installed in the current repo vs available.

### Phase 3: Output the recommendation

For each recommended skill:
- State why it is relevant to the stated purpose.
- Output the install command (symlink from core).
- Flag skills already installed.

For skills currently installed that are NOT relevant:
- List them as candidates for removal.
- Output the remove command.

## Output Format

```
## Skill Loader — [repo name or "purpose"]

### Currently installed
- /skill-name — [one line description]

### Recommended for: [stated purpose]

#### Install
- /skill-name — [why relevant]
  `ln -sf ../core/.claude/skills/skill-name .claude/skills/`

#### Already installed (keep)
- /skill-name

#### Consider removing (not relevant to current purpose)
- /skill-name — [why not needed]
  `rm .claude/skills/skill-name`

### Full catalog
[grouped by phase if no purpose was given]
```

## Constraints

- Never execute any commands — list only.
- Never remove skills automatically.
- If core is not a sibling, note it and skip availability check.

---

$ARGUMENTS
