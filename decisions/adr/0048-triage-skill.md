# ADR-0048: Skill /triage and the severity/effort/domain/type rubric

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR4 (backlog hygiene)
Commands affected: /triage (new), /roadmap, /plan-feature, /orchestrate, /sweep
Repos affected: all (where GitHub Issues are used)

---

## Context

ojfbot has 16 repos with GitHub Issues open across most of them. The current state:
- No consistent label scheme across repos. Some repos use `bug`/`enhancement`, others have nothing.
- "Priority" is implicit and per-author. Two engineers picking what to do next from the same backlog will pick differently.
- Stale issues accumulate because there's no surfacing mechanism for "old + still p3 = close or upgrade."
- `/roadmap` produces directional priorities ("focus on auth this sprint"); nothing translates that into a per-issue ordered list.

Pocock's `/triage` skill addresses the labeling-and-ordering layer. We adopt it with an opinionated rubric tailored to ojfbot's failure modes (auth = always p0/p1; agent-graph state corruption = p0; UI polish = p3 unless it blocks the demo path).

The rubric needs to be *rigid* — same labels and ordering function across every triage session, every repo. Reproducibility is the goal; flexibility defeats the point.

## Decision

Ship `/triage` at `.claude/skills/triage/triage.md` with one knowledge file:
- `knowledge/triage-rubric.md` — full rubric (severity p0–p3, effort xs–xl, domain six-bucket taxonomy, type six-bucket taxonomy), disambiguation rules, ordering function, anti-patterns, rubric-update protocol.

Ordering function: `priority_score = severity_weight / effort_weight` with `p0=8, p1=4, p2=2, p3=1` and `xs=1, s=2, m=4, l=8, xl=16`. p0/xs scores 8.0; p3/xl scores 0.0625. Higher = do first. Tie-breaks: older first, bug before feature, then issue-number lexicographic.

Required GitHub label scheme (per repo):
- `severity/{p0,p1,p2,p3}`
- `effort/{xs,s,m,l,xl}`
- `domain/{auth,agent-graph,ui,infra,docs,ops}`
- `type/{bug,feature,refactor,architecture,docs,chore}`

The skill warns when these don't exist and outputs `gh label create` commands; it does *not* create them automatically (label schema is repo-level config and should be a deliberate setup step).

Modes:
- Default — classify, order, output proposals; no writes.
- `--repo=<name>` — scope to specific repo.
- `--limit=<n>` (default 100), `--filter=<query>` (gh filter syntax).
- `--apply` — write labels via `gh issue edit`. Requires user to have reviewed proposals.
- `--reorder` — output the backlog as a numbered checklist suitable for project boards.

Postflight: anomaly detection — issues with no clear domain, xl items mislabeled as smaller, p2/p3 items >90 days old. Surfaced as a separate section, not auto-acted-on.

## Consequences

### Gains
- Deterministic backlog ordering. Two sessions triaging the same repo produce the same ordered list (modulo new issues).
- "What should I work on next" stops being a judgment call. The top of the score-sorted backlog is the answer.
- Stale-issue cleanup becomes mechanical — `--filter=updated:<2026-01-28 label:severity/p3` finds candidates for closure.
- Cross-repo comparability: a p0/s in cv-builder and a p0/s in shell are the same priority. Lets us reason about overall backlog health, not per-repo backlog health.
- ADR-required for rubric changes prevents rubric drift. The whole rubric only changes via deliberate decision, not session-to-session redefinition.

### Costs
- Requires consistent label setup per repo. One-time cost; the skill outputs the `gh label create` commands but doesn't auto-create them (deliberately).
- Authors who like fluid priorities will find the rubric rigid. That's the point — fluid priorities don't compose across repos and sessions. The rigidity is the feature.
- Some issues genuinely don't fit the four-axis scheme (e.g., a research issue that's neither bug nor feature). Mitigated by the `chore` type as a catch-all and by the anomaly detection surfacing un-classifiable issues.
- Adds another label-management surface. Mitigated by `--apply` being explicit; default mode is read-only.

### Neutral
- Six domain buckets is opinionated. We intentionally don't have separate domains for cv-builder vs blogengine (those are repos, not domains). The cross-repo failure modes (auth, agent-graph) are the domains; per-repo concerns sit inside them.
- Effort calibration is rough. xs/s/m/l/xl is good enough for ordering; not a substitute for sprint estimation.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Free-form labels per repo | Status quo — broken. No cross-repo ordering possible; "priority" means different things in different repos. |
| Three-axis rubric (drop type) | Type is what distinguishes a refactor from a feature; tie-breaks need it. Removing it makes the backlog feel mushy. |
| GitHub project board priority field | Project boards are a UI on top of labels; using labels as the source of truth means the data is portable across repos and tools. |
| ML-driven prioritization | Way out of scope; reproducibility goal is better met by a rigid scoring function than a learned model. |
| Per-repo rubrics tuned to repo concerns | Defeats cross-repo comparability. One rubric, applied universally; per-repo nuance lives in the *issues* not the rubric. |
| Auto-apply labels in default mode | Bulk-relabeling without user review is a recipe for backlog corruption (one bad rubric call updates 100 issues). Default-read-only is the right posture. |

## Implementation notes

- Skill catalog entry already shipped in PR #81 (tier 2, phase `planning`, `suggested_after: ["/roadmap", "/orchestrate"]`).
- No heuristic rule yet — `/triage` is invoked deliberately, not auto-suggested. (Could add a Tier 3 rule later: PR closes >2 unlabeled issues → suggest /triage.)
- The label scheme bootstrap is per-repo. Recommended sequence: run `/triage` against core first (small backlog); use the output to confirm the rubric works for our domain shapes; then propagate to siblings.
- Ordering function is deterministic by design. If we ever want to deprioritize old p1s (decay), that's a deliberate rubric change with an ADR — not a per-session knob.
