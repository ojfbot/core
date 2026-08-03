---
name: frame-dev
description: Start, stop, or check status of all Frame OS dev servers. Displays a clickable URL guide on completion.
triggers:
  - frame-dev
  - start frame
  - launch frame
  - start all apps
  - stop frame
  - frame status
---

# /frame-dev

$ARGUMENTS accepts: `start` (default), `stop`, or `status`.

**Step 1 — Run the launcher script:**

```bash
bash "$(git rev-parse --show-toplevel)/scripts/frame-dev.sh" $ARGUMENTS
```

If `$ARGUMENTS` is empty, default to `start`.

**Step 2 — After the script completes, output the dev-session guide** (substituting the real status from Step 1 for each row):

> **Load `knowledge/dev-session-guide.md`** before writing the guide — the Frame OS URL table, Module Federation flow, log commands, and stop instructions to output.

## Gotchas

- **Outputting the URL guide is not evidence the servers are up.** Step 2 prints the same static table regardless of what Step 1's script actually did — a port already in use, a crashed Vite process, or a stale lockfile all still produce the guide. Substitute the real per-service status from Step 1 into the table; don't present the boilerplate URLs as a health report.
- **A "started" launcher with a dead `:4001` frame-agent breaks every sub-app silently.** The shell on `:4000` loads but Cmd+K prompts fail because the LLM gateway never came up. frame-agent is started by `pnpm dev` in the shell, so a shell that booted doesn't guarantee the agent did — check `:4001/health` before declaring the session usable.
- **Stale processes on the Frame ports survive a crashed session.** If a prior session died without `/frame-dev stop`, the ports (4000/4001, 3000, 3005, 3010, 3015/3016) stay occupied and a fresh `start` either fails to bind or attaches to the old process. When a server "won't start," check for an orphaned listener on its port before retrying.
- **`/frame-dev stop` is a blunt instrument — it stops all servers, not the one you're debugging.** There is no per-app stop here; running it to clear one wedged app also kills the four healthy ones. If you only need to recycle one rig, that's a `/workbench --window <id>` concern, not this skill.
- **The script resolves paths via `git rev-parse --show-toplevel` — running it outside a Frame repo points it at the wrong root.** Invoked from an unrelated repo or a detached checkout, `scripts/frame-dev.sh` either isn't found or launches against the wrong tree. Confirm the cwd is inside the Frame OS workspace before invoking.
