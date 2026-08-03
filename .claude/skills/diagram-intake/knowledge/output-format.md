# Output format

The structured-priorities format `/diagram-intake` Step 5 emits, consumed by `/frame-standup` Step 7 or `/orchestrate`.

```markdown
## Diagram Priorities — <date>

### Category goals (cross-app)
1. <goal from diagram> → affects: [repo1, repo2]
   Alignment: <how this maps to roadmap>

### Per-app priorities

#### <repo-name> (Phase <N>)
Standup context: <one-line from standup.md if available>

1. <goal from diagram>
   Maps to: <roadmap item or blocker>
   Suggested command: /<framework-command>
   Priority: P0 | P1 | P2
   Specificity: high | medium | low
   
2. <goal from diagram>
   ...

3. <goal from diagram>
   ...

#### <next-repo>
...
```

## The Specificity field

The `Specificity` field is critical for downstream orchestration:
- **high**: Goal is a concrete engineering task (e.g. "fix GET /api/tools contract")
  → can be decomposed directly into implementation tasks
- **medium**: Goal identifies the area but not exact work (e.g. "auth improvements")
  → needs a planning/investigation pass before decomposition
- **low**: Goal is aspirational or exploratory (e.g. "make it better")
  → needs a full planning cycle with user input

## Consumption notes

- The output is designed to be consumed by `/frame-standup` Step 7 or `/orchestrate`
- Each goal retains the user's original phrasing alongside the canonical mapping
- The Specificity field determines how many decomposition layers the orchestrator needs
- Category goals become cross-app coordination constraints for the orchestrator
