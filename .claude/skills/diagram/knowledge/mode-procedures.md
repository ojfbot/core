# /diagram mode procedures

Full per-mode procedure for `explain`, `orient <target>`, and `fleet` — load after picking the mode.

### `explain` (default) — what did this session/branch build?

1. Establish what changed: `git diff` / `git log` against the base branch, plus conversation
   context. New files, new edges, changed flows.
2. Draw the delta: what now exists that didn't, and how it connects to what already existed.
   Distinguish pre-existing nodes from new ones (e.g. new nodes carry `*` in the label, or a
   subgraph "new this session" — say which convention you used in the caption).
3. Place it — ask the user which (default: inline in conversation, then their pick):
   - the PR description (edit via `gh pr edit`),
   - the ADR body being drafted,
   - the session's bead,
   - `docs/diagrams/<slug>.md` in the repo (committed).

### `orient <target>` — what IS this repo/module?

1. Read entry points, package layout, key data flows (reuse `/recon`-grade evidence gathering,
   scaled down; check `domain-knowledge/CONTEXT.md` for the repo's own vocabulary).
2. Draw at most: one structure diagram (what contains what), one flow diagram (how the main
   unit of value moves through it). Inline by default; offer `docs/diagrams/`.
3. If the repo has `opm/system.md`, start from it and say so — don't contradict the formal model.

### `fleet` — where does all of it stand?

1. Read the northstar registry (`core/decisions/northstar/README.md`), the roadmaps it lists,
   and open wayfinder maps (`core/decisions/wayfinder/*.md`).
2. Draw altitude views: clusters → northstars → what's active/missing; wayfinder frontiers as
   the "how to get there" layer. Respect the registry's own tier language (L1/L2/L3).
3. **Placement rule:** fleet views that carry career/strategy lenses (job targets, revenue
   framing, client work) go to `~/selfco/career/` (gitignored there) — never public git.
   Pure-structure fleet views may be committed if asked.
4. Never write northstar files, roadmap files, or `status.jsonl` — this mode reads the delivery
   ledger, it does not touch it.
