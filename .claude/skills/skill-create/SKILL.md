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

1. **Three-tier progressive disclosure** — `SKILL.md` (≤250 lines, always loaded) → `knowledge/` (loaded JIT on demand) → `scripts/` (executed without loading context). Never inline reference material or computations that belong in the lower tiers.
2. **Scripts don't consume context** — any step expressible as "input → deterministic output" without LLM reasoning is a script candidate. Move it to `scripts/<verb>-<noun>.js`.
3. **Examples over explanations** — show a script call or tool invocation rather than describing it in prose. Trust the LLM to fill in obvious steps.
4. **Generic, not specific** — skills must not hardcode project names (cv-builder, LangGraph, Carbon, blogengine). Reference `domain-knowledge/` dynamically.
5. **Triggers must earn their triggers** — phrases must be specific enough to avoid false positives but natural enough to match real usage.
6. **Architecture-rubric compliance** — every new skill is born compliant with `skill-audit/knowledge/architecture-rubric.md`: exactly one `category` (use `methodology-meta` if it's off the nine, don't force a fit), a `## Gotchas` section seeded from day one, a model-facing `description` (trigger words, not human prose), and reference material in `knowledge/` once `SKILL.md` exceeds ~400 words. This is what stops catalog/structure drift from recurring.

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
| Orchestration steps (LLM reasoning, tool calls, decisions) | `SKILL.md` |
| Deep reference material (checklist, template, taxonomy, examples) | `knowledge/<topic>.md` |
| Deterministic computation (scan, count, transform, output) | `scripts/<verb>-<noun>.js` |

Add JIT directives in `SKILL.md` at the step that needs the knowledge file:
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
- `.claude/skills/<name>/SKILL.md` — main orchestration file (canonical body; ADR-0084)

**When knowledge files are needed** (one file per distinct reference topic):
- `.claude/skills/<name>/knowledge/<topic>.md`

**When deterministic scripts are needed:**
- `.claude/skills/<name>/scripts/<verb>-<noun>.js` — CommonJS, `--help` flag, proper exit codes

Write each file using the conventions in `knowledge/skill-template.md`. **Every `SKILL.md` must include a `## Gotchas` section** — seed it with the failure modes you already know (it accretes over time, Day-1 → Month-3; Anthropic calls Gotchas the highest-signal content in any skill). If you genuinely know none yet, add a single honest placeholder line rather than omitting the heading.

Read back the generated `SKILL.md` and verify: YAML frontmatter present (`name` matching the directory + a model-facing `description`), ≤250 lines, no hardcoded project names, JIT directives point to real files, **a `## Gotchas` section exists**, and the description doesn't restate default Claude behavior.

### Step 5 — Register the skill

Add an entry to `.claude/skills/skill-loader/knowledge/skill-catalog.json`:

```json
{
  "name": "<name>",
  "tier": <1|2|3>,
  "phase": "<phase>",
  "category": "<one of: library-api-reference | product-verification | data-analysis | business-automation | code-scaffolding | code-quality-review | cicd-deployment | runbooks | infrastructure-ops | methodology-meta>",
  "tags": ["<tag1>", "<tag2>"],
  "description": "<one sentence — what it does and what it produces>",
  "triggers": ["<skill-name>", "<natural phrase 2>", "<natural phrase 3>"]
}
```

The `category` field is **required** (controlled vocab above; see `skill-audit/knowledge/architecture-rubric.md`). Pick exactly one — if the skill genuinely spans two unrelated categories, that's a smell: prefer splitting it. If you keep it deliberately broad, add `"straddle": true` so `/skill-audit` tracks it. Insert the entry adjacent to related skills (e.g., after `plan-feature` if it's a planning skill).

### Step 6 — Output the registration summary

```
## Skill created: /<name>

Files written:
  .claude/skills/<name>/SKILL.md             (<N> lines)
  .claude/skills/<name>/knowledge/<topic>.md  (if any)
  .claude/skills/<name>/scripts/<name>.js     (if any)

skill-catalog.json updated  →  <N> total skills

Manual step — add to CLAUDE.md:
  Table row (in the appropriate section):
    | `/<name>` | <tier> | <phase> | <one-line purpose> |

  Recommended lifecycle order (if the skill fits between existing steps):
    <updated /plan-feature → ... line>
```

## Gotchas

- **The catalog entry is the skill's existence, not the directory.** A skill dir with a SKILL.md works locally but is invisible to `/skill-loader`, `suggest-skill`, and `/skill-audit` until Step 5 registers it in `skill-catalog.json`. Skipping Step 5 is the #1 source of drift — never call the skill "created" until it's in the catalog.
- **`category` is required and easy to fudge.** When tempted to give a skill two categories, that's a signal it does too much — split it, or set `"straddle": true` so the audit tracks the debt. Don't invent categories outside the controlled vocab; off-taxonomy skills are `methodology-meta`, not a new value.
- **A seeded Gotchas section beats a perfect-but-absent one.** You rarely know all the failure modes at authoring time. Seed it with what you know (and an honest placeholder if truly nothing) — the section accretes; omitting the heading guarantees it never does.
- **Don't restate default Claude behavior to hit a line count.** A skill that explains what Claude already does adds context cost without value. If the knowledge doesn't push Claude *out* of its default, cut it.

## Postflight

After creating the skill, offer:
> Run `/spec-review` on the generated `SKILL.md` to catch structural issues before using it in a real session.
> Run `/skill-audit --scorecard=<name>` to confirm the new skill passes the architecture rubric (category, Gotchas, model-facing description, progressive disclosure).
