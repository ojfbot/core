# ADR-0083: Adopt Pocock-style skill conventions; add /prototype, /caveman, /zoom-out, and the writing pipeline
slug: pocock-skill-conventions-and-new-skills
serial: 0083
domain: workflow-engine
type: convention

Date: 2026-05-12
Status: Accepted
OKR: 2026-Q2 / O-skills / KR-coverage
Commands affected: /skill-create, /prototype, /caveman, /zoom-out, /writing-fragments, /writing-beats, /writing-shape, /recon, /handoff, /validate, /pr-review, /spec-review, /bead
Repos affected: core (source); synced to siblings via `install-agents.sh`

---

## Context

Matt Pocock's `mattpocock/skills` repo (and his "New Skills: /handoff, /prototype, /review, /writing-*" changelog, YouTube `DNqsMXH6Eog`) has become the de-facto reference for personal `.claude/` skill directories. Reviewing it against our `core` catalog surfaced:

- **Genuine capability gaps.** We had no `/prototype` (throwaway code that answers one question), no compression mode, no lightweight in-loop "where does this fit" command, and no article-writing pipeline.
- **Convention drift.** Pocock standardizes on a tight `description` spec (capability sentence + trigger sentence, third person, ≤1024 chars, no time-sensitive content), a ~100-line ceiling on the main `SKILL.md` with progressive disclosure into reference files, and one-level-deep cross-references. Our `skill-create` knowledge files had most of this implicitly but not as an enforced checklist.

The user explicitly wants the writing-* family to live in `core` and be synced outward (Pocock keeps his under `personal/` and `in-progress/`).

## Decision

1. **Add four/six new skills to `core`:**
   - `/prototype` — disposable code answering one question; two modes (interactive terminal harness for logic/state-machine edge cases; N radically different UI variants switchable by URL param). Records the verdict (commit / ADR / architecture doc), then deletes.
   - `/caveman` — ultra-compressed communication mode; drops articles/hedging/preamble/recap, keeps full technical accuracy and verbatim paths/commands/code; stays active until "normal mode".
   - `/zoom-out` — in-loop orientation for code you're already in (walk *up* the call graph and module boundaries; who calls this, what it depends on, blast radius if changed). The lightweight, no-report counterpart to `/recon`.
   - `/writing-fragments` → `/writing-beats` → `/writing-shape` — a three-step article pipeline (extract raw material → structure as a reader-journey beat sheet → shape into finished prose with a per-paragraph form decision).
2. **Codify Pocock's conventions in `skill-create/knowledge/naming-guide.md`:** a "Description field spec" section and a pre-commit "Review checklist" (triggers in description, third person, ≤1024 chars, no time-sensitive info, neighbour disambiguation, tier line budget, one-level cross-refs, glossary consistency, concrete examples, scripts for deterministic ops, registry + catalog + CLAUDE.md wiring).
3. **Register everything** in `packages/workflows/src/registry.ts`, `skill-loader/knowledge/skill-catalog.json` (bumped to v1.6), and the `CLAUDE.md` command tables + lifecycle order.
4. **Reframe the review family around Pocock's two axes** — **Spec** (does the change do what was asked?) and **Standards** (auth, secrets, types, logging, tests, framework invariants, lint). `/validate` is the full bidirectional gate; `/pr-review` is the same audit against a PR diff; `/spec-review` is the Spec axis run forward against a plan. Each now states this relationship in its body so the boundaries are explicit rather than overlapping by accident.
5. **Add a `--compact` mode to `/bead`** — a one-shot temp-file conversation handoff (`mktemp -t handoff-XXXXXX.md`, reference artifacts by path, name the next skills) that skips the `.handoff/` ledger. The lightweight counterpart to the full orient → work → handoff bead protocol.
6. **Define and wire a skill `status` lifecycle** — `active` (default, synced + auto-suggested), `in-progress` (drafted, not synced, not suggested), `deprecated` (kept for reference, description names the replacement). Documented in `skill-create/knowledge/naming-guide.md`; absence of the field ≡ `active`. `install-agents.sh` skips non-`active` skills when symlinking; `suggest-skills.mjs` skips them when matching prompts.
7. **Add `/git-guardrails`** — names the dangerous-git policy (history rewrite on shared refs, destructive local ops, safety bypasses, config tampering, indiscriminate staging) and, on request, audits or wires the repo's guardrails via `/update-config` (settings.json deny/ask rules) plus an optional pre-push hook. Read-only by default.
8. **Run the SKILL.md size audit** — result: only `frame-standup.md` (372 lines) and `orchestrate.md` (369) exceed the Tier-2 ≤250 ceiling; everything else is within budget. Recorded as `TECHDEBT.md` TD-005 (move long inline prompt/template blocks into the existing `knowledge/` dirs behind JIT directives) rather than attempting a blind refactor here.

Deferred to follow-up work (not in this ADR's scope): the actual TD-005 refactor of `frame-standup.md` / `orchestrate.md`.

## Consequences

### Gains
- Fills real capability gaps (design-exploration prototyping, in-loop orientation, low-token mode, an end-to-end writing flow) with skills that match conventions already used elsewhere, so the catalog stays coherent.
- The description spec + review checklist make `description` quality (the single thing Claude Code sees when auto-triggering) a checked property rather than an implicit one.
- `/prototype` gives a sanctioned home for spike code with an enforced "record then delete" discipline, reducing prototype rot.

### Costs
- Six more skills to maintain and sync; `skill-catalog.json` and the suggest-skill hook trigger surface grow.
- The writing-* family overlaps conceptually with `daily-logger`'s article generation; we accept some redundancy in exchange for a repo-agnostic pipeline.

### Neutral
- `/caveman` is a stateful conversational mode rather than a procedure — first skill of that shape in the catalog; tier 1, phase `continuous`.
- `/zoom-out` and `/recon` now both exist; their descriptions cross-reference each other to keep auto-trigger selection clean.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Vendor `mattpocock/skills` directly via `npx skills@latest add` | Different conventions (frontmatter shape, `personal/`/`in-progress/` layout, no TypeScript registry); would fork the catalog rather than extend ours. |
| Add a new `/review` skill mirroring Pocock's | We already have `/validate` + `/pr-review` + `/spec-review`; better to refactor those around his two-axis framing later than add a fourth overlapping skill now. |
| Keep writing-* out of `core` (per Pocock, it's "personal") | User explicitly wants it in `core` and synced; prose publishing happens in several sibling repos, so a shared pipeline is the right call. |
| Skip `/caveman` as a gimmick | It's cheap and high-leverage given how many multi-agent/orchestrate flows we run; token cost on long sessions is real. |
