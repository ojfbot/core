# ADR-0084: SKILL.md is the canonical skill body filename (fleet-wide Skill-tool callability)

Date: 2026-06-04
Status: Accepted
OKR: 2026-Q2 / O-skills / KR-coverage
Commands affected: all file-backed skills (54 renamed); /skill-create and /adr knowledge updated; /vault exempted
Repos affected: core (source); synced to siblings via `install-agents.sh`

---

## Context

The Claude Code **Skill tool** discovers a skill by reading `<dir>/SKILL.md`. Every ojfbot
`core` skill, however, ships its body as `.claude/skills/<name>/<name>.md` (the convention set by
[ADR-0003](0003-skill-directories-over-flat-files.md) and reaffirmed by
[ADR-0021](0021-skills-directory-rename-from-commands.md)). The TypeScript engine
(`fileBackedWorkflow.ts`) and Claude Code's slash interface read that file, so `/name` works — but
`Skill(name)` does **not**, because there is no `SKILL.md` for the tool to find.

[ADR-0085] (the vault ADR, formerly numbered 0069)/PR #126 fixed this for `vault` alone by adding a
thin hand-written `SKILL.md` that defers to `vault.md`. The 2026-06-02 core#117 pickup bead flagged the general case as
"ADR-shaped — surface before doing the fleet-wide version." At the time of this decision, **1 of 55
skill directories** (`vault`) was `Skill()`-callable; the other 54 were not.

The user chose, among three mechanisms, to make `SKILL.md` the **canonical** body filename rather
than layer wrappers or symlinks on top of the existing `<name>.md` files (see Alternatives).

## Decision

1. **`SKILL.md` is the single canonical skill-body filename.** Rename every
   `.claude/skills/<name>/<name>.md` → `.claude/skills/<name>/SKILL.md` (54 skills). The body content
   is unchanged; only the filename moves. Existing `name:` + `description:` frontmatter already
   satisfies the Skill tool, so each renamed skill becomes both `/name`- and `Skill(name)`-callable
   from one source of truth — no wrapper file, no description duplication, no drift.

2. **The loader reads `SKILL.md` with a legacy fallback.** `fileBackedWorkflow.ts` now loads
   `<name>/SKILL.md`, falling back to `<name>/<name>.md` if absent (covers a skill mid-migration or
   an out-of-tree consumer). The TS engine and the Skill tool therefore read the same file.

3. **`/vault` remains the documented exception.** It keeps `vault.md` as its canonical body plus a
   thin `SKILL.md` wrapper, because `vault.md` uses `{skill}` path placeholders that the TS engine
   substitutes but the Skill tool does not, and it ships a `consumer/SKILL.md` sub-skill. Folding
   it would re-open PR #126's deliberate design, so it is left as-is.

4. **New skills are born as `SKILL.md`.** `/skill-create` (body + `knowledge/skill-template.md`,
   `knowledge/naming-guide.md`), `/adr`'s `adr-template.md`, `CLAUDE.md`, `docs/`, and the
   `GLOSSARY`/`CONTEXT`/`coding-standards` domain-knowledge files are updated so the convention is
   taught as `SKILL.md`.

5. **This supersedes the *filename* clause** of ADR-0003 and ADR-0021 only. The skill-**directory**
   structure, three-tier progressive disclosure (`SKILL.md` → `knowledge/` → `scripts/`), and the
   `.claude/commands → skills` compat symlink from those ADRs all stand unchanged.

## Consequences

- **Every core skill is now Skill-tool-callable** from a single source of truth, and the change
  **propagates fleet-wide automatically**: `install-agents.sh` symlinks skill *directories* into
  sibling repos, so the renamed `SKILL.md` travels with the directory on the next install — no
  per-repo edit.
- **`core-reader` must migrate its parser (follow-up, separate repo).** Its skill browser reads
  `.claude/skills/<name>/<name>.md` (`domain-knowledge/corereader-ux-research.md`); after this rename
  it must read `SKILL.md` (with a `<name>.md` fallback). The loader fallback protects core itself but
  not external readers. Tracked as a follow-up; until it lands, core-reader's skill list will be stale.
- **One-time churn:** 54 file renames in history (git records them as renames; bodies unchanged).
- **`vault` stays a special case**, documented here and in its `SKILL.md`.
- New direct test coverage (`fileBackedWorkflow.test.ts`) locks the SKILL.md-first / legacy-fallback /
  missing-file behaviour that previously had none.

## Alternatives considered

- **Thin wrapper per skill** (the `vault` #126 pattern, replicated): a generated `SKILL.md` that
  defers to `<name>.md`. Rejected — dual files per skill and the description then lives in three
  places (wrapper, body frontmatter, catalog), requiring a generator to avoid drift. More machinery
  for the same callability.
- **Symlink `SKILL.md` → `<name>.md`** per directory. Rejected — it *layers* a second convention
  rather than simplifying to one, keeps two files per dir, and relies on file-level symlink
  dereferencing surviving in git and every consumer.
- **Do nothing / leave 54 skills slash-only.** Rejected — the user wants them `Skill()`-callable.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | core#117 merge (ADR-0083 landed; skill catalog at v1.7) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
| Supersedes (filename clause) | ADR-0003, ADR-0021 |
| Follow-up | core-reader parser → read SKILL.md (separate repo) |
