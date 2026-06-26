# ADR: Session-provenance hardening — evidence-tiered pickup over a no-join-key bead reconciliation
slug: session-provenance-hardening
serial: draft
rev:
Date: 2026-06-25
Status: Proposed
domain: observation
type: convention
OKR: 2026-Q2 / O-legibility / KR-provenance
Commands affected: /resume (new), /bead (orient stays the cheap path), /orchestrate (future: --verify finalize gate)
Repos affected: core (.claude/skills/resume, .claude/skills/bead/scripts/normalize.py, skill-catalog); all repos with a .handoff/ via the skill
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [framebead-work-primitive, dolt-bead-store, session-beads-meta-coordination, control-gated-slices]
  parent:
  part-of-series:

---

## Context

When a session picks up prior work, the agent routinely **confabulates** what earlier sessions
"finished" — narrating from unverified `.handoff/` markdown, or from its own priors, when git and
the PRs say otherwise. This is the single most-cited failure of the current handoff loop. The
substrate that should prevent it is fragmented:

- Two bead worlds with **no shared join key.** Markdown `.handoff/` beads carry a `session_id` that is
  an ISO timestamp (minted by `bead/scripts/write.py`); the Dolt store (ADR-`dolt-bead-store`,
  `session-beads-meta-coordination`) carries a `session_id` that is the Claude Code `$SESSION_ID`
  UUID. The two cannot be correlated by id at all.
- **Schema drift** in the markdown ledger: `status: open` outside the documented enum, `date:` instead
  of `created_at:`, missing timestamps, `actor:` parentheticals, `hooks:` (prose list) vs `hook:` (a
  single id), and three filename styles — verified across the real `core/.handoff/` corpus. A
  programmatic reader that trusts the idealized schema mis-parses real beads.
- **No tier of trust.** `/bead orient` reads markdown as if it were authoritative. Nothing consults the
  one thing that is ground truth — git, the PRs, CI.

`/frame-standup` already embodies the cure in miniature (Step 3 audits the daily-logger's claims
against git before planning). This ADR generalizes that "audit before you believe" instinct into the
session-pickup path itself.

## Decision

Introduce **`/resume`**, a hardened, read-only, evidence-tiered pickup that reconstructs a *provenance
ledger* instead of narrating prose. Four primitives:

1. **Evidence tiers, ranked by trust.** `[git]` and `[PR]` are GROUND TRUTH; `[DOLT]` and `[READ]`
   markdown beads are SELF-REPORT. Every claim is tagged with a verdict —
   `VERIFIED | UNVERIFIED | CONFLICT | GAP | GROUND-TRUTH` — and its evidence source. The binding rule:
   **a self-report is never fact on its own; only [git]/[PR]-corroborated claims may be stated as done;
   CONFLICT and GAP rows must be surfaced.**
2. **Correlation by commit-SHA + repo + time-window, never by id.** Because the two bead worlds share no
   join key, the reconciliation is evidential: a bead is VERIFIED when a referenced PR is merged or a
   commit falls within a ±36h window of it; CONFLICT when a "done" claim has no merged PR; GAP when
   ground-truth work has no bead.
3. **Normalize-on-read, never rewrite.** `bead/scripts/normalize.py` canonicalizes drift as beads are
   read (the `.handoff/` ledger is append-only, ADR-`framebead-work-primitive`); anything unparseable
   becomes a visible DRIFT row, never a silent drop.
4. **Preflight that STOPs on bad ground**, and a **git-backfill verify pass** (`/resume --verify`) that,
   for merged work with no self-report, writes a `report` bead tagged `(backfilled by integration)` — a
   visible signal that session-close discipline was skipped. The backfill is an action-taking control, so
   it ships **shadow-first** (dry-run default; `--write` to act), per ADR-`control-gated-slices`.

The canonical source of truth is git/PR (and, when reachable, the Dolt event spine); markdown beads are a
durable, human-facing *view* whose drift is absorbed on read.

## Consequences

### Gains
- An agent picking up work reads a git-grounded verdict table, not impressions — confabulated
  completion becomes structurally hard rather than merely discouraged.
- Works in any repo immediately: `[git]/[PR]/[READ]` need only `git`, `gh`, and a Python with PyYAML —
  no workspace build, no running Dolt. `[DOLT]` corroborates when present and degrades to an explicit
  "unavailable" note otherwise.
- The two bead worlds are reconciled without a migration: they are joined evidentially at read time, not
  unified in storage.
- `normalize.py` makes every existing `.handoff/` consumer (`orient.py`, `replay.py`) drift-proof.

### Costs
- Correlation is heuristic (a ±36h window, PR-ref matching) — it can mislabel a VERIFIED as UNVERIFIED
  when a bead omits a PR ref and the commit is outside the window. Verdicts are deliberately conservative
  (default to UNVERIFIED/surface rather than asserting done), trading false-negatives for safety.
- `[PR]` depends on `gh` auth and a GitHub remote; `[DOLT]` on `mysql2` + a live Dolt. Both degrade
  rather than fail, but a fully-offline repo runs on `[git]/[READ]` only.
- A second skill at the session boundary (`/resume` alongside `/bead`); the README must keep the
  cheap-glance vs hardened-pickup distinction clear.

### Neutral
- `/resume` is scoped `["user"]` in the catalog (paired with `/bead`); activation requires
  `install-agents.sh --user-scope` to create the symlink.
- The `--verify` backfill is the seed of an `/orchestrate` finalize gate (promote shadow→gate later, a
  data-gated RIDM decision per ADR-`control-gated-slices`).
