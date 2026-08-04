# ADR-XXXX: The teach corpus is a two-stage artifact sink whose deposit emits evidence and is reconciled

slug: teach-corpus-deposit-architecture
serial: draft
rev:
Date: 2026-08-03
Status: Proposed
domain: observation
type: policy
OKR:
Commands affected: [/teach, /vault, /wayfinder]
Repos affected: [core, selfco]
gate:
baseline:
traces:
  supersedes:
  amends: obsidian-bases-views
  relates-to: [comprehension-heatmap-zpd-role, l1-core-operator-competence-property, wrap-absorb-reject, vault-schema-as-data, selfco-vault-and-skill, wayfinder-decision-maps]
  parent:
  part-of-series:

---

## Context

The teach-in-the-loop map (`decisions/wayfinder/teach-in-the-loop.md`) rules that teaching is a
standing output of fleet work, authored in standalone shadow workspaces and accumulated into a
corpus future sessions draw from. The operator ruled the location architecture in conversation on
2026-08-03 and recorded it on wayfinder ticket #382: **per-repo `git worktree` for authoring,
`~/selfco/teach/` (Obsidian) for the corpus**; a new sibling repo (`ojfbot/teach-corpus`) was
rejected. That ruling settles *where* and leaves *how the corpus actually accumulates* open — which
is the part that decides whether any of it exists in six months.

The precedent cited in support of the location — `/diagram` authors in-session and deposits to
`~/selfco/diagrams/` — was measured on 2026-08-03 and is **the cautionary case, not the
reassuring one**:

| Measurement | Value |
|---|---|
| `/diagram`'s deposit mechanism | prose principle #7 in `.claude/skills/diagram/SKILL.md` — a convention, no hook, no emission |
| Files in `~/selfco/diagrams/` | **2**, both stamped `Aug 3 12:04` (the day the convention was written) |
| Git state of `~/selfco/diagrams/` at the time of the ruling | **untracked** — never committed to the vault repo (*superseded 2026-08-04: a concurrent vault session committed both files in `877e93f`, so this row no longer reproduces. The measurement stands as of the ruling; the argument does not rest on it — see the note below.*) |
| Ledger rows recording a diagram deposit, any file, any event name | **0** |
| `diagrams/` row mirrored into `core/.claude/skills/vault/templates/vault-claude-md.md` per ADR-0088 | **absent** (0 occurrences); the live-vault row is itself an uncommitted edit |

Set against the channels that *do* accumulate, every one of them hook-emitted:

| Ledger | Rows | Emitter |
|---|---|---|
| `skill-dispositions.jsonl` | 540 | hook |
| `skill-authoring.jsonl` | 194 | hook |
| `merge-observations.jsonl` | 90 | `scripts/hooks/merge-quiz.mjs` |
| `deviations.jsonl` | 60 | `scripts/hooks/deviation-log.mjs` (Stop) |
| convention-deposit channels | ~0 | prose |

**Evidence correction, 2026-08-04.** One row above has already decayed: a concurrent vault session
committed both `diagrams/` files (`877e93f`) hours after this decision merged, so "untracked" is no
longer true. The load-bearing measurement is unaffected — **zero ledger rows record a diagram
deposit**, then and now — and that is the row the argument rests on. Recording the decay rather than
quietly editing it: a decision whose cited evidence silently stops reproducing is how a ruling turns
into folklore, and this one is specifically about mechanisms that fail without anyone noticing.

This is the TD-006 shape exactly. `hook-bead-session` was *declared* and never implemented; the
result was 28 open hooks against 9 reports ever, and nothing in the system noticed, because nothing
was watching for the absence. A worktree is disposable **by definition** — if the deposit does not
fire, the lesson dies with the worktree and the corpus never accumulates. The failure is silent and
total, and a convention is not a mechanism.

ADR-0088 exists specifically to stop folder-role additions from being dropped by a future
`/vault init`, and the most recent folder-role addition was dropped anyway, the same day, in the
same table this decision must edit. ADR-0105 does not cover the gap: `schema.yaml` declares *page
types* inside `wiki/`, not top-level sink folders, so folder roles remain two prose copies kept in
step by discipline — the arrangement ADR-0105 measured as failing 6 of 9 facts.

Resolved via `/grill-with-docs` in a wayfinder work session; the four load-bearing calls below are
operator rulings, taken against the measurements above.

## Decision

**R1 — Two stages, one sink. `~/selfco/teach/` is an artifact sink, not a work-item surface
(the explicit D6 answer).**

Authoring happens in a per-repo `git worktree` — transient, sitting next to the code and the diffs
the lesson cites. The corpus lives at `~/selfco/teach/`, outside `wiki/` alongside `bases/`,
`canvas/`, and `diagrams/`, so the `wiki/`-scoped lint invariant is structurally untouched.

ADR-0097 row D6 rejected `.scratch/<feature>/issues/NN-slug.md` because a fourth **work-item**
surface fragments provenance: ojfbot has three sanctioned ones (`.handoff/` beads,
`decisions/northstar/` roadmaps, GitHub issues) and a work item must be findable in exactly one.
The operative test is whether the surface answers *"what should I do next?"* and carries claim,
assignment, and closure state. `~/selfco/teach/` carries none of them — nothing in it is ever open,
nothing is assigned, nothing closes. It is read-only input to lesson placement, the same standing
`~/selfco/diagrams/` has as read-only input to comprehension. Work items *about* teaching keep
living where they already do: wayfinder tickets on this map for the questions, roadmap slices for
the builds. D6 is respected because the corpus never holds a work item to fragment.

**R2 — The deposit is a skill step that emits evidence, plus a reconciler that flags its absence.**

`/teach`'s deposit step performs two acts that ship together: it writes the workspace's durable
artifacts into `~/selfco/teach/<topic-slug>/`, **and** it appends a `harness:lesson-deposited` row
to `~/selfco/tracking/teach-sessions.jsonl`. A deposit that does not emit did not happen; the row is
the deposit's evidence, not its log.

Emission alone is insufficient — it makes a *performed* deposit visible while leaving a *skipped*
one invisible, which is precisely how TD-006 went unnoticed for 96 days. So a reconciler
(`scripts/hooks/reconcile-teach-deposits.mjs`, following the shape of the existing
`reconcile-tracking.mjs` and `reconcile-skill-acted.mjs`) compares pushed `teach/*` branches against
deposit rows and reports orphans — authoring that produced no corpus entry. **Shadow first**, per
`adr:control-gated-slices`: it reports and never blocks, and promotion to a gate happens on
evidence.

Rejected: a SessionEnd hook as the sole mechanism. SessionEnd hooks are opt-in per repo
(`vault-session.sh` is not installed by default), so coverage becomes a config question across 43
repos, and a worktree torn down mid-session is missed entirely. Rejected: emission without
reconciliation — the TD-006 failure mode is the *unwatched absence*, and only the reconciler
addresses it.

**R3 — The authoring branch is pushed and never merged.**

Same disposition as `wayfinder/386-html-lesson-spike`, which this map already cites as a primary
source. The standing out-of-scope ruling ("lessons committed inside working trees") holds because
the branch never merges; working trees stay clean. What this buys is that **the deposit stops being
a single point of failure**: authoring context survives worktree teardown, so a missed deposit is
recoverable from the branch instead of fatal. Under R2's reconciler the pushed branch is also the
detector's left-hand side — it is what makes an orphan observable at all.

Rejected: pure scratch, never pushed. Coherent, and it was the brief's framing, but it makes every
miss unrecoverable at exactly the moment R2 is adding machinery to catch misses.

**R4 — Learning records land at `~/selfco/teach/<topic-slug>/learning-records/`, as files.**

This closes the #382↔#384 seam that D21 opened (format absorbed; location → #382; sensor → #384).
#384's R4 ruled files canonical with a ledger event as the machine index, and explicitly left the
file location here. Records travel with the lesson corpus as one artifact: ADR-style markdown per
D21, Obsidian-readable, supersession over deletion. The "same signal, two shapes" mismatch is
resolved **by role, not by duplication** — the files are the record, the ledger event is the index,
and the sensor reads the index. Nothing is written twice and nothing is authoritative in two places.

Two distinct events, and the boundary is deliberate:

| Event | Ledger | Owner | Means |
|---|---|---|---|
| `harness:lesson-deposited` | `~/selfco/tracking/teach-sessions.jsonl` | **this decision** | the corpus accumulated |
| `harness:lesson-served` | the ledger #384's sensor reads | **#384 R4** | a served lesson is attributable to a cell |

Depositing is not serving. Collapsing them would let corpus growth masquerade as teaching delivered,
which is the kind of confound #384's R2 was written to keep out of P5.

Rejected: records as first-class `wiki/` pages — it puts LLM-owned learning state inside the linted
corpus and needs a new page type in `schema.yaml`, a larger change than this ticket scoped.
Rejected: ledger-only records — contradicts #384's R4 and D21's record format outright.

**R5 — The read path is `~/selfco/teach/index.md`, appended by the same step that emits.**

Obsidian renders Mermaid fences natively but **will not render a standalone `.html` as a page** — a
deposited lesson is an attachment opened in a browser. A markdown index is therefore what makes the
corpus browsable in-app, mirroring the `wiki/index.md` hub pattern the vault already runs on.

The index entry is appended by the deposit step that emits the ledger row, deliberately: index
freshness then rides the *same* evidence the R2 reconciler already checks, so there is one mechanism
to keep honest instead of two drifting apart. Rejected for now: a `bases/teach.base` view (renders
only in recent Obsidian, unverifiable headlessly per ADR-0088's recorded cost) and a regenerated
ledger-derived index (builds the regenerator before the first deposit exists).

**R6 — Naming and session binding.** *Derived from `adr:adr-slug-identity` and the bead frontmatter
vocabulary rather than separately grilled — correct in a follow-up if wrong.*

The corpus is keyed by **topic slug**, not by date or serial: `~/selfco/teach/<topic-slug>/`.
Successive lessons on one topic accumulate in one folder, which is what D21's
supersession-over-deletion requires and what ADR-0087's slug-as-identity already rules for records
generally. Lessons are numbered within the folder (`0001-<slug>.html`, D23); records mirror that
(`learning-records/0001-<slug>.md`, D21). Session binding is a workspace manifest carrying
`session_id`, the originating bead id, repo, base SHA, and issue refs — the same `refs:` vocabulary
beads already use — and the pushed `teach/<topic-slug>` branch from R3 binds the authoring context
itself.

**R7 — The `teach/` folder role is declared in both copies now, and the dropped `diagrams/` row is
repaired in the same edit.**

The row lands in `~/selfco/CLAUDE.md` **and** in
`core/.claude/skills/vault/templates/vault-claude-md.md` in one change, per ADR-0088's mirroring
obligation. The missing `diagrams/` row is restored to the template in the same edit — it is a
one-line repair of a known silent-loss vector in the exact table being edited, and deferring it
would reproduce, for a third time, the failure this decision is about.

## Consequences

### Gains
- The corpus has a mechanism instead of an intention, and the mechanism has a watcher. The measured
  difference between hook-emitted and convention-deposited channels in this fleet is roughly two
  orders of magnitude.
- A missed deposit is now both **detectable** (R2 reconciler) and **recoverable** (R3 pushed branch)
  — the two properties the `/diagram` precedent has neither of.
- The #382↔#384 seam closes without duplication: one artifact, files canonical, ledger as index.
- D6 is answered by a stated test (claim/assignment/closure state) rather than by analogy, so the
  next sink proposal can be judged against it.
- ADR-0088's obligation is discharged for two rows at once, and the failure that motivated this
  paragraph is on the record with measurements rather than as a caution.

### Costs
- Three artifacts must ship before the corpus can accumulate: the deposit step, the reconciler, and
  the `teach-sessions.jsonl` schema. Until they exist this decision constrains a mechanism that does
  not yet run, and the corpus is empty by construction — the ruling must not be read as capability.
- Pushed-never-merged `teach/*` branches accumulate on remotes across repos; nothing here prunes
  them, and a retention rule is not yet written.
- The topic-slug key assumes topics are stable enough to be identity. A renamed topic orphans a
  folder, and supersession-over-deletion means the corpus only grows.

### Neutral
- Folder roles remain prose in two places. This decision mirrors them correctly and repairs one
  drop; it does **not** fix the underlying arrangement that ADR-0105 identified, which would mean
  extending `schema.yaml` past page types to sink folders.
- The reconciler is shadow-only. Whether it ever gates is a later evidence-gated call.

## Alternatives considered

- **SessionEnd hook as the sole deposit mechanism** — rejected under R2. Fires without agent
  cooperation, which is genuinely attractive, but per-repo opt-in makes coverage a config question
  across 43 repos and mid-session teardown is missed. Available later as a *belt* over R2's braces
  if the reconciler's orphan rate justifies it.
- **A sibling repo `ojfbot/teach-corpus`** — rejected by the operator before this ticket opened.
  Records here so the rejection survives: it would have made the corpus a fourth surface with its
  own issues and PRs, which is the D6 objection with more machinery.
- **Emission without reconciliation** — the shape TD-006 actually shipped. Rejected on its measured
  outcome.
- **Deferring the vault schema rows to "the slice that builds it"** — rejected under R7 on the
  evidence that the identical deferral dropped the `diagrams/` row within one day of it being
  written.
