Reference for `/resume --verify`: the backfill commands and the rules the pass runs under.

```
node <skill>/scripts/verify-session.mjs --repo <repo> --days 14            # SHADOW (dry-run)
node <skill>/scripts/verify-session.mjs --repo <repo> --days 14 --write    # create the beads
```

- It finds **merged PRs in the window that no `.handoff/` bead references** and proposes a `report` bead per PR, reconstructed from [PR]/[git] ground truth and tagged `(backfilled by integration)` — a visible signal that the session-close discipline was skipped.
- It **defaults to shadow** (prints, writes nothing) because writing is an action-taking control (ADR-0086 shadow-first). Add `--write` only when you intend to create the append-only beads.
- It is **append-only**: never overwrites an existing bead, never overwrites a verified self-report. CONFLICT rows are surfaced, never auto-resolved.
