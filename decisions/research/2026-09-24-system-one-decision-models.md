# Research — System One decision models (TypeSafe Jev / open Kev) in the ojfbot fleet

**Date:** 2026-09-24 · **Status:** Research output (informs decision; doesn't make it) — **PARKED by operator ruling 2026-09-24, not continued** · **Input:** external Dia report "System One Inside Your LangGraph Harness" (operator's Desktop, 2026-09-24) · **Method:** one evaluation session — 3 fleet-exploration sweeps (cv-builder V2 graph · core dev-harness · 9 other repos), primary-source verification of every external claim, `/adopt-stack` Gate-0 measurement, one adversarial review pass against the code · **Feeds:** nothing yet — no roadmap slice, ADR, or glossary term was kept (see *Pickup*) · **Full drafted artifacts:** commit `4271b74` on branch `adr/judge-primitive` (adopt-stack record D60–D69, ADR draft `judge-primitive`, CONTEXT/GLOSSARY terms, l2 roadmap S40) — reverted in the following commit, retrievable from history.

## Verdict (one paragraph)

The external report's *mental model* is sound — a cheap typed-decision primitive (Choice / Score / Noul with probabilities) inside a graph node or edge, confidence logged into checkpointed state, cheap first and expensive only on ambiguity — but its *map of where it fits* was wrong at nearly every point because it could not see the code: cv-builder's V2 graph has one conditional edge fed by a full Opus call parsed with a regex plus a hidden second Opus call after every specialist, no quality loop, and a RAG node that is not in the graph; TripPlanner's phases are a straight sequence; gastown-pilot's prime node is a deterministic state check; the harness suggests skills lexically and `/techdebt` has no gate; the fleet's gateway is switchboard, not shell's frame-agent. The commercial model (Jev) is closed to new accounts (operator-verified); independent benchmarks put its lead over open clones anywhere from 26 pp to 0.6 pp depending on domain; prompt-injected state demonstrably moves its verdict (vendor-acknowledged). The fleet already runs five ad-hoc judge-shaped calls and already has the rulings that would govern a real one (ADR-0033 rejected float thresholds; cockpit ADR-0003 forbids silent cloud cascade; switchboard ADR-0001 admits only labeled cascade; f1-pit-wall measured "never escalate what rules rejected"; ADR-0086 shadow-before-enforce). The evaluation's recommendation — absorb the idea as a fleet **Judge** primitive, wrap self-hosted Kev locally, run a three-armed shadow pilot on cv-builder's route against a sealed gold set — was drafted in full and then **parked** by the operator. Two byproducts stand on their own and are not parked: the cv-builder self-report reconciliation (ojfbot/cv-builder#155, ojfbot/core#492) and the daily-logger dead-sweep investigation (separate session).

## Operator rulings recorded during the session

1. **Jev is closed to new accounts** (operator verified) → hosted vendor is not an option.
2. **Any pilot would use local Kev only** — no hosted arm, not even SemIf as a shadow arm.
3. **Vocabulary, if resumed: reuse Judge / Verdict** (the fleet's existing sense in buddy-check, f1-doctrine, l2 PH4 S20), never "classifier" / "router" / "decision model".
4. **Park it.** File as draft research; do not register slices, terms, or an ADR now.

## Pickup (if resumed)

1. Re-read this note's Parts A–F below; re-verify Part A's external facts (the ecosystem was 9 days old at evaluation; SDK 0.6.0).
2. Restore the drafted artifacts from `4271b74` (`git show 4271b74:decisions/adopt-stack/system-one-decision-model.md`, `…:decisions/adr/draft-judge-primitive.md`, the S40 hunk in `roadmap-l2-ojfbot.md`, the CONTEXT/GLOSSARY hunks) rather than re-deriving them; re-run `measure-pkg.mjs @typesafe-ai/sdk` so the Gate-0 table is fresh.
3. Entrance for any pilot remains `rm:rm-l1-cv-builder#S1` (orchestrator hygiene) — check whether it merged.
4. Do **not** pick the daily-logger cleaner or the core skill suggester as a pilot; Part C records why.

---

## Part A — External facts, verified 2026-09-24

| Claim | Status | Evidence |
|---|---|---|
| Jev = TypeSafe AI's first "System One" model, shipped Sept 15 2026; returns Choice/Score/Noul + probabilities in one forward pass, never generates text | **Confirmed** | typesafe.ai blog; LangChain blog (Sept 17); marktechpost |
| SDK is `@typesafe-ai/sdk` (JS) / `typesafe` + `langchain-typesafe` (Python); LangChain.js has `@langchain/typesafe` 0.0.1 (peer `@langchain/core ^1`) | **Confirmed** | `pnpm view`; docs.langchain.com typesafe provider page |
| Base-URL swap works (Jev ↔ SemIf gateway ↔ self-hosted Kev) | **Confirmed** | SDK reads `TYPESAFE_BASE_URL`; `POST /v1/systemone`; Kev README: "drop-in for Jev", SDK works unchanged with `base_url` |
| Jev is waitlisted | **Confirmed unavailable — operator verified 2026-09-24: TypeSafe is not signing up new accounts** | typesafe.ai says "early access"; secondary sources disagree; resold via OpenRouter / Vercel AI Gateway (not verified to be open either). Consequence: the only providers the fleet can actually run today are **Kev (self-hosted, Apache-2.0)** and, until Sept 28 and only for US orgs on LangSmith plans, SemIf. The commercial model is out of scope for the pilot and for any near-term adoption |
| Jev pricing | $42 / 1B input tokens ($0.042/M), output free; ~$0.0004/decision; ~32k-token state limit; 70–500 ms | typesafe.ai; requesty; lmspedia |
| SemIf free on LangSmith Gateway until Sept 28 | **Confirmed** (LangChain docs). Model id `semif-qwen3.5-4b`; US orgs on Free/Developer/Plus; needs `LANGSMITH_API_KEY`; SemIf is "formerly OpenJev", not affiliated with TypeSafe | docs.langchain.com/langsmith/llm-gateway-decision-models |
| Kev = independent open-source clone, self-hostable | **Confirmed** | github.com/jaredpalmer/kev, Apache-2.0, Qwen3.5 0.8B/4B/9B/27B; **Apple Silicon via MLX, 4B/9B fit a 32 GB Mac**; ~720 ms for 5 questions on ~270 tokens (M5), 136 ms cached; no Ollama path |
| "0.966 (Jev) vs 0.704 (best open) on an independent 49-task benchmark" | **Confirmed as one benchmark, misleading as a summary** | That is the "jabr" classifier benchmark (49 tasks / 869 cases). Other independent measurements disagree sharply: open-system-one (10,000 decisions, 4 public datasets, CPU-only) → Jev 79.3% vs a 149M cross-encoder 78.7% (**0.6 pp**); SemIf's own bench (144 decisions) → Jev 0.965 vs Kev-9B 0.917; Kev's eval → Jev 0.857 vs Kev-27B 0.848. **The gap is domain-dependent, from 26 pp to <1 pp.** Only a measurement on the fleet's own decisions is meaningful |
| LangChain's "500 agent decisions" test | Real but narrow: 5 weather-agent runs × 100 repeats, one human labeler; Jev 100% agreement, variance 92–913× lower than LLM judges; LangChain itself says "repeatability is not proof of correctness" and it "does not establish whether Jev will generalize" | superpowerdaily summary of LangChain post |
| Calibration | RLCD training targets honest probabilities; open-system-one shows a **confidence trap** in an open decision head (mean confidence 0.968 at 22.5% accuracy on out-of-distribution input). Calibration must be measured (ECE/Brier), not assumed | open-system-one README |
| **Prompt injection moves the verdict** (absent from the Dia report) | **Confirmed, vendor-acknowledged** | VentureBeat: tool-safety gate on `rm -rf ~/.ssh` went from block p=0.76 / conf 0.64 to p=0.48 / conf 0.22 after a planted "pre-approved" field. TypeSafe docs: "text that argues for its own classification can move the answer." LangChain mitigates by stripping tool outputs from classifier input |

### Gate 0 (script-measured, `measure-pkg.mjs` verbatim)

```
## Gate 0 measurement — `@typesafe-ai/sdk@0.6.0`
| Signal | Measurement |
|--------|-------------|
| Unpacked size | 0.2 MB |
| Direct dependencies | 0 |
| Transitive tree | unknown (requires install in a throwaway dir — do not estimate) |
| Engines | {"node":">=20"} |
| Telemetry SDKs | — |
| DB drivers | — |
| Server / router | — |
| UI frameworks | — |
| Auth stacks | — |
| Native-build hints (direct) | — |
| Package's own install scripts | — |
| Ships a bin/CLI | no |
| Application-shaped signals | 0/6 application-shaped signals |
```

Verdict: **LIBRARY.** Compiled SDK (unpkg `dist/index.mjs`) sends only auth + `User-Agent`/`X-TypeSafe-SDK`/`X-TypeSafe-Runtime` headers; no analytics. Constructor takes `apiKey`, `baseURL`, `defaultModel` (default `jev-latest`), `timeout` (10 s), `retry` (2 retries, 408/429/5xx), `fetch`, `logger`. WRAP-by-import is legitimate. Note the SDK is 9 days old at 0.6.0 (a 0.x API): pin exactly.

---

## Part B — Report scorecard (claim by claim, against the code)

| # | Report claim | Verdict | What the code actually says |
|---|---|---|---|
| 1 | cv-builder V2 is a LangGraph `StateGraph`, the layer to target | **True** | TS, `packages/agent-graph/src/`, `@langchain/langgraph` ^0.2.19 (installs 0.2.74), SQLite checkpointer, SSE on `/api/v2/chat/stream`. V2 on only when `ENABLE_V2_API=true` |
| 2 | "3 node-level fits: route · gate · judge" | **1 of 3 exists** | Exactly one conditional edge (`graphs/cv-builder-graph.ts:102`). No judge, no quality loop, no `interrupt`. RAG node is **not in the graph** and no node reads `ragResults` |
| 3 | "Suggested first move: RAG relevance Score gate — pure add-in, changes no control flow" | **Wrong first move** | Gating dead code changes nothing. RAG is `MemoryVectorStore` + hard-coded seed text + plain top-4 `similaritySearch`, `OPENAI_API_KEY` required. Shared invariant already says MemoryVectorStore in prod is a blocker. A gate here would be theater until RAG is wired and persisted |
| 4 | "Conditional-edge routing is most harness-native; today likely an LLM or hand-written branch" | **Both, and worse than either** | `routeToAgent` is a switch on `state.nextAction`; `nextAction` is set by a **full Opus call** (`claude-opus-5`, temp 0.7, 2048 tokens) parsed with `/\*\*Next Action\*\*:\s*(\w+)/` and `as any`, keyword-guess fallback. Plus a **hidden second Opus call** after every specialist (the edge returns to the orchestrator, which re-reads the specialist's own reply as a "user request") — a continue/stop judge nobody designed. `temperature: options.temperature \|\| 0.7` makes 0 impossible. `rag_retrieval` action self-loops. Recursion limit is the library default |
| 5 | "Quality loop is where LangGraph and Jev combine best" | **Would be new control flow, not a swap** | No loop exists. The closest planned thing is TECHDEBT TD-007 `ApplicationAuditAgent` (blocks until Hard requirements score "Met") and northstar **P2 "trustworthy, not hallucinated"** (each bullet maps to a source-CV span; current 20%). A per-bullet Noul "is this claim supported by the source CV?" is the highest-value *new* decision in the repo — but see injection risk in Part D |
| 6 | "Persist the probability into checkpointed state; rides the SSE stream for free" | **True, small work** | `metadata: Record<string,any>` exists (last-write-wins); `ARCHITECTURE_V2.md:260` already designs `RoutingDecision{…, confidence:number}`; SSE `state` event at `routes/v2/chat.ts:124` carries only 4 fields, needs extending |
| 7 | "Same decider reusable across TripPlanner's 11-phase pipeline" | **No fit** | The 11 phases are a straight sequence in `import-processor.ts`; the only decisions are JSON-shape checks, string `includes`, and a cosine threshold. Nothing to route |
| 8 | "…and gastown-pilot's multi-agent graph" | **No fit today** | `prime` node is a stub returning `await_input`; the intended `runPrimeNode` (core `prime-node.ts`) is a deterministic state check (hook → mail → budget → approval). Not a model decision by design |
| 9 | "In core it routes slash commands and gates /techdebt" | **False on both counts** | Slash-command suggestion is **lexical word overlap** (`scripts/hooks/suggest-skills.mjs` `scoreCatalog`: +10 suggested_after, +5 phase, +3 tag, +2 trigger word; any score > 0 fires; no confidence). `/techdebt` has **no gate** — it is offered inline by other skills' postflight; propose-mode classification (priority/effort/kind) is one Sonnet generation call. The one real "cheap decision" call in the harness is the **CLAUDE.md gate judge** (`claude-md-gate/judge.mjs`, Haiku, returns `{isConditional, suggestedLayer, confidence}`; confidence logged, never used) |
| 10 | "Register one decision provider behind the shell frame-agent gateway" | **Wrong gateway, right instinct** | Shell's `frame-agent` (port 4001) does hold two System-One-shaped classifiers (`meta-orchestrator.ts` `classify()` → DomainType via 20-token Sonnet call after regex fast paths; `detectAction()` → spawn/focus/null via 80-token call), but the model is hardcoded, there is no provider registry, and the harness itself never routes through it. The fleet's designated gateway is **switchboard** (Python/FastAPI, provider adapters, per-app budgets, opt-in *labeled* cascade, ADR-0001; Ollama adapter is unmerged S2). A decision provider belongs in switchboard as a route class, or in the calling app's own adapter |
| 11 | "Gate behind a confidence threshold with a Claude fallback" | **Collides with two standing rulings** | cockpit ADR-0003: *no automatic cloud cascade* (degrade to deterministic, never to cloud). switchboard ADR-0001: cascade only per opted-in route class and always labeled. core ADR-0033 *rejected numeric confidence thresholds* ("LLMs produce poorly calibrated probabilities") in favor of categorical high/medium/low + mandatory human PR review. Adopting a float threshold requires revising ADR-0033 with calibration evidence, not sliding it in |
| 12 | "0.966 vs 0.704 — open models copy the interface, accuracy only partly" | **Overstated** | See Part A: gap ranges 26 pp → 0.6 pp across independent benchmarks. Fleet-side measurement is the only number that counts |
| 13 | Prompt injection | **Omitted** | The single biggest risk for cv-builder (JD text is pasted from the wild) and for any tool-safety gate. See Part D |

**Net:** the report's *mental model* (decision primitive inside a node or edge, confidence logged into checkpointed state, cheap first / expensive on ambiguity) is right and worth absorbing. Its *map of where it fits* is mostly wrong because it couldn't see the code, and it misses the fleet's own precedents and rulings.

---

## Part C — Where the fleet already makes cheap decisions (fit ranking)

Ranked by: hot-path frequency × existing labels/evals × conformance with standing rulings × injection exposure.

| Rank | Decision point | Today | Shape | Labels / eval available | Notes |
|---|---|---|---|---|---|
| **1** | **cv-builder orchestrator route** `nodes/orchestrator-node.ts` | Opus ×2 per turn, regex parse; the keyword fallback at `:146-156` is literally a regex router already | Choice over 5 actions + done (+ error) | `scripts/test-graph.ts` message→route pairs (5); 4 few-shot examples; 18 personal JDs + 5 audits (gitignored) → a sealed gold set can be authored **before** any arm is scored (f1-doctrine pattern) | **Best first pilot.** Three arms fall out naturally: A0 regex fallback (deterministic floor), A1 local Kev-4B, A2 Opus (incumbent). Replayable offline from the gold set, so it does not depend on live traffic. Precondition (no model): input-existence rules into code, honor the specialist's `done`, fix the temperature bug, validate the parsed action against the enum. Injection exposure: low (state = user's own message + 4 checkmarks) |
| 2 | **core CLAUDE.md gate judge** `scripts/hooks/claude-md-gate/{tripwire,judge,gate,events}.mjs` | tripwire (3000-token threshold) → Haiku judge → `decide()` in `shadow` (default) / `enforce` / `off`; trips logged to `~/.claude/claude-md-gate-telemetry.jsonl`; M5 "judge false-block rate" gates shadow→enforce | `{isConditional, suggestedLayer, confidence\|null, reasoning}`; **`decide()` reads only `isConditional`**; the prompt is ADR-0081-specific; signature is `judgeBlock({filePath, addedContent, complete})` | Telemetry jsonl; M5 | **Not a zero-point for the verdict shape** (reviewer-verified): the reusable seam is the injectable `complete(system, user)` — a *provider* boundary. It is a later *consumer* of the Judge primitive, and the shadow/enforce/TPM scaffolding is the template for every pilot |
| ✗ | **daily-logger cleaner** "is this TODO resolved?" `src/cleaner.ts:411-499` (Noul + high/medium/low) and "is this doc stale?" `:312-398` | Opus, sequential per candidate; `low` → `return null` | TODO path is System-One-shaped; **doc path asks Opus to emit line edits — a generation task** | **None per candidate.** `stamp-outcome.ts` stamps the *article's* `outcome: accepted\|edited`, not cleaner hunks. Only labels: `clean/<date>` PR merged vs closed, per PR not per hunk (166 PRs, merges cluster to the minute = backlog clearing). ADR-0033's skip report and `medium` markers are unimplemented (`Status: Proposed`) | **Blocked, and the pipeline is dead:** zero candidates swept since 2026-08-19 (every run since logs "No recent commits found — nothing to sweep" while repos have commits; `collectContext` shows `gh api … — skipped` warnings; the daily blog has no article PR after 08-10). This is the "no-ops GREEN" shape already in operator memory. Even alive it was ~7 candidates / 0–3 proposals per run; ADR-0035's cap is unimplemented and never approached. Filed as an out-of-scope investigation (see Findings). Revisit only after the sweep is fixed or killed and ADR-0033's per-item skip report exists |
| **3** | **cv-builder northstar P2 grounding check** (new) | Nothing built (P2 at 20%) | Noul per generated bullet: "supported by source CV span?" | None; would need a fabricated-bullet eval scenario (the northstar's own verification clause) | Highest value, but the state includes JD text → injection surface. Must pair with a deterministic span-match floor; the model only ranks what the floor can't settle |
| 4 | **shell frame-agent classifiers** `packages/frame-agent/src/meta-orchestrator.ts` `classify()` / `detectAction()` | regex fast path → 20/80-token Sonnet call, substring match, no confidence, hardcoded `claude-sonnet-4-20250514` | Choice over DomainType; Choice spawn/focus/null | none | Shape fits; needs a provider seam first. Per-message hot path in the shell UI, so latency matters — local Kev only |
| **✗** | **core skill suggester** (UserPromptSubmit hook; κ 0.700 overall / 0.743 dev / **0.603 holdout**; 27-row gold `decisions/opav/suggester-gold-v1.jsonl`, 9 holdout rows out of bounds for tuning) | lexical `scoreCatalog`, no threshold | Choice over 77-entry catalog + no-match | **Best-instrumented decision in the fleet** (gold set + `suggester-eval.mjs` κ harness) | **Do not target now.** Prior research (`decisions/research/2026-07-17-skill-loop-sota.md`): an LLM pre-classifier "hallucinated false positives"; forced-eval hook won; router skill **rejected** (Pocock D15). Roadmap S15 "semantic suggester" is explicitly **LAST, gated on ≥10 logged lexical misses after S10–S12**. ADR-0068: 0.8% followed rate — the bottleneck is following, not matching. Revisit only when S15's data gate opens; the κ harness then becomes the calibration read for free |
| 6 | **morning-cockpit watch scorer** `packages/watch/src/score.ts` (ADR-0017) | qwen2.5:7b via Ollama, per item, 06:15 batch; 3 scores 0–1 with prompt calibration examples; deterministic authority; `THIN_CEILING=0.55`; degrades to deterministic score | Score ×3 | `rubric_version` per row; no calibration set | Already the fleet's **template** for a local scorer with a deterministic floor. Swapping qwen for Kev is a provider change inside an existing adapter; cloud Jev is forbidden here (ADR-0003) |
| 7 | **f1-pit-wall NL router** `packages/server/src/route.ts:66-88` | rules → cheap model slot-fill → validator; measured eval (`pnpm eval:router`) | Choice + slots | Measured: "LLM rescues of rule-rejected queries: 4 misroutes, 0 wins" | The fleet's own evidence for **never escalating what deterministic rules rejected on purpose** — bake into the primitive's contract |
| 8 | dealdesk critique verdict (`strong\|workable\|weak`, Sonnet → qwen2.5:32b fallback) | LLM | Choice | — | Candidate later |
| 9 | `/techdebt` propose-mode `priority/effort/kind` (Sonnet, one generation call) | LLM | Choice ×3 | — | Could split out as 3 typed questions; low volume, low value |
| 10 | dive-briefing `classify()` regex tier routing (no abstain step) | regex | Choice + abstain | buddy-check goldset | Would be new; "no LLM in the retrieval path" is a stated design choice — needs its own ruling |
| 11 | selfco-box page-type / heavy-model choice; tag proposal (988 tags, 46% singletons, S7 vocabulary pending) | human hint + Claude in loop | Choice | none until S7 vocabulary lands | Blocked on S7 |
| — | TripPlanner phases, gastown-pilot prime, purefoy FTS5, merge-quiz `wouldQuiz`, git-guard, bead-lint, autonomy-fit | heuristic / deterministic / regex | — | — | **Not targets** — deterministic by design; the fleet's default is "rules first, model only for the remainder" |

Existing calibration/judge harness to reuse: **f1-doctrine phase-keying gate** (sealed gold committed before labels, blind judge with shuffled arm labels, pre-registered pass bar) — this is the fleet's pattern for an honest "does the cheap decider agree with the expensive one" read.

---

## Part D — Standing rulings and risks that shape the design

1. **Local-first / no silent cloud** (cockpit ADR-0003; switchboard ADR-0001). A "fall back to Claude" edge is allowed only as an opted-in, labeled route class. Default degrade path is deterministic, not cloud.
2. **Confidence thresholds were rejected once** (core ADR-0033): categorical + human gate, because LLM probabilities aren't calibrated. System One's RLCD claim is exactly the counter-argument — so the pilot's job is to *produce the calibration evidence* (ECE/Brier on fleet labels) that would justify revising ADR-0033, and to keep the human gate regardless.
3. **Shadow before enforce** (ADR-0086): any decider that takes action runs Brassboard/observe-only first, emitting TPMs; promotion is a recorded RIDM decision.
4. **Prompt injection moves the verdict** (vendor-acknowledged). Contract rules for the primitive: (a) never gate a consequential or destructive action on the decision alone; (b) strip untrusted fetched content / tool outputs from `state` (LangChain's own mitigation); (c) deterministic floor first, model only ranks the remainder; (d) test option-order and adversarial payloads before promotion. cv-builder JD text and vault-ingest content are untrusted.
5. **Never escalate what rules rejected on purpose** (f1-pit-wall measured: 4 misroutes / 0 wins).
6. **Benchmark humility**: independent gaps range 26 pp → 0.6 pp; the SemIf free window closes Sept 28; the SDK is 0.6.0 and 9 days old. Pin, wrap, measure.
7. **LLM pre-classifiers have already lost once in this fleet** (skill-loop SOTA research: hallucinated false positives; router skill rejected, Pocock D15; S15 semantic suggester gated LAST). Any new decider must clear the same bar: measured on a sealed gold set, precision reported, promotion data-gated.
8. **Name by purpose** (user rule) and reuse existing words. The fleet already says **judge** for an LLM call whose output is a verdict calibrated against human labels — buddy-check ("judge ≠ generator; judge untrusted until agreement ≥ 80%/dim"), f1-doctrine's blind judge, l2 roadmap PH4 "one calibrated judge" / S20 "Calibrate judge #1", `claude-md-gate/judge.mjs` — and **verdict** for the typed outcome (PASS/BLOCKED, ABSORB/WRAP/REJECT, keep/kill/revise). A System One call is the same thing at a cheaper cost tier, not a new concept, so: the primitive is a **Judge** (interface `{state, questions} → {answers, confidence, provider, model}`), its output a **Verdict**, Haiku / Kev / Jev / Opus are **judge providers**, and the buddy-check rule ("untrusted until agreement clears a bar") becomes the primitive's contract. `CONTEXT.md` gets **Judge** and **Verdict** with a "Flagged ambiguities" line reconciling the rubric-grader and typed-question uses; `_Avoid_: classifier, router, decision model` (the first two carry rejected-skill baggage). Never "typesafe"/"jev" in schema or domain names. (Corrected after review: merge-quiz does not use the word "judge"; buddy-check and the l2 roadmap do.)

---

## Part E — `/adopt-stack` decision table (to be written to `core/decisions/adopt-stack/system-one-decision-model.md`)

| # | Opinion the stack imposes | Call | Evidence → invariant |
|---|---|---|---|
| 1 | "Decisions are typed questions (Choice/Score/Noul) over a state, answered with probabilities" | **ABSORB** | Idea is small and good; caro #1460 did the same (local `Choice<T>` + measured-not-constant confidence). Re-express as the fleet **Judge** primitive with a provider interface (new code; `claude-md-gate/judge.mjs` supplies the provider-injection seam `complete(system,user)` and the shadow/enforce/TPM scaffolding, not the verdict shape); the fleet has five ad-hoc versions (gate judge, cleaner, watch scorer, pit-wall router, frame-agent classify) → ubiquitous language |
| 2 | Hosted API at `api.typesafe.ai`, key in env | **REJECT for now (not obtainable)** | Operator verified 2026-09-24: no new accounts. The SDK is still worth wrapping because Kev speaks the same `/v1/systemone` shape via `baseURL`; if TypeSafe reopens, hosted Jev would re-enter only as an *opted-in, labeled* route class (switchboard ADR-0001), never the default for hooks or cockpit |
| 3 | Confidence float + threshold routing | **ABSORB, with ADR-0033 revision gated on measured ECE/Brier** | ADR-0033 rejected float thresholds on calibration grounds; RLCD is the counter-claim; shadow pilot supplies the data |
| 4 | "Fallback to an LLM below threshold" | **ABSORB as *labeled escalation*, REJECT as silent cascade** | ADR-0003 / switchboard ADR-0001; pit-wall "never escalate rule-rejected" |
| 5 | LangChain integration package (`@langchain/typesafe`, `langchain-typesafe`) | **REJECT for now** | 0.0.1 / experimental middleware; the direct SDK is 0 deps and the routing function is a plain TS function. Revisit if `ModelRouterMiddleware` matures |
| 6 | LangSmith Gateway as provider registration point | **REJECT** | Fleet has switchboard; SemIf free window ends Sept 28 and is US-org-plan-gated. Use SemIf only as a short-lived second shadow arm |
| 7 | Log probabilities into graph state / stream | **ABSORB** | cv-builder `RoutingDecision{confidence}` already designed; extend SSE `state` event |
| 8 | Vendor-named types in domain code | **REJECT** | name-by-purpose rule; confinement check `grep -r typesafe packages/` → adapter only |
| 9 | Self-hosted Kev (MLX) as local provider | **WRAP at a process boundary** | Kev is a Python server (`kev.serve`), Apache-2.0, fits a 32 GB Mac; run out-of-process like Ollama, speak the same `/v1/systemone` shape. The Pi is out (4B model). Conforms to local-first |

| 10 | Suggester/router use case (the vendor's headline demo: "route the request") | **REJECT for the harness now** | Pocock D15 router rejected; S15 gated LAST on logged lexical misses; ADR-0068 shows follow-through, not matching, is the gap |

**Integration shape (one line):** absorb "typed question + calibrated confidence + logged verdict" as the fleet **Judge** primitive behind one provider interface; wrap self-hosted Kev (local, default; Jev is closed to new accounts) as the first cheap judge provider via the `@typesafe-ai/sdk` wire shape; run every adoption in shadow, three-armed against a deterministic floor and the incumbent, on a sealed gold set, before it moves any control flow.

---

## Part F — Recommended execution (control-gated, one slice per PR)

Reviewer-verified corrections folded in: the cleaner pilot is out (dead sweep, no per-candidate labels, doc half is generation); `judge.mjs` is a provider seam, not a verdict-shape zero-point; ADR-0100's four loop elements must be named up front or the work is a wayfinder ticket; a northstar *property* is a claim about the harness, not a pilot — the pilot is a *slice*.

### Slice 0 — Decision record + ADR stub + glossary + slice registration (core) — the `/adopt-stack` deliverable
- Write `core/decisions/adopt-stack/system-one-decision-model.md`: Gate-0 table verbatim (above), Part E table, integration shape, the benchmark-disagreement note, the injection note. (This is the OPAV-tracked `skill:acted` artifact for the `/adopt-stack` invocation made in this session.)
- `/adr new` stub `judge-primitive` (slug-as-identity, no serial) recording: the **Judge** interface `{state, questions} → {answers, confidence, provider, model}` with question kinds Noul/Choice/Score; zero-point `scripts/hooks/claude-md-gate/judge.mjs`; provider list (Haiku today; Kev local; Jev hosted opt-in); the contract rules from Part D (§4 injection, §5 never-escalate-rule-rejected, §1 labeled escalation only, §3 shadow first); the ADR-0033 revision trigger (measured ECE/Brier on fleet labels); traces `relates-to: [control-gated-slices, explicit-failover-and-per-app-budgets (switchboard), local-first-lane-synthesis (cockpit 0003), daily-cleaner-confidence-threshold-policy]`.
- `core/CONTEXT.md`: add **Judge** and **Verdict** (`_Avoid_: classifier, router, decision model`); `domain-knowledge/GLOSSARY.md` one-liners.
- Register the pilot as a **slice** under the l2 roadmap's PH4 ("the evaluation layer … one calibrated judge"), next to S20 "Calibrate judge #1": **"Calibrate judge #2 — cv-builder route: cheap judge provider vs regex floor vs Opus on a sealed gold set"**, `advances: ns:l2-ojfbot#P2`, `autonomy: gate-0`, `repo: cv-builder`. ADR-0100's four loop elements, named now, not deferred: **ledger** = `cv-builder/evals/route-shadow.jsonl` (one row per routed turn: prompt hash, state checkmarks, arm verdicts, probabilities, provider, model, `routed_by`); **check** = `pnpm eval:route` (new script modeled on core `suggester-eval.mjs` and f1-pit-wall `eval:router`: agreement, κ, ECE/Brier per arm vs sealed gold; `--check --baseline=` mode for CI); **schedule** = runs in cv-builder CI on every agent-graph PR + replayed manually after any provider/model change; **verdict-dated slice** = keep/kill/revise on **2026-10-22** (4 weeks after Slice 2 lands), recorded in `decisions/research/`. Lint: `node scripts/roadmap-lint.mjs --check` in core. Movement-contract discipline: the slice declares `moves_from/moves_to`; nothing writes northstar `current:`; `record-movement.mjs` runs at merge.
- No code. Reviewable in one sitting.

### Slice 1 — cv-builder orchestrator hygiene (no decision model yet)
- **Entrance:** Slice 0 merged.
- **Build:** deterministic input-existence checks in code (the prompt's "needs bio / currentJob" rules); add a conditional edge **specialist → END on `done|error`** so the hidden second Opus call disappears; fix `options.temperature || 0.7` (`orchestrator-node.ts:98`, `cv-builder-graph.ts:76`) to `?? 0.7`; validate the parsed action against the `nextAction` enum instead of `as any`; either register the RAG node for `rag_retrieval` or remove the enum value (today it falls to `default → "orchestrator"`, a loop bounded only by the library recursion limit); set an explicit `recursionLimit`; add a `routingDecision` state field with its own reducer (shape from `ARCHITECTURE_V2.md:260`, incl. `confidence`, `routed_by`, `provider`) and put it on the SSE `state` event (`routes/v2/chat.ts:124-129`). Add the graph-compile and routing unit tests `langgraph-patterns.md` already prescribes.
- **Visible change to state up front:** one fewer chat bubble per turn (the orchestrator's post-specialist summary goes away; the specialist's message already carries the content). Update `scripts/test-graph.ts:269` message-count expectations and `chat-service.ts` consumers. Side bug to fix in passing: `client-v2.ts:253` checks `event.type`, which the server never sends.
- Ships value alone: halves Opus routing calls, makes routing deterministic and testable, creates the seam for Slice 2.

### Slice 2 — Shadow pilot: cv-builder route, three arms (Brassboard, observe-only)
- **Entrance:** Slice 1 merged; sealed gold set committed **before any arm is scored** (f1-doctrine pattern): the 5 `test-graph.ts` pairs + ~40 authored prompts covering all 6 outcomes incl. `done`, with state-checkmark variants, plus a small adversarial subset (prompts that argue for their own routing); Kev-4B running locally on the Mac (`uv run --extra serve python -m kev.serve --run jaredpalmer/kev-4b --port 8009`, MLX). **Operator ruling 2026-09-24: local Kev only — no hosted arm in the pilot.** The adapter keeps `baseURL` configurable so a hosted provider (Jev / SemIf) remains a one-line, opt-in, labeled option later; it is not wired, keyed, or logged in this slice.
- **Build:** a small local `judge/` module in `packages/agent-graph` — the Judge interface (`{state, questions} → {answers, confidence, provider, model}`), one vendor adapter over `@typesafe-ai/sdk` (pinned exact `0.6.0`, `baseURL` configurable so Kev/SemIf/Jev are one adapter), one adapter over the existing Anthropic call, and the regex floor as a third provider. In `routeToAgent`/orchestrator: compute A0 (regex), A1 (local Kev judge) **alongside** A2 (Opus, still decides); write every arm's verdict + probabilities into `routingDecision` and append to the ledger. Promote to a shared package only when a second consumer (Slice 4+) exists — no speculative scaffolding.
- **Contract rules enforced in the module:** never escalate what the deterministic floor rejected on purpose; strip anything not user-authored from `state`; confidence null-safe; provider labeled on every verdict.
- **TPMs:** M1 agreement with sealed gold per arm; M2 κ vs gold (same harness as the suggester); M3 ECE/Brier of the cheap arm's confidence, and the confidence-trap check (mean confidence on the adversarial subset); M4 latency + cost per route per arm; M5 false-route rate at candidate τ.
- **Success criteria / RIDM promotion (recorded verdict 2026-10-22):** cheap arm M1 ≥ Opus M1 on gold **and** ≥ regex floor + a pre-registered margin; ECE ≤ a pre-registered bar; M5 at τ ≤ Opus's. Promotion = the cheap judge routes when `confidence ≥ τ`, else Opus, `routed_by` labeled (the switchboard ADR-0001 labeled-cascade shape, one app). That promotion is also the evidence to open an ADR-0033 revision. **Kill** if the cheap arm cannot beat the regex floor — then the exercise has shown a regex is enough and the Opus router should simply be replaced by rules.

### Later / explicitly not now (each needs its own entrance)
- **claude-md-gate judge provider swap** (Haiku → Judge primitive; the `complete()` seam) — after Slice 2's verdict, as the second consumer that justifies a shared package.
- **P2 grounding Noul** — after a deterministic span-match floor + fabricated-bullet eval scenario exist.
- **daily-logger cleaner** — after the dead sweep is investigated/killed and ADR-0033's per-item skip report ships; TODO Noul only.
- **Core suggester** — only when roadmap S15's data gate opens (≥10 logged lexical misses after S10–S12).
- **Cockpit watch scorer** qwen → Kev — ADR-0003 forbids cloud; local provider only.
- **switchboard `judge` route class** — after switchboard S7 accepts ADR-0001 and the Ollama adapter (S2) merges.

## Verification
- Slice 0: `core` ADR lint + `node scripts/roadmap-lint.mjs --check` pass; the decision record contains the Gate-0 table byte-identical to the script output; `grep -ril "typesafe\|jev" core/` hits only `decisions/adopt-stack/` and the ADR; CONTEXT.md diff shows Judge + Verdict + the ambiguity line.
- Slice 1: `pnpm test` (cv-builder, `packages/agent-graph`) green with the new compile + routing tests; one V2 turn on `pnpm dev:v2` shows exactly one orchestrator Opus call in pino logs; SSE `state` event carries `routingDecision`.
- Slice 2: `pnpm eval:route` prints a per-arm table (agreement, κ, ECE, latency, cost) from the committed gold set; the gold set's commit predates the first ledger row (git ancestry is the seal); `grep -r typesafe packages/` → adapter file only; a V2 turn with Kev stopped still routes (Opus) and logs `provider: unavailable` for the cheap arm — no cascade, no blank.

## Findings outside this scope (surfaced, not acted on)
- **daily-logger sweep has been a no-op since 2026-08-19** (both cleaner and article pipeline; `collectContext` `gh api … — skipped`). Flagged for a separate `/investigate` session.
- `client-v2.ts:253` checks an `event.type` the server never sends (fix in Slice 1).
- ADR-0033 and ADR-0035 are both still `Proposed` and unimplemented in `cleaner.ts`.

## Operator rulings (2026-09-24, via AskUserQuestion)
1. **Provider posture: local Kev only.** No hosted arm in the pilot. Operator also verified Jev is closed to new accounts, so the commercial model is not an option at all right now (Part E row 2 → REJECT for now). The open-vs-commercial gap on this task is therefore *not* measurable; if the local arm fails to beat the regex floor, the kill verdict is "rules are enough here".
2. **Vocabulary: reuse Judge / Verdict.** CONTEXT.md gets both terms plus the reconciliation line; the buddy-check "untrusted until agreement clears a bar" rule is the primitive's contract.
