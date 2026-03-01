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
bash /Users/yuri/ojfbot/core/scripts/frame-dev.sh $ARGUMENTS
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
| **CV Builder** | [http://localhost:3000](http://localhost:3000) | Standalone or loaded by Shell |
| **BlogEngine** | [http://localhost:3005](http://localhost:3005) | Standalone or loaded by Shell |
| **TripPlanner** | [http://localhost:3010](http://localhost:3010) | Standalone or loaded by Shell |

### Module Federation flow

1. Open **[Shell](http://localhost:4000)** → click the hamburger → expand sidebar
2. Click an app (e.g. CV Builder) → Shell dynamically loads `./Dashboard` from `:3000`
3. The app renders inside Shell's main pane with the fade-in transition
4. Cmd+K → type a prompt → frame-agent at `:4001` routes it to the active sub-app

### Logs

```bash
# Watch a specific app
tail -f /tmp/frame-dev-logs/shell.log
tail -f /tmp/frame-dev-logs/cv-builder.log
tail -f /tmp/frame-dev-logs/blogengine.log
tail -f /tmp/frame-dev-logs/tripplanner.log
```

### Stop all

```
/frame-dev stop
```
