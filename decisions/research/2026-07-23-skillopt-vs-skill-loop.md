# Deep study — Microsoft SkillOpt vs the honest skill loop (2026-07-23)

Primary-source study of **microsoft/skillopt** (MIT; arXiv:2605.23904; PyPI `skillopt` 0.2.0)
against `rm-l1-core`, run to decide how to leverage the pattern without framework lock-in.
Method: scratchpad clone read directly (README, `docs/`, `skillopt/evaluation/gate.py`,
`skillopt/optimizer/clip.py`, `docs/sleep/README.md`, `plugins/claude-code/`), PyPI registry
metadata, plus a /deep-research cited sweep (filed in the vault:
`~/selfco/wiki/sources/microsoft-skillopt.md`). Integration verdicts:
`decisions/adopt-stack/skillopt.md`. Vault synthesis twin:
`~/selfco/wiki/synthesis/skillopt-vs-ojfbot-skill-loop.md`.

## What SkillOpt is (from the repo, not the coverage)

Treats the skill document as the **trainable state of a frozen agent**. One loop step:
rollout (target model executes tasks with the current skill) → reflect (a separate optimizer
model turns scored trajectories into edit patches) → aggregate (merge patches) → select/clip
(LLM ranks edits, keep top-L_t where L_t = the edit budget / "textual learning rate", default 4
with cosine decay to floor 2 — `optimizer/clip.py:rank_and_select`) → update (apply to the doc)
→ **gate** (accept only on *strict* held-out improvement, ties rejected —
`evaluation/gate.py:evaluate_gate`, a pure decision function over hard/soft/mixed metrics).
Rejected edits go to an epoch-local buffer (with the score drop they caused) fed to later
reflection as negative feedback; epoch boundaries run a slow update + meta-skill memory into a
protected field. Deployed artifact: `best_skill.md` (300–2,000 tokens), zero extra
inference-time calls at deployment.

**Evidence status (deep-research verified, 25/25 claims 3-0, 2026-07-23).** Best-or-tied on all
52 (model × benchmark × harness) cells; on GPT-5.5, +23.5 direct chat / +24.8 Codex / +19.1
Claude Code. Caveats that matter: the grid is **asymmetric** (52 ≠ 7×6×3=126 — Codex/Claude
Code cells cover GPT-5.5 only, over 5 benchmarks vs 6); the +19.1 figure exists **only in the
paper** (the docs site's per-benchmark Claude Code deltas average ~18.6 and never print it);
**every number is the authors' own — no independent reproduction exists as of 2026-07-23**, and
the contemporaneous HKUST SkillRevise survey (arXiv:2606.01139) doesn't even cite it. Their own
honesty note: flat-within-noise on saturated benchmarks, single-seed variance ±1–2 pts. The
strongest independent (if indirect) critique is **SkillEvolBench** (arXiv:2605.24117, Ohio
State/Amazon): raw-trajectory reuse frequently beats distilled skills (a "lossy abstraction
bottleneck") and skill gains do not reliably transfer to frozen deployment tasks — in tension
with SkillOpt's stable-transfer claims, though it never benchmarks SkillOpt itself.

**`skillopt_sleep`** (v0.2.0 headline, zero dependency on the paper code; gate vendored) is the
deployment-time twin: nightly *harvest `~/.claude` transcripts → mine recurring tasks → replay
offline → consolidate (reflect → bounded edit → gate on real held-out tasks) → stage proposal →
**human adopts** (`/skillopt-sleep adopt`, with backup)*. Ships a Claude Code plugin
(`plugins/claude-code/`), a no-API `mock` backend, and a `handoff` backend where the session
itself answers the model calls. Their data-boundary note is candid: real backends send truncated
transcript excerpts to the provider and "outbound prompts are not currently guaranteed to be
secret-free." Two verified caveats: Sleep is **repo-only** (the arXiv paper never mentions it —
it is engineering on top of the paper, not peer-visible work), and human-gating is the *default
configuration, not an invariant* — `gate_mode=off` (greedy) and an `--auto-adopt` scheduler
setting exist. Any wrapped use must pin the gated, staged configuration explicitly. Their
real-agent Sleep validation is tiny and self-reported (gbrain-evals, 4 deficient seeds,
0.00→1.00 on ~3-item holdouts).

## Loop-stage mapping (their vocabulary ↔ ours)

| SkillOpt stage | rm-l1-core equivalent | Notes |
|---|---|---|
| Rollout (benchmark tasks, scored) | Live sessions + weekly `trace-triager` sampling | Ours is production traffic, not a benchmark split; scoring is disposition classification, not task accuracy. |
| Reflect (optimizer model → edit patches) | Nothing automated — PH3 slices are operator/agent-authored edits to `skill-catalog.json` / `SKILL.md` | **Their strongest piece; our open gap.** |
| Aggregate + select/clip (edit budget) | No equivalent (edits land whole) | The bounded add/delete/replace + budget contract is the most absorbable idea. |
| Update (apply patch) | `skill:authoring` events on the shadow evolution stream (ADR-0098) | We *observe* edits; they *generate* them. Two-track invariant: use funnel ∥ evolution stream, never blend. |
| Gate (strict held-out improvement) | Frozen suggester holdout (κ, `suggester-gold-v1.jsonl`) + capture-quality GREEN gate + RIDM promotion | Same discipline, different scope: we gate *suggester/program* changes; skill-**body** edits are not yet eval-gated. |
| Rejected-edit buffer | No equivalent | Absorb as a rejected-proposal ledger (jsonl) so refuted edits inform later sittings. |
| Epoch slow-update / meta-skill | Loosely: ADR-governed doctrine + `decisions/loops/loops.md` registry | Theirs is in-loop memory; ours is out-of-loop governance. |
| `best_skill.md` artifact | `SKILL.md` (ADR-0084 canonical) | Keep ours; absorb the protected machine-managed-block idea (`LEARNED`-style markers). |
| skillopt_sleep night | (unbuilt) — closest kin is trace-triager's weekly proposal-only PR loop | Sleep's stage-then-human-adopt contract is philosophically identical to shadow-first → RIDM. |

## Prior art & novelty (verified)

The constituent ideas predate SkillOpt: GEPA (arXiv:2507.19457, July 2025) already ran
rollout → LLM reflection → mutate → improvement-gated acceptance and explicitly called textual
diagnostic feedback "the text-optimization analogue of a gradient"; TextGrad (2024) coined the
gradient framing. SkillOpt cites and benchmarks against both. The defensible novelty is the
**combination applied to a persistent, exportable artifact**: bounded edit budget with decay,
strict held-out gating, rejected-edit memory, epoch-wise meta updates — train/validate/export/
reuse of a skill file rather than ephemeral prompt tuning. That artifact-centric packaging is
precisely why it rhymes with our SKILL.md world; the optimizer machinery itself is evolutionary,
not revolutionary.

## Divergence analysis

1. **Objective.** SkillOpt optimizes skill-body *task performance* against benchmark splits;
   rm-l1-core optimizes *trigger precision + usage honesty* against operator-labeled golds. They
   trained the skill; we trained the ruler. Complementary, not competing — and their loop
   presumes what our loop exists to provide: a trustworthy score. Plugged together naively,
   their gate would inherit whatever dishonesty the score carries (self-scored validation,
   no operator labeling, no two-source contract).
2. **Automation posture.** Their research loop is fully automated inside a run;
   promotion-to-deployment is out of scope. Sleep re-introduces exactly our posture — staged
   proposals, human adoption, backups — which is independent corroboration of the shadow-first
   → RIDM design from a group that started at full automation and backed off for deployment.
3. **Eval integrity.** Their gate compares against a *selection split* the loop touches every
   step; overfitting to it is acknowledged via the honest-scope note. Our holdout is FROZEN and
   out-of-bounds for tuning, chance-corrected, with an explicit no-match class. On this axis we
   are ahead; nothing to import.
4. **What they have that we lack.** A generative optimizer (reflect→patch), an edit-budget
   contract, a rejected-edit memory, and (in Sleep) transcript-mining → replay machinery that
   turns real usage into a held-out task set. The last is the piece that would let P4 close the
   join: *skill edit → did outcomes move?*

## Integration candidates — PROPOSALS ONLY (not registered in roadmap.md)

Sketched in gated-slice shape for a future operator sitting; none entered on the roadmap spine.

- **P-A · Edit-op vocabulary for the evolution stream.** Absorb bounded
  add/delete/replace classification into `skill:authoring` events (today: `created | extended |
  refactored`). Entrance: evolution stream capture-quality pass done (S16 GREEN — met). Success:
  ≥80% of a 20-event labeled sample classified correctly; observe-only, no gate consumes it.
- **P-B · Rejected-proposal ledger.** A jsonl ledger of skill-edit proposals that failed review
  or eval, readable at authoring time. Entrance: P-A vocabulary exists. Success: ledger written
  by ≥2 loops (trace-triager + one sitting) and cited in ≥1 subsequent authoring decision.
- **P-C · Validation gate for skill-body edits.** Extend the frozen-eval discipline: a
  SKILL.md body change to a high-traffic skill must show non-regression on a per-skill task
  set before merge (shadow first: report-only comparison in PR). Entrance: per-skill task sets
  exist for 2 pilot skills (can be mined à la Sleep). Success: gate report attached to 3
  consecutive skill-body PRs with zero false blocks; RIDM note before it may ever gate.
- **P-D · Wrapped skillopt-sleep shadow trial.** Run `skillopt-sleep` out-of-process
  (scratchpad venv, `mock`/`handoff` backend only — D6/D7 in the adopt-stack record) against 1–2
  non-sensitive projects for ~2 weeks; proposals reviewed at a sitting, adopted by hand if ever.
  Entrance: operator selects the projects + reviews the data boundary. Success: ≥1 staged
  proposal judged non-trivial by the operator, or a documented verdict that the mining quality
  is below our bar — either result is a valid RIDM datum.
- **P-E · Watch item.** Track releases (PyPI + repo News) via the normal SOTA sweep cadence; the
  ecosystem around it (gbrain, gbrain-evals, darwin-skill) doubles as an external benchmark pool
  for P-C task sets.

## Anti-lock-in statement

We deliberately do **not** take: their trainer as a runtime dependency (no SkillOpt package in
any ojfbot tree, any language); their envs/benchmarks as our ruler (ADR-0095 golds stay
canonical); their DL vocabulary (our UL: disposition/ruler/gate/RIDM — the mapping table above
is the interface); their scheduler, WebUI, and default real-backend data flow (adopt-stack
D7/D10/D11). The relationship is the TypeScript-shaped one the user named: a powerful, actively
maintained tool we reach for where it fits — contracts absorbed into our primitives, capability
wrapped at a process boundary, never a platform we build on.
