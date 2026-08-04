Reference for `/bead`: scope boundaries — what this skill is NOT.

## What this skill is NOT

- Not a project management system. It does not replace GitHub issues, ADRs, or CLAUDE.md.
- Not a full Gas Town. The frontmatter is bead-compatible by design so this can be ingested later, but the skill is standalone and has no Gas Town runtime dependency.
- Not a chat log. Beads are the things worth remembering; the conversation that produced them is not preserved.
- Not auto-merging. Nothing in `.handoff/` ever overwrites or merges. Beads are append-only; corrections take the form of a new bead that supersedes a prior one (referenced via `refs`).
