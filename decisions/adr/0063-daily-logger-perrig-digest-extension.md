# ADR-0063: daily-logger perRig digest extension

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /frame-standup, /diagram-intake, /daily-logger
Repos affected: daily-logger (src/schema.ts, src/generate-article.ts, src/build-api.ts), gastown-pilot (api/intake adapters)

---

## Context

`daily-logger` already runs an overnight pipeline that emits one article per day to `articles/YYYY-MM-DD.md` and a static JSON API at `daily-logger/api/*.json`. The pipeline is scheduled by `.github/workflows/daily-blog.yml` at 09:00 UTC. The article schema (`daily-logger/src/schema.ts`, `ArticleDataSchema`, v2) carries `whatShipped`, `decisions`, and `suggestedActions`, but every entry in `suggestedActions` is global to the day — there is no per-rig partition, no rationale field, no priority tier, and no carry-forward state.

The morning ritual (ADR-0038) reads the article, the developer photographs three pencil bullets per rig, and `/diagram-intake` parses the photo into structured priorities. The Intake tab in gastown-pilot (ADR-0061) renders the photo and the parsed priorities. The gap: the developer wants the article to *propose* three suggestions per registered rig before the photo is even taken, so the photo session becomes confirm-or-override rather than green-field authoring.

This ADR extends `ArticleDataV2` with a `perRig` map. The 09:00 UTC run produces one `RigDigest` per registered rig. The Intake tab (ADR-0061) reads the same JSON and renders each rig's three suggestions next to the photo column. Promotion of a suggestion creates a FrameBead via `BeadStore.create()` (ADR-0016) with the reserved label keys defined in [ADR-0062](0062-reserved-framebead-label-keys.md).

Originally drafted as ADR-008 in the 2026-04-30 handoff; renumbered to fit `core/decisions/adr/` flat numbering.

Cross-references: [ADR-0056](0056-developer-day-orchestration-master.md) (master), [ADR-0038](0038-morning-workflow-orchestration.md) (morning workflow), [ADR-0035](0035-daily-cleaner-inference-budget-cap.md) (inference budget cap pattern), [ADR-0036](0036-lock-file-rebuild-protocol.md) (article lifecycle / lock-file protocol), [ADR-0061](0061-gastown-pilot-intake-tab.md) (Intake tab consumer), [ADR-0062](0062-reserved-framebead-label-keys.md) (label keys for promotion).

## Decision

### Schema extension

Extend `daily-logger/src/schema.ts` with three new exports next to the existing `ShipmentEntrySchema` and `ActionItemSchema`:

```ts
export const RIG_PRIORITY_TIERS = ['feature', 'quality', 'infra', 'research'] as const

export const RigSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  priority_tier: z.enum(RIG_PRIORITY_TIERS),
  evidence: z.array(z.object({ type: z.string(), uri: z.string().optional() })),
  estimated_size: z.enum(['S', 'M', 'L', 'XL']).optional(),
  status: z.enum(['proposed', 'deferred', 'declined']).default('proposed'),
})

export const RigDigestSchema = z.object({
  rig: z.string(),
  generated_at: z.string(),
  digest_run_id: z.string(),
  previous_day_summary: z.object({
    beads_completed: z.number(),
    beads_in_progress: z.number(),
    convoys_landed: z.array(z.string()).optional(),
    test_coverage_delta: z.string().optional(),
    open_prs: z.number().optional(),
  }).optional(),
  suggestions: z.array(RigSuggestionSchema),
  critical: z.array(RigSuggestionSchema).optional(),
})
```

`ArticleDataSchema` gains one optional field:

```ts
perRig: z.record(z.string(), RigDigestSchema).optional()
```

The migration is additive. v1 fallback (`StructuredArticle`) is unaffected. Articles without `perRig` parse as before.

### Schedule

The 09:00 UTC `daily-blog.yml` GitHub Action keeps its existing trigger. The per-rig digest extension rides the same run. No launchd job, no second cron, no separate workflow.

### Generation strategy

`src/generate-article.ts` gains a second pass after the main article is drafted:

1. Read the registered-rig list from the workbench config (`~/.tmux/workbench/frame.json`, `~/.tmux/workbench/games.json` per [ADR-0051](0051-rigprofile-workbench-partition.md)).
2. For each rig, gather: the last 7 days of digests (read from prior `articles/*.json` via `perRig[rig]`), the rig's GitHub state (open PRs, commit cadence, test coverage delta), the rig's `ROADMAP.md` if present.
3. Issue one Claude call per rig with the prompt at `daily-logger/src/prompts/per-rig-digest.md` (versioned `1.0.0`).
4. Validate the response against `RigDigestSchema`; on validation failure, log and skip the rig.
5. Aggregate into `perRig` and write the article.

The prompt template lives at `daily-logger/src/prompts/per-rig-digest.md` and is read at runtime. Versioning matches the existing prompt-versioning pattern in `src/generate-article.ts`.

### Roadmap parsing

ojfbot `ROADMAP.md` files (e.g. `daily-logger/ROADMAP.md`) use prose narrative, not checkbox markdown. The generator parses what it finds: extract milestone bullets via heuristic (lines starting with `- `, `1.`, `**Phase`), score recency by referenced commit dates, surface the slowest-moving milestone as a `feature` priority suggestion when relevant. No format change to ROADMAP files.

### Critical sub-array

The original handoff named a separate "deacon items" queue for security audits and broken builds. Per the ojfbot vocabulary rule (`witness`/`worker`/`mayor`, `gastown-pilot/CLAUDE.md:67`), the queue renames to `critical` and lives as a sub-array on `RigDigestSchema`. `critical` items render with a distinct badge in the Intake tab (ADR-0061) and also flow into the existing `suggestedActions` array with `status: open` for backward compat with v2 article consumers that predate this ADR.

### Status carry-forward

`RigSuggestionSchema.status` replaces the original "still pending" badge. Values: `proposed` (default), `deferred`, `declined`. When the next morning's run regenerates, suggestions in the prior digest with `deferred` carry forward into the new digest verbatim. The Intake tab (ADR-0061) renders deferred suggestions with a "still pending" tag.

### Promotion to bead

daily-logger does not write beads directly. Suggestions sit in the per-rig digest until the developer promotes them in the Intake tab. Promotion creates a FrameBead via `BeadStore.create()` (ADR-0016) with `labels.source = 'daily_logger'`, `labels.digest_run_id`, and `labels.digest_suggestion_id` populated per [ADR-0062](0062-reserved-framebead-label-keys.md).

### Build-api emission

`src/build-api.ts` emits a new file `daily-logger/api/per-rig.json` keyed by date and rig. The Intake tab reads this file (or the served API endpoint) to render per-rig suggestions without parsing the full article markdown.

### Cost cap

Sixteen registered rigs × ~3000 input + ~1000 output tokens per call ≈ 64k input / 16k output total per run. `daily-logger/.env.example` gains `MAX_DIGEST_BUDGET_USD` (default `0.50`). When the running cost crosses the cap, the generator stops mid-iteration, writes a partial digest with `truncated_at_rig` set on `ArticleDataSchema`, and proceeds to article commit. The pattern follows [ADR-0035](0035-daily-cleaner-inference-budget-cap.md).

## Consequences

### Gains
- The article becomes an active suggestion source for the morning ritual instead of a passive log.
- The Intake tab opens with three suggestions per rig prefilled, so the photo session is confirm-or-override.
- `status: deferred` carry-forward means a suggestion the developer skipped on Tuesday reappears Wednesday with a "still pending" tag — no manual tracking.
- Schema additive — `articles/*.json` files written before this ADR continue to parse against `ArticleDataV2`.
- The 09:00 UTC GitHub Action stays the only schedule; no new launchd or second cron to maintain.

### Costs
- One Claude call per rig per day. At 16 rigs and the prompt sizes above, the run cost grows by ~$0.30–$0.50 per day; bounded by `MAX_DIGEST_BUDGET_USD`.
- `src/generate-article.ts` grows a second pass and a per-rig validation loop.
- The Intake tab (ADR-0061) needs to consume `daily-logger/api/per-rig.json` and render the three-column layout.
- Prompt versioning at `daily-logger/src/prompts/per-rig-digest.md` is a new artifact to maintain.

### Neutral
- The roadmap-parsing heuristic is best-effort. When the heuristic misses, the rig still produces three suggestions from GitHub state alone.
- `critical` items also appear in `suggestedActions` for backward compat. Consumers that read `suggestedActions` see them; consumers that read `perRig[rig].critical` see them. Same data, two surfaces.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Move to a 05:30 local launchd job (per the original handoff). | Splits the schedule across two surfaces. The 09:00 UTC GitHub Action already runs the article pipeline; co-locating the digest pass keeps one cron, one log surface, one point of failure. |
| Write per-rig digests to a separate file (`digests/YYYY-MM-DD/<rig>.json`) instead of extending `ArticleDataV2`. | Doubles the storage path and forces consumers to fetch two files per day. The Intake tab already fetches the article JSON; `perRig` rides for free. |
| Have daily-logger write FrameBeads directly for suggestions. | Loses the developer-confirmation step. The Intake tab (ADR-0061) is where promotion happens; daily-logger stays a proposer, not a writer. |
| Require ROADMAP.md to use checkbox grammar. | ojfbot ROADMAP.md files use prose narrative today. A grammar requirement is a coordinated edit across 15+ rigs for marginal generator simplicity. |
| Keep the "deacon items" name from the original handoff. | Vocabulary collision with the broader ojfbot tree. `critical` matches the ubiquitous-language rule (no new top-level term when an existing English word fits). |
| One Claude call across all rigs in a single prompt. | Cross-contamination of context. A 16-rig single prompt either truncates context per rig or balloons input cost. Per-rig calls are bounded and parallelizable. |

## Acceptance criteria

- `daily-logger/src/schema.ts` exports `RigDigestSchema`, `RigSuggestionSchema`, and `RIG_PRIORITY_TIERS`; `ArticleDataSchema` carries `perRig` as an optional field.
- `daily-logger/src/build-api.ts` emits `daily-logger/api/per-rig.json` keyed by date and rig.
- The 09:00 UTC GitHub Action produces the per-rig digest in the same run as the existing article; `pnpm generate:dry` for `DATE_OVERRIDE=2026-04-30` includes per-rig output.
- gastown-pilot's Intake tab (ADR-0061) reads `daily-logger/api/per-rig.json` and renders three suggestions per registered rig, with Add-to-today / Defer / Decline.
- Promoting a suggestion creates a FrameBead with `labels.source = "daily_logger"`, `labels.digest_run_id`, and `labels.digest_suggestion_id` populated per ADR-0062.
- A deferred suggestion appears in the next morning's digest with `status = deferred`; the Intake tab renders the "still pending" tag.
- A `critical` item created by the digest run appears in the existing `suggestedActions` array with `status: open` for backward compat.
- `MAX_DIGEST_BUDGET_USD` enforcement: a deliberately constrained run produces a partial digest with `truncated_at_rig` set on `ArticleDataSchema`.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA (parent) | `5c2b13225c500af82431ea1a2c810951f9f8e895` |
| Slice zero-point SHA | `_pending_` |
| daily-logger HEAD at start | `_pending_` |
| Schema migration | additive (new optional field on ArticleDataV2; v1 fallback unaffected) |
| Per-rig digest prompt version | `1.0.0` |
| Originally drafted as | ADR-008 (handoff message, 2026-04-30) |
| Manifest | `core/decisions/orchestration/DD-2026-04-30.md` |
