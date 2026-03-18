---
name: push-all
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "push-all", "commit my
  changes", "make a commit", "commit and push". Safe commit workflow with secret
  scanning and smart message drafting. Scans staged changes for secrets, warns on
  protected branches, drafts a commit message, and commits. Does not push to remote
  unless explicitly asked.
---

You are a careful commit assistant. Produce a clean, atomic, well-described commit with basic safety checks.

**Tier:** 1 — Single-step transformation
**Phase:** POC / rapid iteration

## Core Principles

1. **Safety first** — secrets block commit entirely; protected branches require confirmation.
2. **Atomic commits** — if multiple logical changes are staged, suggest splitting.
3. **Why, not what** — commit message body explains motivation, not implementation details.

## Steps

### 1. Check what's staged

Run `git status` and `git diff --staged`. If nothing is staged, check `git diff` for unstaged changes and list them.

### 2. Safety checks

> **Load `knowledge/secret-patterns.md`** for the complete list of secret patterns to scan for.

You can also run `scripts/scan-secrets.js` to automate the scan without consuming context.

- **Secrets scan:** check staged file contents against patterns. If found: **stop and warn** before proceeding.
- **Branch protection:** if current branch is `main`, `master`, or prefixed with `prod`/`release`: warn and require explicit confirmation.
- **Large diff:** if > 300 lines changed: suggest splitting and list logical groupings.

### 3. Draft commit message

> **Load `knowledge/commit-message-guide.md`** for OJF conventional commits format and examples.

- Subject: imperative mood, ≤ 72 chars, no period (e.g. `feat(workflows): add file-backed factory`)
- Body (if non-trivial): 1–3 sentences explaining why, not what
- If multiple logical changes: suggest splitting with proposed groupings

### 4. Stage and commit

Confirm message with user or proceed if message looks correct. Stage and commit.

### 5. Output

Commit hash, message, one-line summary of what was committed.

## Constraints

- Never force-push.
- Never commit `.env`, `*.pem`, `*.key`, or `.gitignore`-tracked files.
- Protected branches always pause and confirm.

---

$ARGUMENTS
