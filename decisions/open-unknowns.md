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

## 2026-08-03 — Teach corpus: a two-stage sink whose deposit emits evidence and is reconciled (wayfinder #382)

**Deferred decisions**
- Retention of pushed `teach/*` branches — R3 pushes one per lesson across every teaching repo and nothing prunes them; unblocked by: the deposit step existing and the first branches accumulating (recorded in the map's `## Not yet specified`)
- The `teach-sessions.jsonl` row schema beyond the event name — what a `harness:lesson-deposited` row must carry for the reconciler to match it to a branch; unblocked by: the slice that builds the deposit step
- Whether `reconcile-teach-deposits.mjs` ever promotes from shadow to a gate, and on what orphan rate — deliberately deferred per `adr:control-gated-slices`
- Whether a SessionEnd hook is added as a belt over R2's braces — available if the reconciler's measured orphan rate justifies it; rejected as the *sole* mechanism, not rejected outright
- Whether `schema.yaml` should extend past `wiki/` page types to declare sink folders — R7 mirrors two rows correctly and repairs one drop, but does not fix the two-prose-copies arrangement ADR-0105 identified as unmaintainable

**Unvalidated assumptions**
- That topic slugs are stable enough to be identity (R6) — a renamed topic orphans a folder, and supersession-over-deletion means the corpus only grows; derived from `adr:adr-slug-identity` rather than separately grilled
- That an agent reliably runs an explicit deposit step when the skill says to — R2's reconciler exists precisely because this is *not* assumed, but the reconciler's own value assumes someone reads its report; nothing yet routes it
- That authoring in a worktree next to the code produces better lessons than authoring elsewhere — the shadow-space ruling is an argument from working-tree cleanliness, not from lesson quality, and no lesson has been authored either way
- That `harness:lesson-deposited` and #384's `harness:lesson-served` stay distinct in practice — the boundary is stated, but one skill will emit both and collapsing them is the cheap mistake

**Standard considerations not covered**
- The corpus is empty by construction and will stay so until three artifacts ship (deposit step, reconciler, ledger schema). This ruling constrains a mechanism that does not run; it must not be read as capability — the same caution `adr:comprehension-heatmap-zpd-role` records about the heatmap.
- No access or privacy boundary is stated for the corpus. Lessons cite diffs from private repos and land in a vault that has had a public-disclosure seam ruled on elsewhere (texas-rr engagement, #347); nothing here says what a lesson may quote.
- Nothing routes the reconciler's report to a human. TD-006's 96-day gap was not caused by missing data — `bead-lint` existed — but by nobody reading it.

## 2026-08-14 — cca-prep adopts the standard fleet app stack; Carbon rejected, React permitted (wayfinder #456)

**Deferred decisions**
- Whether the drill client, once a Vite build artifact, retains any exam-eve runtime guarantee — and if so whether built output is committed or built on demand; unblocked by: the client-migration slice. New fog created by this ruling; charted on the map rather than decided here.
- Which dependencies get adopted first; unblocked by: Lab-surface selection (#459).
- TypeScript and React/Vite phase timing relative to the sitting; unblocked by: operator, at roadmap-slicing — the absorber guard ("no build slice eats pre-sit study evenings") still stands until the sitting itself.
- Whether cca-prep becomes a pnpm workspace with `packages/` (as morning-cockpit) or stays a single package; unblocked by: the migration slice.
- Whether the six `.test.mjs` files stay on `node --test` or move to Vitest, as morning-cockpit did.
- Whether lab Python (if #459 selects it) uses `uv` + PEP 723 depositing nothing, or a managed `pyproject.toml` — the ruling covers repo source, and a Python lab surface would be a second dependency ecosystem it does not speak to.

**Unvalidated assumptions**
- That `pnpm install --frozen-lockfile` keeps CI fast enough not to erode the current bare-checkout feedback loop. Never measured; CI today does zero install (`ci.yml` comments "Zero-dependency repo: no install step").
- That flipping `skip-dependency-audit: false` produces actionable output rather than noise on a repo with few direct dependencies. Not tried.
- That the ten real source files (1,183 LOC, git mode 100644) migrate cleanly to `.ts` — they were counted, not audited for type-hostile patterns. `node:sqlite` typings in particular were not checked.
- That the GroupThink tokens are recorded somewhere retrievable. Spec line 45 points at a *memory* (`project_landing_groupthink_brief`), not a file in any repo; that the memory still resolves was not verified.
- That morning-cockpit's stack (React 18 + Vite 6 + TS 5.6 + Vitest, `tsc --noEmit && vite build`) transfers to a repo whose server is a bare `node:http` process with no bundler today.

**Standard considerations not covered**
- Supply-chain policy the flip makes newly relevant: pinning strategy, `pnpm audit` failure thresholds, Renovate/Dependabot, provenance checks. The grill established that auditing turns on; it did not decide the policy behind it.
- Publication-checklist interaction. `publication-checklist.md` documents an unresolved operator-only git-history purge blocking the public flip, and GitHub retains PR head refs server-side; a lockfile and build output are new artifacts that purge must now account for. Not examined.
- Rollback cost — what reverting to a zero-dependency posture would cost once a lockfile is in history.
- No measurement of what the zero-dependency rule was actually buying. It was argued about on properties (no install step, no lockfile drift), never instrumented, so the flip's cost is reasoned rather than observed.

## 2026-08-14 — cca-prep labs execute terminal-side against a mock by default (wayfinder #459)

**Deferred decisions**
- App ingestion of `results.json` — unblocked by: a later slice. No prior art was found in any surveyed runner (Exercism submits remotely, rustlings writes a local file, NodeSchool is terminal-only); it is the survey's least-estimated cost, which is why slice one emits the artifact and builds no consumer.
- Python lab adoption via `uv` + PEP 723 — unblocked by: slice two, or an inversion of the TS-first call if the exam guides prove Python-first. Anthropic's own teaching material (`anthropics/courses`, cookbooks) is Python-first, so this counter-argument is live and was recorded rather than dismissed.
- Whether the runner is `node --test`, Vitest, or a custom `node:test` reporter emitting `results.json` directly. Node ships no XML parser (`DOMParser` undefined on 24.11.1), so the built-in JUnit reporter is a poor fit; the line-oriented `tap` reporter or a custom reporter are the dependency-light options.
- Mock fidelity scope — which of SSE streaming, the Batches submit/poll/`results_url` flow, and SDK retry/error-class behaviour the mock must support. The retry/error half is exactly where the validation-retry lesson lives.
- Where lab files live — owned by Workbench home (#455), deliberately not decided here.
- Which exercise comes first — owned by the Lab 1 de-freezing slice (#454).

**Unvalidated assumptions**
- That Exercism's file contract transfers. Exercism, rustlings, and NodeSchool all solve "get a stranger productive at scale"; cca-prep solves "keep one known person calibrated." The survey names this transfer unvalidated, and it is the assumption this design leans on hardest.
- That grading against a deterministic mock teaches the judgment the exams test, rather than rewarding fixture-matching.
- That the mock generalises — it was measured against exactly one `tool_use` response shape.
- That terminal-side sustains operator engagement as well as an in-app surface would. No ergonomics data exists in either direction; the survey is explicit that its only hard numbers are machine latencies, not human ones.
- That `uv`'s one mandatory online prime is acceptable — empty cache plus `--offline` is a hard failure (23.73 s cold, 2.22 s warm, 0.68 s warm+offline, single-trial on one machine).

**Standard considerations not covered**
- Exercise authoring cost was entirely outside the survey and could dominate the mechanism cost this decision optimised. Whether scaffolds are hand-written, generated by cca-prep's own pipeline, or seeded from exam-guide task statements was never established.
- Key handling for the live escape hatch — no `.env` or key-hygiene story was decided.
- Toolchain drift on the operator's machine. uv 0.10.7 / Node 24.11.1 / pytest 9.0.2 are one-machine facts, and the runner assumes them.
- Telemetry-boundary interaction: `results.json` is arguably personal telemetry, which CLAUDE.md rule 3 sends to the vault and `scripts/boundary-check.mjs` gates in CI. Where the runner writes is therefore not a free choice — Lab artifact & telemetry boundary (#461) owns it.
