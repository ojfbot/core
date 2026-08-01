---
type: defect-report
slug: northstar-fm-inline-comment-not-stripped
class: schema-drift
severity: medium
status: open
disposition: repair-mechanism
location: "core:scripts/lib/northstar-fm.mjs:17"
claim: "scalar() parses a constrained-YAML frontmatter value; the schema doc treats registry entries as YAML, in which a trailing ' # ...' is a comment."
actual: "Inline comments are not stripped. decisions/northstar/README.md:39 'slug: buddy-check   # NB: ...' parses as a 91-char slug with the comment glued on. northstar-lint.mjs never caught it because it resolves entries by path, not slug; /wayfinder's resolve-anchor.mjs is the first slug-keyed consumer and had to work around it. A naive fix is unsafe: roadmap-l2-ojfbot.md:301 has title: \"Calibrate judge #1 — ...\" and entrance/deliverable prose citing 'PR #165', so stripping must be quote-aware or it will truncate live roadmap slices and break an operational CI gate."
claim_probe: "node --input-type=module -e \"import{loadRegistry}from'./scripts/lib/northstar-fm.mjs';process.exit(loadRegistry('.').entries.some(e=>/\\s#/.test(String(e.slug)))?0:1)\""
filed: 2026-08-01
filed_by: "agent:claude-opus-5"
evidence: "path:.claude/skills/wayfinder/scripts/resolve-anchor.mjs"
---

# scalar() parses a constrained-YAML frontmatter value; the schema doc treats registry entries as YAML, in which a trailing ' # ...' is a comment.
**Actual:** Inline comments are not stripped. decisions/northstar/README.md:39 'slug: buddy-check   # NB: ...' parses as a 91-char slug with the comment glued on. northstar-lint.mjs never caught it because it resolves entries by path, not slug; /wayfinder's resolve-anchor.mjs is the first slug-keyed consumer and had to work around it. A naive fix is unsafe: roadmap-l2-ojfbot.md:301 has title: "Calibrate judge #1 — ..." and entrance/deliverable prose citing 'PR #165', so stripping must be quote-aware or it will truncate live roadmap slices and break an operational CI gate.
## Why it matters
_(unwritten — filed mid-work)_
## Repair
_(unwritten)_
