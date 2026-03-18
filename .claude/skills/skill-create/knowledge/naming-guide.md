# Skill Naming Guide

Reference for `/skill-create`. Covers naming conventions, phase values, tier definitions, and trigger phrase guidelines.

---

## Naming conventions

- **kebab-case only** — no underscores, no camelCase
- **Verb-first for action skills** — `spec-review`, `push-all`, `test-expand`, `doc-refactor`
- **Noun-first for domain/tool skills** — `workbench`, `roadmap`, `recon`, `adr`
- **Single word where unambiguous** — `validate`, `sweep`, `deploy`, `scaffold`, `hardening`
- **Name must match** the directory, the filename, and the `name` field in YAML frontmatter

## Conflict check

```bash
ls .claude/skills/
```

If a directory with the name exists, pick a more specific name. Do not overwrite.

---

## Trigger phrase guidelines

- Always include the skill name itself as the first trigger
- Add 3–5 natural language variants — match what a user would actually say, not just paraphrases of the skill name
- Phrases must be specific enough to not trigger the wrong skill

**Good:**
```
"spec-review", "double-check this spec", "fact-check this", "peer review this plan"
```

**Avoid:**
```
"review"  ← too ambiguous, also triggers pr-review
"check"   ← too broad
```

When in doubt: would this phrase more naturally trigger a different existing skill? If yes, pick a different phrase.

---

## Phase values

| Phase | When it runs |
|-------|-------------|
| `planning` | Before implementation — produces a spec, plan, or decision |
| `pre-kick-off` | After planning, before scaffolding — validation, fact-checking |
| `kick-off` | Starts implementation — generates types, skeletons, wiring |
| `debugging` | During implementation — investigates failures, traces errors |
| `quality-gate` | Before merge — verifies correctness, invariants, security |
| `pre-milestone` | Before a release or milestone — security, resilience, observability |
| `release` | During deployment — pre-flight, blast radius, rollback |
| `post-ship` | After deployment — documentation, runbooks, open items |
| `continuous` | Runs any time, not phase-locked (sweep, techdebt, adr) |
| `meta` | Produces or improves other skills/tools |

---

## Tier definitions

| Tier | Meaning | Typical line count |
|------|---------|----------------|
| 1 | Lightweight — single-step, fast, narrow scope | <100 lines |
| 2 | Multi-step procedure — the default for most skills | 100–250 lines |
| 3 | Meta-skill — orchestrates other skills or manages the system | 100–200 lines |

Most skills are Tier 2. Use Tier 3 only for skills that coordinate other skills (techdebt, skill-loader, workbench).

---

## skill-catalog.json entry shape

```json
{
  "name": "<kebab-case-name>",
  "tier": 2,
  "phase": "<phase>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"],
  "description": "<one sentence — what it does and what it outputs>",
  "triggers": [
    "<skill-name>",
    "<natural phrase 1>",
    "<natural phrase 2>",
    "<natural phrase 3>"
  ]
}
```

Insert adjacent to related skills (e.g., a planning skill goes after `plan-feature`).

---

## CLAUDE.md placement

Add a row to the appropriate command table in CLAUDE.md. Section guide:

| Skill type | CLAUDE.md section |
|------------|-------------------|
| Core lifecycle skill | `### Development lifecycle` |
| Recurring maintenance | `### Supporting routines` |
| Project-specific | `### Project-specific commands` |
| Discovery / read-only | `### Discovery and analysis` |
| Environment / tooling | `### Environment` |
| Meta / management | `### Skill management` |

Also update the recommended lifecycle order if the skill fits between existing steps:
```
/plan-feature → /spec-review → /scaffold → ...
```
