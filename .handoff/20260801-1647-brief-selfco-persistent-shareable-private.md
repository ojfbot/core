---
id: 20260801-1647-brief-selfco-persistent-shareable-private
type: brief
title: "selfco vault: persistent, syncable, shareable, private — 'shareable' is the undecided axis; ADR-0070 Phase A has a verified implementation gap and there is an open accidental-sharing leak path"
actor: code-claude
session_id: wayfinder-fde-operating-presence-2026-08-01
refs:
  - 20260801-1600-report-fde-map-320-321-closed
  - adr:vault-multi-surface-access
  - adr:selfco-vault-and-skill
  - adr:employer-evidence-boundary
hook: "github:ojfbot/core#321"
status: live
created_at: 2026-08-01T16:47:00-0500
labels:
  project: selfco
---

## Purpose

Spawn prompt for a fresh session. Everything below the line is self-contained — paste it, or
point the new session at this file. Facts were verified 2026-08-01; the new session should
re-verify rather than trust them, and the prompt says so.

**Framing note for whoever reads this first.** The four properties are not equally open.
Persistence and sync have an *accepted* decision (`adr:vault-multi-surface-access`) with an
implementation gap — that is execution debt, not a design question. **Shareable is the real
problem**, and it is precisely what ADR-0070 does not address: it solved multi-surface access
for *one person*, not access for *other people*. A session that treats all four as equally
undecided will re-derive settled ground. The leak in §2 below is best read as a design input
rather than a bug — it is a working example of what "shareable" looks like when nobody decided
it: the whole vault, to everyone, by accident, via a build step.

---

Design how the selfco vault becomes persistent, syncable, shareable, and private — four
properties that are currently in tension, with only some of them decided.

Substrate: ~/ojfbot/core (fleet), ~/selfco (the vault). Read-only until we've aligned.

## What selfco is

A Karpathy-style LLM Wiki at ~/selfco: append-only `raw/` source layer + an LLM-owned
`wiki/` of source/entity/concept/synthesis pages, plus index.md, log.md, canvas/, bases/,
templates/, tracking/. Schema is ~/selfco/CLAUDE.md (222 lines) — read it first. Maintained
by the /vault skill (core/.claude/skills/vault/). 69 MB, 1,661 markdown files, actively
written (last push 2026-08-01). Git remote: ojfbot/selfco, PRIVATE, working tree clean.

## What is already decided — do not re-litigate without reason

- `adr:selfco-vault-and-skill` (0085, Accepted) — the vault and skill exist.
- `adr:vault-multi-surface-access` (0070, Accepted) — **Phase A**: the private GitHub repo
  ojfbot/selfco is the SOURCE OF TRUTH and ~/selfco on the Mac is a clone; the official
  GitHub connector serves claude.ai web + iPhone + Desktop; Desktop additionally gets a local
  mcp-obsidian (Obsidian Local REST API plugin); a `/vault` Agent Skill is uploaded to the
  Anthropic account so the workflows exist in the consumer apps. **Phase B** (later, with
  dedicated hardware) migrates to a locally-hosted obsidian-mcp.
- Also accepted and relevant: 0079 vault-page-lifecycle-policy, 0080 vault-staleness-scanner,
  0087 stable-identity-and-facet-tags, 0088 obsidian-bases-views, 0089 lint-shadow-to-gate,
  0090 defuddle-ingest-fetch, 0091 semantic-link-suggester.

## Verified gaps and hazards (checked 2026-08-01 — re-verify, don't trust this list blindly)

1. **ADR-0070's sync is partially unimplemented.** The ADR specifies `scripts/autocommit.sh`
   (debounced fswatch → pull/commit/push, launchd template) to cover writes that bypass the
   skill — hand-edits in Obsidian, mcp-obsidian writes. The script exists at
   core/.claude/skills/vault/scripts/autocommit.sh but is NOT installed at ~/selfco/scripts/,
   and NO launchd job is loaded. The two ~/Library/LaunchAgents/com.ojfbot.selfco-box.*.plist
   files are `.disabled`. So skill-mediated writes sync; everything else does not. Confirm
   this before designing around it.

2. **There is an accidental-sharing leak path, open right now.** ojfbot/core-library is a
   PUBLIC repo. packages/vault-ingest regenerates the ENTIRE vault graph to
   public/graph/selfco.json (1.5 MB, private vault content verbatim in node titles) on
   dev-start, on build, and on vault change; apps/web/src/main.ts:82 fetches it at runtime.
   The git vector was closed today (core-library@ccbf853 gitignores public/graph/), but the
   BUILD/DEPLOY vector is wide open: the repo has no vercel.json/.vercel/netlify.toml, so
   "not currently deployed" is the only thing containing it. Deploying core-library
   republishes the whole private vault to a public URL and .gitignore does nothing.
   **Deploying core-library is blocked until this is designed.** Recorded in
   core/decisions/open-unknowns.md.

3. **Hosting is unsettled.** An always-on host has been discussed (a Raspberry Pi named
   `selfco`, with a Mac mini as the eventual target) and is ADR-0070's Phase B trigger.
   Verify what actually exists on the network before treating any of it as real.

4. **selfco-box** (~/ojfbot/selfco-box) is the capture daemon and is paused; its launchd
   plists are disabled.

## The actual problem

"Shareable" is the genuinely undecided axis and it is in direct tension with "private."
Everything else has at least a decided direction. Open questions to grill, not answer alone:

- Shareable WITH WHOM, and at what granularity? A specific page to one person, a curated
  public subset, a read-only graph view, an export? Per-page, per-tag, per-tier?
- Is sharing a PROJECTION of the vault (a derived, filtered artifact) or ACCESS to it?
  ADR-0070 chose the GitHub connector for the private multi-surface case; sharing with
  others is a different problem and may want a different mechanism entirely.
- What is the redaction tier model? There is now a fleet precedent to reuse or reject:
  `adr:employer-evidence-boundary` (wayfinder #321, decided 2026-08-01) established the
  **stranger test** — a reader with no prior knowledge cannot identify the employer, system,
  or team — and `adr:boundary-enforced-by-construction` established that the boundary is
  enforced by a denylist lint reading from gitignored personal-knowledge/, NOT by author
  discipline, because a discipline-based boundary already failed twice in one day.
  dive-briefing's `adr:corpus-governance-tiered-authorities` is the other precedent: tiered
  authorities with a `private_mount` tier that is unpublishable BY CONSTRUCTION.
- Does "persistent" mean anything beyond the git remote — durability, backup, retention,
  recoverability if the Mac dies?
- Does the graph UI (core-library) stay a private local tool, become the sharing surface
  with a filtered graph, or get retired from this role?

## How to work it

Start with /grill-with-docs to establish the shared design concept and surface the decision
tree — facts you can look up, decisions to me one at a time. If the grill shows this is
multi-session and genuinely foggy (I suspect the sharing model alone may be), say so and
route to /wayfinder to chart it as a decision map rather than forcing a premature spec.

Constraints: no code and no vault writes during alignment. The vault is actively written by
other sessions — treat ~/selfco as live. Do not fix the core-library leak unilaterally; the
guard choice (de-identify at ingest / gate the fetch to local-only / exclude protected nodes
from the graph) is a design decision, not a cleanup. ADR stubs are proposed, never committed
— I run /adr new myself.
