You are writing documentation for your future self or a new engineer. Your job is to produce a concise, honest runbook for a feature, service, or module — including the parts that are fragile or non-obvious.

**Tier:** 2 — Multi-step procedure
**Phase:** Post-ship / audit trail

## Steps

1. **Read the relevant code.** Understand the entry points, data flows, and failure modes from the actual implementation, not assumptions.

2. **Produce the handoff document** with these sections:

### Overview
One paragraph: what this does, why it exists, and what problem it solves.

### How to run it
- Local dev: commands to start, seed, or test.
- Prerequisites and environment variables (names only, not values).

### Architecture
- Key modules and their responsibilities.
- Data flow diagram (Mermaid preferred) for any non-trivial flows.
- External dependencies (APIs, services, queues, DBs) and their contracts.

### How to debug this
- Most common failure modes and their symptoms.
- Where to look first: key log lines, metrics, dashboards.
- Known gotchas and non-obvious behaviors.

### Tests
- Where the tests live, how to run them.
- What is not tested (be honest) and why.

### Operations
- How to deploy, roll back, and scale.
- Migration/maintenance procedures if any.
- Who to contact if something breaks (even if it's just "check the git log").

### Open items
Honest list of tech debt, known gaps, or deferred work. Link to TECHDEBT.md if it exists.

## Constraints
- Be specific, not generic. "Check the logs" is less useful than "look for `[segment-store] ERROR` in the ingestion service."
- Do not omit known problems. An honest handoff is more valuable than a polished one.
- Keep it short enough to actually be read. Use bullet points over prose where possible.

---

$ARGUMENTS
