# ADR-0079: Vault page-lifecycle policy — promoter-side ingest gate + graph-aware staleness signal

Date: 2026-05-16
Status: Proposed
OKR: 2026-Q2 / selfco-vault-discipline
Commands affected: `/vault ingest`, `/vault research`, `/vault lint`, the Notion-inbox promoter (`promote-inbox.py`, unwritten)
Repos affected: `ojfbot/core` (the `/vault` skill scripts + knowledge), `ojfbot/selfco-box` (the promoter daemon), `ojfbot/selfco` (the vault — `scripts/` adds `vault-stale.sh`)

> **Numbering note.** Slots 0069–0078 are reserved: 0069 selfco-vault (on `feat/selfco-vault`), 0070 multi-surface-access, 0071 selfco-box, 0072–0075 Bhardwaj drafts pending renumber on filing, 0076–0078 reserved for selfco-ingest-beads / notion-inbox-pattern / cloudflare-trigger ADRs (see [[selfco/wiki/synthesis/ojfbot-adrs]]). 0079 is the next safely-unclaimed slot. Renumber on filing if any of the pending slots collapse.

---

## Context

The vault is growing through two write paths:

1. **Claude Code `/vault research <topic>` and `/vault ingest`** (Mac, full vault context). The schema in `~/selfco/CLAUDE.md` explicitly encourages liberal page creation — "be willing to touch 10–15 pages in one pass."
2. **Notion `📥 selfco — Inbox` → promoter daemon** ([[selfco/wiki/synthesis/selfco-notion-inbox-pattern]], [[selfco/wiki/synthesis/selfco-cloudflare-tunnel-push-promoter]]). The `/vault` consumer Agent Skill in the Claude apps (`core/.claude/skills/vault/consumer/SKILL.md`) writes Notion rows; the promoter on the selfco-box drains them into the vault.

Observed bloat: the **2026-05-12 "10 datasets every urban designer should know"** research session produced **27 new files** (10 entity pages, 5 concept pages, 11 source pages, 1 raw, 1 synthesis) for a single Instagram listicle. The synthesis page is load-bearing; many of the entity pages are reference shells whose value depends on whether the practice ever touches that data again ([[selfco/wiki/synthesis/ten-datasets-urban-design]]). The same pattern — one social-media surface → ~20 vault files — would compound the same way for every future "N tools / N datasets / N papers" listicle.

The naive remedy is a **time-bound staleness sweep** ("flag pages not touched in N days, prune"). That gives the wrong signal for reference data: a well-formed entity page for `landsat` or `era5` is *supposed* to sit unread for months — its value is presence-when-needed, not access frequency. mtime can't separate *settled reference* from *dead weight*. The link graph can: a page with zero non-`index.md` inbound links after N weeks, no edits, and no `log.md` mention since ingest is dead weight regardless of how recent its mtime is.

The architectural call: ingest discipline (the "should this become entity/concept pages or just an inline mention?" decision) belongs in the **promoter**, not in the **`/vault` consumer Skill writer**. The writer has no vault state — it can't look up "does this topic already have a synthesis page?" — and lives in three independent app environments (web / iPhone / Mac Desktop) whose policy would drift. The promoter is on-host, has full vault read access, runs server-side under one rule set, and is the right policy layer.

---

## Decision

Three mechanisms, scoped distinctly. **Land mechanism (3) first; (1) when `promote-inbox.py` is written; (2) deferred to its own ADR.**

### (1) Promoter-side ingest gate — page-shape policy

The Notion inbox database gains an optional property:

| Property | Type | Default | Purpose |
|---|---|---|---|
| `page-shape` | Select | `synthesis-only` | `synthesis-only` (write a single `wiki/synthesis/<slug>.md` with inline `[[…]]` mentions for entities/concepts) · `full` (write the entity/concept/source pages as well) · `inline` (append to an existing page named by `target path`) |

The promoter applies the following rule at promote time, in order:

1. If the row sets `page-shape: full` **and** at least one of the rule conditions below is met, write the full set.
2. **Rule (a) — explicit demand:** the row's `tags` include `expand:full`, or `page-shape: full` is set and the row body explicitly enumerates the entities/concepts to spawn.
3. **Rule (b) — second-mention threshold:** the topic the row is about already has ≥1 existing `wiki/sources/` page from a prior ingest (i.e. this is the **second** time the topic enters the vault). The promoter detects this by slug-prefix overlap with existing source pages and by `tags` overlap (≥2 shared tags with an existing entity/concept page is the strong signal).
4. **Rule (c) — operator override:** a row with `page-shape: full` whose body header includes a literal `<!-- promoter: bypass-gate -->` HTML comment skips rules (a)/(b) and writes the full set unconditionally. (Escape hatch for cases like the 10-datasets session, which is the "first-mention" but valuable as a reference set.)
5. **Default (no rule met):** write `wiki/synthesis/<slug>.md` only. Entities/concepts referenced in the body remain as `[[wikilinks]]` to *non-existent* pages — which Obsidian renders as broken-link suggestions, surfacing them as candidates for future promotion when a second source touches them.

The page-shape decision is **deterministic, rules-based, and recorded in the row's `error` field on success** as a one-line audit string (`gate: synthesis-only (no second-mention)` / `gate: full (rule-b: 3 shared tags with [[abhinav-bhardwaj]])`). LLM-judging the decision at promote time is rejected as alternative — non-deterministic, harder to audit, and the rules are simple enough.

### (2) Graph-aware staleness signal — `scripts/vault-stale.sh`

A new script at `~/selfco/scripts/vault-stale.sh` (alongside `autocommit.sh`) emits a review queue. A page is **stale** iff *all three* hold:

- **Zero non-`index.md` inbound `[[wikilinks]]`** — computed by `rg -o '\[\[[^]]+\]\]' wiki -N` and excluding `wiki/index.md`.
- **No git-tracked edits in the last 90 days** — `git log --pretty=%H --since=90.days.ago -- <path>` returns empty.
- **Not referenced in `wiki/log.md`** since the page's creation entry — `rg <slug> wiki/log.md` returns only the original `## [date] ingest|research` line.

The script is **surface-only**: it prints a Markdown table to stdout (`page · age-days · category-hint`); never moves files; never deletes. Pages tagged with `category: reference-data` in their frontmatter are excluded — pre-empts false-flags on `landsat`/`era5`/`gtfs` style pages. Operator (you) reviews the queue manually; the destructive verb is a separate `rm` decision.

The script runs **on demand**, not on a schedule. Optionally wired into `/vault lint` as a sub-check, which is the existing surface for vault-health reports.

### (3) Source currency — out of scope

URL rot, `retrieved:` age, and re-fetch cadence are *currency*, not *staleness*. They affect the **fact-validity** of pages, not their **graph-relevance**. Deferred to its own future ADR (working title: "ADR-XXXX: source-page currency & re-fetch cadence"). Tracked as P2 follow-up; no implementation in this ADR.

---

## Consequences

### Gains
- **The right discipline at the right layer.** Promoter holds the policy (on-host, vault-aware, one rule set); writer stays dumb (per-app, no state). No per-app drift; no consumer-Skill bloat.
- **Bloat-resistance without destructive moves.** `synthesis-only` is the default; entity/concept pages spawn on demonstrated demand (second mention / explicit flag). The 10-datasets session would have produced ~3 files under this policy (1 synthesis + 1 source + 1 raw) instead of 27, with the entity pages spawned later if a second urban-design ingest touched them.
- **False-flag protection for reference data.** The `category: reference-data` exclusion + the graph-aware (not mtime) staleness signal protects exactly the case I'd been worried about (settled-but-unread Landsat-style pages).
- **Auditable decisions.** Every gated promotion records its rule outcome on the Notion row. No silent policy.
- **Backward-compatible.** Existing pages are unchanged; the rules apply only to new promotions. Existing-page status is observable via the staleness scanner without forcing remediation.

### Costs
- **Promoter complexity ↑.** `promote-inbox.py` gains a rule engine (≈ 40–60 lines) and a tag/slug overlap query against the vault. Must be testable — recommend unit-testing the gate function with fixture Notion rows.
- **Schema migration.** The Notion inbox DB gains one optional property (`page-shape`). Safe per the documented schema-evolution rule (additive properties are non-breaking).
- **Operator review obligation.** The staleness queue is human-reviewed; nobody acts on it automatically. Failure mode: the queue accumulates and is never read. Mitigation: surface the count in `/vault lint`'s standard output so it's seen.
- **Possible under-promotion.** The default-to-synthesis-only rule may *under*-create pages that turn out to be valuable. Mitigation: rules (a)/(c) give explicit promotion controls; rule (b) auto-promotes on second mention; pages can always be promoted later via a follow-up ingest.

### Neutral
- The `/vault` consumer Agent Skill (`core/.claude/skills/vault/consumer/SKILL.md`) doesn't change. The writer continues to write rows; the promoter decides shape. The Skill's documentation may mention the new optional `page-shape` property but doesn't depend on it.
- Existing draft ADRs in the vault ([[adr-draft-third-party-skills-vendoring]] et al.) are unaffected — they live as drafts in `wiki/synthesis/` and don't go through the promoter.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Time-bound mtime sweep** (the user's first framing) | Wrong signal for reference data; can't separate "settled" from "dead." The graph carries the actual semantic. |
| **Auto-archive or auto-delete on stale-flag** | Destructive. Vault git history protects, but reversing a false-positive deletion still requires a human round-trip. The review queue is cheaper. |
| **Writer-side discipline (in `/vault` consumer Skill)** | Writer has no vault state — can't do graph-aware decisions. Per-app divergence risk (web/iPhone/Mac would each maintain their own rules). |
| **LLM-judged shape decision at promote time** | Non-deterministic; harder to audit; rules-based is sufficient for the observed bloat pattern. Re-evaluate if rules prove insufficient in practice. |
| **Status quo (bloat-permissive)** | Already observed at one IG post. Compounds linearly in social-media ingest volume. |
| **Combine page-shape gate and staleness scanner in one mechanism** | Different problems (creation vs. evaluation), different cadence (per-promote vs. on-demand), different surfaces (Notion property vs. CLI script). Keeping them orthogonal lets each ship independently. |

---

## Implementation plan

- **v1 (this ADR, shippable now)** — `~/selfco/scripts/vault-stale.sh`. ~50 lines bash + git + ripgrep. No dependency on `promote-inbox.py` shipping. Optionally wire into `/vault lint`. Test by running against current vault state; calibrate the 90-day threshold and the `category: reference-data` whitelist by reviewing the first output.
- **v2 (lands with `promote-inbox.py`)** — page-shape gate in the promoter. Adds the `page-shape` Notion property and the rules-engine. Unit-test the gate function with fixture rows. Update [[selfco/wiki/synthesis/selfco-notion-inbox-pattern]] promoter contract from 12 steps to 13 (insert gate after step 3 "Resolve target path", before step 5 "Write the file").
- **v3 (defer — re-evaluate after v2 in production)** — auto-promotion of second-mentioned entities. The rule-(b) signal could be used not just to *allow* full-shape ingest but to *retroactively* promote existing inline mentions to full pages. Defer until v2 has produced 6+ weeks of signal on false-positive rates.
- **out-of-scope (separate ADR)** — source currency / URL rot / re-fetch cadence.

---

## Open questions

- **Calibration of the staleness thresholds.** 90 days mtime / zero non-index inbound links is a guess. First-run output will tell us if it's too tight (false-positives on settled reference) or too loose (misses obvious dead weight).
- **`category: reference-data` adoption.** Should the promoter auto-tag entities classed as reference data (e.g. anything with `kind: product` and a `url:` source whose `retrieved:` is the only inbound source)? Defer until the staleness scanner has been observed for false-positives.
- **Rule-(b) tag/slug overlap thresholds.** "≥2 shared tags" is a heuristic. May need tuning based on real ingest patterns.
- **Interaction with the bead-provenance dedup pass** ([[selfco/wiki/synthesis/selfco-ingest-beads-provenance-spec]]). The gate runs before dedup; both must agree on "is this a second mention of the same topic?" — coordinate definitions when both ADRs are filed.
- **Notion-side UX.** The `page-shape` Select needs a default; currently writing-from-chat workflows don't set it. The Claude consumer Skill should set `page-shape: synthesis-only` explicitly on each row to keep the policy auditable rather than relying on the schema default.

---

## Links

- [[selfco/wiki/synthesis/ten-datasets-urban-design]] — the bloat observation that prompted this ADR
- [[selfco/wiki/synthesis/selfco-notion-inbox-pattern]] — the promoter contract this gate extends
- [[selfco/wiki/synthesis/selfco-cloudflare-tunnel-push-promoter]] — the trigger architecture the promoter runs under
- [[selfco/wiki/synthesis/selfco-chat-to-vault-architecture-audit]] — the prior architecture audit that named the three topology decisions; this ADR is the page-shape policy layered on top
- [[selfco/wiki/synthesis/selfco-ingest-beads-provenance-spec]] — the orthogonal dedup/provenance layer; coordinate `is-this-a-second-mention` definitions
- [[selfco/wiki/synthesis/ojfbot-adrs]] — the vault-side ADR index that must add a row when this ADR lands
