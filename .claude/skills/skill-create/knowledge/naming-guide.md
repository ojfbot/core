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

## Description field spec

The `description` in YAML frontmatter is the **only** thing Claude Code sees when deciding whether to load the skill. Treat it as the most important line in the file.

- **Two parts.** Sentence 1: what capability this skill provides. Sentence 2 (or a clause): when to activate it — the concrete trigger conditions.
- **Third person.** "Builds X…", "Audits Y…", "Turns Z…" — not "I will…" or "You should…".
- **≤ 1024 characters.** Hard limit. If it's bumping the limit, the skill probably does too much.
- **No time-sensitive content.** No dates, version numbers, "new", "recently", "as of". The description outlives them.
- **Lead with the trigger phrases** in our convention: `MANDATORY: Load this skill IMMEDIATELY when user asks to "<trigger1>", "<trigger2>", "<trigger3>".` then the capability sentence, then the key constraint (`No auto-fixes` / `Read-only` / `Creates files on disk` / etc.).
- **Disambiguate from neighbours.** If another skill has a similar name or purpose, say in the description how this one differs (e.g. `/zoom-out` says "For a full repo overview from cold, use /recon instead").

---

## Review checklist (run before committing a new or edited skill)

- [ ] Description includes concrete activation triggers (not just a restatement of the name)
- [ ] Description is third person, ≤ 1024 chars, no time-sensitive info
- [ ] Description disambiguates from any neighbouring skill
- [ ] Main `SKILL.md` stays within its tier's line budget (see Tier definitions below); overflow lives in `knowledge/`
- [ ] Cross-references go one level deep only (a knowledge file doesn't link to another knowledge file)
- [ ] Terminology is consistent with `domain-knowledge/GLOSSARY.md` and `CONTEXT.md`
- [ ] Concrete examples or an output template included — not just abstract instructions
- [ ] Deterministic, repeated operations are in `scripts/`, not inline prose
- [ ] Registered in `packages/workflows/src/registry.ts` and `skill-catalog.json`; row added to the right `CLAUDE.md` table

---

## Skill lifecycle (status)

The catalog has 60+ skills; not all are equally baked. Each `skill-catalog.json` entry may carry a `status` field (absence ≡ `active`):

| status | meaning | synced to siblings? | auto-suggested? |
|--------|---------|---------------------|-----------------|
| `active` (default) | production skill, conventions met | yes | yes |
| `in-progress` | drafted, not yet stable — usable but expect churn | no | no |
| `deprecated` | superseded; kept for reference, scheduled for removal — the description should name the replacement | no | no |

`install-agents.sh` only syncs `active` skills to sibling repos. `suggest-skills.mjs` only matches `active` triggers. When a skill graduates, flip `status` to `active` and run the review checklist above. When retiring one, set `status: deprecated` and point its description at the replacement before deleting it a release later.

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
