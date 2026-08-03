Reference for `/triage` Step 2: the proposal-table format, worked examples, and the reason-column bar.

| # | Title | Severity | Effort | Domain | Type | Reason |
|---|-------|----------|--------|--------|------|--------|
| 12 | Auth bypass on /api/v2/threads | p0 | s | auth | bug | data-exposure risk; affects all users |
| 17 | Add markdown preview to chat | p3 | m | ui | feature | nice-to-have; no blocker |

The reason column is one short clause — what made you pick that severity. Reasons are auditable; "p1 because it's bad" is not.

Reasons must cite specifics: "p0 because data loss" with a sentence pointing at the actual exposure. Not "p0 because critical."
