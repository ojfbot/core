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

## Step 1: Read these files first

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
- **The Claude-call count is N+1 with council, 1 without — and it's a cost invariant.** A change that adds a per-persona call or breaks `SKIP_COUNCIL=true` silently multiplies nightly API spend. Always state the call math before and after any pipeline edit.
- **Read the actual `src/` after the brief, not instead of it.** `knowledge/architecture-brief.md` orients; `src/council.ts`, `src/index.ts`, and `src/types.ts` are ground truth. The brief can lag the code — when the orientation summary contradicts the source, the source wins, and flag the drift.
- **The load-bearing invariants are easy to break and invisible in tests.** Fallbacks, deduplication, and the 7-day previous-articles window are what keep the nightly run from posting duplicate or empty articles. Name them in Step 2 so a later change doesn't quietly remove one.
- **`personas/` lives in the daily-logger repo, not core.** This skill runs against `../daily-logger`; reading core's personas or paths produces an orientation for the wrong repo.

---

$ARGUMENTS
