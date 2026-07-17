# SOTA pass — agent-harness / skills / tool-calling (2026-07-17)

Research subagent sweep (WebSearch/WebFetch, primary sources) covering ~Feb–Jul 2026 output from
the channels we follow, run to ground `rm-l1-core` (the skill-loop roadmap) in current best
practice. Companion to the 2026-07-16 RCA (`~/.claude/last-investigation-*.md`, summarized in the
rm-l1-core Route paragraph). Vault follow-up: fold the strongest items into `~/selfco` via `/vault
ingest` (candidates marked ⬒).

## Channel findings

**Karpathy** — `autoresearch` (github.com/karpathy/autoresearch): agents autonomously iterate
`train.py` under a fixed 5-min compute budget, one scalar metric (val_bpb), keep/discard; a
human-authored `program.md` acts as a lightweight skill the *human* tunes against measured agent
output. ⬒ Sequoia Ascent 2026 fireside + summary (karpathy.bearblog.dev/sequoia-ascent-2026/,
2026-04-30): capability spike ≈ verifiability × training attention × data coverage × economic
value; agent-native infra checklist (CLI/API-first, markdown docs for agents, machine-readable
schemas, auditable logs). Design read: harness effort flows to where you can create reward signal.

**Pocock** — mattpocock/skills v1.1.0 (2026-07-08): explicit **user-invoked vs model-invoked**
skill split; new `wayfinder` (plan big work as investigation tickets) and `to-tickets`
(vertical-slice PRD decomposition); **`/ask-matt` router skill** — one always-loaded skill whose
job is routing to the others (progressive disclosure applied to discovery itself). ⬒

**Anthropic engineering** (richest channel this window) —
- *Demystifying evals for AI agents* (2026-01-09): 20–50 cases from real observed failures; gold
  reference solutions; calibrate LLM judges against human consensus; pass@k AND pass^k; read
  transcripts. Matches ADR-0095's never-publish-before-gold-set rule.
- *Quantifying infrastructure noise* (2026-02-05): infra config swings agentic benchmarks by 6+
  points — pin sandbox resources, report variance.
- *Harness design for long-running apps* (2026-03-24): generator/evaluator; three-agent PM/dev/QA
  collapsed back to one continuous session once Opus 4.5 landed — **harness patterns are
  model-version-relative; keep routing layers thin and disposable.** ⬒
- **Tool Search Tool** (platform.claude.com docs): deferred tools discovered on demand via
  **regex/BM25 lexical search** — Anthropic's production answer to catalog scale is lexical,
  model-in-the-loop, NOT offline embeddings; ~85% token overhead reduction.
- Skill-authoring guidance: descriptions should be **pushy** — Claude has a measured tendency to
  **under-trigger**; description = trigger, not summary; build skills from observed failures.

**Chase / LangChain** — Deep Agents adopted the SKILL.md format wholesale (2026-04-17, citing
Barry Zhang). *Dynamic Subagents* (2026-06-29): main agent writes an **orchestration script**
calling task() in a code interpreter — orchestration-as-code beats chained subagent tool-calls for
fan-out/multi-phase. Decomposition consensus: subagents for context quarantine, batch fan-out,
multi-phase pipelines; single context otherwise. ⬒

**Yegge** — *Gas Town v1.0* (2026-04-03): Beads 1.0.0 shipped; the **Mayor** conversational
interface beat dashboards for supervising 20–30 agents; Gas City = composable orchestrator
primitives. Nothing newer than Apr 3. Relevant to the cockpit: his scaling answer to agent-output
overload is a conversational filter agent, not a better dashboard.

**Willison** — Agentic Engineering Patterns launched (2026-02-23, only 2 patterns so far); OpenAI
adopted Skills in their API (2026-02-11); MCP-vs-skills verdict circulating mid-2026: skills won
procedures/knowledge, MCP retreats to the connection/auth layer.

**Broader SOTA** —
- **Skill activation measured** (Scott Spence, scottspence.com, Nov 2025 + Feb 2026): baseline
  autonomous activation ~50–55%; a **forced-eval UserPromptSubmit hook** (inject full skill list,
  require explicit per-skill YES/NO with reason, then mandatory Skill() calls) hit **84%** on 200+
  prompts and **100% (22/22) with perfect precision on non-matching prompts** in sandboxed
  `claude -p` evals parsing JSONL for real Skill() calls. An LLM pre-classifier variant (~80%)
  hallucinated false positives. ⬒ (grounds rm-l1-core#S12)
- **Tool selection at scale** (tianpan.co 2026-04-09; vLLM Semantic Router 2025-11-07): layered
  routing consensus — <15 tools description quality only; semantic selection's big wins
  (20%→94%) are at **417–741 tools**, an order of magnitude past our 62. (grounds S15's gate)
- **"The 99% Success Paradox"** (arXiv 2605.18857, 2026-05-14): hit-rate metrics can show >99%
  while selectivity is random; small catalogs make selectivity vanish — **report chance-corrected
  metrics**, include no-match cases. (grounds S8's metric design)
- **Registries/portability**: skills.sh (Vercel, ~670K skills, 51-agent CLI install);
  agentskills.io spec under Linux Foundation AAIF. Watch, don't build.

## Design deltas applied to rm-l1-core

1. CONFIRMED measurement-first sequencing (Anthropic evals doctrine ≡ ADR-0095). Gold sets stay
   20–50 cases, from real failures.
2. CONTRADICTED the `--limit=1` single-suggestion shape → S12 forced-eval commitment experiment
   (shadow-first, data-gated on S8 attributing misses to activation).
3. CONFIRMED descriptions-before-embeddings; sharpened by "pushy descriptions / measured
   under-triggering" → S10.
4. CONFIRMED embeddings last, likely never at N=62 (field converged on lexical) → S15's entrance
   gate expected not to open.
5. EXTEND: transcript-parsing activation evals (headless `claude -p`, parse JSONL for Skill()
   calls) → S8 later extension; three funnel stages (suggested / Skill()-called /
   instructions-followed) only distinguishable from transcripts.
6. EXTEND: eval hygiene — infra-noise variance + eval-awareness (sandboxed prompts should look
   real) → S8 harness notes.
7. EXTEND: precision guard — no-match cases + chance-corrected headline metric → S8/S6.
8. CONFIRMED ADR-0082 subagent posture; orchestration-as-code noted for /orchestrate; harness
   layers kept thin/disposable (model-version-relative).
9. NEW: router-skill + user/model-invoked catalog facet → S14; registry/portability = watch only.

## Nothing found (honest gaps)

Yegge after Apr 3; Karpathy on skill design specifically; Pocock on evals; Willison on tool
selection; any published production result for embeddings-based skill suggestion in a Claude
Code-style harness (every vendor shipped lexical/model-in-the-loop instead); Anthropic on
suggestion→follow funnels specifically.

## Source index

karpathy/autoresearch · karpathy.bearblog.dev/sequoia-ascent-2026 · github.com/mattpocock/skills ·
aihero.dev/skills · anthropic.com/engineering/{demystifying-evals-for-ai-agents,
infrastructure-noise, harness-design-long-running-apps, advanced-tool-use,
equipping-agents-for-the-real-world-with-agent-skills} · platform.claude.com docs (tool-search-tool)
· langchain.com/blog/{using-skills-with-deep-agents, introducing-dynamic-subagents-in-deep-agents}
· steve-yegge.medium.com (Gas Town v1.0; A Thousand Gas Towns) · simonwillison.net
(agentic-engineering-patterns; /tags/skills) · scottspence.com/posts/{how-to-make-claude-code-
skills-activate-reliably, measuring-claude-code-skill-activation-with-sandboxed-evals} ·
tianpan.co/blog/2026-04-09-tool-selection-problem · vllm-sr.ai/blog/semantic-tool-selection ·
arxiv.org/abs/2605.18857 · vercel.com/changelog (skills.sh) · agentskills.io
