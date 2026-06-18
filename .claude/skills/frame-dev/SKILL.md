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

**Step 2 — After the script completes, output the guide below** (substituting the real status from Step 1 for each row):

---

## Frame OS — Dev Session

**Entry point → open [http://localhost:4000](http://localhost:4000) in your browser.**

| Service | URL | Notes |
|---------|-----|-------|
| **Shell** _(MF host)_ | [http://localhost:4000](http://localhost:4000) | Open this. Sidebar loads sub-apps via MF |
| **frame-agent** | [http://localhost:4001/health](http://localhost:4001/health) | LLM gateway · started by `pnpm dev` in shell |
| **Resume Builder** | [http://localhost:3000](http://localhost:3000) | Standalone or loaded by Shell |
| **BlogEngine** | [http://localhost:3005](http://localhost:3005) | Standalone or loaded by Shell |
| **TripPlanner** | [http://localhost:3010](http://localhost:3010) | Standalone or loaded by Shell |
| **CoreReader** | [http://localhost:3015](http://localhost:3015) | Standalone or loaded by Shell · API on :3016 |

### Module Federation flow

1. Open **[Shell](http://localhost:4000)** → click the hamburger → expand sidebar
2. Click an app (e.g. Resume Builder) → Shell dynamically loads `./Dashboard` from `:3000`
3. The app renders inside Shell's main pane with the fade-in transition
4. Cmd+K → type a prompt → frame-agent at `:4001` routes it to the active sub-app

### Logs

```bash
# Watch a specific app
tail -f /tmp/frame-dev-logs/shell.log
tail -f /tmp/frame-dev-logs/cv-builder.log
tail -f /tmp/frame-dev-logs/blogengine.log
tail -f /tmp/frame-dev-logs/tripplanner.log
tail -f /tmp/frame-dev-logs/core-reader.log
```

### Stop all

```
/frame-dev stop
```

## Gotchas

- **Outputting the URL guide is not evidence the servers are up.** Step 2 prints the same static table regardless of what Step 1's script actually did — a port already in use, a crashed Vite process, or a stale lockfile all still produce the guide. Substitute the real per-service status from Step 1 into the table; don't present the boilerplate URLs as a health report.
- **A "started" launcher with a dead `:4001` frame-agent breaks every sub-app silently.** The shell on `:4000` loads but Cmd+K prompts fail because the LLM gateway never came up. frame-agent is started by `pnpm dev` in the shell, so a shell that booted doesn't guarantee the agent did — check `:4001/health` before declaring the session usable.
- **Stale processes on the Frame ports survive a crashed session.** If a prior session died without `/frame-dev stop`, the ports (4000/4001, 3000, 3005, 3010, 3015/3016) stay occupied and a fresh `start` either fails to bind or attaches to the old process. When a server "won't start," check for an orphaned listener on its port before retrying.
- **`/frame-dev stop` is a blunt instrument — it stops all servers, not the one you're debugging.** There is no per-app stop here; running it to clear one wedged app also kills the four healthy ones. If you only need to recycle one rig, that's a `/workbench --window <id>` concern, not this skill.
- **The script resolves paths via `git rev-parse --show-toplevel` — running it outside a Frame repo points it at the wrong root.** Invoked from an unrelated repo or a detached checkout, `scripts/frame-dev.sh` either isn't found or launches against the wrong tree. Confirm the cwd is inside the Frame OS workspace before invoking.
