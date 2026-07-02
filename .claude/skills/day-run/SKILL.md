# /day-run — dispatch the day's roadmap slices to unattended sessions

Run the Gate-0 delivery loop: compile ready roadmap slices onto the dispatch queue, then let
the day-runner claim and execute them in isolated worktrees, leaving branch+PR+evidence at
every slice boundary. The runner never merges — your end-of-day ritual is the merge queue,
where movement gets recorded.

**Tier:** 2 — Multi-step procedure
**Phase:** daily-ops
**Governing decisions:** `adr:roadmap-under-northstar`, `adr:dispatch-queue-and-day-runner`,
`adr:progressive-autonomy-gates`; schema at `decisions/northstar/roadmap-schema.md`.

## Steps

### 1. Preflight

- Dolt sql-server must be up on `:3307` (`lsof -i :3307`). If not, stop and say so.
- Shadow health: `node scripts/roadmap-lint.mjs --format=summary` and
  `node scripts/northstar-lint.mjs --format=summary`. Report the one-liners; ERRORs in
  roadmap-lint mean the roadmap files need fixing before dispatch — stop.

### 2. Compile (file → queue projection)

```bash
node scripts/roadmap-compile.mjs            # idempotent; posts ready slices as queue beads
```

Show the Posted/Skipped table. `--dry-run` first if the user wants a preview;
`--reconcile` to surface file-status vs queue-state drift (suggested edits, never applied).

### 3. Confirm the dispatch set

Present what would run (`node scripts/day-runner.mjs --dry-run`) and let the user trim it.
Cockpit users can instead claim/inspect from the Available lane — same beads.

### 4. Run

```bash
node scripts/day-runner.mjs [--max 2] [--once] [--timeout-mins 45]
```

Sessions run headless in worktrees under `~/.cache/day-runner/worktrees/` (never inside
`~/ojfbot` — scratch northstar/roadmap copies must not pollute registry scans). Logs + briefs:
`~/.cache/day-runner/logs/`.

### 5. Report the verdicts

Relay the verdict table: per slice — claimed / pushed / PR # / movement-proposal present.
A ✗ slice keeps its claim lease until `queue-sweep` reclaims it; say what failed and where
the log is.

### 6. Close the loop (merge ritual — human)

For each delivered PR the user merges:

```bash
node scripts/record-movement.mjs --ref rm:<slug>#S<n> --pr <number>
```

which appends the `status.jsonl` movement line from the PR's movement proposal (evidence
included) and reminds you to flip the slice's `status:` to `merged` in the roadmap file.

## Constraints

- **Never merge a PR from this skill.** Gate 0 = human merges. Auto-merge classes arrive only
  via the data-gated promotions in `adr:progressive-autonomy-gates`.
- **Never write `status.jsonl` before a merge.** Movement is recorded from merged evidence.
- The runner writes the bead store only through `bead-emit.mjs` verbs.

## Gotchas

- A lost claim (`status: lost`) is normal contention, not an error — another claimant won.
- If `bead_events`/queue reads look empty, Dolt isn't running; nothing is wrong with the files.
- The compiled bead is a projection: fix roadmaps by editing the markdown, then re-run
  compile — never by hand-editing beads.
