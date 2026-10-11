# Workflow evidence requirements

## Resolve the workflow

Paths are relative to daily-logger unless marked as saved-task evidence.

| Request | Defining evidence |
| --- | --- |
| Scheduled article generation | `.github/workflows/daily-blog.yml`, `.github/scripts/daily_blog_schedule.py`, matching Actions receipt |
| Editorial revision | `.github/workflows/editorial-revise.yml`, accept PR body, full comments, final head and merge |
| Cleaner follow-up | `.github/workflows/daily-cleaner.yml`, `src/clean.ts`, triggering blog run and cleaner receipt |
| Scheduled agent issue intake | Matching saved task prompt, status, schedule, and latest receipt |
| Article queue disposition | Article action IDs, full linked issues, editorial discussion, and existing tracking records |

For "will it pick up this issue?", resolve the intended task's intake before
choosing collection, reconciliation, or execution as the subject. If the task is
unidentified, ask for its name or receipt. An incomplete local inventory does not
establish absence of a task elsewhere.

## Issue pickup

Return separately supported statements about:

- Expected input, based on eligible repos and the identified task's query and limits.
- Observed input, based on a receipt from the matching invocation.
- Article mention or suggestion, based on generated output, not mere collection.
- Tracked work, based on canonical issue, action, and linked bead identities.
- Execution, based on the worker's admission rules and actual authorization.

For article collection, inspect `src/fleet.ts`, `src/collect-context.ts`, and
`src/activity-window.ts`. Bounded queries and truncated bodies cannot establish
exhaustive intake. For a saved agent task, inspect that task's own intake instead.
Fetch full relevant issues and PR comments before evaluating acceptance criteria
or human gates. Record inaccessible evidence as a gap rather than reconstructing it.

Completion: the answer identifies the task and marks every pickup claim as an
expectation, observed receipt, or unknown.

## Queue follow-up

Preserve original article action IDs. Inspect editorial tangents outside the
workflow feedback payload. Match each item to existing issues and tracking before
proposing new work. Orientation reports proposed dispositions without mutating them.

For each item, report its identity, evidence, disposition, and next action.
For a human gate, add the owner, exact decision, evidence packet, and checkpoint.
Mark the checkpoint requested, agreed, or elapsed. If no checkpoint is agreed,
request confirmation instead of inventing a deadline. Resurface an elapsed
checkpoint during authorized review with a concrete decision request.

Completion: every original action and discovered tangent is accounted for.
Distinguish verified delivery, proposed follow-up, and retained gates. Elapsed time
or silence is not approval. A reminder needs separate scheduling authorization.

## Timing

Compare the declared trigger, Actions creation and start, generation completion,
editorial merge, and deployed publication evidence as separate events. Include
the date and timezone of each event. Check the activity-window anchor separately
from the trigger schedule. Match dependent cleaner receipts to their blog run.

For local tasks, use this invocation's receipt. Historical access success does
not prove current access. An approval timeout means the check was unexecuted.
Local schedules depend on an available host and app.

Completion: each known event has a timestamp and source. Unknown timestamps
remain explicit. Attribute a delay only to the interval the evidence supports.
