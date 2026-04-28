# Gas Town / Beads / GasCity compatibility

This skill produces lightweight artifacts whose frontmatter is shaped to be ingestible by Gas Town and adjacent systems if and when that integration is wanted. The skill itself has no runtime dependency on any of these — it works standalone with just markdown files in a directory.

## What's compatible

The bead frontmatter follows Gas Town's `FrameBead` shape (from prior Frame integration analysis):

| Gas Town field | Handoff bead field | Notes |
|---|---|---|
| `id` | `id` | Identical convention; ours uses `YYYYMMDD-HHMM-<type>-<slug>` |
| `type` | `type` | Restricted set: `brief`/`report`/`decision`/`discovery` |
| `title` | `title` | Identical |
| `body` | (markdown body of file) | Gas Town stores body inline; we use the file body |
| `actor` | `actor` | Identical |
| `refs` | `refs` | Identical convention; we use typed URI strings |
| `status` | `status` | Restricted set: `live`/`closed`/`superseded` |
| `created_at` | `created_at` | Identical (ISO-8601) |
| `updated_at` | (file mtime, or implicit) | Not tracked in frontmatter; rely on git history |
| `labels` | `labels` | Identical (free-form key-value) |

## What's deliberately omitted

Gas Town primitives that are *not* part of this skill (and do not need to be added):

- **Hooks as queue primitives.** We use `hook` as a free-text label only. No queue mechanics.
- **Convoys.** Batches of related hooks. Premature for personal-project handoffs; add later if scale demands.
- **Polecats / Mayor / Witness role hierarchy.** Two-actor handoff (chat-claude ↔ code-claude) is what 95% of sessions look like. Roles are addressable via the `actor` field; no hierarchy needed.
- **Wanted board.** Open work-claim model is overkill for a single operator's projects.
- **Stamps and reputation.** Trust is local; we don't federate.
- **Six-stage data lifecycle with maintenance Dogs.** Beads are append-only and human-curated. If decay becomes a real problem, add a sweep step then.
- **Event stream as source of truth.** The directory listing *is* the event stream. No separate ledger.

## Migration path (if you ever want it)

The path to fuller Gas Town integration, in order:

1. **Ingest existing beads.** Point a Gas Town instance at the `.handoff/` directory. Each markdown file becomes a bead in Dolt. Frontmatter maps directly. Body becomes the bead body. Status transitions become events.

2. **Adopt hook semantics.** Replace the free-text `hook` label with a real Gas Town hook (queue identity). Existing labels become hook IDs.

3. **Add convoys.** Group related hooks. The `convoys` directory in the cozy-beaver issue-plan handoff is already shaped for this — each milestone is a convoy of issues.

4. **Adopt role hierarchy.** The `actor` field maps to polecat identity. Sessions become polecat session-instances.

5. **Federate.** When you have multiple Gas Towns or multiple operators, the bead `refs` already use cross-system URIs; federation is mostly a network problem at that point.

None of this is on the roadmap for the skill. It's available if you ever want it.

## Why bead-shaped, then?

Two reasons:

1. **Future-compatibility.** The cost of matching the shape now is zero (frontmatter is frontmatter); the cost of not matching it later is a migration script.

2. **Discipline.** The bead vocabulary forces structure. "Title, actor, refs, status" is a better forcing function than "write a markdown file." The shape encodes what matters.
