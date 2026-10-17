# Time-reference evidence

Use this reference for article time-popover coverage, missing timestamp data,
generation, revision, and historical reconstruction. This skill reports evidence;
it does not authorize generation, harvesting, a backfill, or publication.

Resolve the daily-logger checkout and pin the inspected commit first. Read its
`docs/time-popovers.md` and `docs/backfill-time-references.md`. Those documents and
the owning source define the schema and supported events. Do not create a parallel
schema or ask a model to supply metadata that the code owns.

## Identify who supplies the data

| Operation | Primary source | Evidence to inspect |
| --- | --- | --- |
| Collection | `src/collect-context.ts`, `src/types.ts`, `src/time-references.ts` | Full source identity and distinct author, committer, and PR-event instants |
| Generation | `src/index.ts`, `src/article-time-metadata.ts` | `prepareGeneratedTime` after final prose serialization, followed by `persistGeneratedTime` on the write path |
| Ordinary editorial revision | `src/article-time-frontmatter.ts`, `src/revise-article.ts` | Original declaration detached from model input, model additions discarded, original declaration restored |
| Historical reconstruction | `src/backfill-times.ts` and the backfill guide | Frozen evidence snapshot, article revisions, sidecar, and unresolved report |
| API publication | `src/build-api.ts`, `src/article-time-metadata.ts` | Current article prose independently resolved against retained facts |
| Rendering | Frontend time-popover components and `packages/frontend/e2e/time-popovers.spec.ts` | Actual timestamp control, event date, UTC instant, device-local value, and map |

Drafting and council synthesis produce editorial content, not time evidence.
Normal generation already retains bounded facts at
`api/time-records/<date>/<digest>.json` and writes `time_records_sha256` in the
article. Inspect both the article and artifact in the generated commit. A pointer
without its matching valid artifact establishes no usable source evidence.
Preparation is shared by council and skipped-council paths. It adds no model call.
The credit probe and ordinary authoring calls remain separate; dry run is not an
offline mode. Use committed mocked tests for offline verification.

## Assess one article

Record its date, source commit, article blob, and actual rendered event mention.
Classify each candidate clock from the reader's `references`, `warnings`, and
`unresolved` results at that source. Do not treat an empty array as proof that
coverage is complete.

- **Resolved:** evidence and current prose agree on source, event, day, instant,
  occurrence, and precision. Confirm the API emits that reference.
- **Unresolved:** retain the reader's reason, such as missing evidence or ambiguity,
  and identify the missing source or declaration. A bare UTC clock has no event day.
- **Not an eligible event mention:** explain the bounded reason. A schedule,
  reporting-window bound, or approximate range is not automatically an instant.
  Absence of an eligible clock is different from a missing record for an event.

Use the named event, not another record with the same clock. Do not substitute the
article date for an event date or a present-day mutable PR update/close time for a
historical event. Conflicting facts and exhausted capture remain unresolved.
Complete timestamps with an explicit date and offset may describe themselves;
that establishes stated-time provenance, not independent GitHub verification.

For a coverage sweep, enumerate the actual dated articles in the requested period.
Report per-date resolved references, unresolved reasons, warnings, and relevant
ineligible mentions. Compare rendered clock spellings with the reader's recognized
candidates: an unsupported spelling can escape its unresolved report. Record that
gap separately rather than declaring the article free of event times. A metadata-only
backfill does not authorize changing the parser or prose to remove those gaps.
Keep the source and article revisions fixed for the comparison.
Future dates without articles are absent, not passing coverage. Preserving raw
diagnostics makes the next run comparable without inventing a coverage score.

## Choose the right operation

**New generation:** inspect the committed artifact and digest, then the API built
from the same source. A captured source group can contain competing facts; do not
prune it to make one answer appear certain. A digest proves byte identity, not
provider or account authenticity.

**Ordinary revision:** preserve the original declaration and immutable facts.
Rebuild and inspect references against the revised prose. A newly introduced
source may be absent from the retained selection and remain unknown. Do not widen
the one-article editorial guard or use revision to enrich timestamp authority.

**Historical article:** deployment and API building do not harvest missing events.
Use the existing reconstruction workflow only under separate authorization.
Harvest once into a frozen snapshot, then replay against it offline. Workers share
that snapshot and fixed article revisions, write distinct outputs, and merge with
one writer. Verify repeatability before publication. Preserve article prose,
acceptance state, review history, action IDs, and completion objects when the task
authorizes a metadata-only backfill. Keep unavailable source requests in the report.

If recorded evidence cannot resolve an event, report the gap. Do not infer the day,
relax validation, regenerate prose, or ask a model to invent a binding. A runtime
enforcement gap needs its own concrete repair; instructions alone do not close it.

## Verify the result at each stage

Existing offline controls in the daily-logger checkout cover distinct contracts:

```bash
pnpm test src/__tests__/model-time-output.test.ts src/__tests__/generated-time-lifecycle.test.ts src/__tests__/time-record-durability.test.ts src/__tests__/article-time-metadata.test.ts src/__tests__/time-source-binding.test.ts
```

These use mocked model or network boundaries. Inspect the actual tests at the
pinned source before claiming their scope. They check draft and synthesis metadata
exclusion, persistence, ordinary revision, missing facts, and source admission.
They do not themselves prove that a new live article has captured evidence.

For live delivery, record the generated commit or historical replay source, API
article output, and deployment receipt. Then open the **target article**, not just
an older example. Verify its expected controls and open at least one resolved event
when one exists. Check its full date and UTC instant against source, then local
date and offset at that event instant. Report articles with no eligible event
separately; do not fabricate a control to satisfy a count.

An old page proving the popover component works does not establish target-article
coverage. Keep source reconstruction, API admission, controlled browser testing,
and actual deployed observations separate. Include commands, source pins, artifact
hashes, failures, and unexecuted checks in the handoff.
