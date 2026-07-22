# "Build these 3 projects to get hired" — creator research, fleet audit, gap-closing plan

**Date:** 2026-07-22 · **Session:** research + audit (read-only against the fleet) · **Operator decisions embedded:** portfolio-first (public standalone-legible repos, then wired into ojfbot as consumers); creator research → selfco vault; gap-closers → registered roadmaps.

## 1. Provenance

Source: three Instagram slides from @bashi_fuirkashi ("Bashiri | Become a Software Engineer") prescribing three portfolio projects for AI-engineering hiring:

1. **RAG Pipeline with Hybrid Search** — FastAPI, dense + BM25 + reranking, ChromaDB/Qdrant, grounded answers with verified citations, Docker.
2. **Agent Orchestration System** — LangGraph, tool use, PostgreSQL + ChromaDB memory, Redis + Celery, supervisor delegation, human-in-the-loop escalation.
3. **LLM Gateway with Fallback Routing** — per-team budgets, Redis token-bucket rate limits, provider failover (OpenAI/Anthropic/Ollama), OpenTelemetry + Prometheus + Grafana.

Creator research: see §2 (deep-research cycle, 2026-07-22) and the selfco vault pages `entities/bashiri-smith` + the source page for the post.

## 2. Creator credibility (deep-research findings)

One deep-research cycle, 2026-07-22 (98 agents; 5-angle search fan-out; 3-vote adversarial verification per claim; 7 findings survived). Vault pages: `selfco wiki/entities/bashiri-smith`, `wiki/sources/bashiri-3-projects-to-get-hired`.

- **Identity confirmed (high):** @bashi_fuirkashi is Bashiri Smith (Los Angeles) — Instagram name field, LinkedIn (`linkedin.com/in/bashiri-smith`), TikTok @bashifuirkashi (~57K), Skool @bashiri-smith-2170 all converge. Business = the BASWE Skool funnel: free ~6.2k-member community + $89/month "BASWE.Ai Engineer Accelerator" (~147 members) + becomeasoftwareengineer.com.
- **GitHub very probably `github.com/bashismith` (medium):** name match + the 2021 Exodus Deno/MongoDB tool cross-checks with his Medium write-up; no explicit profile cross-link.
- **Public code contradicts the persona (high):** 13 mostly-forked bootcamp-era web-dev repos, zero AI/LLM/RAG/agent/gateway code, no public activity since 2022-11-29. He has published no implementation of any of the three projects he prescribes.
- **Credentials unverified (high):** the $265k salary appears only in his own content; LinkedIn lists only his own company as employer; "$1M+ in landed salaries" has no published placement evidence.
- **The advice is repackaged consensus, not insider signal (medium):** the identical "Advanced RAG with Hybrid Search" archetype appears on unaffiliated myengineeringpath.dev (among an 8-project list) and similar patterns on DataTalks.Club, dextralabs.com, buildmvpfast.com; the 3-project set appears only in his social content, not his own curriculum pages. **No primary hiring-side evidence** (job postings, hiring-manager commentary) validating the specific prescription was found.

**Verdict:** unverifiable-influencer channel; the prescription survives only because it is independently corroborated as consensus. Use the archetypes as a checklist, weight real coaching advice (Dipen/newline — publishing researcher) above it. §3 audits against the checklist on its merits.

## 3. Fleet audit vs the three archetypes

Two very-thorough Explore sweeps over ~/ojfbot (2026-07-22). Full evidence paths inline.

### 3.1 Archetype 1 — production RAG with hybrid search: **~75% present, in buddy-check**

The fleet's real RAG is **buddy-check**, not purefoy (purefoy's "embeddings" are speaker-diarization voiceprints; it has zero retrieval and zero eval scenarios — confirmed).

Present in buddy-check:
- **True hybrid retrieval**: SQLite FTS5 BM25 + Ollama `nomic-embed-text` 768-d dense vectors, RRF fusion, tier-aware cross-KB router with query classification (`src/buddy_check/retrieval/embed.py`, `retrieval/router.py`).
- **Citation verification** — the rarest archetype feature: per-claim SUPPORTED/CONTRADICTED/NOT_ADDRESSED verdicts cited to the governing standard (`standards_fidelity.py`), grounded two-pass generation (`generate.py`), verbatim deposit chunks (`deposits.py`).
- **Retrieval evals**: 73-query goldset, recall@1/5/10 + MRR across fts/vec/hybrid/router (`data/retrieval/goldset.jsonl`, `scripts/retrieval_eval.py`); committed results: hybrid r@1 67 / r@5 92 / MRR 0.77.

Gaps: no reranker stage (RRF is the ceiling); SQLite-sidecar + in-memory numpy instead of Chroma/Qdrant (right call at this scale, but not archetype-legible); the hybrid router is **not exposed as an answer-serving HTTP endpoint** (the FastAPI server is a catalog viewer); no Docker packaging; embedding path requires a local Ollama daemon.

Elsewhere: resume-builder = FastAPI shell, no retrieval. bldgblog-corpus = lexical token-overlap KB retrieval only (`src/bldgblog/kb.py`, with an explicit "embeddings can layer on later" seam). No repo tree-wide uses ChromaDB/Qdrant/FAISS/pgvector.

### 3.2 Archetype 2 — agent orchestration: **~70–80% conceptually present, ~0% stack-aligned**

Every conceptual pillar exists, on the bead/Dolt substrate rather than the LangGraph/Postgres/Redis stack:

| Archetype feature | Fleet implementation |
|---|---|
| Multi-agent coordination | bead/hook/convoy primitives — `core/packages/workflows/src/{agent-lifecycle,sling,convoy,event-bus}.ts` |
| Supervisor delegation | `shell/packages/frame-agent/src/meta-orchestrator.ts` — classify → delegate to 6 domain agents, cross-domain fan-out + synthesis, dynamic tool discovery |
| Agent spawning / queue | `core/scripts/day-runner.mjs` — Dolt dispatch queue, CAS lease claim, isolated git worktrees, headless `claude -p` pool |
| Human-in-the-loop | sling `hook_approval_*`, G3 approval queue (`frame-agent/src/routes/approvals.ts`), Gate-0 "runner never merges" |
| Persistent memory | Dolt versioned bead store + GUPP hooks + `.handoff/` filesystem beads |
| Durable graph state | real LangGraph + checkpointer in asset-foundry (`src/orchestrator/graph.ts`, `src/state/checkpointer.ts`); agent-graphs in cv-builder/TripPlanner/blogengine |

Absent: Postgres+Chroma memory tier, Redis/Celery, a single LangGraph supervisor graph. **The gap is legibility, not capability** — a hiring manager cannot read the bead substrate without a translation layer.

### 3.3 Archetype 3 — LLM gateway with fallback routing: **~20–25% present. The genuine gap.**

Exists: frame-agent (Express :4001, single shared Anthropic key, tiered per-IP in-memory `express-rate-limit`); morning-cockpit's provider *selector* (`ollama|claude|off` — ADR-0003 deliberately forbids automatic cloud cascade); real cost machinery only in bldgblog-corpus (`config.py` PRICING table, `annotate.py --budget-usd` hard cap, `ledger.py` per-row token/cost ledger).

Absent: cross-provider failover (frame-agent is Anthropic-only), per-team/per-key budgets at a gateway, Redis token bucket, OpenTelemetry/Prometheus/Grafana (zero hits in user code), universal-proxy posture (the Phase-2 "all sub-app calls via frame-agent" migration is unstarted; sub-apps still call providers directly).

## 4. Gap-closing plan (portfolio-first)

Ordering: **A → C → B.** A is the fastest credible public artifact (finish + publish an already-strong RAG); C is a true build with immediate fleet value; B is writing-heavy translation work.

### Project A — finish buddy-check's RAG into a public, legible service
- **A1 — Answer endpoint**: expose the hybrid router as FastAPI `/ask` (retrieve → grounded generate → per-claim citation verdicts in the response schema). Reuses `router.py`, `generate.py`, `standards_fidelity.py`.
- **A2 — Reranker + measured lift**: cross-encoder rerank stage (keyless-friendly, e.g. a local bge-reranker) behind a flag; re-run the 73-q goldset; publish the before/after r@k/MRR table. This is the differentiator interviewers probe ("how do you know reranking helped?").
- **A3 — Packaging**: Docker compose (app + Ollama), README with the eval table + architecture diagram. **Operator gate:** public carve-out strategy — fresh public repo consuming the KB layer vs. publishing a buddy-check subset (scraped catalog data stays private).
- **Integration:** the same retriever library becomes the selfco-KB / bldgblog `kb.py` upgrade path (replacing lexical overlap via its existing seam).

### Project B — orchestration translation, not construction
- **B1 — "Anatomy of a production multi-agent system"**: public repo/long-form article mapping bead/hook/convoy/day-runner/meta-orchestrator onto industry vocabulary (supervisor, delegation, HITL escalation, durable state), with diagrams and excerpted patterns. The fleet already exceeds the archetype; make it legible.
- **B2 (optional)** — minimal LangGraph re-expression of the day-runner supervisor loop as a bridge demo (asset-foundry already proves LangGraph fluency).

### Project C — build the LLM gateway (new repo; real fleet need)
- **C1 — Proxy core**: provider adapters (anthropic/openai/ollama) + static routing + OpenAI-compatible surface; first fleet consumer via base-URL swap (daily-logger or cockpit chat).
- **C2 — Budgets + rate limits**: Redis token bucket; per-caller (per-app = "team") budgets, generalizing bldgblog's PRICING/ledger/budget-cap into middleware.
- **C3 — Failover + observability**: health-based cascade rules (opt-in per route class, honoring cockpit ADR-0003's determinism stance), OTel traces, Prometheus `/metrics`, committed Grafana dashboard.
- **Integration:** supplies the substrate frame-agent's Phase-2 migration is missing; cockpit panes read gateway metrics.

### Pipeline mechanics
Each project = one roadmap (3–4 slices, gate-0, `check:` on agent-eligible slices) per roadmap-schema v1.1. A-slices can attach to buddy-check once its northstar grows a RAG-service property (operator judgment per the movement contract); B and C need new L1 northstars + registry entries. Northstar property wording/percentages are deliberately left to the operator sitting.

## 5. Sitting outcomes (2026-07-22, operator)

All open decisions from §4 were resolved the same day:

- **A = dive-briefing** (new repo + `l1-dive-briefing` northstar, 9-slice roadmap). Corpus governance per its ADR-0001: private normative pack (PADI/SDI/TDI — never redistributed; public citations = agency+standard+section with short attributed quotes only, source-reveal on press); public catalog pack (manufacturer specs, attributed); public CC contextual pack (operator-vetted license manifest); **USN/NOAA as a quarantined military/scientific pack, excluded from recreational routing by default** (operator domain call: doctrinally contradictory with recreational agency standards — mixing them would corrupt citation verdicts).
- **C = switchboard** (new repo + `l1-switchboard` northstar, 10-slice roadmap). **Python + FastAPI.** All three candidate consumers adopted sequentially: daily-logger (supervised batch) → bldgblog annotate (row-for-row ledger parity gate) → cockpit chat (on a fully-instrumented gateway; cockpit routes never cascade, honoring its ADR-0003). Failover posture staged as switchboard ADR-0001 (draft; accept at S7 entrance): cascade opt-in per route class, labeled, never silent.
- **B = blogengine article + agent-anatomy repo** (diagrams, redacted pattern excerpts, optional LangGraph bridge). Registers when the article is outlined — slices follow the outline.
- Registration: core PR #249 (northstars + roadmaps, lint-clean vs baseline). Skeletons on disk at `~/ojfbot/{dive-briefing,switchboard,agent-anatomy}`.
