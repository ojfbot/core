# /adopt-stack decision: mattpocock/skills triage refresh (F7, triage half)

Decided 2026-08-11. Candidate pinned at main `84fdeffd12f2ee307994d1eb6feb48173b6e0502`
(2026-08-06; MIT) — **the same pin as `pocock-skills-v1-2.md`**, whose D37–D43 never
assessed `engineering/triage/`. This record closes the triage half of **F7**
(`FLEET-COORDINATION-EXTENSIONS-2026-07-04.md` §F7, "Refresh the four Pocock skills from
their now-canonical upstream"); the `/deepen` half remains open and tracked there.
**Extends D1–D43** (`pocock-skills-v1-1.md`, `pocock-skills-teach.md`,
`pocock-writing-great-skills.md`, `pocock-skills-v1-2.md`) — same framework
(`adr:wrap-absorb-reject`), numbering continues at **D44**. Not re-litigated: any D1–D43
call. Directly load-bearing here: **D4 / `adr:pocock-lifecycle-absorption`** (auto-
`ready-for-agent` at emit rejected — `/triage` owns the promotion), **D38** (root
`CONTEXT.md` glossary — the concept-matching surface D47 depends on), ADR-0083 (pin +
absorb, zero upstream files enter the tree).

Prompted by the operator studying Pocock's triage + sandcastle material (YouTube /
aihero.dev); the sibling record from the same cycle is `sandcastle.md`.

## Gate 0: LIBRARY (carried forward)

Same pin as the v1-2 measurement: prompt files, no runtime dependencies, no telemetry,
0/6 application-shaped signals. WRAP does not arise; every call is ABSORB or REJECT.

## Upstream shape at this pin

`skills/engineering/triage/{SKILL.md,AGENT-BRIEF.md,OUT-OF-SCOPE.md}` +
`docs/engineering/triage.md` + `skills/engineering/setup-matt-pocock-skills/triage-labels.md`.
A **state machine, not a rubric**: 2 category roles (`bug`/`enhancement`) × 5 state roles
(`needs-triage`/`needs-info`/`ready-for-agent`/`ready-for-human`/`wontfix`), exactly one of
each per item; terminal artifact is a durable **agent brief**; `.out-of-scope/` KB records
rejected concepts; verification precedes briefing; external PRs run the same machine.
Upstream has **no prioritization layer at all** — no severity, no effort, no ordering
function. The two skills solve overlapping but distinct problems, which is why most calls
below are ABSORB-alongside rather than replace.

## Decision table

Evidence paths relative to the pinned clone. Host invariants cite the ADR/file that owns them.

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D44 | `.out-of-scope/` KB: one design-doc-style file per rejected **concept** (not per issue), prior-request links; read wholesale before evaluating anything, matched by concept not keyword; only rejected *enhancements* enter — never already-implemented closures ("would poison the dedup checks"); maintainer confirms every match | **ABSORB, relocated to fleet level** | `OUT-OF-SCOPE.md`, `docs/engineering/triage.md` ("a request rejected six months ago comes back, and it says so and quotes the old reason") → lands at **`core/decisions/out-of-scope/`**, inheriting the existing `decisions/` symlink into every sibling repo (single-source-of-truth architecture, memory `install-agents` §4) — no installer change. Concept files carry a `repos:` applicability line. Per-repo `.out-of-scope/` rejected: fragments rejection memory across 30+ repos, most with tiny backlogs, and bypasses the symlink pattern. selfco-wiki location rejected: `/triage` must not depend on `~/selfco` existing, and the KB must be a committed, diffable artifact (host invariant; the vault is LLM-owned prose). The vault MAY cite KB files as sources — one-way reference, never the system of record. All upstream content rules kept verbatim, including the already-implemented exclusion. New ADR: `adr:out-of-scope-knowledge-base`. |
| D45 | Agent brief as the terminal artifact of `ready-for-agent`: behavioral not procedural; names types/signatures/contracts; **no file paths, no line numbers** (durability over precision — the issue may sit for weeks while code moves); concrete acceptance criteria; mandatory out-of-scope section; "the brief is the contract, the original report is only context" | **ABSORB** as `knowledge/agent-brief.md` + a brief-emission step | `AGENT-BRIEF.md` (template + good/bad examples) → F1 already observed "his AGENT-BRIEF.md maps 1:1 onto your bead brief type"; the local re-expression aligns the brief's Acceptance-criteria/Out-of-scope sections with the bead `brief` template (`bead:templates/brief`) and states the day-runner boundary: a triage brief supplies what `renderBrief()` cannot derive from a roadmap slice. **Boundary with the vertical-slice issue template recorded:** orchestrate-emitted issues carry "Affected paths" *deliberately* (short-lived, consumed by L2 agents — divergence note already in `vertical-slice-issue-template.md`); the triage brief follows upstream's no-paths rule because inbound issues sit unclaimed indefinitely. Two artifacts, two lifespans — don't "fix" either to match the other. |
| D46 | Verify before you brief: reproduce the bug from the reporter's steps / check out the PR and run tests, **before** any state is applied; three named outcomes — confirmed (with code path), failed to reproduce, insufficient detail (= the strongest `needs-info` signal); deliberately shallow ("is this real and roughly where does it live", not root cause) | **ABSORB** as a new SKILL.md step | `SKILL.md` step 3, `docs/engineering/triage.md` §"Verify before you brief" → closes a real hole: `knowledge/routing-rubric.md` already *requires* "claim is verified" for `ready-for-agent` but specifies no procedure. Shallow-by-design boundary kept: won't-reproduce-in-minutes routes to `needs-info` or hands off to `/investigate` (the local `diagnosing-bugs` equivalent — the seam upstream leaves undocumented). |
| D47 | Two cheap codebase checks during context-gathering: **redundancy** (already implemented? — searched by domain concept, not the reporter's wording; report where you looked) and **prior rejection** (`.out-of-scope/` match) — both produce `wontfix` when they hit | **ABSORB** | `SKILL.md` step 1 → concept-search grounds in the D38 glossary convention (`CONTEXT.md`/`GLOSSARY.md`, fallback `domain-knowledge/`). Redundancy hits close as already-implemented (pointer comment, **no** KB write); prior-rejection hits quote the KB file and ask whether the maintainer still agrees. |
| D48 | `needs-info` discipline: structured Triage Notes template ("established so far" / "still need from you, @reporter"); questions specific and actionable, never "please provide more info"; resume protocol — read prior triage notes, check which questions the reporter answered, don't re-ask resolved ones | **ABSORB** | `SKILL.md` needs-info template + §"Resuming a previous session" → no local equivalent existed; the established-so-far section is what keeps grilling work from being lost between sessions. |
| D49 | A PR is an issue with attached code: external PRs run the same machine; states read against the diff; discovery surfaces only *external* PRs (a collaborator's in-flight branch is not triage work); an explicitly named PR is always triaged | **ABSORB, opt-in surface** | `SKILL.md` §"a PR is an issue with attached code" → absorbed as an explicit `--prs` flag / named-PR path rather than default-on: the fleet is single-maintainer and external PRs are rare (public repos exist: `github-actions`, `GroupThink`), so unconditional PR discovery would scan noise on every run. The external-only discovery filter and always-triage-when-named rule kept verbatim. |
| D50 | The full 5-state vocabulary + the invariant: exactly one category and one state per item, never two states; conflicting states are flagged to the maintainer before anything else; `needs-triage` is the entry state (cleared when routed); `wontfix` is terminal with a three-way close (already-implemented / rejected bug / rejected enhancement → KB) | **ABSORB — completes the routing layer** | `SKILL.md` §Roles + state transitions; `docs/…/triage.md` §"The state machine" → local routes were 3 of 5. `needs-triage` was *already* fleet vocabulary (the literal label `/orchestrate --emit` and `/plan-feature` apply) with nothing consuming it — this closes that loop: triage clears it on routing. `wontfix` added as a route with the three-way split (ties D44/D47). Categories map onto the existing type axis (`bug`→`type/bug`, `enhancement`→`type/feature`) — no second category label set introduced. Exactly-one-state extends the existing one-label-per-axis constraint; conflicts surface as a fifth anomaly pattern. |
| D51 | Every comment or issue posted during triage opens with `> *This was generated by AI during triage.*` | **ABSORB** for all `--apply` postings | `SKILL.md` disclaimer block → previously moot (the skill only wrote labels); D45/D48 make it post comments, so the disclaimer ships with them. Honest-provenance invariant, zero cost. |
| D52 | Recommend and wait: state category/state/reasoning + codebase summary, apply nothing until directed; quick state override ("move #42 to ready-for-agent") trusted but confirmed | **ALREADY PRESENT** | `SKILL.md` step 2, `docs/…/triage.md` ("it recommends and waits") → the local default read-only + proposal table + `--apply`-after-review posture is the same contract. No change. |
| D53 | Upstream's acknowledged missing states: `blocked` (specified but waiting on another issue — "most-filed gap"), `deferred` (trigger-gated), terminal `implemented` (without it an AFK runner re-queues finished tickets) | **REVERSE-DELTA — do not import the gap** | `docs/engineering/triage.md` §"Five states aren't enough" (upstream issues #139, #297) → ojfbot already solves all three: blocking is GitHub-native blocked-by edges + the frontier concept (`vertical-slice-issue-template.md`); deferral is roadmap slice `status` (`roadmap-schema.md`); completion is the merge-gated movement record (`record-movement.mjs`). Recorded so a future sync doesn't "absorb" a state set weaker than the local machinery. |

## Protected local deviation (binding on future syncs)

The **severity/effort/domain/type rubric and the non-overridable ordering function
`severity_weight / effort_weight`** (ADR-0048) are kept in full. Upstream has no
prioritization equivalent — nothing orders the backlog once items are labeled. Locally,
reproducible ordering is `/triage`'s founding contract (two sessions, same repo, same
ordered list). The refresh layers the state machine *around* the rubric: classify →
route → order. Per the ADR-0046 Rev A precedent, future upstream syncs must not
re-litigate the rubric's presence without new evidence; this section is the recorded
reason.

## Integration shape

Zero upstream files enter the tree. One skill amended (`/triage`: verify step, KB +
redundancy checks, brief emission, full state vocabulary, needs-info discipline, PR
surface, disclaimer), two knowledge files re-expressed (`agent-brief.md`,
`out-of-scope-kb.md`), one fleet convention materialized (`decisions/out-of-scope/`,
ADR `adr:out-of-scope-knowledge-base`), ADR-0048 Revision A records the calls. Catalog
trigger additions are κ-gated (`scripts/suggester-eval.mjs`, frozen-holdout baseline
0.603) and ship separately from the skill edits if the gate fails.
