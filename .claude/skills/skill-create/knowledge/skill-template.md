# Skill File Template

Reference for `/skill-create`. Defines canonical structure, YAML conventions, and output format for all skills in this project.

---

## YAML Frontmatter

```yaml
---
name: <kebab-case-name>
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "<trigger1>",
  "<trigger2>", "<trigger3>". <One sentence: what does it do, what does it produce>.
  Output: <verdict format or artifact type>. <Key constraint, e.g. "No auto-fixes", "Read-only", "Creates files on disk.">
---
```

Rules:
- `name` must match the directory name and the filename (`<name>/<name>.md`)
- `description` is parsed by Claude Code to auto-trigger the skill — keep it specific
- Trigger phrases: include the skill name itself first, then 3–5 natural language variants
- Avoid trigger phrases that overlap significantly with another skill's triggers

---

## Section Order

```markdown
# /<name>

<One-sentence role statement. "You are a X. Your job is to Y — not Z.">

**Input:** <what the user provides — $ARGUMENTS, pasted content, working tree>

**Tier:** <1|2|3>
**Phase:** <phase — see naming-guide.md>

## Core Principles

1. **<Name>** — <constraint or invariant, not a platitude>
2. ...

## Workflow

### Step 1 — <Name>
...

### Step N — Output

<output template in a fenced code block>

## Verdict criteria (optional)

| Verdict | Condition |
...

## Postflight (optional)

<Offers to trigger other skills if patterns are found.>
```

---

## Core Principles Style

Each principle should be a **constraint or invariant** — something that would change the output if violated. Not platitudes ("do your best", "be thorough").

Good:
- **Evidence-first** — every finding must cite a source. No findings from intuition.
- **No rewrites** — this skill produces a review report only.
- **Scripts don't consume context** — deterministic steps go to `scripts/`, not inline.

Bad:
- **Be thorough** — check everything carefully.
- **Quality matters** — always produce high-quality output.

Aim for 3–7 principles. Fewer is fine if the skill is simple.

---

## Workflow Step Conventions

Each `### Step N — <Name>` section should have a clear input → output contract.

**JIT directive** (loads a knowledge file at the moment it's needed):
```
> **Load `knowledge/<topic>.md`** for <what it provides — one phrase>.
```

**Script reference** (calls a script; show actual usage):
```bash
scripts/<verb>-<noun>.js --input <value> --output <value>
# Returns: <what the script outputs>
```

**Tool call guidance**: Show the specific tool or command. Don't explain obvious tool mechanics.

Avoid:
- Over-explaining steps that are implied by the tool call
- Verbose prose where a table or code block would do
- Inline content that belongs in a knowledge file (>20 lines of reference material = knowledge file)

---

## Output Template Convention

Every skill should end with an output template in a fenced code block:

```
## <Skill Name>: <subject>

### Verdict: PASS | PASS WITH NOTES | BLOCKED

---

### <Section 1>
<findings>

### <Section 2>
<findings>

### Summary table
| # | Severity | Item |
|---|----------|------|
```

For skills that produce files on disk (not reports), summarize what was created:

```
## Created: /<name>

Files written:
  <path>  (<N> lines)

Manual steps:
  <what the user still needs to do>
```

---

## Postflight Patterns

Standard postflight offers — use whichever apply:

```markdown
## Postflight

If recurring patterns were found that suggest systemic debt:
> Offer `/techdebt --mode=scan` to file them.

If stale documentation was found or relied upon:
> Offer `/doc-refactor` to update it.

After producing a new artifact:
> Suggest the logical next command in the lifecycle.
```

---

## Size Budget

| Tier | Line budget | When to use |
|------|-------------|-------------|
| 1 | <100 lines | Single-step, lightweight, fast |
| 2 | 100–250 lines | Multi-step procedure (most skills) |
| 3 | 100–200 lines | Meta-skill that orchestrates other skills |

If the main file exceeds 250 lines, move content to `knowledge/`. If a step has >20 lines of reference material inline, it belongs in `knowledge/`.
