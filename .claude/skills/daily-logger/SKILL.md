---
name: daily-logger
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "daily-logger", "how does
  the council work", "explain the council of experts", "brief me on the article pipeline",
  "how do personas work", "what's the pnpm generate pipeline", or at the start of any
  session in the daily-logger repo. Dense orientation — no files modified.
---

Load the daily-logger architecture context and orient yourself before making any changes.

**Tier:** 1 — Context load / orientation
**Repo:** `../daily-logger` (sibling of core)

## Route the question first

For daily-run timing, issue pickup, queued actions or editorial follow-up, identify
the workflow the user means before explaining article internals. Read the project's
`docs/daily-cycle.md` when available, then inspect the relevant current merged
workflow/source or scheduled task's saved prompt and latest receipt. If the project
context file has not landed, inspect those primary sources directly.

"Pick up" usually means discover/reconcile on the next daily pass, not permission
to launch an agent. Distinguish expected collection from a confirmed run receipt,
article suggestions, linked tracked work and authorized execution. Fetch full
issues/comments for work intake; article previews can omit gates. An unidentified
scheduled skill is an evidence gap, not proof that no such workflow exists.

For article-generation questions, use Steps 1-3 below. This routing remains
read-only and does not change the scheduled task's scope or human gates.

## Step 1: Read article-pipeline context

> **Load `knowledge/architecture-brief.md`** for the full pipeline overview before reading code.

Then read the actual source:
1. `src/types.ts` — all TypeScript interfaces (`BlogContext`, `GeneratedArticle`, `Persona`, `CouncilNote`)
2. `src/council.ts` — `loadPersonas()`, `reviewDraft()`, `synthesizeWithCouncil()`
3. `src/index.ts` — the 4-phase pipeline with env var flags
4. `personas/` directory — each `.md` is an expert reviewer persona (YAML frontmatter: `slug`, `role`)

## Step 2: Confirm understanding

After reading, produce a concise orientation confirming:
- Which 4 pipeline phases run on `pnpm generate`
- Which files call Claude and with what inputs/outputs
- How many Claude calls occur per run (with vs without council)
- What `SKIP_COUNCIL=true` and `DRY_RUN=true` do
- Which invariants must not be broken (fallbacks, deduplication, 7-day previous-articles window)

## Step 3: Answer the question

Respond to `$ARGUMENTS` with this context loaded.

If no `$ARGUMENTS`: produce the orientation summary above, list the current personas
(slug + role + their primary challenge), and note any gaps visible from the file structure.

## Quick reference

**Pipeline:** collect → draft → council → synthesize+write
**Council pattern:** 1 call/persona (review) + 1 synthesis call = N+1 extra calls per run
**Add a persona:** drop `.md` with YAML frontmatter (`slug`, `role`) + markdown body in `personas/`
**Fast mode:** `SKIP_COUNCIL=true` → only Phase 1+2+4 (1 Claude call total)
**Dry run:** `DRY_RUN=true` → print to stdout, no file writes
**GitHub Actions:** runs nightly, posts to BlogEngine via `BLOGENGINE_API_URL`

## Gotchas

- **This is an orientation skill — confirm understanding before you touch code.** The trap is jumping to "fix the council" after reading the brief. Step 2 (state the phases, the call sites, the call count, the invariants) is the deliverable; skipping it means you act on a half-loaded mental model of the pipeline.
- **The nominal Claude-call count is N+2 with council, 1 without.** Council adds N reviews and one synthesis to the initial draft; draft retries can add calls. State the call math before and after a pipeline edit rather than treating N+1 extra calls as the total.
- **Read the actual `src/` after the brief, not instead of it.** `knowledge/architecture-brief.md` orients; `src/council.ts`, `src/index.ts`, and `src/types.ts` are ground truth. The brief can lag the code — when the orientation summary contradicts the source, the source wins, and flag the drift.
- **The load-bearing invariants are easy to break and invisible in tests.** Fallbacks, deduplication, and the 7-day previous-articles window are what keep the nightly run from posting duplicate or empty articles. Name them in Step 2 so a later change doesn't quietly remove one.
- **`personas/` lives in the daily-logger repo, not core.** This skill runs against `../daily-logger`; reading core's personas or paths produces an orientation for the wrong repo.

---

$ARGUMENTS
