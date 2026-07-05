# Roadmap schema — v1.1

The canonical, versioned schema for **roadmaps**: the delivery artifact that sits under a northstar.
`roadmap-template.md` is the copy-me starting point, the `roadmaps:` list in `README.md` frontmatter
is the registry, and `scripts/roadmap-lint.mjs` is the executable enforcement. Governing decision:
`decisions/adr/draft-roadmap-under-northstar.md`.

> **Why this exists.** A northstar is a compass — it names properties and an honest current %.
> It deliberately says nothing about *how* the gap closes. The roadmap is that missing middle:
> it decomposes a property gap (`current → target`) into ordered **phases** of dispatchable
> **slices**, each sized to exactly one agentic session, each leaving the app in a measurably
> different state. The northstar answers "toward what"; the roadmap answers "by what sequence
> of deliveries"; the dispatch queue (compiled beads) answers "what can run today".

## What a roadmap is

A northstar's **route plan**: for one northstar, an ordered set of phases, each containing slices.
A **slice** is the atomic delivery unit — one agentic session's worth of work that produces a named
artifact, advances exactly one northstar property by an expected amount, and passes an explicit gate.
Slices are **compiled** into `queue=available` beads (the dispatch projection) by
`scripts/roadmap-compile.mjs`; they are claimed and run by the day-runner or a human. The file is
canonical; the beads are a projection — the compiler reconciles, humans edit files.

## File location

| Roadmap for | Lives at |
|-------------|----------|
| an L1 app northstar | `<app>/.claude/roadmap.md` (beside `northstar.md`) |
| an L2/L3 northstar | `core/decisions/northstar/roadmap-<northstar-slug>.md` |

One roadmap per northstar (v1). A northstar without a roadmap is fine — it means no decomposed
delivery plan yet, and lint stays silent about it.

## File fields

The frontmatter is the same constrained, no-YAML-lib-parseable shape as northstars: top-level
scalars plus flat lists of maps (`phases:`, `slices:`). **No nesting** — a slice references its
phase by id rather than sitting inside it; ranges are flattened to scalar pairs.

### Frontmatter (top-level scalars)

| Field | Req? | Type / values | Rule |
|-------|------|---------------|------|
| `type` | required | `roadmap` | literal discriminator |
| `slug` | required | kebab-case | **immutable identity** (ADR-0087). Convention: `rm-<northstar-slug>`. A shipped slug is identity — never renamed. |
| `northstar` | required | northstar slug | the compass this roadmap closes gaps against; must exist in the northstar registry |
| `status` | required | `active` \| `paused` \| `done` | — |
| `phases` | required | list of phase maps (≥1) | see below |
| `slices` | required | list of slice maps (≥1) | see below |

### Per-phase fields

| Field | Req? | Type / values | Rule |
|-------|------|---------------|------|
| `id` | required | `PH1`…`PHn` | stable; assigned once, never reused |
| `name` | required | string | what this phase delivers as a whole |
| `goal` | optional | string | the observable end-state of the phase |

### Per-slice fields

| Field | Req? | Type / values | Rule |
|-------|------|---------------|------|
| `id` | required | `S1`…`Sn` | stable; **assigned once, never reused** even if a slice is dropped. Ref form: `rm:<slug>#S<n>` |
| `phase` | required | a `PH<n>` id | must resolve to an entry in `phases` |
| `title` | required | string | imperative, one session's scope |
| `advances` | required | typed ref `ns:<slug>#P<n>` | **resolve-or-fail**, and must point into the roadmap's declared `northstar` (the parent-containment analog) |
| `moves_from` | required | integer 0–100 | the property % this slice starts from (flattened `expected_movement.from`) |
| `moves_to` | required | integer 0–100 | the property % this slice should leave behind; must be ≥ `moves_from` |
| `deliverable` | required | string | the named artifact a reviewer can point at (PR, recording, file, endpoint) |
| `entrance` | required | string | what must be true before dispatch (prose; asserted by the human/standup that flips `status: ready`) |
| `success` | required | string | what the gate checks at the slice boundary — concrete enough to verify on the PR |
| `check` | optional | string (shell command) | **v1.1 (S15, verifiability-sorted dispatch).** A machine-runnable success command, executed from the worktree root by the day-runner's S14 shadow verification stage and recorded on the `pr-created` bead + PR body. Its *presence* is the `autonomy_fit` signal: the compiler queues a slice as agent-claimable only when `check:` exists — `agent_eligible`/`either` slices without one are **demoted to `human_only` at compile time** (logged, never silent). Rationale: unattended autonomy only works against an objective, machine-evaluable criterion; a slice that can't state one belongs with the human. |
| `autonomy` | required | `gate-0` \| `gate-1` \| `gate-2` | the **merge gate** (ADR: progressive-autonomy-gates). gate-0 = human merges; gate-1 = auto-merge on green gates for low-risk classes (data-gated promotion); gate-2 = eval-gated code auto-merge (aspirational). Compiled into the bead as `autonomy_gate` — distinct from the queue label `autonomy` (claim eligibility). |
| `claimable_by` | optional | `human_only` \| `agent_eligible` \| `either` | who may claim the compiled bead (the queue-contract `autonomy` label). Default `either`. |
| `kind` | optional | `s` \| `m` \| `l` | queue TTL class (ADR-0002). Default `m`. |
| `repo` | optional | repo name | where the slice's work lands. Defaults to the northstar's `app` (L1) — override when the delivery for this app's property lives in another repo (e.g. a producer-side fix in `core`). |
| `status` | required | `queued` \| `ready` \| `dispatched` \| `delivered` \| `merged` \| `dropped` | delivery lifecycle, see below |
| `depends_on` | optional | typed ref `rm:<slug>#S<n>` | a slice (same or another roadmap) that must be `merged` first. **Resolve-or-fail.** Pairwise only; no transitivity (same v1 posture as northstar `depends_on`). |

### Body (markdown, after frontmatter)

`# Roadmap — <northstar name>`, a short **`**Route.**`** paragraph, then one `## PH<n> — <name>`
section per phase with a prose account of the slices and why they're ordered this way.

## Slice lifecycle

```
queued ──(human/standup asserts entrance)──▶ ready ──(compiler posts bead; runner/human claims)──▶ dispatched
   ──(PR opened + evidence + report bead)──▶ delivered ──(PR merged + movement recorded)──▶ merged
                                                                    └──▶ dropped (any time; id retired, never reused)
```

- **`queued → ready` is a human judgment** — the entrance criterion is prose, so a person (usually
  during `/frame-standup`) flips it, not a script.
- **The compiler only compiles `ready` slices** whose `depends_on` (if any) is `merged`.
- **`dispatched`/`delivered`/`merged` are observable states** — claim lease on the bead, PR opened,
  PR merged + `status.jsonl` movement line. The file's `status:` field mirrors them; when file and
  observed state disagree, lint reports the drift (shadow) and the file is corrected by hand or by
  `roadmap-compile.mjs --reconcile` output.

## Movement contract (anti-confabulation)

A slice's session **proposes** movement (`ns:<slug>#Pn moves_from → moves_to` + evidence, in the PR
body and report bead). Movement is **recorded** — a `status.jsonl` append via
`scripts/record-movement.mjs` — only at **merge**, by the merging human (or, at gate-1+, by the
promotion-approved gate). A session never writes `status.jsonl`. This is the OPAV / provenance
discipline applied to the vision layer: the odometer turns on merged evidence, not self-report.

## Registry

The authoritative list lives beside the northstar registry, in `README.md` frontmatter under
`roadmaps:` — one entry `{slug, northstar, path}` per roadmap. Same path-resolution rules
(core-root-relative, `~`, absolute).

## Verification

`cd core && node scripts/roadmap-lint.mjs` — ERRORs (registry/file mismatch, unknown northstar,
broken `advances`/`depends_on`/`phase` refs, malformed slice, movement range invalid, duplicate ids)
must be 0; WARNs (moves_from drift vs the property's live `current`, file-status vs bead-state
drift) are shadow signals. Ships **shadow-only** (ADR-0089 discipline); `--check` is the future CI
gate.

## Versioning & evolution

Same regime as `schema.md`: this doc carries a version (**v1.1** — v1.1 adds the optional
`check:` field + compile-time autonomy demotion, 2026-07-05/S15); the schema sharpens through use.
Additive optional fields are the default change; `slug` and `S<n>`/`PH<n>` ids are immutable; never
repurpose a field. `roadmap-template.md` and `roadmap-lint.mjs` move in lockstep — a field is only
"real" once lint enforces it or explicitly defers it as shadow.
