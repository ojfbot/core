---
type: defect-report
slug: selfco-port-collision-3035
class: false-assertion
severity: medium
status: open
disposition: repair-doc
location: "selfco:wiki/entities/capture-agent.md:6"
claim: "ports: [3035, 3036]"
actual: "3035/3036 are asset-foundry's; capture-agent (formerly gcgcca) binds nothing. Two entities declare the same ports."
claim_probe: "grep -q '^ports: \[3035, 3036\]' ~/selfco/wiki/entities/capture-agent.md"
truth_probe: "grep -rl '^ports: \[3035, 3036\]' ~/selfco/wiki/entities/ | wc -l | tr -d ' '"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit"
---

# Two repo entities claim the same ports

`entities/asset-foundry.md:5` and `entities/capture-agent.md:6` both declare `ports: [3035, 3036]`.
`core/CLAUDE.md` assigns 3035 to asset-foundry and no port to capture-agent. A live check found
only 6 of the 26 declared ports across the vault actually listening; 29 of 44 repo
entities carry `ports: []`, which is indistinguishable from "this repo has no ports" and
from "nobody filled it in".

## Why it matters

Port assignment is the one piece of fleet state where a duplicate is not merely stale but
*actively wrong* — it will collide at run time. Nothing lints for uniqueness because
nothing owns the field: `ports:` appears in no generated source, and `bases/repos.base`
displays it without validating it.

## Repair

Per decision #7 (the vault never copies fleet state), the durable repair is to remove
`ports:` from entity frontmatter and let the generated fleet registry own it, with a
uniqueness lint. Interim: correct capture-agent's value to `[]`.

## Closure

`claim_probe` exits non-zero once capture-agent no longer declares 3035/3036. `truth_probe`
returns the number of entities declaring that pair — it should read 1, and a value of 0 is
also acceptable (both moved to the registry).
