# ADR-draft: Correspondence speech-act tiers — one grammar, derived register, machine-minted identity
slug: correspondence-speech-act-tiers
serial: draft
rev:
Date: 2026-09-24
Status: Proposed
domain: gas-town-governance
type: architecture
OKR: 2026-Q3 / l2-ojfbot (agent work is legible and coordinated across the fleet)
Commands affected: /bead, /resume, /adr, /triage, /gated-slice; new /correspond (proposed)
Repos affected: core (schema, lint, skill, hooks); every repo with a `.handoff/` directory (14 today); ojfbot/lego-village-pipeline and ojfbot/play-well-library as the first migration targets, by their own ratification rule
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [session-beads-meta-coordination, stable-identity-and-facet-tags, defect-ledger-and-closure-loop, control-gated-slices, zero-point-and-provenance-convention, dispatch-queue-and-day-runner, session-provenance-hardening]
  parent:
  part-of-series:

---

## Context

### What the play-well cluster built, and what it cost

Between 2026-09-17 and 2026-09-24, `ojfbot/lego-village-pipeline` (lvp) grew a multi-agent
coordination protocol: numbered correspondence memos (`HANDOFF-` / `CORR-` / `REVIEW-LEGO-PIPE-nnn-R<k>`),
a committed register on protected `main`, research records, hashed design-package cuts, and
Python enforcement tooling (`tools/memo_preflight.py`, `register_lint.py`, `register_finalize.py`,
`register_migrate.py`, `package_preflight.py`, `design_pkg.py`). Six parties who cannot convene
(James as operator, Claude Code, Cowork, Codex/ChatGPT, Claude Design, GitHub as the record)
coordinated only by leaving each other documents.

Measured at lvp `origin/main` 0cf92a3 (register 2026-09-18.33):

| Measure | Value |
|---|---|
| Memo files under `docs/correspondence/` | 25, 700 KB total |
| Register versions in the first 5 days | 31 |
| Pull requests | 29 |
| Defects found in PR #13 across 4 review rounds | 13, all one failure shape |
| Defects self-found before review | 1 of 14 |
| Implementation reviews that entered the register | 0 of 6 |
| Required approving reviewers on `main` | 0 |
| GitHub accounts authoring all reviews and comments | 1 |
| Product code shipped | none; every file under `tools/` and `tests/` is governance |

The doctrine is sound and the participants' own debriefs (CORR-027, 028, 029, 030, 031) are
precise about what failed. The failures cluster into five classes, and four of them are the same
root cause: **facts that a system already owns were transcribed by hand into an authored file.**

1. **Number-allocation races.** Numbers are allocated by the operator in chat and transcribed into
   `register/ALLOCATIONS.yaml` on a branch. Three agents drafted against the same next-free number
   within minutes (027/028/029). The canary PR #24 self-numbered a reserved number in the ledger's
   first week. `allocated_by` is free text nothing can validate.
2. **Register version collisions.** Versions were claimed on branches; PRs #11 and #12 both claimed
   `.24`, five debrief PRs all claimed `.27`. The migration (HANDOFF-032) fixed this by assigning
   versions only at finalization against `origin/main`, which now requires a correspondence PR to be
   the very next merge or be unfinalized and redone (observed live 2026-09-24).
3. **Three unlinked truths.** Row status prose, frontmatter `status`, and ledger `state` are each
   hand-written; `register_lint.py` disclaims checking path existence and supersession chains.
4. **Guarantees written as prose the code did not impose.** Every defect in PR #13 was in a
   schema-valid document: nested records with names but no types, `null` bypassing validation, a
   waiver with an empty authority, a self-check whose child suite ran zero tests and passed.
5. **Single-repo hardcoding.** `LEGO-PIPE` is in the schema pattern and two tools; authority and
   Rule 18 are regexes over exact English sentences in `REGISTER.md`; one migration's constants are
   baked into permanent tools. The register claims cluster scope but `play-well-library` has no
   register, no counter, and no branch protection (GitHub Free).

Mechanisms worth keeping verbatim: finalize-at-merge as a pure function of observed `main`;
landing facts derived from first-parent history and never stored; `KNOWN-ANOMALIES.yaml` as
permit-never-launder data; `MetaTest` (every rule id must have a positive and a mutation test);
evidence-method tagging on every claim; the review shape (independent-before-contact, reciprocal
review, one union list with attribution, the single real disagreement sent to the operator as a
ruling with a stated reason).

### What core has, and where it is weak

Core has no correspondence primitive. `grep -ril correspondence` hits one comment in
`decisions/northstar/README.md`. It has eleven ledgers, each with a dep-free `scripts/*-lint.mjs`:
beads (`.handoff/`, adr:session-beads-meta-coordination), Dolt beads, northstar, roadmap,
`status.jsonl`, defects (adr:defect-ledger-and-closure-loop), loops, wayfinder, research,
deviations, tech debt. The bead ledger is the cautionary case: TD-006 records that the closure
loop was declared and never implemented, with 28 open hooks, 9 reports ever, and 32% of beads
non-conformant. `docs/audits/MULTIAGENT-SDLC-AUDIT-2026-07-04.md` names "three identity systems,
no join."

Fleet inventory 2026-09-24: 207 bead files across 14 repos (about 160 unique after worktree
copies of core), of which 85 `brief`, 50 `report`, 11 `discovery`, 3 `decision`, and about 40
that follow no id convention at all. Eight consumer surfaces parse them: `bead-lint.mjs`,
`/resume`, the `/bead` scripts, the vault ingest script, `/speculative-pass`, `/gated-slice`,
`/fleet-onboard`, and the cockpit via Dolt.

Conflicts a fleet-wide layer must rule on: lvp revises memos in place and ADRs bump `rev:`, while
beads are append-only; lvp reserves operator-allocated numbers before drafting, while
adr:stable-identity-and-facet-tags forbids reservations and beads mint timestamps; the word
"handoff" now means the core runbook skill, the bead `brief`, and the lvp `HANDOFF-` work order;
lvp validators are Python with a hand-rolled JSON Schema interpreter in a pnpm fleet.

### Human involvement, sorted

The protocol conflates two kinds of human act. Only one is worth keeping.

| Human act in lvp today | Kind | This ADR |
|---|---|---|
| Allocate a memo number | clerical | machine-minted (D3) |
| Assign a register version | clerical | abolished (D4) |
| Hand-write the register row | clerical | rendered by lint (D4) |
| Transition status text | clerical | derived from events (D5) |
| State a transfer sha256 | clerical | the landing commit is the transfer (D6) |
| Run finalize; peer reruns `--check` | clerical | abolished with versions (D4) |
| Merge to `main` | authority | kept; branch protection is the gate (D7) |
| Rule on a disagreement | authority | kept, and machine-verified (D7) |
| Ratify a protocol change | authority | kept (D7, D11) |

## Decision

**D1. One frontmatter grammar, two strictness tiers.** A speech act is a Markdown file with YAML
frontmatter sharing one base grammar: `id`, `type`, `actor`, `to`, `refs`, `status`, `date`.
Tier 0 is a **note**: what a bead is today (`brief`, `report`, `discovery`, `decision`), a
timestamp-minted id, an optional recipient, never edited after landing. Tier 1 is
**correspondence**: a note plus three required things — an id minted by GitHub (D3), a `to:` that
names an actor other than a future session, and a `type` from the binding set (`work_order`,
`review`, `ruling`, `reply`). Tier 1 is a subtype of tier 0. One parser reads both. There is no
join between tiers; the lint decides the tier from the discriminator, not by lookup.

**D2. The discriminator is the binding test.** An artifact is correspondence if and only if it
names a recipient other than a future session and asks or tells them to do something. This is
lvp's own rule that separates correspondence from research, reused. Promotion is one-way: give a
note an issue and it becomes correspondence, carrying `promoted_from: bead:<id>`. The note is
never edited; the reverse link is derived.

**D3. Identity for tier 1 is minted by GitHub.** A correspondence id is `owner/repo#N`, the
number of an issue created in the memo's repo. Issue creation is atomic, monotonic, and
race-free across any number of agents, which is the property `register/ALLOCATIONS.yaml` tried to
hand-build. Fleet uniqueness comes from the repo prefix; a cluster no longer needs a shared
counter. Type and thread are issue labels. Existing lvp numbers survive as `legacy_id`, never
re-keyed. This is consistent with adr:stable-identity-and-facet-tags: the id is born at one
atomic act, never reserved, never renumbered. The `github:o/r#N` form already appears in bead
`hook:` fields; this makes it mandatory for the binding tier.

**D4. The register is a render, never a source.** A lint reads memo files, first-parent history on
`main`, and the repo's issues and PRs, and renders the register from them. A committed copy is a
cache checked for equality in CI (the lvp kit-mirror pattern). There is no register version
because `main`'s commit SHA already is one; "state the version you read" becomes "state the SHA
you read." Finalization, version records, the pending-notes directory, and peer `--check` are
abolished with it.

**D5. Status is one truth, computed.** `draft` means the file is on a branch; `issued` means it
landed on `main`; `reviewed` means a review artifact pins it; `accepted` means a ruling names it;
`superseded` means a newer memo declares it. The lifecycle enum stays; transitions are computed
from observable events, never typed by hand. Revisions are derived the same way: each landing of
the memo path on `main` is a revision, and the R-number is a count of landings.

**D6. Transfer is a commit.** The only channel that counts is a landing on a branch in the
authority repo; the receipt is the landing SHA. An agent that cannot push hands a branch to one
that can. Paste-is-not-transfer stays as the rule; sha256 bookkeeping in frontmatter goes.

**D7. The retained human acts are verified, not trusted.** A `ruling` memo cites an issue or PR
comment URL; the lint calls the GitHub API and checks the comment exists and its author is the
named operator. Merge authority stays with branch protection. Ratification of protocol changes
stays with the operator of the affected repo.

**D8. Two schemas, deliberately.** The **authored** schema is what an agent may write. The
**derived** schema is what the lint yields after joining to git and GitHub: landing SHA, revision
count, reviewed-head verification, ruling authorship. A field that can be derived is not
permitted in the authored schema, so it cannot be hand-copied wrong. The only stored key that
could be derived is the issue id, because everything else hangs on it.

**D9. Schema as code, one source, three consumers.** The grammar is authored once in TypeScript
(TypeBox or equivalent) in a core package and built into two artifacts: a committed
provider-neutral JSON Schema, and generated TypeScript types as a discriminated union on `type`.
Each speech-act variant declares its own required fields (a `review` must carry a reviewed-state
pin of repo, PR, head, base, tree digest, and merge method, plus an independence declaration; a
`ruling` must carry a comment URL). Skill scripts that write memos are type-checked against the
generated types; the lint and other-provider agents validate against the JSON Schema. The schema
is strict: no additional properties, no hollow nested records, non-empty strings, dates as
patterns. **Type safety is shape safety, not truth**; truth comes from D4, D5, and D7.

**D10. Every enforced rule proves it bites.** The lint carries lvp's `MetaTest` discipline: every
rule id in the lint source must have a named positive test and a mutation test, and the battery
asserts a positive test count so a vacuous run cannot pass. This is the structural answer to
"guarantees written as prose the code did not impose."

**D11. Rollout as control-gated slices, shadow first (adr:control-gated-slices).**

| Slice | Deliverable | Human left in |
|---|---|---|
| S0 | This ADR accepted | ratify |
| S1 | `scripts/correspondence-lint.mjs` in shadow, proven by re-rendering lvp's current register from its files, git, and issues with a zero diff against `REGISTER.md` rows | none |
| S2 | `/correspond` skill (new, land, review, ruling); `git-guard.py` and `verify-outward-writes.py` promoted from user-level hooks into `core/scripts/hooks/` and the catalog; `install-agents.sh` wiring; pilot on core and one active repo | merge |
| S3 | `review` record type live on the pilot repos | merge, rule |
| S4 | CORR memo to lvp proposing cutover with `legacy_id` preserved, under lvp's own ratification rule (CORR-021 §D as amended by CORR-022) | James ratifies |
| S5 | Cross-repo render in the cockpit | none |

Existing beads migrate nowhere: every bead is a tier-0 note on day one, and the roughly 40
non-conforming files are flagged, not broken.

**D12. One convention exception, stated.** Core lints are dep-free ESM. A TypeBox schema cannot be
imported by one. The build step uses the library; the lint consumes the emitted JSON Schema
through a vetted validator taken as the one dependency, rather than a second hand-rolled
interpreter (where several lvp defects lived). This exception is recorded here so it is a
decision and not drift.

## Consequences

### Gains
- Three of five lvp failure classes disappear structurally: allocation races, version collisions,
  and register text contention. The merge-serialization requirement goes with them.
- One lint, one skill, one CI workflow cover both tiers; the bead closure loop (TD-006) is solved
  by derivation from git rather than by a second attempt at hooks.
- Capture stays free: notes need no network, no credentials, no issue. Cowork can still write one.
- Gas Town compatibility holds for notes because the base grammar is unchanged.
- Provider neutrality by construction: the JSON Schema is the exchange format; lvp already has a
  v2 JSON Schema, so S1 is a translation, not an invention.
- The immutability conflict dissolves: a landed revision's bytes are immutable in git; a new
  revision is a new landing. Both the bead rule and the memo rule are satisfied.

### Costs
- Two id schemes coexist permanently (timestamp for notes, `owner/repo#N` for correspondence), and
  the promote-or-not judgment remains with the author. The test in D2 is crisp, but it is a test.
- Minting an issue is an outward write. Cowork cannot do it; it must delegate the mint to an agent
  with credentials, which is one more hand-off in that lane.
- Issues tabs gain records that are not backlog. `/triage` and the cockpit's unassigned queue must
  learn to filter by label.
- A post-merge CI job that commits the rendered register needs a bot token allowed past branch
  protection. On GitHub Free private repos (play-well-library) there is no branch protection to
  pass, and the render is only as trustworthy as the per-clone hook.
- One dependency enters a dep-free convention (D12).
- lvp's Python tooling is not ported; it is retired at S4 by lvp's own decision. Until then two
  systems run side by side in that cluster.

### Neutral
- The `HANDOFF` naming collision in root `CONTEXT.md` is reopened and must be re-resolved:
  `/handoff` (runbook skill) stays; bead `brief` and lvp `HANDOFF-` both map to tier-1
  `work_order` when they bind a recipient, and to tier-0 `brief` otherwise.
- Design packages (cut key, tree digest, drift ledger) are out of scope. They generalize to "any
  hashed deliverable" and only clusters with an external designer need them; a later ADR.
- Attribution stays body-text and commit-trailer based (`Co-Authored-By`) until per-agent GitHub
  identities exist. That is a separate decision.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Port the lvp register and tools to core as-is | Scales the operator bottleneck by the repo count: every number allocated and every landing serialized by a human. Hardcodes one cluster's prefix, sentences, and migration constants. Python in a pnpm fleet. |
| Unify beads and memos into one tier with issue-minted ids for everything | Taxes every discovery note with an outward write; breaks eight consumers and Gas Town compatibility; forces a big-bang migration of ~160 files across 14 repos that TD-006 shows the fleet will not complete. |
| Keep beads and correspondence as two unrelated systems | A fourth identity system with no join. Two lints, two closure loops, and a per-artifact "which ledger" judgment that is exactly where lvp drifted into four finding-id schemes. |
| Operator-allocated numbers fleet-wide, with a shared counter service | Rebuilds what GitHub issue numbers already provide, atomically and per repo, and keeps a human in a clerical loop. |
| Authored register with a stronger finalizer | HANDOFF-032 is the best version of this and it still requires a correspondence PR to be the next merge. Authored facts drift; derived facts cannot. |
| Hand-rolled JSON Schema interpreter to stay dep-free | Where several lvp defects lived (null bypass, `oneOf` semantics, annotation keys the interpreter never read). |

## Open questions for acceptance

1. Which validator dependency (D12), and whether it is vendored or installed.
2. Bot identity for the post-merge render commit, and its handling on repos without branch
   protection.
3. Whether `ruling` requires the operator's comment on the memo's own issue, or any URL the lint
   can verify.
4. Per-agent GitHub identities for attribution (neutral consequence above) — in or out of scope.

## Sources

- lvp `docs/correspondence/`: CORR-LEGO-PIPE-021 (protocol), 027/028/029 (debriefs), 030/031
  (register shape and concurrency), HANDOFF-LEGO-PIPE-032-R1 (migration work order),
  `ARCHITECTURE-correspondence-and-research.md`, `REGISTER.md` rules 1–18.
- lvp `tools/register_finalize.py`, `register_lint.py`, `tests/test_register.py` (`MetaTest`).
- core `TECHDEBT.md` TD-006, TD-008, TD-010/011/012; `docs/audits/MULTIAGENT-SDLC-AUDIT-2026-07-04.md`;
  `.claude/skills/bead/references/bead-schemas.md`; `scripts/record-movement.mjs`.
- Fleet census run 2026-09-24 from `/Users/yuri/ojfbot` (bead counts and consumer surfaces above).

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 83fc432 (empty commit on `adr/correspondence-speech-act-tiers`, base `origin/main` 5b43c97) |
| Inspection commit | n/a (draft ADR, no surface touched) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
| PR number | _pending_ |
| Convoy id | |
