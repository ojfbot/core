---
name: adr
description: Create, list, search, accept, supersede, revise, or publish Architecture Decision Records. Triggers on "adr new", "adr list", "adr search", "adr accept", "adr supersede", "adr revise", "adr publish".
---

# /adr — Architecture Decision Records

Manage `decisions/adr/`. ADRs are the written record of architectural decisions — the "why" layer.

**Identity model (ADR-0087, NASA Configuration Management).** The `slug:` is each ADR's permanent,
immutable identity — the Configuration Item "unchanging base". The 4-digit `serial:` is a
**non-load-bearing display number** assigned once at `accept` (never reused, reserved, or renumbered).
Cross-references use `adr:<slug>`, never the number. Read `decisions/adr/0087-stable-identity-and-facet-tags.md`
for the full scheme before changing this skill's conventions.

> **Load `knowledge/adr-template.md`** for the full frontmatter schema + controlled vocabularies.

Arguments: `$ARGUMENTS`. Subcommands: `new "<title>"` · `list` · `search <kw>` · `accept <slug>` ·
`supersede <old> <new>` · `revise <slug>` · `publish`. Default (no arg) → `list`.

Resolve slug↔serial↔file with the read-only helper (every mode uses it):
```bash
scripts/adr-slugs.sh            # prints: slug <TAB> serial <TAB> file   (one row per ADR + drafts)
```

---

## `new "<title>"`

1. **Derive the slug** = kebab-case(title), drop stopwords, ≤5 words (e.g. "Cache the tool manifest"
   → `cache-tool-manifest`).
2. **Uniqueness check** — run `scripts/adr-slugs.sh` and confirm the slug is not already present. On a
   clash, disambiguate (add a qualifier) or ask the user; a slug is permanent, so pick well.
3. **Write `decisions/adr/draft-<slug>.md`** from `decisions/adr/template.md`:
   - `slug: <slug>`, `serial: draft`, `Status: Proposed`, `Date: <today>`.
   - Prompt for `domain:` (offer the 7-value menu) and `type:` (offer the 6-value menu) — both REQUIRED.
   - Leave `traces:` stubbed; **do not assign a number and do not reserve one.**
4. Output the path. Remind: fill Context/Decision/Consequences/Alternatives + the Provenance table
   (ADR-0065), then `/adr accept <slug>` when the decision lands.

---

## `accept <slug>`

The **only** moment a number is born. (Accepts a slug or, for back-compat, a serial.)
1. Resolve the draft file via the helper.
2. Compute `serial = max(existing numeric serials) + 1`, zero-padded to 4 digits. (Monotonic; gaps are
   never filled — they are meaningless by design.)
3. Set `serial: <NNNN>`, `Status: Accepted`, add `Date accepted: <today>`, and update the `# ADR-<NNNN>:`
   heading to carry the serial.
4. `git mv decisions/adr/draft-<slug>.md decisions/adr/<NNNN>-<slug>.md`.
5. Report the assigned serial. Suggest `/adr publish`.

---

## `supersede <old> <new>`  (slugs; serials also accepted)

Write **both** sides (bidirectional traceability):
- On `<old>`: set `Status: Superseded`, add `traces: superseded-by: <new-slug>`.
- On `<new>`: add `traces: supersedes: <old-slug>`.

Report both edits. Suggest `/adr publish`.

---

## `revise <slug>`  (NASA Rev letters — never renumber)

For an in-place change to an **accepted** ADR (evolved decision, corrected detail):
1. Resolve the file. Bump `rev:` (absent → `A` → `B` → …).
2. Append `(revised <today> — <one-line why>)` to the `Date:` line.
3. **slug, serial, and filename stay fixed.** This is the path that replaces renumbering.

Report the new rev. (If the decision is genuinely replaced rather than revised, use `supersede` with a
new ADR instead.)

---

## `search <keyword>`

Grep `decisions/adr/` case-insensitively. Return matching titles + matched lines + paths, surfacing
each hit's `slug` / `domain` / `type`.

---

## `list`

Group by `domain`, then `type`; within a group sort by serial. List drafts (serial=`draft`) in a
separate **"Proposed (unnumbered)"** section. Each row: `serial · slug · status · rev?`.
`--by-serial` flag → flat chronological view instead.

---

## `publish`

Regenerate `decisions/README.md` AND lint the trace graph.

### Step 1 — read every ADR
Glob `decisions/adr/[0-9]*.md` + `draft-*.md`. Parse `slug`, `serial`, `domain`, `type`, `Status`,
`rev`, `traces`, and the title from the heading.

### Step 2 — dangling-trace lint (the anti-rot gate)
For every `traces:` value across all ADRs, confirm the slug resolves to a file on disk (use the
helper). **Any unresolved slug is an error** — report it and stop before writing. This structurally
forbids the phantom-reservation rot ADR-0087 exists to kill.

### Step 3 — rebuild the index
Write `decisions/README.md` as **one table per `domain`** (the six bounded contexts + `meta`), each
row `serial · [title](<file>) · type · status · rev?`, sorted by serial. Append a collapsed
**by-serial appendix** for ordinal scanning, and a **Proposed (unnumbered)** section for drafts.
Report what changed; if nothing changed, `Index is already up to date.`

---

## Always remind

After any write:
> 3-places rule: if this ADR captures a corrected mistake, also update the relevant `knowledge/` file
> and `memory/MEMORY.md`.

When a decision lands on a branch, the merge commit carries `ADR: <slug>` (canonical) **and**
`ADR: <serial>` (back-compat); branch naming is `adr/<slug>` (ADR-0065 as amended by ADR-0087).

## Gotchas

- **The number is born at `accept`, nowhere else.** The instinct is to "reserve" a serial when drafting so cross-refs can point at it — that reservation is exactly the phantom-rot ADR-0087 kills. Drafts carry `serial: draft`; cross-refs use `adr:<slug>`. Never assign or reserve a number before `accept`.
- **`revise` vs `supersede` is a semantic fork, not a size call.** A corrected detail or evolved decision bumps `rev:` in place (slug/serial/filename frozen). A genuinely *replaced* decision gets a new ADR via `supersede`. Picking `revise` for a real replacement silently rewrites history; picking `supersede` for a typo fix spawns junk ADRs.
- **`supersede` writes both files or it writes neither correctly.** The trap is editing only the new ADR's `supersedes:` and forgetting the old ADR's `superseded-by:`. One-sided traces fail the `publish` dangling-trace lint — set both sides before reporting.
- **`publish` lints before it writes — a dangling trace halts the rebuild.** Don't treat the lint as advisory and regenerate the index anyway. Any `traces:` slug that doesn't resolve to a file on disk is an error that stops `publish`; fix the reference first.
- **Resolve identity through the helper, not by eyeballing filenames.** `scripts/adr-slugs.sh` is the single source for slug↔serial↔file. Guessing a file path from a serial breaks on gaps (gaps are meaningless by design and never filled) and on revised ADRs whose heading serial you might misread.

## See Also
- `decisions/adr/0087-stable-identity-and-facet-tags.md` — the identity + facet scheme.
- `/doc-refactor` to propagate the decision into docs; `/plan-feature` to plan implementation.
