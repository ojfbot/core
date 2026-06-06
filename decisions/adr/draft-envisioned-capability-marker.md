# ADR: Envisioned-capability marker — distributed marker, maturity ladder, and reference lint
slug: envisioned-capability-marker
serial: draft
rev:
Date: 2026-06-06
Status: Proposed
domain: workflow-engine
type: convention
OKR: 2026-Q2 / O-skills / KR-coverage
Commands affected: /envision (new), /skill-create (graduation handoff), /scaffold (graduation handoff), /plan-feature (consumes this design)
Repos affected: core (CONTEXT.md, GLOSSARY.md, envisioned-lint hook, /envision skill, skill-catalog); SelfcoVault (seed migration); all sibling repos via install-agents.sh
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [pocock-skill-conventions-and-new-skills, control-gated-slices, selfco-vault-and-skill]
  parent:
  part-of-series:

---

<!--
Identity (ADR-0087): `slug` is the permanent identity; this draft is `draft-<slug>.md` with `serial: draft`.
`/adr accept` assigns the 4-digit serial (max+1, never reused) and renames to `<serial>-<slug>.md`.
Cross-refs use `adr:<slug>`. Every `traces:` value resolves to a file on disk.
-->

## Context

Future-desired capabilities get captured as notes that read exactly like notes for *real* things. The seed is the drone-tooling stack — `Approach` / `fieldnote` / `flightline` / `Plat` — now scattered across `SelfcoVault` synthesis + concept pages (`wiki/concepts/fieldnote.md`, `flightline.md`), each marked only with a soft "*Planned — not yet built*" line. Two failure modes follow:

- **P1 — pollution / mistaken-for-real.** An agent greps the vault or a repo, hits `fieldnote`, and treats it as an available deliverable ("`fieldnote` exists, I'll import it"). The soft marker is invisible at the reference site (a bare `[[fieldnote]]` or grep hit carries no signal).
- **P2 — over-determination.** A future-capability note prematurely fixes scope/interfaces — declaring signatures and contracts before they're earned.

The existing skill `status: in-progress` (adr:pocock-skill-conventions-and-new-skills §6) does **not** cover this: it presumes a real `SKILL.md` already exists (still harness-discoverable in-repo), and it is skill-only, whereas the scope here is *any* capability fleet-wide (Node libs, apps, integrations, eventual skills).

## Decision

Adopt an **EnvisionedCapability** convention: a distributed marker + maturity ladder + an enforcing lint Hook.

1. **A dedicated frontmatter field `envisioned: idea | shaped | ready-to-build`**, orthogonal to `status:`. **Presence ⇒ the capability does not exist yet**; absence ⇒ real. (Avoids colliding with the two existing `status:` vocabularies — skill `active/in-progress/deprecated`, vault page `seedling/growing/evergreen`.)
2. **Distributed marker, not central backlog.** Notes live where they are contextually at home (beside related code, or in `SelfcoVault`); quarantine is by *marker*, not location. A derived first-line banner plus a **required inbound `— envisioned` reference tag** carry the signal to every reference site (the cure for P1's skim-past).
3. **Maturity ladder** gates allowed detail (the cure for P2, scoped to "too *soon*" rather than "never"): `idea` (name + why) → `shaped` (prose shape, no signatures) → `ready-to-build` (interfaces allowed — detail now earned, build imminent).
4. **`envisioned-lint.sh` Hook** (CI + optional pre-commit), bidirectional, registry **derived at lint-time** from `envisioned:` frontmatter (no hand-maintained list — stays distributed):
   - **containment** — no stage-inappropriate detail (code-fences / signatures / contract-language before `ready-to-build`);
   - **reference** — every mention of an envisioned name carries the inline `— envisioned` tag;
   - **stale-marker** — no `— envisioned` tag points at a graduated (now-real) capability.
   This is the first plank of an intended fleet-wide markdown-lint layer.
5. **`/envision` skill** to author a note, advance its ladder stage, and graduate it. **Graduation = deleting the `envisioned:` field**; the note becomes the real doc and `/skill-create` or `/scaffold` takes over.
6. **Migrate the seed:** `wiki/concepts/fieldnote.md` + `flightline.md` → `envisioned: shaped`; tag inbound references in `drone-tooling-codenames` / `dji-avata-360-pipeline-reality-check`.

## Consequences

### Gains
- P1 and P2 are addressed by **mechanism, not vigilance** — the marker travels to the reference site and the ladder defines when detail is earned.
- A real lifecycle (idea → shaped → ready-to-build → built) with a clean graduation step and a tool (`/envision`) keeping it honest.
- Orthogonal to both existing `status:` vocabularies — composes rather than collides.
- Establishes the first plank of the fleet-wide lint layer, with a reusable bidirectional-lint pattern (containment + reference + stale-marker).

### Costs
- A new frontmatter field + lint to build and maintain; a new `/envision` skill in the catalog.
- **Cross-repo references are out of scope for v1** — a per-repo lint can't see a vault→ojfbot (or repo→repo) reference. Open thread; v1 lints within a single repo (the vault is its own repo).
- Authoring discipline: the `— envisioned` reference tag must be applied by hand until the lint backstops it.

### Neutral
- Distinct from `status: in-progress` (skill drafts) — that lifecycle is unchanged; this sits *below* it for not-yet-a-SKILL.md ideas of any capability kind.
- The marker is convention-level; the harness's native skill discovery is untouched (these notes are never `SKILL.md` files).

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Central `CAPABILITY-BACKLOG.md` (location-quarantine) | Dislocates notes from their context (drone notes leave the vault's drone cluster); a single file becomes a dumping ground divorced from where the capability is built. |
| Reuse `status: in-progress` (adr:pocock-skill-conventions-and-new-skills) | Skill-only; presumes a real `SKILL.md` (still harness-discoverable in-repo); doesn't model the pre-draft "idea/shape" stage or non-skill capabilities. |
| Convention-only marker, no lint | Agents — the exact actors who over-trust — skim past unenforced markers; that *is* P1. The user explicitly wants enforcement as a standing lint plank. |
| Flat `envisioned` boolean (no ladder) | A hard cliff between "vapor" and "real"; doesn't model "scoped too *soon*", which is the actual P2 complaint. The object-over-enum ladder leaves room to grow. |
| Identifier-level marker (`fieldnote.envisioned.md` / name prefix) | Strongest passive signal but fights Obsidian wikilink ergonomics (`[[fieldnote.envisioned]]`) and forces a rename on graduation. Reference-site tagging + lint gets the same coverage without breaking links. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | the 2026-06-06 selfco drone-tooling ingest, which created `wiki/concepts/fieldnote.md` + `flightline.md` as "*Planned*" concept stubs indistinguishable from real-thing notes — the concrete P1 hazard |
| Grilled in | /grill-with-docs session, 2026-06-06 (four forks: scope=any-capability → distributed-marker → reference-site+lint → maturity-ladder) |
| Relates to | adr:pocock-skill-conventions-and-new-skills (skill `status` lifecycle), adr:control-gated-slices (maturity-ladder kinship), adr:selfco-vault-and-skill (where the seed lives) |
| Implementation start | _pending — /plan-feature_ |
| Implementation end | _pending_ |
