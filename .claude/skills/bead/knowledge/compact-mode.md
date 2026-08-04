Reference for `/bead`: the `--compact` one-shot conversation-handoff procedure in full.

## `--compact` mode — one-shot conversation handoff

When invoked as `/bead --compact` (or the user says "compact this conversation", "write a handoff so another agent can continue", "hand this off"), skip the `.handoff/` ledger entirely and produce a single throwaway handoff document for an incoming agent. Use this when there is no `.handoff/` directory, or the work doesn't warrant a permanent bead, or you just need to pass the baton mid-task.

```
1. Path: `mktemp -t handoff-XXXXXX.md`. If a path is given, read it first; append, don't clobber.
2. Reference, don't reproduce. Link existing artifacts by path/URL — PRDs, plans, ADRs, issues,
   commit SHAs, diffs, branch names. Do not paste their contents.
3. Tailor to the next step. If the user said what the next session will focus on, lead with that
   and cut everything not relevant to it.
4. Name the skills the incoming agent should run (e.g. "start with /zoom-out on packages/x, then /tdd").
5. Contents, in order: task + current state · what's done · what's left · open questions / decisions
   pending · gotchas · artifacts (paths) · suggested next skills.
6. Output the path. Do not create a permanent bead unless the user also asks for one.
```

This is the lightweight counterpart to the full orient → work → handoff bead protocol above — same purpose (inter-session continuity), less ceremony.
