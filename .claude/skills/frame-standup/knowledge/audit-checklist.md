# Daily-Logger Audit Checklist

Reference for `/frame-standup` Step 3. Defines how to verify daily-logger
claims against actual repo state and common failure modes to check.

---

## Claim verification patterns

### "X merged" / "PR #N shipped"
```bash
gh pr view <N> --repo ojfbot/<repo> --json state,mergedAt,title
```
Check: `state == "MERGED"`. If `state == "OPEN"` the claim is false.

### "X is now live at frame.jim.software"
```bash
git -C $HOME/ojfbot/<repo> log --oneline origin/main -5
```
Check the relevant commit appears on `origin/main`. GitHub Pages deploys
from main — if the commit isn't on main, it's not live.

### "GET /api/tools added" / "endpoint now exists"
```bash
grep -r "api/tools" $HOME/ojfbot/<repo>/packages/api/src/ --include="*.ts" -l
```
Check the file exists and contains the route definition, not just a comment.

### "Module Federation configured"
```bash
grep -r "vite-plugin-federation\|@originjs" $HOME/ojfbot/<repo>/packages/browser-app/vite.config.ts
```
Check: plugin imported AND `exposes` key exists AND `filename: 'remoteEntry.js'` set.

### "ADR-NNN written / accepted"
```bash
ls $HOME/ojfbot/core/decisions/adr/ | grep NNN
```
Then read the file and check `Status:` field in frontmatter.

### "Component extracted to packages/"
```bash
ls $HOME/ojfbot/<repo>/packages/<pkg>/src/components/<ComponentName>.tsx
```
Check: the file exists at the claimed path. PR body text describing intent ("extracts Header
into packages/ui") is not evidence of completion — only the file on disk is.

Also check the story file if claimed:
```bash
ls $HOME/ojfbot/<repo>/packages/<pkg>/src/components/<ComponentName>.stories.tsx
```

Invert applies too: if the post claims a story is *missing*, verify it isn't already present
before listing it as remaining work.

### "Fix/feature landed" (referenced by commit hash)
```bash
git -C $HOME/ojfbot/<repo> log --oneline origin/main | grep <hash>
```
Check: the commit hash appears on `origin/main`, not just on a feature branch.
If the repo has uncommitted changes on a feature branch, the fix has NOT landed —
it is WIP regardless of what the daily-logger post says.

Cross-reference sync-repos output: a repo with uncommitted changes is a WIP signal
even before checking the git log.

### "CI is green" / "all checks passing"
```bash
gh run list --repo ojfbot/<repo> --limit 3 --json status,conclusion,name
```
Check `conclusion == "success"` on the most recent relevant run.

---

## Structured API verification (when `read-api-context.js` data available)

### `decisions[]` verification
For each `DecisionEntry` in `latestEntry.decisions[]`:
```bash
git -C $HOME/ojfbot/<decision.repo> log --oneline -10 | grep -i "<keywords from decision.title>"
```
Check: the referenced repo has recent commits plausibly related to the decision.
If `decision.repo` does not match any known repo directory, flag as inconsistent.

### `actions[]` verification
For each action in `latestEntry.actions[]`:
```bash
ls .claude/skills/<command-without-slash>/<command-without-slash>.md
```
Check: the `command` field maps to a valid skill. If the skill doesn't exist,
flag the action — it may reference a deprecated or misnamed command.

Also verify the target `repo` directory exists:
```bash
ls -d $HOME/ojfbot/<action.repo>
```

### `codeReferences[]` verification (from `api/articles/<date>.json`)
When per-article JSON is available, verify a sample of code references:

**Commits:**
```bash
git -C $HOME/ojfbot/<ref.repo> cat-file -t <ref.text> 2>/dev/null
```
Check: returns `commit`. If it fails, the SHA may be truncated or from
a force-pushed branch.

**Files:**
```bash
ls $HOME/ojfbot/<ref.repo>/<ref.path>
```

**Components (PascalCase):**
```bash
grep -r "<ref.text>" $HOME/ojfbot/<ref.repo>/packages/ --include="*.tsx" -l | head -3
```

### API staleness check
```bash
node -e "const e=require('$HOME/ojfbot/daily-logger/api/entries.json'); console.log(e[0].date)"
```
Compare against latest `_articles/*.md` filename. If the API date is older,
`build-api` has not been run since the last article was written — API data
is stale and markdown fallback should be preferred.

### Article status check
If `latestEntry.status === "draft"`, all claims must carry a `[DRAFT]` caveat.
Draft articles are AI-generated and have not been human-reviewed — accuracy
is lower confidence. If `status === "rejected"`, skip to the previous entry.

---

## Common failure modes

| Failure mode | How it appears in the post | How to detect |
|---|---|---|
| PR open, not merged | "PR #N shipped X" | `gh pr view N --json state` → `"OPEN"` |
| Feature on branch, not main | "X is live" but only on feature branch | `git log origin/main` vs `git log origin/feat/...` |
| Endpoint listed but not registered | "GET /api/tools exposed" but no route | `grep` for Express route handler |
| MF configured but not exposed | "BlogEngine is a MF remote" but no `exposes` | Check vite.config for `exposes` key |
| ADR referenced but still Proposed | "ADR-007 for X" but Status: Proposed | Read frontmatter |
| Phase claimed complete, one repo missing | "Phase 1 complete" but one repo still not MF | Check ALL repos in phase scope |
| Status in frame-os-context.md is stale | Context doc contradicts actual repo | Cross-reference both |
| File claimed extracted but absent | "Header.tsx extracted to packages/ui/" but file doesn't exist | `ls packages/ui/src/components/Header.tsx` |
| Story claimed missing but exists | "stories outstanding" when .stories.tsx already present | `ls packages/ui/src/components/*.stories.tsx` |
| Fix claimed landed but still WIP | "hasCrossDomainSignal fix shipped" but repo on feature branch with uncommitted changes | Check sync-repos status + `git log origin/main \| grep <hash>` |
| API data stale | `entries[0].date` is older than latest `_articles/*.md` | Compare API date vs filesystem; prefer markdown if stale |
| Draft article treated as ground truth | `status === "draft"` but claims stated without qualification | Always add `[DRAFT]` caveat; do not treat as verified |
| Action references invalid skill | `command: "/foo"` but no `.claude/skills/foo/` exists | Check skill directory exists before including in day plan |
| Decision attributed to wrong repo | `decision.repo` doesn't match commit history | Cross-reference `git log` in stated repo |

---

## Audit verdict criteria

| Verdict | Condition |
|---------|-----------|
| **ACCURATE** | All verifiable claims confirmed; no material errors |
| **PARTIALLY ACCURATE** | Most claims verified; 1–2 specific corrections needed |
| **STALE** | Multiple claims wrong or outdated; context docs need updating |

Format each correction as:
```
❌ Claim: "cv-builder Module Federation configured"
   Actual: No federation plugin in packages/browser-app/vite.config.ts
   Evidence: grep returned no matches
```
