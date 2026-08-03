# Open-unknowns ledger — buckets, template, and rationale

Reference for `/grill-with-docs` Steps 4.5 and 8, moved verbatim from SKILL.md.

## The three buckets (Step 4.5)

List what is still unresolved at the point the grill stops, in three buckets:

- **Deferred decisions** — raised, consciously not decided yet. Name who/what unblocks each.
- **Unvalidated assumptions** — the design concept rests on these and nobody checked them.
- **Standard considerations not covered** — the domain-conventional concerns this work touches but the grill never reached (migration, auth, rate limits, failure modes, whatever the domain's usual checklist is).

**Be honest about what this third bucket is.** It is a checklist of domain-standard considerations you may have skipped. It is *not* a guarantee of blind-spot coverage — a model asked to name what nobody thought of will confabulate plausible-sounding gaps. Prefer "I did not cover X, which work in this domain usually covers" over "your blind spot is X".

An empty bucket is a legitimate result. Write "none" rather than inventing entries to fill the section.

## The ledger entry format (Step 8)

```markdown
## <YYYY-MM-DD> — <design concept in a few words>

**Deferred decisions**
- <item> — unblocked by: <who/what>

**Unvalidated assumptions**
- <item>

**Standard considerations not covered**
- <item>
```

`decisions/` is repo-local, unlike `domain-knowledge/CONTEXT.md`, which is a symlink into core — that is precisely why this ledger is writable and CONTEXT.md is not.

## Why this write exists

Two reasons this write exists, and both matter:
- **For the user:** deferred unknowns survive the session instead of evaporating. The same unknown recurring across repos is a missing convention, not an edge case — promote it to an ADR.
- **For the instrumentation:** this is the skill's `expected_artifact` (`packages/workflows/src/tracking/expected-artifact.ts`). Before it existed, the skill wrote nothing to disk, so it had no reachable path to `acted` and was mis-measured as ignored forever. A grill that stays entirely in chat is `engaged_no_act`, not done.
