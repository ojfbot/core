---
name: git-guardrails
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "git-guardrails", "block dangerous
  git commands", "stop me force-pushing main", "add git safety rails", "protect against bad
  git", "set up git protections". States the dangerous-git policy and, on request, wires the
  guardrails into the repo — PreToolUse deny rules in .claude/settings.json (via /update-config)
  and an optional pre-push hook. Read-only by default; only edits settings when asked.
---

# /git-guardrails

You enforce safe git usage. Most of this is already covered by the project's `.claude/settings.json` deny-rules — this skill names the full policy and, when the user asks, fills any gaps.

**Input:** $ARGUMENTS — optional: "audit" (default — report current coverage), "install" (wire the rails), or a specific command to assess.

**Tier:** 1 — Lightweight
**Phase:** continuous (not phase-locked)

## The policy

These are the operations that need a human's explicit, in-context go-ahead — never run them on a standing authorization, never as a shortcut around an obstacle:

| Class | Examples | Why |
|-------|----------|-----|
| **History rewrite on shared refs** | `push --force` / `push -f` to a branch others use, `push --force` to `main`/`master` (always refuse), amending/rebasing published commits | Destroys others' work, breaks downstream clones |
| **Destructive local** | `reset --hard`, `checkout -- .` / `restore .`, `clean -fd`, `branch -D`, `stash drop`/`clear` | Silently discards uncommitted or unmerged work |
| **Bypassing safety** | `--no-verify`, `--no-gpg-sign`, `commit --amend` after a failed pre-commit hook, `-c core.hooksPath=/dev/null` | Skips the checks that exist for a reason; amend-after-failure modifies the *previous* commit |
| **Config tampering** | `git config` changes to user/signing/hooks, editing `.git/config` | Changes identity or disables protections invisibly |
| **Indiscriminate staging** | `git add -A` / `git add .` when the tree contains `.env`, credentials, or large binaries | Leaks secrets, bloats history |

Safe by default: `status`, `diff`, `log`, `add <specific files>`, `commit` (new commits, not amends), `pull`, `fetch`, `push -u origin <feature-branch>` (non-force), `stash` (push, not drop).

## Workflow

### audit (default)
1. Read `.claude/settings.json` `permissions.deny` (and `ask`) entries.
2. Map them against the policy table. Report which classes are covered, which aren't.
3. List any `allow` entries that are broader than they should be (e.g. a blanket `Bash(git push:*)`).

### install (only when asked)
1. Hand the gaps to `/update-config` to add `permissions.deny` / `permissions.ask` entries in `.claude/settings.json` — e.g. deny `Bash(git push --force*)`, `Bash(git reset --hard*)`, `Bash(git clean -f*)`, `Bash(git config*)`; ask on `Bash(git push -f*)`, `Bash(git rebase*)`.
2. Optionally add a `.git/hooks/pre-push` (or husky `pre-push`) that refuses force-pushes to `main`/`master`. Make it executable. Note that local hooks aren't versioned — for a versioned guard, prefer the settings.json rules + a CI branch-protection check.
3. Show the diff; don't apply without sign-off.

### assess <command>
Given a specific git command, say whether it's in one of the dangerous classes, what it would do, and the safe alternative.

## Output

```
## Git guardrails: <audit | install | assess>

Covered: <classes already protected>
Gaps:    <classes not protected — with the deny/ask rule that would fix each>
Over-broad allows: <entries to tighten — or "none">
Recommendation: <e.g. "run /git-guardrails install" | "policy fully covered, nothing to do">
```

---

$ARGUMENTS

## See Also
- `/update-config` — actually edits `.claude/settings.json` permissions / hooks.
- `/setup-ci-cd` — adds the CI side, including branch-protection-style checks and pre-commit hooks.
