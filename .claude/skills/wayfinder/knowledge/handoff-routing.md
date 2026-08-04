Reference for `/wayfinder`: what to do when the frontier is empty, and the wayfinder/gated-slice/roadmap boundary rule.

The charted decisions are exactly what make `entrance`/`success`/`check` statable — so don't park a spec: run `/plan-feature --from-conversation` → `/orchestrate --emit=github-issues`, and when the map is northstar-anchored, append the resulting slices to that northstar's roadmap (the map is a **slice refinery**). For initiatives carrying enforcement/automation controls, hand to `/gated-slice` instead. Then mark the map `status: handed-off`.

Per-ticket-type skill routing: `/grill-with-docs` (grilling tickets, charting variant) · `/prototype` (prototype tickets) · `/gated-slice` (post-decision staging) · `/plan-feature --from-conversation` + `/orchestrate --emit=github-issues` (handoff)

**Boundary rule:** open question is *what/whether* → wayfinder. *How to ship safely in stages* → `/gated-slice`. Once sliced → roadmap slices dispatched by `/day-run`. (Wayfinder tickets are questions closed by answers; roadmap slices are deliveries closed by merged PRs — two ledgers, never merged: answers never touch `status.jsonl`.)
