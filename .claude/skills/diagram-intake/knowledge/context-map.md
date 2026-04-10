# App Name Context Map

Reference for `/diagram-intake`. Maps informal app names (as JFO might write
on paper) to canonical repo names, architecture doc paths, and default ports.

---

## Canonical mapping

| Informal names | Canonical repo | Architecture doc | Port |
|----------------|---------------|-----------------|------|
| Resume, CV, Builder, Bio | `cv-builder` | `cv-builder-architecture.md` | 3000 |
| Blog, BlogEngine, Engine | `blogengine` | `blogengine-architecture.md` | 3005 |
| Logger, Log, Daily, DL | `daily-logger` | `daily-logger-architecture.md` | — |
| Shell, Frame, OS, Home | `shell` | (covered by `frame-os-context.md`) | 4000 |
| Trips, Planner, Trip, TP | `TripPlanner` | `tripplanner-architecture.md` | 3010 |
| Extension, Plug, Chrome, MrPlug | `mrplug` | `mrplug-architecture.md` | — |
| Purefoy, Deakins, Roger | `purefoy` | `purefoy-architecture.md` | — |
| Core, Workflows, Skills, Commands | `core` | (this repo) | — |
| Canvas, Lean | `lean-canvas` | — | 3025 |
| Gastown, Gas Town, Pilot | `gastown-pilot` | — | 3017 |
| Reader, Core Reader | `core-reader` | — | 3015 |
| SEH, Study | `seh-study` | — | 3030 |
| Components, UI, Frame UI | `frame-ui-components` | — | — |

## Resolution rules

1. If the label matches multiple repos (e.g. "Blog" could be blogengine or
   daily-logger), use surrounding context:
   - Writing/content/posts → daily-logger
   - Dashboard/UI/tabs → blogengine
   - Both → ask the user

2. If the label doesn't match any known repo, flag it in the output as
   `[UNMAPPED]` and ask the user.

3. Case-insensitive matching. Partial matches are acceptable (e.g. "Trip" → TripPlanner).

4. Abbreviations JFO commonly uses:
   - "CV" = cv-builder
   - "TP" = TripPlanner
   - "BE" = blogengine
   - "DL" = daily-logger
   - "MF" = Module Federation (not a repo — a cross-cutting concern)

## Architecture doc paths

All architecture docs live at:
```
~/ojfbot/core/domain-knowledge/<filename>
```

The overall roadmap and repo inventory is in:
```
~/ojfbot/core/domain-knowledge/frame-os-context.md
```

Per-app standup extensions (if they exist) are at:
```
~/ojfbot/<repo>/.claude/standup.md
```
