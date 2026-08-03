# /adopt-stack decision: mattpocock/skills `productivity/teach`

Decided 2026-08-03 (wayfinder ticket ojfbot/core#380, map `decisions/wayfinder/teach-in-the-loop.md`).
Candidate pinned at main `2ab958093e83e0ec752e6c1c5932da465bf23e0c` (2026-07-28; MIT).
**Extends `pocock-skills-v1-1.md` (D1–D17)** — same framework (`adr:wrap-absorb-reject`), same candidate repo
at a later pin, decision numbering continues at D18. Not re-litigated here: the v1-1 calls, and the
teach-in-the-loop Destination rulings (ZPD as organizing principle; HTML canonical; standalone shadow-space
workspaces; l1-core anchor bid). The v1-1 **D6 precedent** (a fourth work-item surface was rejected) is
answered in advance for this candidate by the map's shadow-space ruling: teach workspaces are standalone
spaces outside working trees, so absorbing the workspace file layout creates no new work-item surface.

Boundaries owned by other tickets, recorded here but **not decided**: where the teach corpus lives (#382);
whether/how the merge-quiz heatmap becomes the ZPD sensor (#384); side-panel HTML rendering verification (#386).

## Gate 0 (script-measured): LIBRARY (0/6 application signals)

Candidate is a git subtree of prompt files, not a published npm artifact, so `measure-pkg.mjs` (pnpm-view)
does not apply — same posture as the v1-1 record. Measured directly against the pinned tarball
(`github.com/mattpocock/skills/archive/2ab95809….tar.gz`); commands + verbatim output:

| Signal | Measurement (command) |
|--------|------------------------|
| Version | `package.json` → `1.1.0`, `dependencies: null`; `.claude-plugin/plugin.json` → `1.2.0` |
| Subtree size | `du -sh skills/productivity/teach` → `32K` |
| Content | 6 files: `SKILL.md`, `MISSION-FORMAT.md`, `RESOURCES-FORMAT.md`, `LEARNING-RECORD-FORMAT.md`, `GLOSSARY-FORMAT.md`, `agents/openai.yaml` (`find -type f`) |
| Runtime code | **0** (`find … -name '*.ts' -o -name '*.js' -o -name '*.cjs' -o -name '*.mjs' \| wc -l` → 0) |
| Telemetry/network SDKs | **0** (`grep -rilE 'analytics\|sentry\|amplitude\|posthog' … \| wc -l` → 0) |
| DB drivers / server / auth / bin | none |
| Application-shaped signals | **0/6** |

Consequence: no runtime to wrap. Every call below is **ABSORB** or **REJECT** — WRAP does not arise.

## Decision table

Evidence paths are relative to the pinned tarball (`skills/productivity/teach/…`). All calls are the
operator's (per-opinion grilling, 2026-08-03).

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D18 | Mission interrogation: `MISSION.md` written first; if the user can't articulate why, "interview them before writing anything. A bad mission is worse than no mission"; concrete-over-abstract; one mission per workspace; mission changes confirmed with user + captured as a learning record | **ABSORB** | `MISSION-FORMAT.md`, `SKILL.md` "The Mission" → the grill posture (`domain-knowledge/agent-defaults.md`, `adr:grill-with-docs-skill`) applied to learning; Destination requires mission-grounded workspaces. |
| D19 | RESOURCES vetting (knowledge half): "Never trust your parametric knowledge"; first job is finding high-trust sources; every entry annotated (what it covers, when to reach for it); explicit `## Gaps` drives future search; "Prune ruthlessly … better five sharp sources than thirty mediocre ones" | **ABSORB** — with internal fleet artifacts (ADRs, repo docs, vault synthesis pages) as first-class high-trust sources | `RESOURCES-FORMAT.md`, `SKILL.md` "Philosophy" → fleet no-fabrication discipline (f1 claim-grounding, dive-briefing corpus quarantine); for system-internal topics the fleet's own artifacts ARE the primary sources. |
| D20 | Wisdom/community delegation: wisdom "comes from true real-world interaction"; attempt an answer but "ultimately delegate to a community"; find high-reputation communities; respect opt-out | **ABSORB, external domains only** | `SKILL.md` "Acquiring Wisdom" → real mechanism for external-domain topics (SE/INCOSE, FDE, F1, golf CV); omitted for fleet-internal topics where no community exists — a subreddit recommendation inside a system-internal lesson is noise. |
| D21 | Learning records: ADR-style numbered `0001-slug.md`, lazily created; evidence-gated — "Coverage is not learning. Wait for evidence"; records prior-knowledge disclosures and corrected misconceptions; supersession over deletion | **ABSORB** (format + evidence gate only) | `LEARNING-RECORD-FORMAT.md` → rhymes with `/merge-quiz` ("teaching is the product") and ADR-0087 record discipline. Location of records → #382; heatmap wiring → #384. |
| D22 | ZPD placement computation: unless the user names a topic, read learning-records + mission and "teach the most relevant thing that fits in their zone of proximal development" | **ABSORB as per-workspace floor** | `SKILL.md` "Zone Of Proximal Development" → local records+mission placement is the floor mechanism now; whether the cross-workspace merge-quiz heatmap (repo×domain EWMA) augments or overrides it is #384's decision — boundary recorded, not preempted. |
| D23 | HTML lesson authoring: one self-contained numbered HTML file; Tufte-beautiful; working-memory-short with one tangible win; quiz answers length-matched ("Don't give the user any clues about the answer through formatting"); littered with citations; recommends one primary source; follow-up-questions reminder; reusable `./assets/` components, shared stylesheet first | **ABSORB — #386 spike verifies** | `SKILL.md` "Lessons"/"Assets"/"Skills" → HTML-canonical already ruled by the map; the full authoring shape is the working spec, and the HTML lesson pattern spike (#386) validates side-panel rendering and may amend details with evidence. |
| D24 | reference/ vs lessons/ split + glossary: "Lessons will rarely be revisited later - reference documents will be"; references are the compressed print-quality essence; glossary is "an essential reference" — opinionated canonical language, term added ONLY when the user understands it, definitions use the glossary's own terms | **ABSORB** | `SKILL.md` "Reference Documents", `GLOSSARY-FORMAT.md` → direct extension of the fleet's ubiquitous-language invariant (`CONTEXT.md`/`GLOSSARY.md`, ADR-0044); the understanding-gate makes glossary growth itself evidence of learning. |
| D25 | `NOTES.md` per-workspace teaching-preferences scratchpad | **REJECT** | `SKILL.md` "`NOTES.md`" → the fleet already has its memory surfaces (auto-memory, vault, beads); teaching preferences live in fleet memory and are **injected into the workspace at spawn** rather than accreting a fourth preference surface. Deliberate divergence from the workspace's otherwise self-contained shape — the operator weighed self-containment and ruled for fleet memory. |

## Integration shape

Zero upstream files enter the tree. Seven opinions absorbed into the standalone shadow-space teach-workspace
design (mission interrogation, vetted resources with internal-first sourcing, external-only community
delegation, evidence-gated learning records, records+mission ZPD floor, HTML lesson + assets shape pending
the #386 spike, reference/glossary split with understanding-gate); one rejected (NOTES.md — preferences
injected from fleet memory at spawn). Upstream tracking remains the pinned-commit mechanism; this record
supersedes nothing in `pocock-skills-v1-1.md`.
