# ADR-XXXX: [Decision title]
slug: kebab-stable-id
serial: draft
rev:
Date: YYYY-MM-DD
Status: Proposed
domain: [bounded-context]
type: [decision-class]
OKR: [e.g. 2026-Q1 / O2 / KR1]
Commands affected: [e.g. /plan-feature, /scaffold]
Repos affected: [e.g. shell, cv-builder, core]
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: []
  parent:
  part-of-series:

---

<!--
Identity (ADR-0087): `slug` is the permanent, immutable identity. Draft files are `draft-<slug>.md`
with `serial: draft`; `/adr accept` assigns the 4-digit serial (max+1, never reused) and renames to
`<serial>-<slug>.md`. Never renumber — `/adr revise` bumps `rev:` instead. Cross-refs use `adr:<slug>`.
Controlled vocab — domain: shell-host-composition | agent-graph | workflow-engine | gas-town-governance |
observation | ui-components | meta. type: architecture | convention | process | infrastructure | policy |
tooling. Every `traces:` value is a slug that must resolve to a file on disk. gate/baseline optional.
-->

## Context

What situation forced this decision. What was the problem or constraint we were facing.

## Decision

What we decided, stated plainly. One or two sentences.

## Consequences

### Gains
What this decision enables or improves.

### Costs
What this decision makes harder, slower, or more constrained.

### Neutral
Side effects that are neither clearly positive nor negative.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Option A | Reason |
| Option B | Reason |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | _pending_ |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
