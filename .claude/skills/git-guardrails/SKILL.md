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

## Gotchas

- **A `deny` rule on `Bash(git push --force*)` does nothing against `git push -f` (and vice versa).** The dangerous git surface has multiple spellings of the same operation — `--force` / `-f`, `reset --hard` / `restore .`, `add -A` / `add .`. A guardrail that pattern-matches one spelling leaves the synonym wide open. When auditing coverage, enumerate the aliases, don't trust a single matched rule to cover the class.
- **A `.git/hooks/pre-push` is not versioned and not shared.** It lives outside the working tree, so it protects only the machine that ran `install`, vanishes on a fresh clone, and gives a false sense of fleet-wide safety. Say so explicitly: the durable guard is the `.claude/settings.json` deny rules plus CI branch protection; the local hook is a per-machine convenience.
- **This skill's default mode is read-only — running it must not edit settings.** `audit` is the default; `install` only fires on explicit request. The temptation when you spot a gap is to "just fix it" by editing `.claude/settings.json` directly. Don't — route edits through `/update-config`, show the diff, and wait for sign-off, exactly as the workflow states.
- **An over-broad `allow` entry silently defeats the `deny` rules you just added.** A blanket `Bash(git push:*)` in the allow list can shadow a narrower deny, so the guardrail reads as "covered" while force-push still goes through. Audit the `allow` list as carefully as `deny`/`ask` — over-broad allows are the gap that doesn't show up as a missing rule.
- **`push --force` to `main`/`master` is always-refuse, not ask-and-confirm.** The policy table draws a line: history rewrite on shared refs gets a confirmation gate, but force-pushing the trunk is in the never-on-standing-authorization tier. Don't downgrade it to an `ask` rule the user can wave through in the moment.

---

$ARGUMENTS

## See Also
- `/update-config` — actually edits `.claude/settings.json` permissions / hooks.
- `/setup-ci-cd` — adds the CI side, including branch-protection-style checks and pre-commit hooks.
