---
name: skill-audit
description: "MANDATORY: Load this skill IMMEDIATELY when user asks to \"skill-audit\", \"audit my skills\", \"are my skills well-structured\", \"score the skill library\", \"which skill categories am I missing\", \"check skill architecture\", \"skill coverage map\", \"find straddler skills\". Audits the skill library against the Anthropic skill-architecture patterns (nine categories + authoring tips). Deterministic signals from a script; judgment signals from an LLM pass. Read-only by default — reports, never edits skills."
---

# /skill-audit

Audit the skill library against Anthropic's skill-architecture patterns. The
deterministic signals come from `scripts/audit-architecture.mjs`; you add the
judgment signals on top. **Read-only** — this skill reports; it never edits other
skills. Fixes are applied by the user or by `/skill-create` (new skills) and
`/techdebt` (proposals).

**Tier:** 2 — multi-step procedure
**Phase:** observation (feeds the OPAV loop)
**Category:** code-quality-review (it audits the skills themselves)

## Core principle

The rubric is the source of truth: **`knowledge/architecture-rubric.md`**. The
nine categories are a *gap-finding lens*, not a mandatory classification — most
of this library is `methodology-meta` on purpose. The audit's job is to surface
**gaps** (under-covered categories), **straddlers** (skills that do too much),
**drift** (skills not in the catalog), and **missing Gotchas** — not to force
every skill into a product/ops bucket.

## Modes

| Invocation | What it does |
|------------|--------------|
| `/skill-audit` (default) | Full deterministic report + LLM judgment pass on flagged skills |
| `/skill-audit --coverage` | Category coverage map only (the gap-finder) |
| `/skill-audit --straddles` | Straddle + drift + uncategorized lists |
| `/skill-audit --scorecard=<name>` | One skill's signals + verdict |

## Steps

1. **Run the deterministic pass.** From `core/`:
   ```bash
   node .claude/skills/skill-audit/scripts/audit-architecture.mjs $ARGUMENTS
   ```
   This computes D1–D7 for every skill, the coverage map, drift, straddlers, and
   missing-Gotchas, and appends a summary line to
   `~/.claude/skill-architecture-audit.jsonl` (the OPAV Observation substrate).
   Pass `--no-log` for a dry run.

2. **Load the rubric.** Read `knowledge/architecture-rubric.md` for the J-signal
   definitions before judging anything.

3. **Layer the judgment signals (J1–J4)** on the skills the script flagged
   (`Needs work` / `Refactor candidate`, and any `straddle`). Don't re-judge
   skills that are deterministically `Aligned` unless asked — economize. For each
   flagged skill, read its `SKILL.md` and score J1 (states the obvious?),
   J2 (are its Gotchas real or filler?), J3 (railroads? — gate skills exempt),
   J4 (genuinely straddles?).

4. **Produce the report:** coverage map (gaps first), straddle list with
   split/keep recommendations, prioritized fix backlog (missing Gotchas on
   high-traffic skills rank top — Anthropic calls Gotchas the highest-signal
   content). Offer to file the top items as `/techdebt` proposals or beads.

## Output format

```
## Coverage (gap-finder)
<category table; absent + thin flagged>

## Straddlers
<skill — categories it spans — split or keep + why>

## Drift
<on-disk skills missing from catalog>

## Fix backlog (prioritized)
1. <skill> — <signal failed> — <fix>
```

## Constraints

- Never edit another skill's files. Report and recommend only.
- Don't force `methodology-meta` skills into one of the nine — that's cargo-culting.
- The script owns D-signals; you own J-signals. Don't recompute D by hand.

## Composition

- New skills are born compliant via `/skill-create` (it reads this same rubric).
- Recurring cadence: `/frame-standup` surfaces the drift readout; a weekly
  scheduled run keeps the jsonl fresh. Gate doctrine: any future enforcement
  matures shadow → operational per ADR-0086 (`/gated-slice`).
- File findings as `/techdebt` or `/bead`.

## Gotchas

- **Catalog vs disk drift is the silent failure.** A skill can exist on disk and
  work fine while being invisible to `skill-loader`, `suggest-skill`, and this
  audit — because the catalog, not the filesystem, is the source of truth for
  classification. D1 catches it; don't ignore it.
- **A `## Gotchas` heading passing D3 says nothing about quality.** D3 is pure
  presence. A section full of obvious filler passes D3 but fails J2. Always run
  the judgment pass on Gotchas content, not just the grep.
- **`scope: ["user"]` skills are symlinked, not copied.** The script reads the
  real directory via the symlink, so it audits the canonical core copy — correct.
  But editing findings must land in `core/`, never in `~/.claude/skills/<name>`
  (that's the symlink target).
- **Word-count for D4 is a heuristic, not a verdict.** A 380-word skill with no
  `knowledge/` passes D4; a 420-word one fails. Treat near-threshold D4 fails as
  advisory — the real question is whether reference material is buried inline.
- **Don't run the judgment pass on all 57 skills by default.** That's a large
  token spend. Judge only what the deterministic pass flags, unless the user
  explicitly asks for a full re-judge.

$ARGUMENTS
