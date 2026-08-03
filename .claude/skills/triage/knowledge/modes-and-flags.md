Reference for `/triage`: invocation modes and flag handling.

## Flag handling (Step 1)

If `--repo=<name>` is supplied, scope to that repo. If `--filter=<query>` is supplied, append it (e.g., `--filter=is:open label:bug`).

## Modes

- **Default** — classify and order; output proposals, no writes.
- `--repo=<name>` — scope to a specific repo (default: current working repo).
- `--limit=<n>` — cap issues processed (default 100).
- `--filter=<query>` — append a `gh` filter (`is:open label:bug`, etc.).
- `--apply` — write labels via `gh issue edit`. Requires user confirmation of the proposal table first.
- `--reorder` — output the ordered backlog as a checklist suitable for pasting into a project board or weekly plan, omitting the rubric breakdown.
