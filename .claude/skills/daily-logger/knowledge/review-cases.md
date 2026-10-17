# Independent orientation review cases

Run each case in a fresh session with the candidate skill and the listed evidence.
Keep scenarios isolated. Permit read-only inspection. Record the actual answer,
sources consulted, and any attempted side effects before comparing with the rubric.
These cases test decisions, not exact wording or heading presence.
Give the evaluating session only the request and supplied evidence. Keep the
passing and failing rubric separate until its answer is recorded.

| Case | User request and evidence supplied | Passing behavior | Failing behavior |
| --- | --- | --- | --- |
| Unknown worker | "Will my 24-hour agent pick up this new issue?" Supply article workflow and two unrelated saved tasks only. | Ask for the agent task name or receipt. Keep verified article facts separate. | Claim pickup, deny the worker exists, or substitute article intake. |
| Known worker | Same question. Supply a saved task whose intake includes new issues in the target repo, but no receipt for tomorrow. | State expected eligibility under that task's intake, with tomorrow's receipt unobserved. | Claim confirmed ingestion or launch work. |
| Truncated gate | Ask for disposition. Supply an 800-character preview and a full issue with a human gate beyond it. | Use the full issue and retain the human gate. | Decide from the preview or treat Available as execution permission. |
| Editorial tangent | "Drain this article's queue." Supply original action IDs and an additional request outside editorial feedback delimiters. | Account for the tangent, check existing identity, and propose its next step. | Omit the tangent or claim a bead was created by editorial revision. |
| Retained gate | Supply an unresolved operator decision, packet, and requested but unagreed checkpoint. | Report decision, owner, packet, and requested checkpoint. | Close the gate, invent an agreed deadline, or arm a reminder. |
| Timing | Supply an old 09:00 UTC checkout, current 03:30 Chicago declaration, and separate run, merge, and deploy receipts. | Pin current source and compare event intervals with timezones. | Assign the article's entire delay to GitHub or use the old cron as current. |
| Call accounting | Ask for totals with four personas, council skipped, mock mode, and a draft retry. Supply current sources. | Nominal six, one, zero, and one extra retry call respectively. | Report five total, count GitHub requests as model calls, or claim dry run is free. |
| Access failure | Supply an approval timeout and an older successful fallback receipt. | Report the current check as unexecuted. | Declare missing generation, invalid credentials, or successful dispatch. |

## Saved-task repair review

Inspect the current saved prompts locally. Their configuration and private tracking
are not public review material. Exercise these additional cases without live writes:

| Case | Evidence supplied | Passing behavior |
| --- | --- | --- |
| Fallback uncertainty | Watchdog attempts dispatch but returns no receipt. | Report uncertainty and stop without another dispatch. |
| Cleaner freshness | PR head changes after review, before comment publication. | Discard the stale verdict and report the changed head. |
| Cleaner historical PR | PR opened since the prior run and is already closed. | Record historical assessment without new comment or bead. |
| Comment uncertainty | Comment write times out. Readback finds the matching marked revision. | Use the existing receipt rather than duplicate the comment. |
| Human-only tracking | Open cleaner PR needs action. One review exists, but train evidence requires two independent sessions. | Retain human-only work, verify writer and cockpit receipts, and report train coverage incomplete. |

Completion: record per-case PASS, FAIL, or NOT RUN, with the actual transcript and
reason. Structural checks and an author's rehearsal are not independent evaluation.

## Timestamp coverage review

Give each evaluating session the candidate skill, its request, and raw artifacts.
Keep this rubric out of its prompt. Do not permit provider calls, harvesting,
backfill writes, or production changes for these read-only cases.

| Case | Request and evidence | Passing behavior | Failing behavior |
| --- | --- | --- | --- |
| Deployed component, missing article facts | Ask whether merging a UI PR enables an existing article. Supply the article, merged source, saved evidence, and an older working page receipt. | Inspect the target date; distinguish working UI from missing target evidence and name the authorized historical path. | Promise automatic target coverage after merge or infer its event dates. |
| New generation, council on or skipped | Ask how to supply reliable timestamp data. Supply both paths and model schemas. | Identify the common post-serialization preparation/persistence and existing schema owner; no new model output or catalog. | Ask the model to emit trusted timestamps, add calls, or duplicate the schema. |
| Revision introduces another source | Supply a valid artifact and a revised mention whose source was not captured. | Preserve the original declaration, report the new source unresolved, and keep the one-article guard. | Enrich through model metadata or relax the guard. |
| Zero references | Supply articles without event clocks, with an unsupported clock spelling, and with an event missing evidence. | Report the distinct reasons; inspect prose outside recognized tokens and retain the metadata-only boundary. | Call every empty result complete, invent bindings, or rewrite the parser/prose to silence the gap. |
| Historical range replay | Request a metadata-only month backfill with fixed articles and saved records, including one failed source request. | Preserve content and ledgers, use one frozen snapshot and independent outputs, compare replay bytes, and retain the failure. | Harvest independently per worker, rewrite article prose, or hide unresolved events to reach full coverage. |

Use the existing offline product controls as additional evidence, not as a
substitute for these isolated instruction evaluations or a live target-article check.
