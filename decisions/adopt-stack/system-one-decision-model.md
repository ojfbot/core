# /adopt-stack decision: System One decision models (TypeSafe Jev · `@typesafe-ai/sdk` · Kev)

Decided 2026-09-24. Candidate pinned at npm `@typesafe-ai/sdk@0.6.0` (published 2026-09-15; MIT
per registry), wire shape `POST /v1/systemone`. Sibling record from the previous cycle:
`sandcastle.md` (D54–D59); numbering continues at **D60**. Framework: `adr:wrap-absorb-reject`.
**Decision-only pass** — no code lands from this record; the ABSORBs route to `adr:judge-primitive`
(draft) and roadmap slice `rm:rm-l2-ojfbot#S40`.

Input was an external Dia research report ("System One Inside Your LangGraph Harness", 2026-09-24)
proposing three insertion points in cv-builder's V2 LangGraph: conditional-edge routing, a RAG
relevance gate, and a quality-loop judge. The report could not see the fleet; this record checks
each claim against the code and the standing rulings. Full scorecard and fleet inventory:
`~/.claude/plans/users-yuri-desktop-system-one-in-your-radiant-feather.md` (Parts A–F).

**What a System One model is.** A model that takes a state (text/JSON) plus typed questions —
`choice` (label + per-option probabilities + confidence), `score` (ordered rubric + confidence),
`noul` (yes/no probability) — and answers all of them in one forward pass without generating text.
TypeSafe AI's **Jev** (shipped 2026-09-15) is the commercial original; **SemIf** (LangSmith Gateway,
free until 2026-09-28, US-org-plan-gated) and **Kev** (`jaredpalmer/kev`, Apache-2.0, Qwen3.5
0.8B/4B/9B/27B, Apple-Silicon MLX, same endpoint shape) are open clones.

## Gate 0: LIBRARY (0/6 application signals)

`measure-pkg.mjs @typesafe-ai/sdk` (registry, 2026-09-24), table verbatim:

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

Compiled `dist/index.mjs` (unpkg, read 2026-09-24): `TypeSafeClient({apiKey, baseURL, defaultModel
= "jev-latest", timeout = 10000, retry, fetch, logger, defaultHeaders})`; env `TYPESAFE_API_KEY`,
`TYPESAFE_BASE_URL`, `TYPESAFE_DEFAULT_MODEL`; headers beyond auth are `User-Agent`,
`X-TypeSafe-SDK`, `X-TypeSafe-Runtime`, `X-TypeSafe-Retry-Count`; no analytics. WRAP-by-import is
legitimate. The API is 0.x and nine days old — pin exactly.

## Facts that constrain the calls (verified 2026-09-24)

- **Jev is closed to new accounts** (operator-verified). Hosted Jev is not an option today.
- **Benchmark spread is domain-dependent, 26 pp → 0.6 pp.** jabr (49 tasks/869 cases): Jev 0.966
  vs best open 0.704. open-system-one (10,000 decisions, 4 public datasets, CPU-only): Jev 79.3% vs
  a 149M cross-encoder 78.7%. SemIf bench (144 decisions): Jev 0.965 vs Kev-9B 0.917. Kev's own
  eval: Jev 0.857 vs Kev-27B 0.848. LangChain's 500-decision test is 5 weather-agent runs × 100
  repeats, one labeler; LangChain: "repeatability is not proof of correctness". Only a measurement
  on the fleet's own decisions counts.
- **Calibration is a claim until measured.** open-system-one documents a confidence trap (mean
  confidence 0.968 at 22.5% accuracy on out-of-distribution input) in an open decision head.
- **Prompt injection moves the verdict** (vendor-acknowledged; VentureBeat 2026-09): a tool-safety
  gate went from block p=0.76/conf 0.64 to p=0.48/conf 0.22 after a planted "pre-approved" field.
  LangChain's mitigation strips tool outputs from classifier input.
- **The fleet's own precedents:** ADR-0033 rejected float confidence thresholds (categorical +
  human gate); cockpit ADR-0003 forbids silent cloud cascade; switchboard ADR-0001 allows cascade
  only per opted-in, labeled route class; f1-pit-wall measured "LLM rescues of rule-rejected
  queries: 4 misroutes, 0 wins"; the skill-loop SOTA research found an LLM pre-classifier
  "hallucinated false positives" and the router skill was REJECTed (D15); ADR-0086 requires shadow
  before enforce.
- **Where the report's map was wrong.** cv-builder V2 has one conditional edge fed by a full Opus
  call parsed by regex, plus a hidden second Opus call after every specialist; no quality loop; the
  RAG node is not in the graph (a relevance gate would gate dead code); TripPlanner's 11 phases are
  a straight sequence; gastown-pilot's prime node is a deterministic state check; the harness does
  not route slash commands with a model (lexical `scoreCatalog`) and `/techdebt` has no gate; the
  fleet's designated gateway is switchboard, not shell's frame-agent.

## Decision table

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D60 | "Decisions are typed questions (Choice/Score/Noul) over a state, answered with probabilities" | **ABSORB** | SDK types (`choice`/`score`/`noul` helpers, `answers.<id>.{choice,confidence,probabilities}`) → the fleet already runs five ad-hoc versions of this shape (`claude-md-gate/judge.mjs` `{isConditional, suggestedLayer, confidence}`, daily-logger `cleaner.ts` `{resolved, confidence}`, cockpit `watch/score.ts`, f1-pit-wall `route.ts` slot-fill, shell `meta-orchestrator.ts` `classify()`); ubiquitous language demands one primitive. Re-expressed as the **Judge** primitive (`adr:judge-primitive`); vendor stays behind one adapter. `wildcard/caro#1460` reached the same absorb independently. |
| D61 | Hosted API at `api.typesafe.ai`, key in env | **REJECT for now (not obtainable)** | Operator-verified: no new accounts. If reopened, admissible only as an opted-in, labeled route class (switchboard ADR-0001) — never the default for hooks or cockpit (ADR-0003). |
| D62 | Confidence float + threshold routing | **ABSORB, gated on measured calibration** | ADR-0033 rejected float thresholds because LLM probabilities aren't calibrated; RLCD is the counter-claim. The shadow pilot (`rm:rm-l2-ojfbot#S40`) must report ECE/Brier on a sealed gold set; only that evidence opens an ADR-0033 revision. |
| D63 | "Fall back to an LLM below the threshold" | **ABSORB as labeled escalation; REJECT as silent cascade** | cockpit ADR-0003 (degrade to deterministic, never silently to cloud); switchboard ADR-0001 (cascade opt-in per route class, always labeled); f1-pit-wall measurement → never escalate what deterministic rules rejected on purpose. Every verdict carries `provider` + `routed_by`. |
| D64 | LangChain integration packages (`@langchain/typesafe` 0.0.1, `langchain-typesafe` experimental middleware) | **REJECT for now** | 0.0.1 / experimental; the routing function in cv-builder is a plain TS function and the SDK has 0 deps. Revisit if `ModelRouterMiddleware` matures. |
| D65 | LangSmith Gateway (SemIf) as the provider registration point | **REJECT** | Fleet gateway is switchboard; SemIf window closes 2026-09-28 and is plan-gated. Not used even as a shadow arm (operator ruling 2026-09-24: local only). |
| D66 | Log probabilities into graph state and the stream | **ABSORB** | cv-builder `ARCHITECTURE_V2.md:260` already designed `RoutingDecision{confidence}`; SSE `state` event (`routes/v2/chat.ts:124`) extended by `rm:rm-l1-cv-builder#S1`. |
| D67 | Vendor-named types in domain code | **REJECT** | Name-by-purpose rule; confinement check `grep -r typesafe packages/` → adapter file only. Also avoid "classifier"/"router" (rejected-skill baggage). |
| D68 | Self-hosted Kev (MLX) as a local provider | **WRAP at a process boundary** | Kev is a Python server (`kev.serve`, Apache-2.0; 4B/9B fit a 32 GB Mac; ~720 ms for 5 questions, 136 ms cached); run out-of-process like Ollama, spoken to through the same `/v1/systemone` shape via `baseURL`. Conforms to local-first. The Pi is out (4B model). |
| D69 | The vendor's headline use case: route the request / suggest the skill | **REJECT for the harness now** | D15 router rejected; roadmap S15 semantic suggester gated LAST on ≥10 logged lexical misses after S10–S12; ADR-0068 shows follow-through (0.8% followed), not matching, is the gap. Revisit only when S15's data gate opens. |

## Integration shape

Absorb "typed question + calibrated confidence + logged verdict" as the fleet **Judge** primitive
behind one provider interface (`adr:judge-primitive`); wrap self-hosted Kev as the first cheap judge
provider via the `@typesafe-ai/sdk` wire shape, pinned; run every adoption in shadow, three-armed
(deterministic floor · cheap judge · incumbent) on a sealed gold set, before it moves any control
flow. First pilot: cv-builder orchestrator route (`rm:rm-l2-ojfbot#S40`), entrance
`rm:rm-l1-cv-builder#S1`. Explicitly not now: daily-logger cleaner (sweep dead since 2026-08-19; no
per-candidate labels), core suggester (D69), cockpit scorer (local provider only, after the
primitive exists), switchboard `judge` route class (after its S7/ADR-0001 acceptance).

## Loop contract (ADR-0100 item 6)

Named now, live at S40: **ledger** `cv-builder/evals/route-shadow.jsonl` · **check**
`pnpm eval:route` (agreement, κ, ECE/Brier per arm vs sealed gold; `--check --baseline=`) ·
**schedule** cv-builder CI on every agent-graph PR + manual replay on provider/model change ·
**verdict** keep/kill/revise on 2026-10-22, recorded in `decisions/research/`. The
`decisions/loops/loops.md` entry lands with S40 (the registry admits only `live|disabled`).
