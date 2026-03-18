---
name: skill-create
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "skill-create",
  "create a skill", "capture this as a skill", "make this a slash command",
  "save this workflow as a skill", "add a new skill", "turn this into a command".
  Turns a reusable workflow or session pattern into a convention-compliant skill
  directory. Creates files on disk. Registers in skill-catalog.json.
---

# /skill-create

You are a skill author. Given a workflow description or session pattern, you produce a complete, convention-compliant skill directory ready for immediate use as a `/command`.

**Input:** `$ARGUMENTS` — a description of the workflow to capture. Can be a sentence, a list of steps, or a reference to a flow just demonstrated in this session.

**Tier:** 2
**Phase:** Meta — produces a new skill

## Core Principles

1. **Three-tier progressive disclosure** — `<name>.md` (≤250 lines, always loaded) → `knowledge/` (loaded JIT on demand) → `scripts/` (executed without loading context). Never inline reference material or computations that belong in the lower tiers.
2. **Scripts don't consume context** — any step expressible as "input → deterministic output" without LLM reasoning is a script candidate. Move it to `scripts/<verb>-<noun>.js`.
3. **Examples over explanations** — show a script call or tool invocation rather than describing it in prose. Trust the LLM to fill in obvious steps.
4. **Generic, not specific** — skills must not hardcode project names (cv-builder, LangGraph, Carbon, blogengine). Reference `domain-knowledge/` dynamically.
5. **Triggers must earn their triggers** — phrases must be specific enough to avoid false positives but natural enough to match real usage.

## Workflow

### Step 1 — Understand the flow

Parse `$ARGUMENTS`. If thin, check the current conversation for a recently demonstrated pattern.

Identify:
- **Trigger phrases** — what would a user naturally say? (3–6 phrases)
- **Input** — what does the user provide? (`$ARGUMENTS`, pasted content, working tree state)
- **Output** — what does it produce? (verdict, files on disk, report, catalog update)
- **Discrete steps** — 3–9 named steps is the right range; fewer is one function, more needs splitting
- **Knowledge candidates** — reference material, checklists, templates, examples → `knowledge/`
- **Script candidates** — file scanning, JSON transforms, counting, formatting → `scripts/`

### Step 2 — Derive name and check conflicts

> **Load `knowledge/naming-guide.md`** for naming conventions, phase values, and tier definitions.

Derive a kebab-case name. Run:
```bash
ls .claude/skills/
```
Confirm no conflict. If a clash exists, use a more specific name.

### Step 3 — Classify components

| What | Where |
|------|-------|
| Orchestration steps (LLM reasoning, tool calls, decisions) | `<name>.md` |
| Deep reference material (checklist, template, taxonomy, examples) | `knowledge/<topic>.md` |
| Deterministic computation (scan, count, transform, output) | `scripts/<verb>-<noun>.js` |

Add JIT directives in `<name>.md` at the step that needs the knowledge file:
```
> **Load `knowledge/<topic>.md`** for <what it provides>.
```

Add script usage examples at the step that calls the script:
```bash
scripts/<verb>-<noun>.js --input <arg> --output <arg>
```

### Step 4 — Generate the skill directory

> **Load `knowledge/skill-template.md`** for YAML frontmatter format, section order, Core Principles style, output template conventions, and postflight patterns.

Create the following files:

**Always:**
- `.claude/skills/<name>/<name>.md` — main orchestration file

**When knowledge files are needed** (one file per distinct reference topic):
- `.claude/skills/<name>/knowledge/<topic>.md`

**When deterministic scripts are needed:**
- `.claude/skills/<name>/scripts/<verb>-<noun>.js` — CommonJS, `--help` flag, proper exit codes

Write each file using the conventions in `knowledge/skill-template.md`. Read back the generated `<name>.md` and verify: YAML frontmatter present, ≤250 lines, no hardcoded project names, JIT directives point to real files.

### Step 5 — Register the skill

Add an entry to `.claude/skills/skill-loader/knowledge/skill-catalog.json`:

```json
{
  "name": "<name>",
  "tier": <1|2|3>,
  "phase": "<phase>",
  "tags": ["<tag1>", "<tag2>"],
  "description": "<one sentence — what it does and what it produces>",
  "triggers": ["<skill-name>", "<natural phrase 2>", "<natural phrase 3>"]
}
```

Insert it adjacent to related skills (e.g., after `plan-feature` if it's a planning skill).

### Step 6 — Output the registration summary

```
## Skill created: /<name>

Files written:
  .claude/skills/<name>/<name>.md            (<N> lines)
  .claude/skills/<name>/knowledge/<topic>.md  (if any)
  .claude/skills/<name>/scripts/<name>.js     (if any)

skill-catalog.json updated  →  <N> total skills

Manual step — add to CLAUDE.md:
  Table row (in the appropriate section):
    | `/<name>` | <tier> | <phase> | <one-line purpose> |

  Recommended lifecycle order (if the skill fits between existing steps):
    <updated /plan-feature → ... line>
```

## Postflight

After creating the skill, offer:
> Run `/spec-review` on the generated `<name>.md` to catch structural issues before using it in a real session.
