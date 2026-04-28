# Triage rubric — severity, effort, domain, type

The rubric is short, opinionated, and rigid. Reproducibility is the goal: same rubric across sessions, same ordering function, no drift.

## Severity

User impact. Not author urgency. Not "I want this soon."

| Label | Definition | Examples |
|-------|-----------|----------|
| **p0** | Data loss, security exposure, broken core flow that affects all users, ongoing incident | Auth bypass; database corruption; cv-builder won't load for anyone; secrets leaked in logs |
| **p1** | Broken non-core flow OR core flow degraded for a subset of users; production-grade bug | One sub-app's chat panel is broken; daily-logger pipeline fails on a specific persona; SSE drops mid-stream for slow networks |
| **p2** | Degraded experience but workaround exists; significant feature gap | Loading state stuck (refresh works); export takes 30s; missing keyboard shortcut for a common action |
| **p3** | Polish, nice-to-have, paper cuts | Spacing tweaks; new theme color; minor wording fixes |

**Disambiguation rules:**
- p0 vs p1: does it affect the *core* path (the thing users come to do) for *all* users? p0. Otherwise p1.
- p1 vs p2: is there a workaround a user can apply themselves? Workaround exists → p2. No workaround → p1.
- p2 vs p3: does this block someone from getting their work done? Blocks → p2. Doesn't block, just feels off → p3.
- "I want this soon for a demo" → not a severity input. The deadline is a separate signal; severity describes the issue's impact.

## Effort

Calibrated. Trust your gut, then pick the bucket below it (gut-feel is consistently optimistic).

| Label | Definition | Calibration |
|-------|-----------|-------------|
| **xs** | ≤1 hour, no surprises expected | Adjusting a CSS rule; renaming a variable; updating a doc paragraph |
| **s** | ≤1 day, scope is fully understood | Adding a Carbon component to an existing dashboard; writing one new node in an established LangGraph |
| **m** | 1–3 days, scope is mostly understood, minor unknowns | New API endpoint with auth + tests; new agent graph node + state schema field |
| **l** | 1 week, scope is understood, real unknowns expected | New sub-app feature touching 3+ packages; agent-graph refactor; auth-touching change |
| **xl** | >1 week, scope is partially understood — STOP and split | New sub-app from scratch; cross-package consolidation; auth system overhaul |

**xl is a flag, not an estimate.** If something genuinely is xl, it should be split into multiple m/l issues before going on the backlog. The skill flags xl items as anomalies and recommends `/plan-feature` to split.

## Domain

Six buckets. Pick one (the most-affected, if multiple). The skill uses domain to cluster the backlog and route issues to the right human reviewer.

| Label | Scope |
|-------|-------|
| **auth** | Authentication, authorization, session, ownership middleware, token storage, JWT, OAuth |
| **agent-graph** | LangGraph state machines, nodes, routing, checkpointer, RAG, agent orchestration |
| **ui** | Browser-app code, Carbon components, layout, animations, accessibility |
| **infra** | Build tooling, CI/CD, dev env (workbench, frame-dev), Docker, deploy scripts, env vars |
| **docs** | README, CLAUDE.md, domain-knowledge, ADRs, GLOSSARY, CONTEXT, daily-logger articles |
| **ops** | Production observability, telemetry, hooks, monitoring, runbooks, incident response |

**Disambiguation:**
- Backend route that handles auth: `auth` (auth wins over the route's other concerns).
- Frontend that calls an agent: `ui` if the bug is in the UI rendering; `agent-graph` if the bug is in the agent's response shape.
- "Add new sub-app" doesn't fit cleanly — usually `infra` (because the scaffold work is infra-shaped). Once the sub-app exists, its issues go to `ui` / `agent-graph` / `auth` as normal.

## Type

What kind of work is this?

| Label | Scope |
|-------|-------|
| **bug** | Broken behavior; defect; regression |
| **feature** | New user-visible capability |
| **refactor** | Restructure existing code, no user-visible change |
| **architecture** | Cross-package or cross-repo structural change; usually has an ADR |
| **docs** | Doc-only changes |
| **chore** | Maintenance: dep upgrades, config tweaks, CI tuning |

**Disambiguation:**
- "Add tests" alone → `chore` (or fold into the bug/feature it tests).
- "Improve performance" → `refactor` if there's no user-visible spec change; `feature` if the user-visible spec includes a perf budget.
- "Migrate from X to Y" → `architecture` if cross-package; `refactor` if local; `chore` if dep-only.

## Ordering function

```
priority_score = severity_weight / effort_weight

severity_weight: p0=8, p1=4, p2=2, p3=1
effort_weight:   xs=1, s=2, m=4, l=8, xl=16
```

| | xs | s | m | l | xl |
|-|----|----|----|----|----|
| **p0** | 8.0 | 4.0 | 2.0 | 1.0 | 0.5 |
| **p1** | 4.0 | 2.0 | 1.0 | 0.5 | 0.25 |
| **p2** | 2.0 | 1.0 | 0.5 | 0.25 | 0.125 |
| **p3** | 1.0 | 0.5 | 0.25 | 0.125 | 0.0625 |

Higher = do first.

**Tie-breaks** (same score):
1. Older issues first (`createdAt`).
2. `bug` before `feature` before `refactor` before everything else.
3. Lexicographic by issue number (deterministic last resort).

## Common rubric anti-patterns

**The "everything is p1" backlog.** Symptom of severity drift — author urgency leaking into severity. Fix: enforce that p1 has a *user impact* clause. If no users are affected, downgrade.

**The "everything is medium effort" backlog.** Symptom of estimation laziness. Fix: force one xs and one xl into every triage pass — calibrate against extremes.

**The "everything is a feature" backlog.** Symptom of treating bugs as features-of-omission. Fix: bug is "broken thing"; feature is "missing thing." If a user expected it to work and it didn't, it's a bug.

**The "creative new label" backlog.** Symptom of the rubric not fitting the work. Almost always means the work is a bundle that should be split. If the rubric *genuinely* doesn't have a category, raise it as an anomaly and let the user decide whether to extend the rubric (a deliberate, durable change).

## Updating the rubric

If the rubric needs to change:
1. The change is an architecture decision — write an ADR proposing it.
2. The change updates this file *and* the GitHub label set across affected repos.
3. Re-triage existing issues against the new rubric (the skill will surface anomalies).

Don't tweak severity definitions ad-hoc. The whole point of the rubric is reproducibility; per-session redefinition defeats it.
