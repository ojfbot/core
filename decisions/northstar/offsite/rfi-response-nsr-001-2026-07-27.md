# Response — NSR-RFI-001

| Field | Value |
|---|---|
| **Reference** | NSR-RFI-001-R1 |
| **Issued** | 2026-07-27 |
| **Issued by** | Code-side relay session (filesystem / `gh` / registry authority) |
| **Vantage** | `core` main @ `8b3ace7` (amendment merged) · all 44 local checkouts · `gh` authenticated · `~/selfco` |
| **Method** | Every verbatim block below is copied from disk, not paraphrased. Where evidence is absent, absence is stated. |

**Reading order:** RFI-001/002/003 are complete and unblock the Notion writes. One material
finding is buried in RFI-006 — read it before the voice sitting: **the two means do not diverge
widely; A2's recorded expectation is wrong on current data.**

---

## RFI-001 — Authoritative slug manifest **[answered — 3 traps confirmed, no 4th]**

Verbatim from `decisions/northstar/README.md` frontmatter, registry order, copy-paste fidelity:

| slug | path |
|---|---|
| `l3-shared` | `decisions/northstar/l3-shared.md` |
| `l2-ojfbot` | `decisions/northstar/l2-ojfbot.md` |
| `l1-cv-builder` | `../cv-builder/.claude/northstar.md` |
| `l1-morning-cockpit` | `../morning-cockpit/.claude/northstar.md` |
| `l1-f1-pit-wall` | `../f1-pit-wall/.claude/northstar.md` |
| `l1-f1-substrate` | `../f1-substrate/.claude/northstar.md` |
| `buddy-check` | `../buddy-check/.claude/northstar.md` |
| `l1-f1-press-room` | `../f1-press-room/.claude/northstar.md` |
| `l1-silicon-empires` | `../silicon-empires/.claude/northstar.md` |
| `l1-shell` | `../shell/.claude/northstar.md` |
| `l1-blogengine` | `../blogengine/.claude/northstar.md` |
| `l1-core` | `.claude/northstar.md` |
| `l1-dive-briefing` | `../dive-briefing/.claude/northstar.md` |
| `l1-switchboard` | `../switchboard/.claude/northstar.md` |
| `l1-virtuallight` | `../virtualLight/.claude/northstar.md` |
| `l1-mirrorworld` | `../mirrorworld/.claude/northstar.md` |
| `l1-f1-doctrine` | `../f1-doctrine/.claude/northstar.md` |

The registry file carries an inline comment on the `buddy-check` line: *"NB: shipped with a bare
slug (no l1- prefix); slug is immutable identity (ADR-0087), so it is registered as-is."*

**The trap inventory is three, and the third is new to the chat side:**
1. `buddy-check` — bare slug, no `l1-` prefix.
2. `l1-virtuallight` — slug all-lowercase; the *directory* is `virtualLight`. Slug ≠ path casing.
3. **`l1-core` — path is `.claude/northstar.md` with no `../<app>/` prefix** (core is the registry's
   own repo). Any tooling that assumes the `../<app>/.claude/northstar.md` shape breaks on this row.

No fourth inconsistency found. Paths resolve relative to the core root; `~` expands to home
(per the registry's own header comment).

---

## RFI-002 — Verbatim parent property text **[answered]**

Exact frontmatter from `decisions/northstar/l2-ojfbot.md` as of main @ `8b3ace7`:

```yaml
  - id: P1
    name: "The fleet ships usable surfaces"
    target: "Each active app reaches a usable surface in its natural venue and is past scaffold — value shown where the app lives, not gated on one cross-domain hero demo."
    current: 55
    verification: "A recorded session per active app in its natural venue (cockpit dashboard, pit-wall telemetry, dive-briefing Q&A, shell composition, …); each is past scaffold."
    ladders_up_to: "ns:l3-shared#P1"
  - id: P2
    name: "Every app's daily work traces to a measurable property"
    target: "100% of active fleet apps have a northstar; the daily standup frames each priority against a property; movement is recorded as a time-series, not asserted from memory."
    current: 30
    verification: "northstar-lint: every tracked repo has a northstar that ladders here; standup output cites ns:<slug>#P refs; status.jsonl accrues movement lines."
    ladders_up_to: "ns:l3-shared#P2"
  - id: P3
    name: "The Arcade fronts the fleet"
    target: "The Arcade surface can launch, front, and talk to registered apps across both composition tiers; ≥5 apps reachable from one surface with declared cardinality respected."
    current: 10
    verification: "Arcade launches, fronts, and talks to ≥5 registered apps spanning Tier A and Tier B from a single surface; instances respect declared cardinality."
    ladders_up_to: "ns:l3-shared#P1"
```

Caveat for the card refresh: the contract's own rule text (RFI-003) still describes
`ladders_up_to` as a **two-value** choice (`#P1` or `#P2`) with the *old* P1 gloss ("the fleet
ships demoable surfaces"). Refreshing 28 cards against the text above without also amending that
contract rule (A5.1's job) mirrors a contradiction into every card.

---

## RFI-003 — Current Contract sections **[answered — verbatim]**

From `decisions/northstar/offsite/contract.md` (git copy; header notes it was captured from
Notion 2026-06-29 and that the live relay has drifted to v1.1 usage — see the NOTE reproduced at
the end).

**Confirmed-block format specification:**

```
CONFIRMED NORTHSTAR
app: <app-slug>
schema: v1
vision: <one paragraph>
P1 | name: <…> | target: <…> | current: <0-100> | verification: <…> | ladders_up_to: ns:l2-ojfbot#P1
P2 | name: <…> | target: <…> | current: <0-100> | verification: <…> | ladders_up_to: ns:l2-ojfbot#P2 | depends_on: ns:l1-<other-app>#P<n>
LADDER_STRESS: l2#P1=clean; l2#P2=strain — <reason; one verdict per parent property the app ladders to>
SYNTHESIS: <cross-project connections — feeds the ledger>
```

**The `ladders_up_to` constraint** (a Rules bullet, verbatim):

> Every property's `ladders_up_to` is either `ns:l2-ojfbot#P1` (the fleet ships demoable surfaces) or `ns:l2-ojfbot#P2` (work traces to a measurable property).

**The `LADDER_STRESS` field definition** (heading + body, verbatim):

> ### `LADDER_STRESS` — the kickback channel (mandatory, never empty)
> The roadtrip stress-tests the L2 parent while authoring L1s. One verdict **per parent property touched** (`clean` / `strain` / `break`); reason required for anything but `clean`. **Semantic judgment is chat's, not the linter's** — a forced-fit property resolves syntactically and the linter greenlights it; only the verdict surfaces the buried failure. The linter only enforces the field is present/well-formed. **Gate:** one `break`, or N `strain`s against the *same* parent property (N starts at 3), freezes the roadtrip for a deliberate, versioned parent revision. The L2 parent is never hot-patched mid-leg.

**The drift note at the file's end** (verbatim, because it bears on A6):

> **NOTE (git ↔ Notion drift):** the live relay block has graduated **`schema: v1.1`** + semver-pinned refs (`@0.1.0`) + a cluster tier (`ns:cluster-<name>@<semver>#P<n>`) in the confirmed Frame/blogengine blocks — those extensions are **designed, not yet in `schema.md`/lint** — this contract copy shows the v1 shape; see `confirmed/*.md` for the v1.1 usage and `schema-evolution-log.md` for status.

Amendment-relevant observations: the rule text predates #274 (P1 gloss says "demoable"), offers
no `#P3` option, and hard-codes N=3 with the strain counter now subject to A4's reset.

---

## RFI-004 — Card 11b **[answered — it exists file-side; the DB lags the file]**

Card 11b **exists in `offsite/itinerary.md`**, Leg 4 table, verbatim row:

> | 11b | F1 (cluster) | briefed | PRE-DRAFTED quick-confirm from the landed f1 L1s (~5 min); decides ladder topology for all clusters. NOTE: f1's depends_on edge is schema-doc-only — not in pit-wall's file, not linted; retrofit lands in the cluster-tier build slice |

The file-side itinerary also carries **11a** (`GameWorld (cluster)` — "THE cluster conversation —
first real cluster-tier instance; CC lands its block as design evidence, not a v1.1 file") and
**14a** (`CarrierPigeon` — "next game; pre-code scaffold … primary source = the voice
conversation"). **The Notion DB's 28 rows lag the file's itinerary**, which explains the row-count
mismatch: the file is the copy of record (constraint 6.1) and 11a/11b/14a need Itinerary rows
created, not invented.

**On "pre-drafted":** no fuller draft of the cluster-f1 card exists anywhere on disk — I searched;
the only hits are the itinerary row and the schema-evolution log. If it isn't in a Notion briefing
section on your side, **it was never authored** and needs drafting before the quick-confirm.
Sequencing note: 11b *"decides ladder topology for all clusters"* — it should precede or accompany
the RFQ-004 build slice, since the topology decision is an input to the loader semantics.

Also relevant to constraint 6.4, from the same file (this corrects both relay sides' earlier
"struck" language): the itinerary records **deliberate 2026-07-02 dispositions**, not phantom
self-lands — `jocdive-sdi-mcp`: *"retired — folds into buddy-check's roadmap (SDI portal = a
buddy-check data-source concern); code + parking note kept"*; `dms-core`: *"ARCHIVED (temporary) —
membership inactive; reactivation re-enters as queued."* Both carry reasons. The OD-5/Q5
write-path concern shrinks accordingly.

---

## RFI-005 — Evidence-based posture recommendations **[answered — 45 rows, 6 flagged ambiguous]**

Recommendation only; verdicts are the operator's. Basis cites last commit (lc), registry state,
consumers, unpushed/dirty state. `AMBIG` = evidence genuinely under-determines; do not force.

**Cluster 1 — tree & instruments**

| Repo | posture (rec) | basis |
|---|---|---|
| core | **active** | lc 2026-07-27; everything depends on it; rm 11/18 merged |
| ~/selfco | **active** | lc 2026-07-23; L3#P1 depends on it; l2-selfco pending (OD-3) |
| agent-anatomy | **seeded** | scaffold, lc 07-22; declared pull = article outline |
| github-actions | **substrate** | consumed by ~14 repos; no app surface; lc 05-05 |
| ojfbot (profile) | **substrate** | org README; no target will ever apply |

**Cluster 2 — surfaces**

| Repo | posture (rec) | basis |
|---|---|---|
| morning-cockpit | **active** | lc 07-17, 3 ready slices, 57% avg, 1 unpushed commit |
| shell | **AMBIG: active vs reviving** | lc 07-02, no roadmap, 6% avg — but L2#P3 names its switcher as the Arcade baseline. If the Arcade decision (census Cluster-2 sitting) picks shell, it is active by fiat; if not, reviving. Evidence cannot decide a decision that hasn't happened. |
| core-reader | **reviving** | lc 05-04; reads core, which is active; cheap revival |
| gastown-pilot | **reviving** | lc 05-04; README: panels render placeholder data |
| frame-ui-components | **substrate** | 7 components consumed by 9 apps; "essentially done" per vault |

**Cluster 3 — F1 stack**

| Repo | posture (rec) | basis |
|---|---|---|
| f1-substrate | **active** | rm 2 ready; P1 84%; lc 07-03 but downstream-coupled (doctrine S1 hit it) |
| f1-pit-wall | **active** | lc 07-25; rm 2 ready |
| f1-doctrine | **active** | lc 07-25; S0+S1 merged this week |
| f1-press-room | **AMBIG: active vs reviving** | 2 slices merged, 10 queued — but P1/P3 at 0, no remote, and its delivery channel (blogengine) is dormant. Activity says active; the blocked pipeline says its queue can't move. Flag for the F1 sitting. |

**Cluster 4 — grounded answers & eval**

| Repo | posture (rec) | basis |
|---|---|---|
| buddy-check | **active** | 21 unpushed commits = in-flight work (R3a claim checker, F1 judge); highest-% L1 |
| dive-briefing | **active** | S1 merged 07-23, S2 ready, 3 declared consumers |
| switchboard | **active** | S1 merged 07-23, S2 ready, 4 declared consumers |
| diy-repair-qa-eval | **seeded** | initial commit only (07-03); pull = buddy-check eval lineage generalizing |
| jocdive-sdi-mcp | **fold → buddy-check** | already decided file-side 2026-07-02 (itinerary: retired, folds in); not a posture call to remake |

**Cluster 5 — knowledge & publishing**

| Repo | posture (rec) | basis |
|---|---|---|
| daily-logger | **active** | live daily at log.jim.software; 3 roadmaps land slices in it; lc 07-23 |
| blogengine | **reviving** | lc 06-11; has northstar (15/8); press-room + selfco-ingest both blocked on it — highest-leverage revival in this cluster |
| purefoy | **reviving** | lc 06-04; real corpus, zero eval scenarios; parked coaching thread |
| bldgblog-corpus | **reviving** | corpus complete, annotation structured for increments; fine-tune operator-held |
| selfco-box | **reviving** | marked paused; Pi host mid-rebuild; queue position = after host rebuild |

**Cluster 6 — worlds, assets, imagery**

| Repo | posture (rec) | basis |
|---|---|---|
| silicon-empires | **active** | 13 slices shipped 07-23; PR #28 open |
| mirrorworld | **active** | S2 delivered 07-23; 1 unpushed |
| virtualLight | **active** | S8 merged 07-23; S1 ready |
| gcgcca | **AMBIG: active vs fold → mirrorworld** | lc 07-23 (USGS login-token M2M migration — someone is working it), 7 dirty, no upstream branch. Active work, but mirrorworld's fairway revives the same lineage. The Cluster-6 sitting decides; evidence supports either. |
| asset-foundry | **reviving** (cluster member) | lc 06-09; mirrorworld S9/S11 land here; GameWorld member |
| foundry-recipes | **reviving** (cluster member) | lc 05-04; itinerary flags SUPPORT-MODE question "resolves as a cluster-role question" |
| beaverGame | **reviving** (cluster member) | lc 05-04; the pipeline's original consumer |
| lofi-beaver | **reviving** (cluster member) | shipped 4 slices 06-09; 2nd-consumer gate; itinerary names CarrierPigeon the candidate |
| core-library | **fold → asset-foundry** | stale extraction still containing `asset-foundry/`; 15 dirty; no consumer; lc 05-09 |

**Cluster 7 — Frame-app cohort** (operator-declared revive set)

| Repo | posture (rec) | basis |
|---|---|---|
| cv-builder | **reviving — queue head** | only one with a northstar (40/20); carries the ready `rm-l2-ojfbot#S1` repair slice |
| TripPlanner | **reviving** | lc 04-12; 11-phase pipeline works |
| lean-canvas | **reviving** | lc 04-12; agent-per-section stubs |
| mrplug | **reviving** | lc 04-12; functional extension |
| landing | **AMBIG: active vs reviving** | public site, live, lc 05-06, GitHub push 07-23; also the flagged 3rd-strain candidate now mooted by A4. Low-touch active ("maintained") vs reviving — cosmetic difference; flag rather than force. |
| todo-todo | **AMBIG: seeded vs retire-target** | unchanged create-next-app README, 7 dirty on a dep-vuln branch. Nothing to revive (never grew); `seed` implies declared intent, which was never stated. The one row where the operator's no-demote rule meets a repo with no stated purpose. Operator call. |

**Cluster 8 — long tail**

| Repo | posture (rec) | basis |
|---|---|---|
| workstation-yuri | **reviving** | paused mid-build before P4 by declared intent; 8 unpushed |
| seh-study | **reviving** | content-complete trainer; ADR-0086/0087 source its glossary; lc 05-04 |
| golf-platform-scripts | **reviving** | one card with build-golf/mcp-golf per itinerary Leg 3; lc 2025-07 — coldest active-claim in the fleet |
| newline-ai-course | **active** | course workspace; lc 06-04; no remote (hygiene, not posture) |
| GroupThink | **AMBIG: shipped vs reviving** | ecosystem table says shipped; 5 dirty on docs/readme says someone touched it. "Shipped" is a terminal posture the amendment doesn't define — flag for A-list. |
| hailstone | **reviving** | shipped map w/ live users per vault; TS migration stalled at Phase 1 |

**Pre-repo seeds** (RFI-008): CarrierPigeon, basecamp-20 — see RFI-008.

---

## RFI-006 — Both rollup means **[answered — and A2's expectation is contradicted]**

Method: replicated `northstar-lint`'s child computation — every property of every registered L1,
grouped by its explicit `ladders_up_to` target, arithmetic mean of `current`. My replication
reproduces the lint's published n=37 for P1 exactly. Active split = the RFI-005 recommendations
(active set: core, silicon-empires, f1-substrate, f1-pit-wall, f1-doctrine, morning-cockpit,
dive-briefing, switchboard, virtuallight, mirrorworld, buddy-check, f1-press-room — the two AMBIG
rows counted active for this computation; moving them to non-active shifts the means by <2 points).

| Parent | ALL mean | N | ACTIVE mean | N | asserted |
|---|---|---|---|---|---|
| `l2-ojfbot#P1` | **28.4** | 37 | **30.8** | 31 | 55 |
| `l2-ojfbot#P2` | **30.9** | 21 | **33.5** | 19 | 30 |
| `l2-ojfbot#P3` | — | **0** | — | **0** | 10 |

**Three findings, stated plainly:**

1. **The means do not diverge widely. A2's recorded expectation is wrong on current data.**
   Filtering to active moves P1 from 28.4 to 30.8 — 2.4 points. The reason: the biggest zeros are
   *active* repos (dive-briefing 0/0/0/0/0, switchboard 0/0/0/0, mirrorworld 0/0/0/0/0 — all
   active by any honest reading). **The 55% claim is not rescued by the denominator.** The gap
   closes by shipping the load-bearing zeroes or by revising the 55 downward — not by accounting.
   (The posture field remains worth building for P2 and for walk bookkeeping; it just doesn't
   arbitrate P1.)
2. **P2's assertion is honest.** 30 asserted vs 30.9 computed. Whoever set it was calibrated.
3. **P3 has zero children.** No L1 property anywhere ladders to `ns:l2-ojfbot#P3`. Its 10% is
   unrolled-up assertion. Any Arcade-relevant northstar work (shell revision, cockpit, a future
   arcade L1) should ladder something to P3, or it stays structurally unmeasurable. This also
   means the contract's two-value `ladders_up_to` rule (RFI-003) actively *prevents* P3 children —
   A5.1 is not optional cleanup, it is the fix.

---

## RFI-007 — Row additions vs cluster subsumption **[answered — rows AND clusters, not either/or]**

Per ITERATION 6's own semantics (verbatim: *"an optional rung between L1 and L2 — apps may ladder
to a cluster property OR directly to L2"*) and the file-side Leg 4 design (cluster card 11a runs
*alongside* per-app cards 11–14a): **the cluster is an additional node, not a replacement.**
Members keep their L1s, their rows, and their roadmaps.

- `f1-doctrine`, `f1-press-room`: **individual rows warranted** — both have registered L1
  northstars + roadmaps with merged slices. `cluster-f1` (11b) is a topology node over them.
- GameWorld members: same — 11–14a already exist as file-side rows; `cluster-gameworld` (11a) is
  the cluster conversation, not their absorber.
- No churn risk: the rows a cluster "absorbs" are zero; what changes is at most each member's
  `ladders_up_to` *target* (L2 → cluster property), and ITERATION 6 makes even that optional.

So D2's six-row addition stands, plus 11a/11b/14a from RFI-004 = **nine rows** to bring the DB
level with the file.

---

## RFI-008 — Seeds without repos **[answered]**

**Registry: no. Itinerary: yes.** `northstar-lint` errors on registered paths that don't resolve
("17/17 registered northstars present" is its first check) — a pre-repo seed cannot take a
registry entry without breaking CI. The file-side itinerary already demonstrates the correct
pattern: CarrierPigeon holds row 14a with no `.git`. Under A2, pre-repo seeds live as Itinerary
rows with `posture: seeded` + pull condition; a registry entry follows the first commit that
creates `<app>/.claude/northstar.md`.

**Declared seeds with no repo, found on disk/vault:**
1. `CarrierPigeon` — itinerary 14a; directory exists (2 entries, no `.git`).
2. `basecamp-20` — vault gap G-03 ("no repo yet"), seedling page `[[basecamp-20-program]]`.
3. `story-engine` — vault seedling (`[[story-engine]]`, named as a prospective fleet repo in the
   camera-program page).
4. `seh-engine` — vault seedling (`[[seh-engine]]`); adjacent to the existing seh-study repo but
   declared as a distinct design concept (SE Competency Engine).
5. `apollo-7-counter-cartography` — vault seedling, "implied future, Apollo-class."

Items 3–5 are vault declarations, not fleet decisions; listed as evidence for OD-3/OD-4, not as
row proposals.

---

## RFI-009 — `l2-selfco` deferred entry **[answered — verbatim]**

From `decisions/northstar/README.md`, including the surrounding note, exactly as on disk:

```yaml
  # Deferred to a later slice (declared here so lint/standup know the intended shape):
  # - slug: l2-selfco
  #   tier: L2
  #   path: ~/selfco/tracking/northstar-selfco.md   # in the vault, OUTSIDE wiki/ (lint scope)
  #   ladders_up_to: l3-shared
```

The slug is `l2-selfco`; the path is `~/selfco/tracking/northstar-selfco.md`. The file does not
exist yet (verified; `~/selfco/tracking/` currently holds only jsonl telemetry). Do not invent an
alternative.

---

## RFI-010 — ADR-0087 **[answered — verbatim rule + scope ruling]**

`decisions/adr/0087-stable-identity-and-facet-tags.md` (Accepted, 2026-06-04). Operative rules,
verbatim:

> 1. **The slug is the Configuration Item identifier — the unchanging base.** Each ADR carries an
>    immutable kebab-case `slug:` […] All *new* cross-references use `adr:<slug>` […]
> 2. **The 4-digit number is a non-load-bearing display serial.** `serial:` is `draft` while a decision
>    is `Proposed`, and is assigned exactly once at **accept** — `max(existing serials) + 1`, monotonic,
>    **never reused, never reserved, never renumbered.**
> 3. **Decisions are revised in place (Rev letters), never renumbered.**

**Scope ruling:** the ADR's own text governs **ADR identity only**. Its application to northstar
slugs is **by explicit adoption**: the registry comment on `buddy-check` ("slug is immutable
identity (ADR-0087), so it is registered as-is") and `schema.md` ("Identity is the immutable
`slug` (ADR-0087); property ids `P1…Pn` are assigned once and never reused"). Itinerary `App Slug`
values are **not directly governed** by ADR-0087 — they are bound *transitively* through the
contract rule "`app:` must equal the row's **App Slug**" plus the registry's `app:` field. Net
effect for chat-side practice: treat App Slug as immutable once a northstar registers against it,
because changing it breaks the equality chain even though no ADR text forbids it.

---

# RFQ responses

Format per §4: scope · effort · dependencies · risk · dispatchability. No work performed.

## RFQ-001 — `check:` backfill

- **Scope.** Add a `check:` line to ~57 slices across 8 roadmap files (concentrations confirmed on
  disk: f1-pit-wall 15, silicon-empires 12, f1-press-room 9, f1-substrate 9, morning-cockpit 6,
  rm-l2-ojfbot 3, f1-doctrine 3, mirrorworld 1). Existing fleet patterns are suite-runners
  (`pnpm test`, `python -m pytest -q`) and success-specific commands (`python -m pytest -q
  tests/test_budgets.py`, `python scripts/parity_check.py`, `bash scripts/smoke_ask.sh`).
- **The honest split.** A uniform suite-runner covers the *majority mechanically* but is **vacuous
  for most of them** — the schema's intent is a machine-runnable *success* criterion, and `pnpm
  test` passing does not verify "tyre-degradation panel renders honest residuals." Estimate:
  ~1/3 of the 57 can take a meaningful suite/subset check as-is; ~2/3 need either a targeted test
  file, a small smoke script, or an honest decision that the slice is genuinely `human_only`
  (which is a *valid outcome* — the chore's goal is honest sorting, not 57 green lines).
- **Effort.** 8 per-roadmap PRs, S each; plus new smoke scripts where warranted (S each, land
  inside the slice's own repo).
- **Dependencies.** None. Sequencing position 1-of-6 confirmed.
- **Risk.** Vacuous checks are worse than none — they grant false autonomy confidence. Mitigate by
  requiring each added check to name the slice's success noun (reviewable at PR time).
- **Dispatchability.** **Self-hosting: yes, with a human pattern-PR first.** PR #1 (suggest
  f1-substrate — smallest bespoke surface, strong existing test idioms) is human-authored to set
  the pattern; PRs #2–8 are agent-dispatchable with human review of check *semantics* (the one
  judgment machines shouldn't self-certify).

## RFQ-002 — TD-006 (`S32` → `S33`)

- **Scope.** Both slices are **fully specced on disk already** — deliverables, entrance, success,
  and (notably) their own `check:` commands (`node scripts/bead-lint.mjs --check`, S33 adds
  `--max-open-hook-age-days=30`). S32 = correct the lying registry entry + new `bead-lint.mjs` +
  workflow (shadow/WARN-only) + close the event-loop liveness blind spot. S33 = backfill the 28
  hooks via the existing `/resume --verify`, then promote bead-lint from shadow (the RIDM step).
- **Retroactive vs forward.** Both, by design: S32 is forward correctness; **S33 is explicitly the
  retroactive backfill** ("each hook resolves to shipped (write the report bead, flip the brief to
  closed) or genuinely pending"), worked by concentration: core 11, morning-cockpit 5,
  lofi-beaver 3, remainder. The shipped-vs-pending split is the slice's named finding.
- **loops-lint purpose check.** S32's deliverable (3) addresses the adjacent blind spot (event
  loops must either be liveness-evaluated against `evidence_ref` recency or required to declare a
  verifier — pick one, record why). A full purpose-vs-existence check for *all* loop classes is
  not in S32's text; if wanted, it is a follow-on slice, not scope creep into this one.
- **Effort.** S32: 1 core PR, M. S33: 1 core PR + per-repo backfill commits, M, slower wall-clock
  (fleet sweep).
- **Dependencies.** S32's entrance is **already MET** (TD-006 filed with the audit numbers;
  28-hook baseline recorded). S33 `depends_on: S32`. Flipping `queued`→`ready` is a
  standup/operator act — one line each, not a work item.
- **Risk.** Low; both are shadow-first per ADR-0086. S33's risk is judgment quality on
  shipped-vs-pending calls — which is why the file already marks it `human_only`.
- **Dispatchability.** S32: `claimable_by: either` on disk, has a check — **agent-dispatchable
  today** (it would be among the first slices to clear the RFQ-001 bar naturally). S33:
  `human_only` on disk, correctly.

## RFQ-003 — Load-bearing zeroes

- **Scope.** switchboard S2 (`ready`, "OpenAI + Ollama adapters behind an OpenAI-compatible
  surface", `check: python -m pytest -q`) → S3 ("First consumer: daily-logger routes through
  switchboard", `check: pnpm test`). dive-briefing S2 (`ready`, "Serve /ask — grounded generation
  with per-claim citation verdicts", `check: python -m pytest -q && bash scripts/smoke_ask.sh`).
- **Paper vs real consumers — checked on disk: aspirational.** daily-logger's only references to
  switchboard are repo-name lists in `src/build-api.ts` (display/sweep config), **no client
  integration code exists**. The consumers become real exactly at S3/S6/S9 of switchboard's own
  roadmap — which is fine, but no one should read "4 consumers routed" as load until then.
- **The drift warning.** `rm-l1-switchboard#S2` declares `moves_from: 30` against live
  `current: 0` because **S1 merged (2026-07-23) but its movement line was never written** — the
  same odometer-stall class PR #291 addresses (note: **#291 is still OPEN** as of this response).
  Recommended fix: record S1's movement (P1 0→30) via `record-movement --ref
  rm:rm-l1-switchboard#S1 --pr 1 --apply` if S1's PR carries a movement proposal; if it doesn't,
  a `manual-unverified` line per the #291 convention. Replanning `moves_from` down would erase a
  real merge from the ledger — wrong direction.
- **Effort.** Each slice S–M, 1 PR each in its own repo. S3 additionally touches daily-logger.
- **Dependencies.** S2s: none (both `ready`). switchboard S3 entrance requires S2 merged **+ a
  supervised cron run** (it runs unattended in production — the file says pick a supervised run).
- **Risk.** switchboard S3 touches a live daily pipeline; supervised-run requirement handles it.
- **Dispatchability.** Both S2s have real checks — agent-dispatchable. S3: dispatchable for the
  code, human-supervised for the cutover run.

## RFQ-004 — Cluster-tier build slice

- **Scope.** (i) `ns:cluster-<name>#P<n>` node syntax in `schema.md` + `scripts/lib/northstar-fm.mjs`
  loader + `northstar-lint.mjs` resolve checks; (ii) `cluster-gameworld` file (content from the
  11a voice conversation); (iii) `cluster-f1` file (content from the 11b quick-confirm);
  (iv) pit-wall `depends_on` retrofit + the never-landed lint resolve-check (ITERATION 4 debt).
- **Separability: yes, cleanly.** (i)+(iv) are one mechanical core+pit-wall PR (syntax, loader,
  lint, retrofit — testable without any cluster file existing). (ii) and (iii) are content PRs
  gated on their voice conversations. If the slice proves oversized, split (i)/(iv) from
  (ii)/(iii); do not split (i) from (iv) — the log already bound them.
- **Ladder semantics** (the RFQ's direct question, answered from ITERATION 6 verbatim): the
  cluster is *"an optional rung between L1 and L2 — apps may ladder to a cluster property OR
  directly to L2."* So: the cluster node ladders to L2; members **may** re-point to a cluster
  property but are **not forced to** — existing direct-to-L2 ladders stay valid. This avoids the
  ITERATION-2 re-point-churn concern and means the build breaks zero existing files. The final
  topology call is exactly what card 11b exists to decide — **11b's quick-confirm is a dependency
  of (ii)/(iii), not of (i)/(iv).**
- **Effort.** (i)+(iv): 1 core PR + 1 pit-wall PR, M. (ii)/(iii): 1 small PR each after voice.
- **Dependencies.** (i) none; (ii) 11a conversation; (iii) 11b quick-confirm (which needs
  authoring first — RFI-004).
- **Risk.** Low for (i) — additive syntax, shadow-first lint per house style. Content risk in
  (ii)/(iii) is handled by the relay loop itself.
- **Dispatchability.** (i)+(iv): agent-eligible with `check: node scripts/northstar-lint.mjs
  --check` + a fixture test. (ii)/(iii): human (voice-confirmed content).

## RFQ-005 — `posture:` field + two-mean lint

- **Scope.** Parse `posture:` in `northstar-fm.mjs`; registry entries take the field (17 existing
  entries: **absent = `active` default, no backfill** — set explicit values only on non-active
  rows as the walk assigns them; zero-churn migration); `northstar-lint` drift WARN reports both
  means with N (arithmetic per RFI-006).
- **roadmap-lint posture-awareness: yes, minimal and shadow.** One new WARN: a `ready` or
  `dispatched` slice whose northstar is `reviving`/`seeded` (posture/work mismatch — either the
  posture is stale or the slice shouldn't be ready). Nothing blocking.
- **Effort.** 1 core PR, S. Includes fixture tests in the existing lint-test mould.
- **Dependencies.** OD-6 (amendment confirmation) — this PR is the amendment's first enforcement
  artifact and should not precede its confirmation.
- **Risk.** Minimal; additive optional field is the schema's own preferred change class. One
  honest caveat from RFI-006: **do not sell this PR as resolving the 55-vs-28 question** — the
  computation shows it won't. It resolves the *bookkeeping* of the walk.
- **Dispatchability.** Agent-dispatchable with `check:` = both linters + fixtures.

## RFQ-006 — Hygiene triage

- **Scope & per-item findings** (all verified this session):
  - **buddy-check** — `origin/feat/s1-engine` exists (at `ea8b96e`); local is strictly ahead by
    21 with **no divergence**, so `git push` publishes everything — **confirmed: nothing in the 21
    commits is lost by pushing as-is.** The 2 dirty files are uncommitted and stay local either
    way; list them in the pass and let the owner commit-or-discard.
  - **workstation-yuri** — 8 unpushed on a branch with **no upstream**: `git push -u origin
    feat/mvp-arc-and-input-surfaces`. Sole-copy risk ends there.
  - **daily-logger** — behind 9, **ahead 0**: recommendation is **`git pull --ff-only`**, not
    reset — with ahead=0 they converge to the same commit, and `--ff-only` is the idiom that can
    never destroy local work. Reset is the wrong reflex here.
  - **gcgcca** — branch has no upstream: `git push -u origin feat/npm-frame-ui-components`
    (1 commit), then the 7 dirty files are a commit-or-stash judgment (active work per lc 07-23).
  - **core-library / golf-platform-scripts / todo-todo** — dirty-only (15/8/7); no push fixes
    these; each needs eyes on the diff. Cheap to *stage* (stash with a dated message) if the
    sitting wants clean trees before verdicts.
  - **jocdive-sdi-mcp / newline-ai-course** — no remote at all. `gh repo create ojfbot/<name>
    --private --source . --push` is one command each; **visibility is an operator call**
    (newline contains course material; jocdive is already file-side retired-into-buddy-check,
    which may argue for archiving its code into buddy-check rather than minting a remote).
- **Effort.** One sitting, sequential, ~30 minutes of commands; no slices, no PRs (pushes only).
- **Dependencies.** None; explicitly concurrent per the RFQ.
- **Risk.** Near-zero for the pushes (all fast-forward publishes). The dirty-tree judgments carry
  content risk and are not automatable.
- **Dispatchability.** The pushes: dispatchable but not worth a dispatch — faster done directly.
  The dirty-tree triage: `human_only` (content judgment). **buddy-check first**, per the RFQ's
  data-loss ranking — a single `git push`, and the only live data-loss profile in the fleet closes.

---

## Closing note on §6.2

Acknowledged and corrected: chat-side Notion access is live and OD-5 is the gate, not tooling.
D4's "both relay sides" note is superseded; Code-side Notion MCP remains unauthenticated, so all
Notion writes route chat-side, per constraint 6.3. This response is filed in `offsite/` as the
copy of record for its contents.
