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

## Gotchas

- **The secret scan is gated on what's staged — unstaged changes are invisible to it.** Step 1 runs `git diff --staged`, so a credential in a tracked-but-unstaged file sails through if you then `git add -A` and commit in one motion. Scan the contents you're actually about to commit, and re-scan if you stage more after the check.
- **A clean regex scan is not proof of "no secrets."** `knowledge/secret-patterns.md` matches known shapes (`sk-ant-`, `ghp_`, AWS keys); a hand-rolled token or a base64 blob with no secret-named variable won't match. Treat a clean scan as "no *known* patterns," and still eyeball any new config/`.json`/`.yaml` file before committing.
- **Don't paper over a placeholder as a secret, or a secret as a placeholder.** `ANTHROPIC_API_KEY=your-key-here` and `API_KEY=xxx` are intentional false positives — blocking on them trains the user to ignore the scan. Conversely, `PASSWORD=password` in a non-test file is real. Use the false-positive list in the knowledge file rather than blocking on the variable name alone.
- **The branch warning fires on name match, not on remote-protection truth.** This skill warns when the branch is `main`/`master`/`prod*`, but a feature branch that's actually a shared integration branch gets no warning. The name heuristic is a floor, not a guarantee — when the diff is large or the branch is shared, pause regardless of its name.
- **This skill commits; it does not push.** The name "push-all" is misleading — per the description it stops at commit unless the user explicitly asks to push. Don't infer a push from the skill name; pushing to a remote (especially a protected one) is a separate, explicit step.

---

$ARGUMENTS
