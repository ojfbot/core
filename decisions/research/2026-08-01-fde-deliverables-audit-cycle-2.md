# Research — FDE deliverables checklist + fleet re-audit (independent second cycle)

**Date:** 2026-08-01 · **Ticket:** wayfinder #320 (map `fde-operating-presence`) · **Method:** deep-research harness, ONE cycle (6 primary-source angles → adversarial per-angle verification with refetch → checklist synthesis → 2 grading passes → completeness critic; 21 agents, 697 tool calls, run `wf_552dba6d-332`) · **Feeds:** #321 (TeamBot boundary — **urgent, see §7**), #327 (hired-projects disposition), #328 (positioning narrative + venue map).

## 0. Provenance — why this document exists alongside another

Two sessions worked #320 concurrently. The other session filed
`2026-08-01-fde-deliverables-audit.md` (run `wf_c49acb71-86d`, 90 agents, hypothesis-driven:
H1/H2/H3), merged it via PR #332, closed #320, and appended the gist to the map. That happened at
19:39 UTC — roughly 22 minutes into this cycle's sweep phase.

**This document does not replace it and nothing here reopens #320.** It is filed as a companion
because a second, independently-designed cycle over the same question is worth more than either
cycle alone: where the two converge, the finding is corroborated by different methods over
different corpora; where they diverge, the divergence is itself information. Sections 4–6 are new
evidence; §5 corrects the merged audit; §6 corrects this cycle's own agents.

**Independence boundary, stated honestly.** The primary-source sweep, verification, and checklist
synthesis (§2–§4) ran without sight of the merged audit and are genuinely independent. The two
grading passes (§5–§6) ran *after* it landed on disk and cite it — they are informed, not blind.
Treat convergence in §3 as strong and convergence in the grading sections as weaker.

## 1. Method

Six angles, each pipelined into its own adversarial verifier: Anthropic's own postings; Palantir
FDE/FDSE canon; peer postings (OpenAI, Sierra, Scale, Cohere, Cursor, LangChain, Databricks,
Mistral, Ramp, Decagon, Together); first-person practitioner accounts; documented interview and
assessment practice; and the artifact genre itself. Verifiers were instructed to **refute**, to
refetch every cited URL, and to default to `UNVERIFIABLE`/`DOWNGRADED` under doubt. Five read-only
fleet sweeps ran concurrently. A completeness critic closed the cycle.

Corpus: 12 hiring companies' own documents, 3 named practitioners, 1 hiring-manager roundtable.
Claims that failed refetch were struck, not softened — the register is §4.

**Sequential-research rule honoured:** one cycle, no parallel cycles.

## 2. Where the two cycles agree (independently derived, different corpora)

These four findings are now corroborated twice by different methods. They should be treated as the
load-bearing conclusions of #320.

1. **Evaluation frameworks are the best-evidenced FDE deliverable.** Merged audit: genre 1, "the
   hiring gate at Anthropic, the success metric at OpenAI, the first responsibility at Cohere."
   This cycle: convergence 7, independently derived (§3.1.3).
2. **Cost-aware orchestration is not an FDE deliverable.** Merged audit: H1 **REFUTED**, 0 of 25
   verified items. This cycle reached the same place from role taxonomy rather than hypothesis
   testing: gateway/routing work lands *exclusively* on infrastructure-titled forward-deployed
   variants (Sierra FDIE, Palantir FDIE), never application ones. Both cycles conclude switchboard
   is the weakest positioning bet.
3. **The genuine gap is an engagement with an external counterparty.** Merged audit: H3 supported,
   "no public end-to-end engagement… the highest-value missing artifact." This cycle: §1.2
   (convergence 7) and §2.11 (convergence 4) are structurally unreachable by building more
   self-contained repos.
4. **Expertise capture runs vendor-ward, not customer-ward.** Merged audit says so directly. This
   cycle found the same loop as its single highest-convergence item (§3.1.1, convergence 9).

## 3. The checklist — what survived adversarial verification

Full item-by-item detail with URLs is in the run transcript
(`subagents/workflows/wf_552dba6d-332/journal.jsonl`). Convergence = number of distinct hiring
companies whose *own* documents carry the item.

### 3.1 Deliverable artifacts

| # | Item | Conv. |
|---|---|---|
| 1.1 | Reusable delivery assets distilled from engagements — playbooks, patterns, accelerators | **9** |
| 1.2 | A production application running in the customer's own systems | 7 |
| 1.3 | Evaluation frameworks and harnesses | 7 |
| 1.6 | Observable systems — instrumentation shipped with the solution | 4 |
| 1.4 | Written scopes of work and project plans | 3 |
| 1.10 | Public technical output — talks, published content | 3 |
| 1.5 | Deployment runbooks, upgrade procedures, operational automation | 2 |
| 1.7 | Data integration: access negotiation → cleaning → stable pipeline | 2 |
| 1.8 | MCP servers, sub-agents, agent skills | 1 ⚠ |
| 1.9 | Fine-tuning as a delivery lever | 1 ⚠ |

**1.1 is the single most-corroborated item in the corpus** (OpenAI, Anthropic, Palantir, Cursor,
Databricks, Scale, LangChain, Cohere, Sierra). Note what this does to the 2026-07-22 priority
order — see §5.3.

**1.5 and §3.3 below land only on infrastructure-titled variants.** That split within the
forward-deployed family is a finding in its own right and is why gateway work reads as adjacent-role
evidence.

`[weakened]` The familiar "not demos, not prototypes" framing does **not** survive: OpenAI's FDSWE
names proof-of-concept prototypes as a first-class scoped deliverable. Prototypes are a legitimate
stage; what the postings reject is stopping there.

### 3.2 Working practices

| # | Item | Conv. |
|---|---|---|
| 2.1 | Own the full arc: discovery → scoping → design → build → rollout | 7 |
| 2.3 | Route field signal back into product/engineering/research | 6 |
| 2.6 | Security, compliance, governance as design inputs | 5 |
| 2.2 | Ambiguous business problem → scoped workflow with explicit success criteria | 4 |
| 2.8 | Engage stakeholders from technical teams up to executives | 4 |
| 2.11 | **The FDE is not the engagement owner — a paired non-engineering role exists** | 4 |
| 2.4 | Ship a first usable version fast, then harden | 3 |
| 2.10 | Deliberately overfit to the customer; generalization is downstream | 2 ⚠ |
| 2.12 | Enable the customer to operate independently | 2 |
| 2.9 | Learn the customer's domain vocabulary fast | 1 ⚠ |

**2.11 is the most decisive item absent from the merged audit.** Anthropic pairs the FDE with a
Technical Deployment Lead; Palantir pairs Delta (FDE) with Echo (Deployment Strategist); Cursor
staffs pods of 1 Strategist + 1–2 FDEs; OpenAI's TDL owns value cases, ROI and exec reporting and
**no OpenAI IC FDE posting carries an ROI bullet.** The role is defined partly by what it excludes.
This matters directly to #328: pitching ROI ownership pitches the wrong role.

**2.10 cuts against the fleet's instincts.** The Palantir model is deliberate overfitting, with
generalization as a *separate downstream function* (Product Development). The fleet's reflex —
extract to a shared library, gate promotion on a second consumer — is evidence of the
generalization function, not the FDE function.

### 3.3 Technical capabilities

Python as primary language: **convergence 8**, the most consistent technical requirement — and,
per the corpus itself, the least discriminating. Cloud infra (K8s/Terraform/VPC): 4, concentrated
on infrastructure variants. Production LLM/agent competencies: 4. Experience floors span ~4x
(Palantir 1+ years to OpenAI 7+) and **do not converge**; "4+ years" would not distinguish an FDE
from most senior IC roles.

### 3.4 Evaluation and assessment signals

- **4.1** Success measured by production adoption and workflow impact, not delivery milestones — 4.
- **4.2** Palantir's five published competency guides — the **only public assessment rubric in the
  corpus**. Named failure mode worth internalizing: declaring an unfamiliar codebase bad and
  proposing a rewrite.
- **4.3** Drive and "compulsive builders with a prolific visible trail" (Balaji, First Round). **This
  is the only place in the entire corpus where a public body of work is named as a hiring signal.**
  Everything the fleet does about portfolios rests on this one citation.
- **4.6** The role is commercially scoped at org level — Databricks alone describes FDEs as
  **billable**.

**Two published rubrics directly contradict each other and no source reconciles them.** Ramp ranks
drive above engineering fundamentals, explicitly warning against over-indexing the technical bar;
the Palantir lineage insists the technical bar is non-negotiable. Do not smooth this into one
"ideal FDE profile" — carry the conflict.

## 4. Rejected — claims that must not be reused

The adversarial pass struck a substantial fraction of what circulates as FDE lore. Recording it so
it does not re-enter the fleet through a future search.

**Fabricated.** "The FDE day splits 40% prototyping / 30% enterprise architecture / 30% product
feedback." The cited page contains no time-allocation data at all. Strike entirely.

**Cross-contaminated.** "Palantir's FDSE posting frames the role as a startup CTO" — the CTO
analogy is in the *Forward Deployed AI Engineer* posting, not FDSE.

**Inverted.** "FDEs run code review with customer CTOs" — the source describes Ironclad's own
engineers reviewing with Ironclad's own CTO. An internal loop.

**Aggregator artifacts (9 claims).** A cluster of "frameworks" traces to a summary aggregator that
synthesizes its own tables and labels one as "implicit in" the approach — including Ramp's
"always be scoping" checklist and Decagon's productization ladder. In three cases a video URL was
cited while the aggregator was what was actually read.

**Commercially motivated.** An FDE comp band of $350–550K and a five-stage loop with a "~60%
simulation filter rate" come from an interview-prep business selling training for these roles, and
the comp figure is misreported even against its own page.

**What the evidence base does not support at all:** any time-allocation or engagement-length data;
customer-facing handover docs, training curricula or demo decks in *any* FDE-titled posting; and —
critically — **portfolios**. No source discusses résumé structure, merged PRs, benchmark notes or
adoption numbers as candidate signals. Every "portfolio signal" beyond Balaji's visible trail is
derived guidance, and must be labeled as such wherever the fleet reuses it.

**Title instability.** Anthropic's live board carries **zero** "Forward Deployed" titles; the live
family is *Applied AI Architect / Applied AI Engineer*. Palantir runs 74 FDE-titled reqs across at
least six distinct sub-roles. Any checklist keyed to the title alone will miss the work and catch
the wrong roles.

## 5. Fleet audit — disk-verified

Read-only. Load-bearing facts were re-verified against disk rather than taken from sub-agent report.

### 5.1 Hired-projects track, as it exists today (not as roadmapped)

| | dive-briefing | switchboard | agent-anatomy |
|---|---|---|---|
| First-party code | 552 LOC Python | 378 LOC Python | **0** |
| Tests (executed this session) | **28 passed** | **16 passed** | none |
| HTTP surface | none | real, never served a request | — |
| Corpus / goldset / eval harness | none | none | — |
| Slices delivered | 1 of 9 | 1 of 10 | 0 (no roadmap) |
| Northstar properties above 0 | **0 of 5** | **0 of 4** | n/a |
| GitHub visibility | **PRIVATE** | **PRIVATE** | **PRIVATE** |
| `status.jsonl` odometer lines | **0** | **0** | n/a |

Three findings the merged audit does not carry:

1. **The green tests prove the opposite of what they appear to prove.** Both suites are hermetic by
   construction — `dive-briefing/tests/conftest.py` builds 8-dimensional one-hot fake vectors with
   no Ollama and no network; `switchboard/tests/conftest.py` injects `httpx.MockTransport` with no
   real key. Passing them establishes that neither system has ever touched a real provider or a
   real corpus. switchboard has never written a ledger line.
2. **The movement contract was not honoured.** Two slices merged declaring movements
   (dive-briefing P3 0→40, switchboard P1 0→30); `core/decisions/northstar/status.jsonl` has 32
   lines and **zero** matches for either slug. The odometer is not merely at zero — it is not wired
   to the work.
3. **A public overclaim.** `daily-logger/src/generate-article.ts:36` describes switchboard on the
   public dev log as having per-app budgets, token-bucket rate limits, opt-in labeled failover and
   OTel/Prometheus observability. S4/S5/S7/S8 are all queued; none of it exists. The same block
   publishes unbuilt dive-briefing features. The copy is public, points at private repos, and can
   therefore be neither checked nor corrected by a reader.

Scorecard against the checklist: of 30 gradable items across the three repos, **4 SATISFIED
verdicts total** — and one of them is Python, the item the corpus itself flags as
non-discriminating. Genuine strengths worth keeping: dive-briefing's ADR-0001 is a real
governance-as-design-input artifact (§3.2/2.6, convergence 5) that is *implemented and tested*, not
asserted; and its scoping chain from vague ask to falsifiable per-slice success lines is a clean
match for §2.2. Both fail SATISFIED on one word in the sources: **counterparty**. The author
scoped, agreed and executed against himself.

### 5.2 Wider fleet — the asymmetry is the finding

- **§1.3 (evals) is met publicly by exactly one repo**, and the merged audit's scorecard omits it:
  `diy-repair-qa-eval` (public, MIT, 6 topics — the only public repo in the fleet with topics set)
  carries a versioned suite, a human-labeled gold set, a judge from a different model family at
  temp 0, an 11-cycle iteration log, and a README leading with a **miss** (0.75/0.70 against a
  stated >0.80 bar). It is reachable from nothing — not the profile, not the landing site, not the
  log.
- **The three most rigorous eval artifacts in the fleet are private**: f1-doctrine's pre-registered
  sealed-commit phase-keying gate, buddy-check's SME-calibrated judge negative result, f1-pit-wall's
  retraction of a stochastically-inflated 99.2% in favour of an honest 92.5%.
- **§4.4 (candid failure accounting)** — which Palantir interviews for directly — is the fleet's
  single most differentiated quality, and roughly 1 of 5 instances is publicly legible.
- **§1.5 (runbooks): near-total absence**, made sharper by the fact that core publishes a runbook
  *template* and a deploy preflight checklist. The capacity is shipped as tooling; the
  instantiations are essentially zero.
- **§2.8 (dual-altitude communication): a hard zero.** Every document in the fleet is written at one
  altitude — internal expert.
- **§4.3, the only sourced portfolio signal, is the one the presentation actively fights**: 24 of 51
  repos private (including 6 of the 8 pushed in the last ten days); 22 of 27 public repos have no
  topics; `core-library` is public with no README and no description; the profile README omits the
  two strongest standalone pieces and claims **34 ADRs against core's actual 111**.

### 5.3 Does the 2026-07-22 prescription still stand? — feeds #327

**No, and the correction is an ordering correction, not a cancellation.**

The 2026-07-22 plan ran **A → C → B** on the reasoning that B (agent-anatomy) was "writing-heavy
translation work." Under a primary-source ruler that ordering is close to inverted: **B maps to
§3.1/1.1 — convergence 9, the single most-corroborated item in the corpus** — while C (switchboard)
maps to items that appear only on infrastructure-titled variants and to the hypothesis the merged
audit refuted 0-of-25. The correct order is **A → B → C**. The thing dismissed as "writing" is the
highest-convergence deliverable on the page; agent-anatomy is the highest-value *unbuilt* item in
the track and is blocked on an article outline, not on engineering.

Within A, the ordering is also wrong: dive-briefing puts the goldset and recall@k harness at **S3
of 9**, behind a scaffold and an endpoint. Under a ruler where evals are convergence-7 and the
documented interview differentiator, it should have been S1 — and it is the cheapest slice in the
plan, needing no corpus, no endpoint and no deployment.

**Best-supported by primary evidence: dive-briefing — but not for the reason it was chosen.** It
was picked as "the RAG archetype"; hybrid BM25+dense+RRF appears nowhere in the checklist as a
named deliverable. Its actual strength is the corpus-governance seam: authority tiers, a
`private_mount` pack that is unpublishable by construction, and a doctrinal quarantine enforced in
the router and covered by tests.

**Weakest as positioning evidence: switchboard** — on four independent grounds (H1 refuted;
gateway work sits on infrastructure-titled variants; its distinctive observability contribution is
45 lines that have never written a line; its P1 target of ≥3 fleet consumers stands at zero). Its
fleet-internal value is a separate and untouched question, and this finding does not rule on it.

**The conclusion that dominates all of the above:** all three repos are **private**. §4.3 — the
only hiring signal in the corpus a portfolio can address — scores zero regardless of how much gets
built. dive-briefing's own northstar calls it "the public, portfolio-legible dive-Q&A service" and
its P2 target requires a goldset scored "by any visitor." No visitor exists. Nine more slices do
not change that.

## 6. Corrections

### 6.1 To the merged audit (`2026-08-01-fde-deliverables-audit.md`)

- Its fleet scorecard **omits `diy-repair-qa-eval`**, the fleet's only public measured eval harness
  and its best genre-1 evidence.
- It does not name the **runbook gap** (§1.5), which two independent sweeps agree is near-total.
- It carries no equivalent of **§2.11** (the paired non-engineering engagement owner), which is
  convergence 4 and directly constrains #328's framing.

These are additions and omissions, not contradictions. Nothing in this cycle refutes a verdict in
the merged audit.

### 6.2 To this cycle's own agents

Recorded because the same errors would otherwise propagate into #328's venue map:

- A grading pass claimed the profile README "says daily-logger uses GitHub Pages." **False** —
  `ojfbot/README.md:29` says "Merging deploys to Vercel." The Pages reference belongs to `shell`.
- It claimed the README says 40 ADRs. It says **34**; core has **111**. The staleness is larger
  than reported, and the same line also claims "30+ slash commands" against 67 skill directories.
- It counted 3 public drive-by forks. There are **4** (hailstone, gastown, modelcontextprotocol,
  langchain-nextjs-template) — and hailstone is simultaneously cited as the §4.2 flagship, so the
  fork census and the §4.2 evidence contradict each other's framing.
- "100+ committed articles" and the per-repo article tallies were asserted without a stated method
  and are **not verified here**.

### 6.3 Known limits of this cycle

- **§4.3 rests on one article.** The most load-bearing citation in the deliverable is a single
  First Round roundtable. If Balaji is weaker than one quote supports, the entire public/private
  analysis loses its primary anchor.
- **First-party talk transcripts were not fetched.** Nine claims were struck solely because they
  were read through an aggregator; the underlying videos have retrievable captions. That is the
  one modality that speaks to how the work is *done* rather than how it is advertised.
- **No human primary source.** Zero informational interviews with a sitting FDE or FDE hiring
  manager — the modality every other item is a proxy for.
- Palantir's 74 FDE-titled reqs were sampled at a handful while the checklist reasons about the
  population.

## 7. Urgent — feeds #321 (TeamBot public-evidence boundary), which is OPEN

Verified directly against `origin/main` of **public** `ojfbot/core` this session:

- A word-boundary grep for the employer name and the internal system nickname over `origin/main`
  returns **9 files**. (The search terms are deliberately not reproduced here — see
  `adr:boundary-enforced-by-construction`: a list of the protected terms is the disclosure it
  prevents. The live list is the denylist in gitignored `personal-knowledge/`.)
- `decisions/wayfinder/fde-operating-presence.md:19-20` binds the internal system nickname to the
  employer name and quotes a strategic framing sentence, in one place.
- `decisions/research/2026-08-01-fde-deliverables-audit.md` carries the employer name and a
  "Fleet + TeamBot scorecard" section.
- The remaining seven files use the nickname as a bare alias attached to generic agent-harness
  mechanisms. **On their own that is a blind alias; once one public file binds the alias to the
  employer, all of them become retroactively attributed.** That compounding is the actual exposure.

**Governance inversion, stated as fact without inferring intent:** #321 exists precisely to decide
what class of day-job material is publishable. It was opened at 19:00:28Z and is **still open**. PR
#332, which merged material naming the employer to public main, was created at 19:38:49Z and merged
at 19:39:56Z — about 39 minutes later, by an automated session.

Whether this breaches employer policy is a legal question this document cannot answer. The two
verifiable facts are that the material is public and the ruling has not been made. **The remedy is
a decision on #321, not an agent edit** — it is a grilling ticket and the call is the operator's.
Note also that `git history` retains the strings regardless; a history rewrite is a separate and
much larger decision.

One adjacent hazard worth pre-empting: `core-library/public/graph/selfco.json` is a ~1.5 MB
untracked build artifact carrying a TeamBot-tagged node title, sitting in a directory named
`public/` with no gitignore entry. A stray `git add -A` publishes it.

**What is publishable at pattern level** (subject to the #321 ruling): the agent-harness discipline
already shipped in public core as generic mechanisms — preflight state verification, session
reports reconstructed from git rather than self-report, self-contained briefs, a Socratic
comprehension gate at the review boundary. The sanitized version already exists; what would need
removing is the attribution, not the content. **The adoption story — how you get engineers to
accept a gate that slows them down — is the single most FDE-legible thing available**, and it is
§2.2, §2.8 and §2.12 in one narrative. It is tellable only stripped of employer attribution, team
size, internal metrics, tool names and org structure.

**Not publishable:** the employer↔system binding in any form; anything sourced from the primary
day-job corpus (which lives on an unmounted volume, was not inspected, and if built on company time
is plausibly employer-owned); internal metrics, adoption rates, team sizes, org and customer names.

## 8. What this changes for the dependent tickets

- **#321 (TeamBot boundary)** — ticket body stands and is **not** invalidated; §7 makes it urgent
  and supplies the file list the ruling needs. It should be the next ticket worked.
- **#327 (hired-projects disposition)** — ticket body stands; the question ("stand as-is, extend, or
  replan?") is exactly the right one. §5.3 supplies the evidence: the answer is **replan the
  ordering**, not cancel. Two specific inputs the body does not anticipate: the A→B→C inversion, and
  the fact that flipping repos public is a higher-yield move than any slice in the current 19.
- **#328 (positioning narrative + venue map)** — ticket body is **partly invalidated in its
  framing**. It proposes "what would a 3-person FDE team + a McKinsey-style process consultant
  deliver for [the employer]" as the candidate public frame. Two problems: that frame names the
  employer, which §7 shows is the live exposure and was #321's to rule on (**ruled 2026-08-01**:
  de-identified pattern-level only — so the frame is now void as written); and §3.2/2.11 shows the
  consultant-pairing
  instinct is right but inverted — the FDE is the *engineer* in that pair, and pitching ROI and
  value-case ownership pitches the Technical Deployment Lead role instead. The venue map itself is
  unaffected.
- **Not yet specified — "Flywheel TPMs"** — §3.4/4.1 gives it a sourced anchor it lacked: adoption
  and workflow impact, with the measurement method stated.

## 9. Open questions for the operator

1. Does this companion document stand alongside the merged audit, or should the two be reconciled
   into one file? (Reconciling is a real edit to canon another session authored — not an agent call.)
2. #321 needs a ruling before any further FDE-track publishing. Should the employer-name strings on
   public main be removed pending that ruling, or does the ruling come first?
3. Is `diy-repair-qa-eval` the intended public flagship? Both cycles' evidence says it is the
   fleet's strongest public artifact, and it is currently linked from nothing.
