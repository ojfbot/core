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
git -C /Users/yuri/ojfbot/<repo> log --oneline origin/main -5
```
Check the relevant commit appears on `origin/main`. GitHub Pages deploys
from main — if the commit isn't on main, it's not live.

### "GET /api/tools added" / "endpoint now exists"
```bash
grep -r "api/tools" /Users/yuri/ojfbot/<repo>/packages/api/src/ --include="*.ts" -l
```
Check the file exists and contains the route definition, not just a comment.

### "Module Federation configured"
```bash
grep -r "vite-plugin-federation\|@originjs" /Users/yuri/ojfbot/<repo>/packages/browser-app/vite.config.ts
```
Check: plugin imported AND `exposes` key exists AND `filename: 'remoteEntry.js'` set.

### "ADR-NNN written / accepted"
```bash
ls /Users/yuri/ojfbot/core/decisions/adr/ | grep NNN
```
Then read the file and check `Status:` field in frontmatter.

### "CI is green" / "all checks passing"
```bash
gh run list --repo ojfbot/<repo> --limit 3 --json status,conclusion,name
```
Check `conclusion == "success"` on the most recent relevant run.

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
