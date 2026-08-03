Reference for `/resume`: the skill's file inventory and runtime dependencies.

## Files in this skill

- `scripts/verify-session-state.sh` — preflight; STOP on untrustworthy ground.
- `scripts/reconstruct-state.mjs` — assemble the four-tier provenance ledger (read-only).
- `scripts/verify-session.mjs` — git-backfill verify pass (shadow by default; `--write` to act).
- The [READ] tier reuses `../bead/scripts/normalize.py` — the schema-drift shim that canonicalizes `.handoff/` beads on read (so reconstruction is reliable despite real-world drift).

## Dependencies

`git` and `gh` (ground-truth tiers); a Python 3 with PyYAML for the [READ] tier (the bead scripts already ship this way); `node` for the `.mjs` scripts. The [DOLT] tier additionally needs `mysql2` + a running Dolt on `:3307` (best-effort).
