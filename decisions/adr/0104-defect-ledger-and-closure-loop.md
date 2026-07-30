# ADR-0104: Behavioral misreports get their own ledger, and only an independent sweep may close one

slug: defect-ledger-and-closure-loop
serial: 0104
rev:
Date: 2026-07-30
Date accepted: 2026-07-30
Status: Accepted
domain: observation
type: architecture
OKR:
Commands affected: /techdebt, /vault, /bead
Repos affected: core, selfco
gate: shadow — sweep reports, never blocks; `--check` gates schema errors only
baseline: 11 reports seeded from the 2026-07-29 audit; 2 closed end-to-end on filing day
traces:
  supersedes:
  amends:
  relates-to: [harness-loop-instrumentation, lint-shadow-to-gate, control-gated-slices, stable-identity-and-facet-tags]
  parent:
  part-of-series: selfco-ontology-program

---

## Context

A 2026-07-29 audit of the selfco vault produced ~30 findings of a kind the fleet had no
place to put. Not code that works badly (tech debt), and not a plan-vs-territory gap noted
mid-task (a deviation), but **artifacts asserting things that are false**:

- `entities/core.md`: "No open PRs, no milestones" — three were open.
- `entities/virtualLight.md`: `status: archived`, "a finished one-off" — eight commits since.
- `wiki/_lint-report.md`: "309 pages" — the vault held 668; the report was 53 days stale.
- Six documents describing the Notion promoter as the live write path — paused for 48 days,
  the transport formally superseded 43 days earlier by the vault's *own* synthesis page.

The class has a measurable signature. Every PR-state claim in the vault (4 of 4) was false
at 25–48 days of age; every count claim that could be re-derived by `ls | wc -l` was wrong.
These are not opinions that drifted — they are checkable facts that went stale silently,
and a stale fact reads exactly like a true one.

`/techdebt` is the wrong container: it scopes to the workflow framework ("never propose
changes to production business code"), categorises by code quality (architecture,
performance, maintainability), and detects by code inspection. None of that fits a claim
proven false by running a command.

The second-order problem is worse than the first. During the same audit, a research brief
produced by a separate agent recommended a multi-day implementation plan aimed squarely at
the dead promoter — because it faithfully read the six documents that still describe it as
live. **A false document propagates into new work.**

## Decision

**1. A third defect class, with its own ledger.** `core/decisions/defects/`, one
`dr-<slug>.md` per report, slug-as-identity per adr:stable-identity-and-facet-tags. Class
values: `false-assertion` · `dead-mechanism` · `schema-drift` · `phantom-reference`.

**2. Every report carries an executable probe, or it is not a report.** `claim_probe`
exits 0 while the false claim is *still present in the artifact*; `truth_probe` prints
current reality for the repairer. A finding with no re-derivation path may be filed only as
`disposition: needs-investigation` — an honest stub. An unverifiable claim dressed as a
defect is not.

**3. The two-source contract: agents file, an independent sweep decides.**
`defect-file.mjs` is the self-report side; `defects-lint.mjs --sweep` runs the probes
against reality and assigns the status. **An agent never closes its own defect.**

**4. Filing policy by provenance.** Deterministic findings file at `open`; LLM/judgement
findings file at `needs-confirmation` and are never auto-closed — a verifier must promote
them. Dedup on claim+location ships on day one, not as a fast-follow.

**5. Findings name the admissible set.** Rejections and violations state the observed value
*and* the allowed values, never a bare "invalid".

**6. Shadow by default.** Exit 0 in every mode except `--check` on schema errors. A
measurement never blocks (adr:control-gated-slices).

## Consequences

**Why the two-source contract is the load-bearing clause.** The fleet has already run the
one-source experiment. The bead-ledger closure loop was declared and never implemented:
**28 open hooks against 9 reports ever filed** (TD-006, core PR #290). Filing is the cheap,
self-rewarding half; closure is where the last system died. Every loop in this fleet that
*survived* — `deviation-log.mjs`, `reconcile-skill-acted.mjs` — carries the same header:
self-report plus an independent parse that "never trusts the self-report."

**It was vindicated on the first run.** The initial sweep returned `claim-gone` for two
reports authored minutes earlier: one had a shell-quoting bug in its probe, and
`dr-selfco-loops-unregistered` was **factually wrong** — the loops *are* registered; they
carry `verifier: "none"`, which is the sharper defect. A separate audit figure ("87 pages
unlisted") was likewise corrected to 42 once a deterministic probe normalised
folder-qualified links. Three errors caught by the mechanism, against its own author, on
day one. A ledger where agents both file and close would have shipped all three as facts.

**Corrections are recorded, not edited away.** Both revisions live in the defect bodies. A
ledger that quietly revises its own numbers is the failure it exists to catch.

**Probes require maintenance, and that is a feature.** `dr-selfco-last-synced`'s probe
grepped `CLAUDE.md` for a key *declaration*; once S1 moved the schema, that probe would
have closed the defect while zero pages carried a trustworthy freshness stamp. A probe that
closes on a declaration rather than a change in the world is this ledger's own version of
the disease. It now tests whether any page actually carries the key.

**Costs accepted.** `--sweep` executes shell strings from data files, so defect files are
executable content — operator-run against a local checkout, deliberately not wired to CI on
untrusted input. Probe rot is a real ongoing tax. And the ledger only ever covers what
someone thought to probe; it is a floor, not a guarantee.

**What it also buys.** Registering the sweep on the weekly rail makes it the floor
reconciler for selfco's *ungated* write paths (LiveSync replication, manual edits), which
no commit-time gate can reach — the detect-and-quarantine model, arrived at independently.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Extend `/techdebt` | Wrong referent (code quality vs. false claims), wrong detection (inspection vs. verification), and its path allowlist excludes the vault entirely. |
| GitHub issues with a `defect` label | Status is queryable, but findings span repos (a vault page → core code → a dead daemon), agent-filed volume pollutes human backlogs, and selfco's own defects would land in a private tracker. |
| A new bead type in `.handoff/` | Reuses a schema, but beads are the system whose closure loop already failed, and per-repo `.handoff/` scatters cross-repo findings. |
| Let agents close their own defects | The failure mode this ADR exists to prevent; disproven on day one. |

## Implementation

Shipped 2026-07-29, core `e475c82`:
`decisions/defects/` (README + 11 reports) · `scripts/defects-lint.mjs` ·
`scripts/defect-file.mjs` · `scripts/probes/` · `decisions/loops/loops.md` registers
`defects-sweep` plus the two selfco generators that were on no rail. 18 tests.

Verified end-to-end: regenerating `_lint-report.md` (309 → 668 pages) flipped its defect to
`claim-gone`; `--apply` closed it and `dr-selfco-loops-no-verifier` to `verified-closed`
with probe output as evidence in `defects-status.jsonl`.
