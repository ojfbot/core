---
id: 20260803-1200-brief-untracked-bead-ledger-vantage-gap
type: brief
title: "11 untracked beads make bead-lint's local and CI measurements disagree — resolve before S33's promotion RIDM"
actor: code-claude
to: code-claude
session_id: newline-curriculum-ingestion-2026-08-03c
refs:
  - bead:20260803-1130-report-newline-sitting6-u14-m2m3m13-u1m6-u8
  - commit:core@0ce9bd2
  - commit:core@be2da2c
  - path:core/scripts/bead-lint.mjs
  - path:core/.github/workflows/bead-lint.yml
  - path:core/decisions/northstar/roadmap-l2-ojfbot.md
hook: "rm:rm-l2-ojfbot#S33"
status: live
created_at: 2026-08-03T12:00:00-0500
labels:
  project: bead-queue-wiring
---

## The finding

`scripts/bead-lint.mjs` (landed `0ce9bd2`, S32) enumerates `.handoff/` by **reading the
filesystem**, not by asking git. `core/.handoff/` currently holds **28 tracked + 11
untracked** bead files. So the same command reports two different worlds:

| Vantage | What it sees | Reports |
|---|---|---|
| This checkout, locally | 28 tracked + 11 untracked | **87 beads · 40 open hooks · 32 schema errors** |
| CI (`bead-lint.yml`, fresh `actions/checkout`) | tracked only | a strictly smaller, unknown number |

That matters because **S33's success criterion and its check command sit on opposite sides
of the split.** S33 (`claimable_by: human_only`, entrance now MET) promotes bead-lint from
shadow to enforcing, and its `check:` is
`node scripts/bead-lint.mjs --check --max-open-hook-age-days=30` — which runs in CI. Its
success clause is "the fleet clean **at promotion time**." A human truth-pass done in a
local checkout would be validating against 87 beads; the gate it promotes would be
enforcing against ~76. Promote on the local number and CI silently enforces a different
baseline than the one that was verified.

The script already documents vantage scoping for *repos* it can't reach ("downgrade to
WARN — the gate never fails a PR over a checkout it cannot see"). It has no equivalent
concept for **files present on disk but absent from git**, which are invisible in exactly
the opposite direction: they inflate the local count and vanish in CI.

## Second finding — `responding_to` is empty on every one of the 11

The open-hook formula (replicating `orient.py`) is: *a brief is an open hook iff
`status: live` AND no report in the same repo names it in `responding_to`.*

Every one of the 11 untracked beads has **no `responding_to` field at all** — including the
four reports. Three of the untracked briefs are `status: live` with
`hook: github:ojfbot/core#319`, and their work demonstrably shipped (the corresponding
sitting reports exist, tracked, in the same directory).

So tracking these files alone **does not retire a single hook**. It would move them from
invisible-to-CI to visible-and-open, i.e. it would *raise* the enforced open-hook count.
The tracking gap and the schema gap have to be fixed together or the first one makes the
number worse.

## Third finding — I shipped a schema error this session, and I'm not the first

`bead-lint` flags two beads for `status: 'done' not in live|closed|superseded`:

- `20260803-1130-report-newline-sitting6-u14-m2m3m13-u1m6-u8.md` — **mine, this session, already committed in `3bec213`**
- `20260803-0015-report-newline-vault-backfill-u14mp-u6-u11.md` — untracked, prior sitting

`done` is not a valid status. Both should be `closed`. Per the bead protocol corrections
are new beads, not edits — but a *frontmatter schema fix* on a bead whose prose is
unchanged is a conformance repair, not a claim revision. **Decide which it is before
touching them**; the append-only rule exists to protect the ledger's auditability, and a
silent `sed` across 32 schema errors is precisely the move that would break it.

## What to do

**Do not start by committing the 11.** The first question is the operator's, not yours.

1. **Get the ruling.** Three options, and they are genuinely different:
   - *Track them* — the ledger becomes honest, CI and local agree, open-hook count rises,
     and S33's baseline moves before the human pass.
   - *Leave them untracked* — accept that `.handoff/` is partly a local scratch space, and
     then **fix the script** so local and CI agree (e.g. enumerate via `git ls-files` and
     WARN on untracked-but-present, mirroring the vantage treatment).
   - *Triage individually* — some are genuinely session-local scratch and should be deleted;
     others are real ledger entries. This is the most work and the most correct.
2. **Measure both vantages before deciding anything.** Get the CI-side number honestly:
   `git stash -u` is *not* safe here (concurrent agents). Instead clone to a temp dir and
   run the lint there — `git clone ~/ojfbot/core /tmp/... && node scripts/bead-lint.mjs`.
   The delta between that and the local 87/40 is the actual size of this problem, and it
   belongs in S33's report bead as a finding.
3. **Fix `responding_to` before or with tracking**, or the count goes the wrong way. Each
   of the three live `#319` briefs has a shipped report; wire them.
4. **Then, and only then,** consider whether this is an S33 sub-task or its own slice.

## Gotchas

- **`HOOK_CONVENTION_START = 2026-08-02`.** Briefs before that date are explicitly "S33
  backfill territory, not lint noise" per the script's own comment. Four of the 11
  (2026-07-29, ×3 2026-07-30) are pre-convention; seven are post. Don't treat them alike.
- **Concurrent agents are live in this repo right now.** During the session that wrote this
  brief, another agent committed and merged in core inside a 90-second window
  (`c783363` → `be2da2c`), and `CLAUDE.md` changed under me. Re-verify branch and tree state
  immediately before any git operation; never `stash -u` or `checkout --` a shared tree.
- **`core` is `ahead 5, behind 0` and unpushed** as of this bead. `main` is **not**
  branch-protected (verified: `gh api .../protection` returns 404) — a prior claim in this
  thread that it was push-protected was wrong. Convention may still say PR-only; confirm.
- **bead-lint is PROPOSAL-ONLY by design** — "closing a bead is a truth claim about whether
  work shipped, and that claim stays with a human." There is no `--apply`. Don't build one.
- The four untracked golf/OPM beads reference `github:ojfbot/core#297` and
  `github:ojfbot/mirrorworld#11`; `--sweep` can probe those for shipping evidence. Use it —
  it exists precisely for this and writes nothing.

## Suggested skills

`/resume --verify` on core first (it backfills git-grounded report beads for work that
shipped with no self-report — S33's deliverable names it as the mechanism, "no new
machinery"). Then `node scripts/bead-lint.mjs --sweep` for the proposal table. `/bead` to
file the outcome.
