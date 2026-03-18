# Runbook Template

Use this structure for all `/handoff` outputs. Fill in from actual code — do not invent architecture.

```markdown
# [Module/Feature Name] — Runbook

**Last updated:** YYYY-MM-DD
**Author:** [who wrote this]
**Status:** [active | deprecated | draft]

---

## Overview

[2-3 sentences: what this module does, who uses it, why it exists]

---

## How to run

### Prerequisites

- Node v24+ (or Python 3.12+)
- Environment variables: (list all required, with descriptions)
  - `ENV_VAR_NAME` — description
- Dependencies: `pnpm install` (or `pip install -r requirements.txt`)

### Development

```bash
# Start in dev mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

### Production

```bash
# How it runs in production (command, Docker, systemd, etc.)
```

---

## Architecture

[Read the actual code before writing this section]

Key files:
- `src/entry.ts` — [what it does]
- `src/handler.ts` — [what it does]

Data flow: [describe how data enters and exits — one paragraph]

---

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | yes | — | Authenticates X requests |
| `DEBUG` | no | false | Enable verbose logging |

---

## Debugging

### Common failure: [descriptive name]

**Symptom:** [what the user sees or what the log says]
**Cause:** [why this happens]
**Fix:** [what to do]

```bash
# Diagnostic command
```

### Check health

```bash
curl localhost:[port]/health
```

### Read logs

```bash
# Where to find logs
tail -f [log path]
# Or in production:
# [how to access logs in the deployed environment]
```

---

## Operations

### Deploy

[One-liner or link to deploy process]

### Rollback

[How to roll back a bad deploy — one command or link]

### Scale

[How to scale horizontally if load increases]

---

## Tests

| Suite | Command | What it covers |
|-------|---------|----------------|
| Unit | `pnpm test` | Core logic |
| Integration | `pnpm test:int` | API endpoints |

---

## Open items

- [ ] [known gap or planned improvement]

---

## Contacts

- Owner: [name or team]
- On-call: [rotation or contact]
```
