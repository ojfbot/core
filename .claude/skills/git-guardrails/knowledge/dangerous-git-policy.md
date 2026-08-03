# Dangerous-git policy reference

The class-by-class table of git operations requiring explicit human go-ahead, plus the safe-by-default list.

| Class | Examples | Why |
|-------|----------|-----|
| **History rewrite on shared refs** | `push --force` / `push -f` to a branch others use, `push --force` to `main`/`master` (always refuse), amending/rebasing published commits | Destroys others' work, breaks downstream clones |
| **Destructive local** | `reset --hard`, `checkout -- .` / `restore .`, `clean -fd`, `branch -D`, `stash drop`/`clear` | Silently discards uncommitted or unmerged work |
| **Bypassing safety** | `--no-verify`, `--no-gpg-sign`, `commit --amend` after a failed pre-commit hook, `-c core.hooksPath=/dev/null` | Skips the checks that exist for a reason; amend-after-failure modifies the *previous* commit |
| **Config tampering** | `git config` changes to user/signing/hooks, editing `.git/config` | Changes identity or disables protections invisibly |
| **Indiscriminate staging** | `git add -A` / `git add .` when the tree contains `.env`, credentials, or large binaries | Leaks secrets, bloats history |

Safe by default: `status`, `diff`, `log`, `add <specific files>`, `commit` (new commits, not amends), `pull`, `fetch`, `push -u origin <feature-branch>` (non-force), `stash` (push, not drop).
