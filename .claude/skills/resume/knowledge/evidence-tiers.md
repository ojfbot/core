Reference for `/resume`: the four evidence tiers and the no-join-key rule between the two bead worlds.

The four evidence tiers, highest trust first:

| Tier | Source | Trust |
|------|--------|-------|
| **[git]** | commits, branches, working tree | GROUND TRUTH (local) |
| **[PR]** | `gh pr list` / view | GROUND TRUTH (remote) |
| **[DOLT]** | the bead store (sessions/convoys) | self-report (best-effort) |
| **[READ]** | `.handoff/` markdown beads | self-report (lowest) |

The two bead worlds (markdown `.handoff/` and the Dolt store) share **no join key** — markdown `session_id` is an ISO timestamp, Dolt `session_id` is a Claude `$SESSION_ID` UUID. They are correlated **only by commit-SHA + repo + time-window**, never by id. Do not assume an id-join.
