---
name: resume
description: "MANDATORY: Load this skill IMMEDIATELY when picking up prior work and you need to know what actually shipped — triggers include \"resume\", \"pick up the session\", \"pick up where we left off\", \"what did the last session actually do\", \"what's the real state here\", \"verify what shipped\", \"reconstruct session state\", \"/resume\", \"/resume --verify\". The hardened, evidence-tiered alternative to /bead orient: instead of narrating from unverified markdown beads (which lets an agent confabulate completed work), it reconstructs a provenance ledger from four tiers — [git] and [PR] (ground truth), [DOLT] and [READ] beads (self-report) — and tags every claim VERIFIED / UNVERIFIED / CONFLICT / GAP / GROUND-TRUTH so you can only act on what is corroborated. Runs a preflight that STOPs on untrustworthy ground (uncommitted tracked edits, prunable worktrees). --verify backfills git-grounded report beads for work that shipped with no self-report. Read-only by default. Distinct from /bead (writes handoffs) and /handoff (post-ship runbooks)."
---

# /resume — evidence-tiered session pickup (kills confabulation)

When you pick up prior work, the failure mode this skill exists to prevent is **confabulation**: narrating what a previous session "finished" from unverified markdown, or from your own priors, when git and the PRs say something different. `/resume` replaces "narrate from memory/markdown" with "read a git-grounded verdict table behind a preflight that refuses bad ground."

It is the hardened sibling of `/bead orient`. Use `/bead orient` for a cheap, markdown-only glance at the `.handoff/` ledger. Use `/resume` when correctness matters — before building on prior work, after an interruption, or whenever you're about to assert "X is done."

## The core rule

> **A self-report is never fact on its own.** Only claims corroborated by ground truth ([git]/[PR]) may be stated as done. Everything else is "unverified" — and CONFLICT / GAP rows MUST be surfaced to the user, never glossed.

The four evidence tiers, highest trust first:

| Tier | Source | Trust |
|------|--------|-------|
| **[git]** | commits, branches, working tree | GROUND TRUTH (local) |
| **[PR]** | `gh pr list` / view | GROUND TRUTH (remote) |
| **[DOLT]** | the bead store (sessions/convoys) | self-report (best-effort) |
| **[READ]** | `.handoff/` markdown beads | self-report (lowest) |

The two bead worlds (markdown `.handoff/` and the Dolt store) share **no join key** — markdown `session_id` is an ISO timestamp, Dolt `session_id` is a Claude `$SESSION_ID` UUID. They are correlated **only by commit-SHA + repo + time-window**, never by id. Do not assume an id-join.

## Procedure (pickup)

1. **Preflight — STOP on bad ground.** Run:
   ```
   bash <skill>/scripts/verify-session-state.sh --repo <repo>
   ```
   It fails (exit 1) on uncommitted tracked edits or prunable/stale worktrees, and warns on untracked files / Dolt down / a conflicting live session. **If it STOPs, surface the failures and resolve them (commit/stash, `git worktree prune`) before acting.** You may still run step 2 read-only to see the state, but do not *act* on a repo that failed preflight without the user's acknowledgement. Override knobs: `--allow-dirty` (dirty → warning), `--strict` (untracked → failure).

2. **Reconstruct the ledger.** Run:
   ```
   node <skill>/scripts/reconstruct-state.mjs --repo <repo> --days 14
   ```
   This prints the tier availability and the **claim ledger** — every claim tagged with a verdict and its evidence source. Add `--json` for machine output, `--session <id>` to focus.

3. **Read the ledger out loud to yourself before saying anything to the user:**
   - **VERIFIED / GROUND-TRUTH** → safe to treat as done / present.
   - **UNVERIFIED** → a bead claims it but nothing corroborates it. Say "unverified" explicitly; do not upgrade it.
   - **CONFLICT** → a claim contradicted by ground truth (e.g. a bead implies merged but the PR is open / missing; an unparseable bead). **Surface it.**
   - **GAP** → in-flight ground-truth work (open PR, unmerged branch) that no bead documents. **Surface it** — it's likely what to pick up, and it's invisible to a markdown-only orient.

4. **Orient the user** from the ledger, not from prose impressions. Lead with CONFLICT and GAP rows. Then proceed.

## Procedure (--verify backfill)

At a session/slice close-out, reconstruct what actually shipped and backfill the record for any work that has **no self-report** — the ojfbot analog of TeamBot's integration agent backfilling from git:

```
node <skill>/scripts/verify-session.mjs --repo <repo> --days 14            # SHADOW (dry-run)
node <skill>/scripts/verify-session.mjs --repo <repo> --days 14 --write    # create the beads
```

- It finds **merged PRs in the window that no `.handoff/` bead references** and proposes a `report` bead per PR, reconstructed from [PR]/[git] ground truth and tagged `(backfilled by integration)` — a visible signal that the session-close discipline was skipped.
- It **defaults to shadow** (prints, writes nothing) because writing is an action-taking control (ADR-0086 shadow-first). Add `--write` only when you intend to create the append-only beads.
- It is **append-only**: never overwrites an existing bead, never overwrites a verified self-report. CONFLICT rows are surfaced, never auto-resolved.

## Files in this skill

- `scripts/verify-session-state.sh` — preflight; STOP on untrustworthy ground.
- `scripts/reconstruct-state.mjs` — assemble the four-tier provenance ledger (read-only).
- `scripts/verify-session.mjs` — git-backfill verify pass (shadow by default; `--write` to act).
- The [READ] tier reuses `../bead/scripts/normalize.py` — the schema-drift shim that canonicalizes `.handoff/` beads on read (so reconstruction is reliable despite real-world drift).

## What this skill is NOT

- Not a writer of handoffs — that's `/bead`. The only thing `/resume` ever writes is a *backfilled* report under `--verify --write`, and only for work git proves shipped.
- Not a runbook generator — that's `/handoff`.
- Not a Dolt requirement. [git]/[PR]/[READ] work in any repo with no workspace build; [DOLT] corroborates when a Dolt server is reachable, and degrades to an explicit "unavailable" note otherwise — never a crash, never a silent omission.

## Dependencies

`git` and `gh` (ground-truth tiers); a Python 3 with PyYAML for the [READ] tier (the bead scripts already ship this way); `node` for the `.mjs` scripts. The [DOLT] tier additionally needs `mysql2` + a running Dolt on `:3307` (best-effort).
