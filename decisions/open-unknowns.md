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
