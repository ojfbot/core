# Open unknowns

Deferred decisions, unvalidated assumptions, and domain-standard considerations a grill did not
reach. Appended by `/grill-with-docs` at the confirmation gate; never rewritten in place.

The third bucket is a checklist of considerations the grill skipped — **not** a guarantee of
blind-spot coverage. An empty bucket is a legitimate result.

---

## 2026-08-01 — employer-evidence boundary for public FDE artifacts (wayfinder #321)

Ruling: day-job material is publishable only as de-identified engineering patterns passing the
**stranger test**, enforced by a denylist lint sourced from gitignored `personal-knowledge/`.
HEAD scrubbed on decision; history rewrite staged. See `adr:employer-evidence-boundary`,
`adr:boundary-enforced-by-construction`, `adr:staged-history-remediation`.

**Deferred decisions**
- Git-history rewrite of the 10 commits carrying the protected strings (earliest 2026-06-25) — unblocked by: in-flight PRs landing (#337 among them) plus an agent-quiescent window. Force-pushing `main` against ~23 live agent sessions and 3 worktrees is the risk being deferred around, not the rewrite itself.
- Whether the denylist lint covers sibling public repos (`daily-logger`, `shell`, `core-library`, `landing`) or only `core` — unblocked by: the lint's roadmap-slice scoping.
- Whether GitHub support is asked to GC unreferenced objects after any rewrite — a rewrite alone leaves objects reachable by SHA.
- Whether the primary day-job corpus (unmounted external volume, never inspected) is ever examined. Nothing from it can be ruled publishable until someone has looked at it.

**Unvalidated assumptions**
- ~~That the employer's employment agreement and publication policy permit de-identified, pattern-level technical writing.~~ **RESOLVED 2026-08-01 — operator confirmed** ("I am good on employment agreement"). The ruling in `adr:employer-evidence-boundary` no longer rests on an unread policy. Recorded rather than deleted: this was the load-bearing assumption, and a future reader should be able to see that it was closed by operator confirmation rather than by document review.
- That the stranger test is actually satisfiable for the adoption story specifically — no draft exists yet, and none has been tested against a cold reader.
- That a term denylist is sufficient protection. It catches names; it does not catch situational fingerprints (a distinctive metric, an unusual org shape, a dated incident).
- That the 9 remaining bare-alias files pass the stranger test now that the binding is removed. Reasoned, not reader-tested.

**Standard considerations not covered**
- Non-git surfaces were never swept: published daily-logger articles, Notion, selfco exports, and the Vercel-hosted sites may carry the same strings. Only the git surface was checked.
- LinkedIn, X, and résumé name the employer by design and sit outside this boundary entirely — no ruling was made on how they interact with de-identified public artifacts that a reader could correlate.
- No human review step for future narrative drafts before publish, beyond the mechanical lint.
- ~~`core-library/public/graph/selfco.json` — untracked, not gitignored, in a public repo.~~ **FIXED 2026-08-01** — `core-library@ccbf853` ignores `public/graph/` wholesale. The git vector is closed.
- **Open, and larger than the one just fixed: `core-library` serves the vault graph at runtime.** `apps/web/src/main.ts:82` fetches `/graph/selfco.json`, and the vault-ingest Vite plugin regenerates it into `publicDir` on every build. The repo is not currently deployed (no `vercel.json`, no `.vercel`, no `netlify.toml`), which is the only reason this is contained. **If core-library is ever deployed, the build republishes the entire private vault graph to a public URL, and `.gitignore` does nothing to stop it.** Under `adr:boundary-enforced-by-construction` this wants a build-time guard (de-identify at ingest, gate the fetch behind local-only, or exclude protected nodes from the graph), not a note. Decision, not yet made — deploying core-library is currently blocked on this.

---

## 2026-08-01 — dossier→presence seam: per-artifact clearance over an absolute public-git lint (wayfinder #347)

Ruling: engagement artifacts are private by default in `fieldwork-1`; public git stays absolutely
lint-clean (the client term-set joins the gitignored denylist of
`adr:boundary-enforced-by-construction`, stranger-test threshold); disclosure is upgraded
**per-artifact** by the client principal's written sign-off recorded in a permission ledger;
cleared renders never enter public git — the operator is the only crossing point to presence
surfaces; refusal narrows, never erases. See `adr:engagement-disclosure-seam` (stub).

**Deferred decisions**
- Exact sign-off capture form (channel, ledger entry format) — unblocked by: conversation #1
  (the #346 discovery instrument carries the permission ask).
- History rewrite vs acceptance for client intel already in public git history — unblocked by:
  #356's session (a scrub commit removes the tip, not the history).
- Off-git publish-checklist mechanics (Medium/LinkedIn/blog) — unblocked by: the
  fde-operating-presence flywheel tickets (#322/#329); the surfaces are that map's, the seam is
  this one's.

**Unvalidated assumptions**
- The client grants documentation permission at all — the proof plan and dossier-as-compensation
  floor rest on it; outright refusal re-scopes the engagement (standing ruling).
- The denylist lint (still an unbuilt roadmap delivery) accepts a second term-set without
  redesign.
- Presence-surface publishing stays operator-manual. If any automation ever publishes outward,
  the seam's "the operator is the only crossing point" guarantee silently breaks — a standing
  constraint, not merely an assumption.
- A term denylist catches names, not situational fingerprints (distinctive figures, dated
  incidents) — carried from the employer-boundary entry; applies doubly here since the
  engagement narrates real jobs.

**Standard considerations not covered**
- Screenshot redaction beyond names: EXIF/metadata, crew faces, addresses on work orders —
  PII, not just identity terms.
- Third-party data inside artifacts: adjusters, insurers, builders' documents — parties who
  never entered the permission protocol.
- Revocation after publication: no takedown protocol exists if the client withdraws a
  previously granted clearance.

## 2026-08-03 — l1-core P5: operator competence, uplift-primary measure (wayfinder #381)

**Deferred decisions**
- P5 numeric current/target calibration — unblocked by: operator review of amendment PR #389
- ~~Whether the merge-quiz heatmap augments or overrides records+mission ZPD placement~~ — **CLOSED 2026-08-03 by #384: augments, min-n gated, never overrides** (`adr:comprehension-heatmap-zpd-role`)
- Teach corpus / learning-records location — unblocked by: #382
- Activation criteria for the staged lessons-served-at-ZPD metric — unblocked by: #384 + #382 closing. **#384's half closed 2026-08-03**; #382 remains. #384 contributes: placement nominates only at n ≥ k, and the rate may only be cited over the pre-registered holdout (R2).

**Unvalidated assumptions**
- The merge-quiz heatmap has (or will accrue) enough cell coverage for taught-vs-cold divergence attributable to served lessons to be detectable
- The taught/cold separation is maintained cleanly enough in the observation data to serve as the uplift ruler

**Standard considerations not covered**
- A deskilling counter-metric (operator dependence rising while quiz scores rise) — the ai-augmentation-evidence synthesis names the risk; P5 as accepted measures uplift only

## 2026-08-03 — ZPD sensor: the comprehension heatmap augments, never places alone (wayfinder #384)

**Deferred decisions**
- The value of `k` (the min-n gate below which a cell contributes no nomination) — unblocked by: the slice that builds the re-keyed sensor, against a real cell population
- Which cells form P5's pre-registered holdout, how the pre-registration is recorded, and what happens when a cell crosses from holdout into selected — unblocked by: the sensor re-key landing (graduation candidate, recorded in the map's `## Not yet specified`)
- The P5 northstar amendment reconciling "repo × domain cells" with bounded-context × mode + holdout — unblocked by: the building slice (R6 deferred it deliberately, not by omission)

**Unvalidated assumptions**
- That bounded context × mode is a grain the operator's comprehension actually varies along — the pooling argument is arithmetic (12 cells fill, 43×N×2 do not), not empirical
- That a per-question difficulty/facet profile is sufficient to separate proximal from foundational gaps — it is necessary (a 60 from hard misses vs easy misses want opposite lessons), but sufficiency is untested
- That a diff maps to exactly one of the six ADR-0044 bounded contexts — the contexts are drawn by concern and a repo may participate in several; no path→context mapping exists to check this against
- That `mode` (taught/cold) self-report is honest enough to key cells on — the script cannot verify it, and under R2 a mislabel now corrupts the holdout as well as the cell

**Standard considerations not covered**
- Comprehension-as-competence validity: `.claude/skills/merge-quiz/SKILL.md:32` states the instrument is "a reasonable extrapolation from adjacent evidence, not a validated intervention," and neither vault page (`ai-augmentation-evidence`, `se-competency-engine`) treats self-report or quiz-score validity as a measurement question. #384 constrains how far decisions may lean on the instrument; it does not upgrade its evidentiary standing.
- No time decay in the EWMA (α=0.4, per-observation, not per-day, and not CLI-reachable) — a stale cell never ages, which matters more for a placement prior than for a score.
- Zero invocations: the instrument P5 depends on produced no data in 5 days across 25 qualifying merges. R5 declines to backfill; the H8 retirement rule is the designated catch.
