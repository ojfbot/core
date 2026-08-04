# RESOURCES

Vetted 2026-08-04. Pruned to five, ordered by what they are actually good for.

## Primary

- **The transcript excerpt, supplied by the operator** — Boris Cherny in conversation with Diana at
  YC Startup School 2026, published at
  [ycrootaccess.com/p/boris-cherny-building-claude-code](https://www.ycrootaccess.com/p/boris-cherny-building-claude-code).
  Covers: dynamic workflows (Bun sandbox + VM, staged fan-out/verify/fan-out again), the algebra
  framing and its functional-programming lineage, loops vs routines (local cron vs cloud), the
  self-maintenance routine fleet, and the test-time-compute argument. **Reach for it first** — it is
  the only source here that is the man's own words. Trust: primary, operator-supplied.
  **Recommended primary source for going deeper.**

- **The live `Workflow` tool contract, in-session** — the tool description exposed to this very
  session. Covers the operator set (`agent`, `parallel`, `pipeline`, `phase`, `workflow`, `log`),
  the barrier semantics, concurrency and lifetime caps, the resume/journal mechanism, and the
  determinism rules. **Reach for it whenever the transcript is ambiguous about behaviour** — it is
  executable truth rather than description, and it settles several things the talk leaves open.
  Trust: authoritative for this session's runtime. *Caveat: a tool contract is version-specific and
  will drift; the transcript's concepts should outlive it.*

## Secondary — corroborating, weaker

- **[InfoQ, Claude Code creator workflow](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)**
  — Boris's personal working practice: parallel sessions, plan mode, slash commands, feedback loops.
  Reach for it for practice, not architecture. Trust: edited tech press, second-hand.

- **[How the Claude Code Team Works](https://engineeredintelligence.substack.com/p/how-the-claude-code-team-works)**
  — the build-for-the-next-model stance, `CLAUDE.md` sizing (~2.5k tokens team file), the
  unship-tools cadence. Reach for it for the surrounding philosophy. Trust: independent write-up,
  unverified against primary.

- **The 80%-prompt-cut reporting** ([BigGo](https://finance.biggo.com/news/7df48019614f68c0), plus
  circulating X threads) — **caution resolved 2026-08-04.** Rated lowest-tier here, with
  `CLAUDE_CODE_SIMPLE=1` flagged as effectively single-sourced and not to be repeated unverified.
  The primary transcript confirms both it and a `--system-prompt` override. Superseded by primary;
  kept so the resolution is recorded rather than the caution just vanishing.
  See [[teach/prompt-ablation/|prompt-ablation]].

## Gaps

- **~~The full talk was not obtained.~~ SUPERSEDED 2026-08-04** — the page is reachable and
  unpaywalled after all; the earlier 403s were transcript-scraper services, not the source. All
  thirteen topics are now mapped in [[teach/prompt-ablation/|prompt-ablation]]. This document remains
  the §10–11 deep dive. Left visible rather than deleted: a gap that silently closes teaches the next
  session nothing.
- **Boris's own claim that this "hasn't really been written about a lot"** is, as far as this
  sourcing went, correct — no independent technical treatment of agent-orchestration algebra was
  found. That is a genuine gap in the literature, not a gap in the search, and it is the reason the
  live tool contract had to serve as the second primary source.
- **No fleet-internal source exists.** Grepped 2026-08-04: zero references to dynamic workflows
  across every skill, ADR, and decision record in core. For once D19's "fleet artifacts are
  first-class primary sources" has nothing to offer — this is genuinely new ground here.
- **The functional-programming lineage is inferred, not sourced.** Boris says his background is FP
  and calls the design an algebra; he does not name the specific tradition. The lesson's reading of
  purity-for-replay is grounded in the *observable runtime behaviour*, not in a claim he made.
- **Unverified: agent counts.** "Thousands," "20 or 30 routines," "hundreds of agents daily" are
  Boris's estimates, hedged in the transcript itself ("I'm not sure. I can ask Claude").
