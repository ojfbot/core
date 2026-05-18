# ADR-0080: Vault staleness scanner — graph-aware signal, surface-only, layered on `/vault lint`

Date: 2026-05-17
Status: Proposed
OKR: 2026-Q2 / selfco-vault-discipline
Commands affected: `/vault lint` (gains `--stale` mode), `/vault` (the consumer Skill's `lint` mode forwards the flag)
Repos affected: `ojfbot/core` (extends `.claude/skills/vault/scripts/lint.py`), `ojfbot/selfco` (adds `scripts/vault-stale.sh` thin wrapper)

> **Relationship to ADR-0079.** ADR-0079 (Proposed, 2026-05-16) is the umbrella decision: promoter-side ingest gate + a graph-aware staleness signal. This ADR **refines mechanism (2)** of 0079 with the implementation-level decisions — algorithm, output schema, calibration plan, layering on `/vault lint`, false-positive escape hatches. ADR-0079 stays the umbrella; this one is the load-bearing detail for the staleness side. The ingest gate (mechanism (1) of 0079) is unaffected.

---

## Context

ADR-0079 named the *signal* — staleness = (zero non-`index.md` inbound `[[wikilinks]]`) ∧ (no git-tracked edits in N days) ∧ (not mentioned in `wiki/log.md` since the page was created) — and committed to **surface-only, never destructive** action. It left several questions open: where the code lives, the exact algorithm and output schema, the calibration of N, the `category: reference-data` exclusion, the false-positive escape hatch, and the relationship to `/vault lint`'s existing orphan check.

Those questions matter because:

- **`/vault lint` already computes the inbound-link set** (`core/.claude/skills/vault/scripts/lint.py:47-61`). A staleness scanner that re-implements that in bash duplicates the work and risks drift. The Python module is the natural home; the only reason 0079 said "bash" was the user's framing — that's not load-bearing.
- **The 90-day threshold in 0079 was a guess.** First-run output will tell us if it's right; the ADR needs to define how calibration happens, not just name the knob.
- **`category: reference-data` is a new schema convention.** Adopting it means back-tagging existing entity pages (Landsat, ERA5, GTFS, …). Without a defined adoption plan, the exclusion mechanism is half-built.
- **False-positives are inevitable.** A page might be legitimately unread for 6 months but still valuable. The scanner needs a per-page escape hatch *that doesn't require editing the script*.
- **Operator workflow** (what the user does with the output) determines whether the scanner is useful or just noise. If it prints 200 stale pages with no triage signal, it dies on the vine.

The vault has ~155 wiki pages today (rough count from `find wiki -name '*.md' | wc -l` in the prior session); a calibrated scanner should surface 5–20 candidates per run, not 100.

---

## Decision

### (1) Implementation lives in `lint.py`, not a standalone script

Extend `core/.claude/skills/vault/scripts/lint.py` with a `--stale` mode. Reuses the existing inbound-link computation (lines 47–61) and the existing CLI plumbing. The `--stale` flag is **additive** — `python3 lint.py wiki` keeps its current output; `python3 lint.py wiki --stale` adds a staleness section to the report.

A thin shell wrapper at `~/selfco/scripts/vault-stale.sh` is the user-facing entry point — it invokes the Python script with the right paths and forwards exit code:

```bash
#!/usr/bin/env bash
# Surface stale wiki pages. See ADR-0080.
exec python3 "$HOME/ojfbot/core/.claude/skills/vault/scripts/lint.py" \
    "$HOME/selfco/wiki" --stale "$@"
```

`/vault lint` (the consumer Skill, `core/.claude/skills/vault/consumer/SKILL.md`) passes `--stale` to its lint mode by default.

### (2) Stale-page predicate

A page `wiki/<type>/<slug>.md` is **stale** iff *all four* hold:

1. **`type ∈ {entities, concepts, synthesis}`** — `sources/` and the top-level `index.md` / `log.md` are excluded as a class. (Source pages have their own currency concern, deferred to a future ADR.)
2. **Zero non-`index.md` inbound `[[wikilinks]]`** — same predicate as the existing orphan check, except `index.md` references don't count (every page is reachable from index by schema requirement; that's not real demand).
3. **No git-tracked edits in the last `--days` window** (default **90**) — `git log --since=<days>.days.ago --pretty=%H -- <path>` returns empty. Implemented via `subprocess.run(['git', 'log', ...])`; falls back gracefully if not in a git repo.
4. **Not referenced in `wiki/log.md` since the page's creation entry** — `grep <slug> wiki/log.md` returns only the original `## [date] ingest|research|note` line that created it. Implemented as a simple line-grep + counts-check.

A page with frontmatter `category: reference-data` is **excluded** before the four-check evaluation. So is a page with frontmatter `staleness: ignore` — see (4) below.

### (3) Output schema

A Markdown section in the lint report (or stdout if invoked as the wrapper), columns:

```
| Page | Age | Inbound | Last log | Hint |
|---|---|---|---|---|
| wiki/entities/nicfi-planet-basemaps.md | 95d | 0 | 2026-05-12 (create) | reference-data candidate |
| wiki/concepts/some-orphan.md | 220d | 0 | 2025-10-08 (create) | review for merge into [[parent-synthesis]] |
```

- **Page** — repo-relative path, clickable as `file_path` in terminals.
- **Age** — days since most recent git edit. Sort the table by age desc (most-stale first).
- **Inbound** — count of non-`index.md` inbound `[[links]]` (always 0 by predicate; column kept for future loosening).
- **Last log** — date + op of the most recent `wiki/log.md` mention (always the create entry by predicate).
- **Hint** — heuristic action prompt: `reference-data candidate` (if `kind: product` in entity frontmatter and `url:` source present), `review for merge` (if it shares ≥2 tags with another non-stale page), `consider archive` (default).

The hints are advisory — the operator decides.

### (4) False-positive escape hatch: `staleness: ignore` frontmatter key

A page whose YAML frontmatter contains `staleness: ignore` is excluded from the scan, regardless of other signals. This is the **per-page escape hatch** — used for pages the operator has reviewed and explicitly kept (e.g. a reference page that genuinely sits unused but is load-bearing for a future analysis).

The class-level escape hatch is `category: reference-data`, used for reference pages collectively (Landsat/ERA5/GTFS — datasets that are *supposed* to be quiet until invoked). The two are orthogonal: `category: reference-data` says "this class is exempt"; `staleness: ignore` says "this specific page is exempt regardless of class."

Neither is read by other vault tooling today; introducing them is a *new* schema convention contained to this ADR.

### (5) `category: reference-data` adoption — one-shot back-tag pass

A one-time `scripts/tag-reference-data.sh` (or equivalent ad-hoc) reads each `wiki/entities/<slug>.md` whose frontmatter has `kind: product` and at least one `[[sources/…]]` page with a `url:` (i.e. an external data product with documentation as its primary source), and adds `category: reference-data` to its tags or as a top-level frontmatter key.

This is **a one-shot**, not a recurring task. New pages added after this ADR lands are tagged at create time by the promoter (when ADR-0079's gate ships) or by hand. The one-shot is not part of this PR — it's filed as a follow-up.

### (6) Calibration plan for the 90-day threshold

The 90-day default is a starting guess. First-run discipline:

1. Run `vault-stale.sh` on the current vault. Record the count of flagged pages.
2. If flagged > 25, the threshold is too loose for the current state — increase to 180d.
3. If flagged = 0, the threshold is too strict for current usage — decrease to 60d for the next run.
4. If 5 ≤ flagged ≤ 25, the threshold is in range; lock at 90d. Re-evaluate every 6 months.

The threshold is configurable via `--days N`. The default lives in `lint.py`'s argparse setup.

### (7) `/vault lint` integration — additive, not replacement

The existing `/vault lint` orphan check stays. The staleness section is added below it in the lint report when `--stale` is passed. They are different signals:

- **Orphan** (existing): structural — no inbound links *right now*. Includes never-linked new pages.
- **Stale** (new): temporal + structural — no inbound links **and** not edited in N days **and** not log-mentioned since creation. Strictly a subset of orphan (every stale page is an orphan; not every orphan is stale).

A new page that's an orphan today is correctly *not yet* stale — it's still in its grace period.

---

## Consequences

### Gains
- **No code duplication.** Single inbound-link computation, in one place (`lint.py`). The bash wrapper is a 3-line shim.
- **Operator workflow is concrete.** Run the wrapper → read the table → for each flagged page, choose merge / archive / `staleness: ignore` → re-run to confirm. Bounded loop.
- **Escape hatches at two granularities** (class-level via `category: reference-data`, page-level via `staleness: ignore`) — covers both the bulk-exemption case and the per-page judgment case.
- **Surface-only.** Re-affirmed from 0079. No destructive verbs. Every `rm` is a human decision.
- **Composable with existing tooling.** Layers cleanly on `/vault lint`; doesn't break the existing orphan check.
- **Test-friendly.** `lint.py` is already a unit-testable Python module; adding `--stale` adds one function (`is_stale(page, days, log_path)`) that's pure given its inputs.

### Costs
- **Two new schema conventions** (`category: reference-data`, `staleness: ignore`) to socialize. Documented in this ADR and `~/selfco/CLAUDE.md` (when next edited).
- **The one-shot back-tag pass is a real task** with ~20–40 pages to evaluate. Not auto-applied — needs a quick human read.
- **`lint.py` grows.** Currently 93 lines; this adds ~60–80 lines. Still under the 250-line skill-orchestration limit and easily refactorable later.
- **The git-log dependency means the script can't run on a non-git vault.** Acceptable — the selfco vault is git-tracked by design; the script can degrade gracefully with a warning.

### Neutral
- **The `--days N` knob exists.** Configuration burden vs flexibility; one more thing the operator can fiddle with.
- **Bash wrapper at `~/selfco/scripts/vault-stale.sh`** exists alongside `autocommit.sh`. Matches the convention.
- **The `~/selfco/scripts/` directory is referenced from the vault's `CLAUDE.md` ("`scripts/autocommit.sh` covers writes that bypass [the `/vault` skill]")** — the new wrapper is a peer.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Pure bash script** (0079's original framing) | Duplicates `lint.py`'s inbound-link computation; harder to test; would drift over time. The bash wrapper is the right scope for bash; the algorithm is the right scope for Python. |
| **Separate Python module** (`stale.py`) alongside `lint.py` | Same import surface; same data structures; sharing utilities across two files is just refactoring deferred. Co-locating in `lint.py` is the simpler call. |
| **One escape hatch, not two** | `category: reference-data` is a *class* signal that's useful beyond staleness (e.g. for the promoter's gate decisions). `staleness: ignore` is a *per-page* override that's useful only here. Collapsing them either over-broadens the class signal or eliminates the per-page judgment hook. Two narrow hatches > one wide one. |
| **Auto-archive after N days post-flag** (the user's first instinct) | Re-rejected from 0079: destructive, hard to reverse, and the operator decision is cheap. The scanner is a queue; the human is the worker. |
| **Daemon-mode (run on a schedule)** | The scanner is fast, on-demand, and the output is for human review. A cron-fired report nobody reads is worse than a manual one occasionally run. Re-evaluate if the manual cadence drifts. |
| **Per-folder thresholds** (e.g. `entities/` 180d, `synthesis/` 60d) | Possibly correct long-term, but speculative now. Ship the one-knob version; collect first-run signal; refine in a follow-up if folder-shape patterns emerge. YAGNI. |

---

## Implementation plan

- **v1 (next PR)** — Land the `lint.py` extension + the `vault-stale.sh` wrapper. Calibrate the threshold on first-run output.
- **Out of scope for v1** — the `category: reference-data` back-tag one-shot (separate PR, separate review). The ADR documents the convention; adoption is a follow-up.
- **Re-evaluate at 6 weeks** — once the scanner has run 3–6 times in practice, decide whether to (a) loosen/tighten the default `--days`, (b) introduce per-folder thresholds, (c) wire into a periodic reminder.
- **The ADR-0079 page-shape gate** is unaffected; it ships independently when `promote-inbox.py` is being written.

---

## Open questions

- **Source page currency** — same temporal signal but different remediation (re-fetch the URL, update `retrieved:`, not archive). Deferred to a separate ADR; do not extend this scanner to `sources/`.
- **`/vault lint --fix` for staleness** — should there ever be an auto-fix mode? Default answer: no; the human-in-the-loop is the point. Re-evaluate only if a clear class of safe auto-fixes emerges (e.g. "delete pages that are stale *and* orphan *and* whose only inbound was a now-redirected wikilink").
- **Output sink** — should the lint report write to a file (`wiki/_lint.md` or similar) for the operator to track over time, or just stdout? Default: stdout. If the operator wants a log, they can `> file`. Re-evaluate if patterns of re-running emerge.
- **What to do with `wiki/log.md` itself** — by predicate it's excluded from scanning, but it grows unboundedly. Out of scope here; mention as a future concern.
- **Cross-vault portability** — the wrapper hard-codes `$HOME/ojfbot/core/...` and `$HOME/selfco/...`. Fine for a single-user vault; would need env-var-ification if multiple operators ever shared the vault. Defer.

---

## Links

- ADR-0079 — the umbrella decision (vault page-lifecycle policy); this ADR refines mechanism (2). Filed in `decisions/adr/0079-vault-page-lifecycle-policy.md`.
- `core/.claude/skills/vault/scripts/lint.py` — the module being extended (currently does inbound-link orphan detection).
- `core/.claude/skills/vault/vault.md` — the `/vault` skill orchestration that forwards `--stale`.
- `core/.claude/skills/vault/consumer/SKILL.md` — the Agent Skill in the Claude apps; gains a `lint` mode that runs the scanner remotely.
- `[[selfco/wiki/synthesis/ten-datasets-urban-design]]` — the bloat observation that triggered the lifecycle work.
- `[[selfco/wiki/synthesis/ojfbot-adrs]]` — the vault-side ADR index that must add this row when filed.
