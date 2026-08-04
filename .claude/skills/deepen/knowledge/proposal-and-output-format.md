# Proposal and output format

The per-proposal block emitted in Step 4 and the overall report shape.

## Proposal block

```
### Proposal D-N: <name>

**Move:** <one-sentence description>
**Affected files:** <list>
**Proposed surface:** <pseudocode of the new module's exports>
**Internal:** <what gets hidden behind the new interface>

**Cost:**
- Test impact: <which tests need to move/rewrite>
- Blast radius: <which callers change>
- ADR required: <yes/no — yes if crossing package boundary or changing semantics>
- Migration risk: <low/medium/high>

**Benefit:**
- Cognitive load delta: <N files → 1 file; N exports → M exports>
- Caller ergonomics: <what callers stop having to know>
- Testability: <what becomes easier to test>

**Recommended order:** <1=do first, 2=do later, 3=skip unless other refactors force it>
```

## Report format

```
## Scope
<path or area>

## Depth measurement summary
<table or bullets: file count, avg exports per file, avg lines per function, single-caller leaf count>

## Shallow clusters identified
<grouped bullets>

## Proposals (ranked)
### Proposal D-1: <name>
<full proposal block>

### Proposal D-2: <name>
...

## ADR drafts (for cross-package proposals)
### ADR-XXXX: <title> (Proposed)
<stub>

## Suggested next steps
1. <which proposal to do first and why>
2. <follow-on /scaffold or /tdd invocation>
```

## ADR stubs (Step 5)

For each proposal where "ADR required" is yes, output a draft ADR stub inline. User runs `/adr new "<title>"` to commit. ADR captures: which boundary moved, why, what callers had to change, what the public surface now is.
