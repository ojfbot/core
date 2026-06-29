---
id: 20260628-2009-brief-resume-northstar-offsite
type: brief
title: "Resume the OJFBot Fleet Northstar offsite — land confirmed legs, audit the survey, Phase 2"
actor: code-claude
to: code-claude
session_id: northstar-offsite-2026-06-28
refs: []
hook: "Land the confirmed Frame leg (+ fold its graduated framework flags into the schema), then continue the roadtrip + survey work"
status: live
created_at: 2026-06-28T20:09:00
labels:
  project: ojfbot-northstar
---

## Context

This session ran the **OJFBot Fleet Northstar offsite** — authoring a northstar (vision + measurable
properties) per active fleet app. It is **conversational strategy work via a two-agent relay**, NOT
autonomous codegen: this Code session owns ground truth (filesystem/git/lint) + lands artifacts; a
separate **chat (voice)** session co-authors via **Notion as the relay**. James routes between them.

The northstar system already existed (three-tier L1→L2→L3, `draft-three-tier-northstar` ADR, a linter);
this offsite is **Slice 2** of that ADR + a hardening of the framework itself. Read
`core/decisions/northstar/schema.md` (v1.1) and `core/decisions/northstar/offsite/itinerary.md` first.

**Shipped this session:**
- Foundation reconciled: registered 3 orphan L1s (f1-pit-wall, f1-substrate, buddy-check) in the
  registry; excluded mc-perf/mc-motion (dup cockpit worktrees); cv-builder L1 confirmed on origin/main
  (lint "error" is a local-branch artifact). Lint: 6/7 present, 0 structural errors.
- `schema.md` v1.1 authored (added `depends_on` horizontal peer edge; cap is SHADOW not a hard block).
- Built the Notion relay: parent page + Itinerary DB (26 apps, status cursor) + Contract + Synthesis
  Ledger. Hardened the contract with `LADDER_STRESS` (mandatory kickback channel) + `depends_on`.
- Briefed cards: f1-substrate, f1-pit-wall (co-authored pair), blogengine, Frame(shell).
- **Frame(shell) leg CONFIRMED** in voice — a 4-property northstar (instance-federation: shell =
  authorizing surface, core = spawn mechanism). Its block **graduates framework flags** (see Goal).
- **Phase-1 evidence survey** of core + the core↔shell seam → `core/SURVEY.md` (+ Notion mirror +
  `phase2-candidates.md` parking note). Headline: the leg-5 shell/core division is *entirely
  aspirational* — zero code; repos couple only via a shared Dolt table + 1 hardcoded path + doc symlinks.

## Goal

Pick up the offsite. In rough priority: (1) **land the confirmed Frame leg** to disk and fold its
graduated framework decisions into the schema/lint; (2) drive the next roadtrip legs (cursor below);
(3) get the survey its honesty audit from *ground truth*, not chat; (4) when cued, start Phase 2.

## Acceptance criteria

- [ ] Land `shell/.claude/northstar.md` from the confirmed Frame block (Notion row `Frame (shell)`,
      status `confirmed`); register `l1-shell` in the registry; run `northstar-lint.mjs` to 0 new errors.
- [ ] **Fold the Frame block's graduated flags into `schema.md` + lint** (these are "designed", NOT yet
      in schema): (a) **cluster tier** `ns:cluster-<name>@<semver>#P<n>` (optional rung between L1 and L2);
      (b) **semver-pinned refs** `ns:<slug>@<semver>#P<n>` (the safe, non-silent replacement for the
      deferred `@v2`); (c) "instance" bound as the federation noun, "remote" retired. Log in
      `schema-evolution-log.md`.
- [ ] Check Itinerary DB for other `confirmed` rows and land them (only Frame verified confirmed this
      session; f1 pair + blogengine were `briefed`). Land the f1 pair together (co-defined).
- [ ] Implement the `depends_on` resolve-check + shadow-cap in `northstar-lint.mjs` when landing the
      first leg that uses it (real instance to verify against).
- [ ] Run an **adversarial ground-truth completeness pass on `SURVEY.md`** (a read-only agent that
      *refutes* claims / finds §7 gaps / catches leaked solutioning) — NOT chat (see Flag back).

## References

- file:core/SURVEY.md — Phase-1 evidence survey (ground truth)
- file:core/decisions/northstar/schema.md — schema v1.1
- file:core/decisions/northstar/offsite/itinerary.md — roadtrip map + cursor + relay URLs
- file:core/decisions/northstar/offsite/schema-evolution-log.md — 4 logged pressures (depends_on built; @v2 + 3rd-parent deferred)
- file:core/decisions/northstar/offsite/phase2-candidates.md — parked fixes (do NOT act in Phase 1)
- adr:draft-three-tier-northstar — governing ADR (still Proposed; acceptance is James's call)
- Notion relay (workspace "James O'Connor's Notion"):
  - Itinerary DB — https://app.notion.com/p/e923eaf2afc14685880b18488054c69a
  - Frame confirmed block — https://app.notion.com/p/38d54a8c53d78130b1cbef8df26c9328
  - Survey page — https://app.notion.com/p/38d54a8c53d781adbe16f5716f91df11
  - Contract — https://app.notion.com/p/38d54a8c53d7816f91bbe170f85bd27f

## Flag back

- **UNCOMMITTED on core/main** — everything this session wrote is working-tree-only (registry edit,
  `schema.md`, `SURVEY.md`, the whole `offsite/` dir, this bead). A `/resume` preflight will flag dirty
  ground. Ask James before committing; he gates commits. Re-verify branch/tree state before any git op
  (concurrent agents move branches).
- **ADR acceptance is James's call** — do not accept `draft-three-tier-northstar` unilaterally.
- **Chat hallucinates below the evidence line.** It has no filesystem; it confabulates when pushed into
  code-fact territory (it drifted on the survey audit this session). Keep chat ABOVE the line: judgment,
  framing, aspiration, "is this honest?". Any code fact is a question for Code, not a chat claim. Route
  evidence/completeness audits to a ground-truth agent.
- **Don't hot-patch the L2 parent.** L2-P1-widening is at 2 of 3 instances (substrate, Frame); gate trips
  at 3. The semver-on-refs mechanism is what makes a future L2 revision non-silent — build that before
  any L2 bump.

## Constraints

- **Aspiration vs honesty split:** targets/vision are meant to be ambitious; only `current` % must be
  merciless and evidence-based. The gap is the roadmap.
- **Survey is evidence-only** — no decomposition/FTI/OTAV/target-arch leaks into `SURVEY.md`; park in
  `phase2-candidates.md`.
- **Phase 2** (decomposition) pulls the canonical OTAV (Observe/Test/Act/Verify) + FTI
  (Feature/Training/Inference) definitions from James's **selfco vault** before cutting any planes.
- Roadtrip cursor: leg 1 (f1 pair, briefed) → leg 5 (Frame, CONFIRMED, ready to land) is ahead of cursor;
  legs 2–4 + rest of 5 + 6 still `queued`. Core itself is leg-6 #22 (its northstar is what the dangling
  `ns:l1-core#P-launcher` ref needs — unauthored).
