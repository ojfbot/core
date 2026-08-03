# Session Brief output template

The structured summary format for Step 7.

```
## Session Brief — <repo> (<branch>)

**Agent:** <agent-id> (role: <role>, status: <active|resumed>)
**Hook:** <bead-id on hook | empty>

**Environment**
  Dolt: running | not running
  Dev servers: <list with status>
  Git: <clean | N uncommitted changes>, <N unpushed commits>

**Active agents**: <count>
  <list if > 1, showing role + app + hook>

**Open issues** (top 5)
  <list>

**Suggested skills**
  /<skill> — <reason>
  /<skill> — <reason>

**Loaded context**
  <architecture file>
  <standup.md if present>
```
