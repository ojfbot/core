# RESOURCES

Vetted 2026-08-04. **The sourcing situation changed mid-topic** — the full transcript turned out to
be reachable after an earlier session recorded it as unobtainable. Everything below reflects the
better position.

## Primary

- **[Boris Cherny, *Building Claude Code*, YC Startup School 2026](https://www.ycrootaccess.com/p/boris-cherny-building-claude-code)**
  — full transcript, not paywalled. Thirteen topics; §3 (the 80% cut) and §4 (ablation) are this
  lesson's source. **Reach for §3 specifically** for the qualifier every secondary write-up drops:
  some prompts are kept for product usability and desired behavior. Trust: primary.
  **Recommended primary source for going deeper.**

- **The measured fleet baseline, taken 2026-08-04 before authoring** — `core/CLAUDE.md` ≈ 5,034 tok,
  `~/.claude/CLAUDE.md` ≈ 1,370 tok, 19 user-scope skill descriptions ≈ 949 tok, total ≈ 7,350.
  Reach for it whenever the argument threatens to become abstract. Trust: measured directly; method
  is a words÷0.75 estimate, so treat as an order of magnitude, not a token count.

## Secondary — and now demoted

- **[How the Claude Code Team Works](https://engineeredintelligence.substack.com/p/how-the-claude-code-team-works)**
  — `CLAUDE.md` sizing (~2.5k team file), build-for-the-next-model, unship cadence. **Important
  boundary:** the full-talk read found **no `CLAUDE.md` discussion in this talk at all**, so these
  claims come from elsewhere and must not be attributed to it. Reach for it for the surrounding
  philosophy only. Trust: independent write-up, unverified against a primary.

- **[InfoQ, Claude Code creator workflow](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)**
  — personal practice: parallel sessions, plan mode, slash commands. Practice, not architecture.
  Trust: edited tech press, second-hand.

- **The 80%-cut aggregation** (BigGo, circulating X threads) — **superseded.** An earlier session
  rated `CLAUDE_CODE_SIMPLE=1` as effectively single-sourced and flagged it for verification before
  repeating. The primary source confirms both it and a `--system-prompt` override. Kept in the list
  only to record that the caution was resolved rather than forgotten. Trust: superseded by primary.

## Gaps

- **No eval instrument exists to run step 3 of the ablation loop.** This is the honest blocker and
  the lesson says so. `~/selfco/tracking/merge-observations.jsonl` has 0 `harness:quiz-taken` rows,
  so the fleet's nearest ruler is empty. Every ablation verdict taken now is a sample of one.
- **The 80% figure is not decomposed.** He does not say what *kind* of lines made up the 80%, so the
  deficiency-patch-vs-house-rule split is a reading of the qualifier, not a taxonomy he stated. The
  distinction is defensible and it is mine.
- **Anthropic's ratio does not transfer.** Their prompt ships to millions across unknown tasks; this
  fleet's instructions serve one operator with strong stated preferences. The house-rule fraction is
  almost certainly far higher here, which means the 80% headline number should never be treated as a
  target.
- **Untested.** No ablation has been run on this fleet. The method is described from his account, not
  from local experience.
- **Token estimates, not counts.** Words÷0.75. Fine for "roughly triple the reference file," useless
  for anything needing precision.
