# DeepStack architecture evaluation — what transfers to the fleet, what doesn't

**Date:** 2026-06-13
**Subject:** Dipen's internal frontend tool **DeepStack** (`~/Research/deepstack`), reviewed against the ojfbot fleet's skill-routing architecture.
**Trigger:** A cowork handoff doc recommended rewriting skill descriptions to DeepStack's template as the "fastest win on broken routing… a clean cheap hypothesis to test inside the OPAV loop."
**Verdict:** Source observations accurate; central recommendation mis-targeted for *our* architecture; the one pattern that genuinely transfers was under-sold. Details below.

---

## (a) Source verification

The handoff's reading of the DeepStack source is faithful. One correction:

| Handoff claim | Actual | Status |
|---|---|---|
| 15 skills, globally symlinked into `~/.claude/skills/` | 15, via `setup.sh` `link_dir … ${CLAUDE_HOME}/skills` | ✅ |
| Every skill description follows "Use this skill when… Auto-loads on…" | Confirmed across sampled skills; 3 trigger types coexist (not mutually exclusive) | ✅ with nuance |
| `post-edit` cheap + non-blocking, full gate deferred | `post-edit` runs TypeCheck+Lint, `exit 0`; `pre-commit` runs 6-phase gate, `exit 1` | ✅ |
| 7 commands | 7 | ✅ |
| **3 templates → 29 items total** | **4 templates** (`architect.md`, `agent.md`, `project-CLAUDE.md`, `project-settings.json`) → **30 items** | ❌ off by one |

The off-by-one doesn't change any conclusion; noted for accuracy.

---

## (b) The load-bearing finding: DeepStack has one router, we have two

DeepStack's "description = router" claim is literally true *there* because there is no mechanical suggester — Claude reads all 15 descriptions and self-routes, which is coherent because all 15 fit a single archetype (frontend). Our architecture is split:

- **Layer A — mechanical suggester.** `core/scripts/hooks/suggest-skills.mjs:104-184` scores each catalog entry against `triggers[]`, `tags[]`, `phase`, and `suggested_after`. It **never reads the prose `description`**. The final output at `:198` emits only `{name, reason, command}` — `description` is dropped entirely. So **rewriting SKILL.md prose to DeepStack's template changes Layer A by exactly zero.**
- **Layer B — agent self-routing.** Once a skill is surfaced (or its SKILL.md is in context), Claude reads the `description` and decides whether to invoke. Prose *does* matter here — but the real Layer-B failure was already diagnosed and fixed: ADR-0068 found the agent treated "MANDATORY: Load this skill IMMEDIATELY…" as advisory, and the remedy (a behavioral rule in `~/.claude/CLAUDE.md`) is behavioral, not lexical. Better prose is marginal on top of an already-shipped fix.

**Conclusion:** "rewrite descriptions first" aims at a router that doesn't read descriptions (Layer A) and at a problem already addressed (Layer B). It is not the fastest win; it is close to a no-op on the mechanical path.

---

## (c) It is not a "clean cheap hypothesis to test" — it is S0-gated

The handoff frames the rewrite as cheaply testable inside the OPAV loop. Our own `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md` says the measurement instrument is broken until **S0** lands:

- **0 of 1,279** telemetry events carry a `SUGGESTION_ID` — joins are fuzzy temporal windows.
- The **0.8% baseline is false provenance** — the lone historical "follow" is a `/init` acceptance (beaverGame, 2026-04-27), not a skill action.
- All **575 `suggestion-ignored` events are inflated** by ADR-0092's uninstrumented inline follows.

"Did description precision raise the right-skill-fires rate?" has **no trustworthy denominator** until S0 (mint `SUGGESTION_ID` + repair the denominator) and S1 (action instrumentation) ship. Running the experiment now would read movement against a poisoned baseline — the precise trap S0 exists to remove.

---

## (d) On distribution we are *ahead* of DeepStack, not behind

DeepStack's `setup.sh` symlinks all 15 skills globally and solves relevance purely at the activation layer (description quality). That works only because **15 skills / 1 archetype** are mutually coherent. We carry **52 skills / 9 archetypes** (`frame-app`, `python-service`, `extension`, `game`, `prose`, …); the 2026-06-13 fleet audit found most repos carry 18–26 irrelevant skills. `draft-repo-scoped-skill-relevance.md` already names distribution rot "the structural cause of routing-rot" and is migrating *away* from the global-symlink model. The handoff holds DeepStack's distribution model up as a target; for our scale it is the thing we are correctly leaving behind. Adopting it would be a regression.

---

## (e) What genuinely transfers

### Three-trigger taxonomy (the real find)
DeepStack descriptions encode three activation modalities: **path globs** (`on .env changes`, `on any component diff`), **lifecycle events** (`when a feature is complete`, `on PR review`), and **keywords** (`when the user mentions…`). Our suggester is **keyword-only**: `suggest-skill.sh` is a `UserPromptSubmit` hook that matches query words against `triggers[]`. We have **no path-glob triggers and no lifecycle triggers** — yet we already own the hook surface to support them (`PostToolUse` on `Edit|Write` powers `claude-md-gate` today; a session-start hook is the lifecycle analogue, mirroring DeepStack's `on-session-start`). **No current OPAV slice covers this.** It is a distinct capability from repo-relevance (S2) and the genuine architectural gap the handoff surfaced — see the addendum filed in `draft-repo-scoped-skill-relevance.md`.

**Implementability trace (editing `.env`):** `PostToolUse` fires → today nothing matches (no path field; suggester is prompt-only) → with a `trigger_paths[]` catalog field + a `--path` branch in `suggest-skills.mjs`, a hook matches the edited path against the full catalog and emits a suggestion (e.g. `/hardening` on `.env`/`package.json` edits). All three pieces — the hook surface, the catalog loader, the install wiring (`install-agents.sh`) — already exist.

### Graduated-enforcement topology (verification axis — defer)
DeepStack's `post-edit` (cheap, non-blocking, `exit 0`) → `pre-commit` (full 6-phase gate, blocking, `exit 1`) is a clean inline-cheap → commit-full topology. We have only `claude-md-gate` (shadow) plus a `prettier --write` `PostToolUse`; no local verification gate.

**Recommendation: defer.** CI (`.github/workflows/claude-skill-audit.yml`) + `claude-md-gate` already hold the verification spine, and our shadow→operational RIDM discipline (ADR-0086) is *more* mature than DeepStack's binary hard-block — DeepStack blocks at `exit 1` with no shadow stage and no data-gated promotion. If a felt pain emerges (e.g. broken commits landing locally), route a graduated gate through `/gated-slice` (shadow → operational with a RIDM promotion point), **not** a DeepStack-style unconditional block. This is an optional control, not a gap to close now.

---

## (f) Reply to cowork's closing offer

Cowork offered to "fold this rewrite-descriptions-first hypothesis into `HANDOFF-routing-and-rules.md` as an explicit early slice." Two reasons not to, as framed:

1. **The file isn't in the repo** — `find` over `~/ojfbot` returns no `HANDOFF-routing-and-rules.md`. The real planning home for routing is `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md` and its draft ADRs.
2. **The hypothesis as stated shouldn't be an early slice at all** (sections b–c). What *should* fold in is the **trigger-taxonomy** capability — and it belongs as an S0-gated candidate slice (provisional **S2.5 / draft ADR `multi-modal-skill-triggers`**), recorded in `draft-repo-scoped-skill-relevance.md`, entrance-gated on `SUGGESTION_ID` like everything else in the ladder.

The corrections from this review have been folded into the OPAV plan ("Inputs considered and rejected") and the repo-scoped-relevance ADR ("Future trigger-modality" addendum).
