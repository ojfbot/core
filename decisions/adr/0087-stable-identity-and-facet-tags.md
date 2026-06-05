# ADR-0087: Stable-identity + facet-tag ADRs — NASA Configuration Management applied to decision records
slug: stable-identity-and-facet-tags
serial: 0087
domain: meta
type: convention
Date: 2026-06-04
Status: Accepted
OKR: 2026-Q2 / O-skills / KR-coverage
Commands affected: /adr (rewritten), /bead (refs: adr:<slug> form)
Repos affected: core (decisions/, the /adr skill, skill-catalog); sibling repos read decisions/ via symlink (browse-only, unaffected)
traces:
  amends: zero-point-and-provenance-convention
  relates-to: [control-gated-slices, ubiquitous-language-layer, selfco-vault-and-skill]

---

## Context

Pure sequential ADR numbering (`0001`…`0086`) is fragile, and the failure modes all bit in one
2026-06-04 session:

1. **Collisions under concurrent authoring.** Two ADRs were both assigned `0069`; one had to be
   renumbered `0069 → 0085`, dangling references across `core` *and* the `~/selfco` vault.
2. **Phantom forward-reservations rot.** ADR-0066 cited "ADR-0067 *Cluster test bar*" and "ADR-0069
   */validate CI gate*" for follow-up ADRs that were never written under those numbers; the vault
   "reserved" `0071`–`0075` for drafts. Reservations to unwritten docs decay into wrong pointers.
3. **Renumbering churn.** The number is load-bearing — embedded in filenames (`0069-*.md`),
   cross-references (`ADR-0069`), commit messages (`ADR: 0NNN`, ADR-0065), branch names
   (`adr-0NNN/<slug>`), and skill-catalog tags — so a single renumber touches dozens of files.
4. **No taxonomy.** Categorization lived in prose ("the Developer Day series 0056–0065"); you cannot
   filter the corpus by domain or decision-class.

ADR-0086 (Control-Gated Slices) established the house discipline: **reuse NASA Systems Engineering
Handbook (SEH) nomenclature where it fits, and flag the harness extensions** — sourcing the terms
from `seh-study` (`packages/shared/src/glossary.json`). ADR-0086 mapped the *life-cycle / control-gate*
half of that vocabulary. This ADR applies the **Configuration Management** half to **decision
identity** — the part of SEH built precisely to keep a controlled set of documents identifiable and
traceable over a long life cycle without churn.

## Decision

Adopt a **stable-identity + facet-tag** scheme for ADRs, grounded in NASA Configuration Management.

1. **The slug is the Configuration Item identifier — the unchanging base.** Each ADR carries an
   immutable kebab-case `slug:` (e.g. `zero-point-and-provenance-convention`). All *new* cross-references
   use `adr:<slug>` (the same typed-URI form `/bead` already uses in `refs:`). Because nothing
   load-bearing references the number, renumbering and collisions can no longer dangle.

2. **The 4-digit number is a non-load-bearing display serial.** `serial:` is `draft` while a decision
   is `Proposed`, and is assigned exactly once at **accept** — `max(existing serials) + 1`, monotonic,
   **never reused, never reserved, never renumbered**. Assigning it at the accept serialization point
   (not at authoring time) makes the `0069` double-assignment structurally impossible. Gaps are
   meaningless by design and are never backfilled.

3. **Decisions are revised in place (Rev letters), never renumbered.** When an accepted decision
   evolves, bump `rev:` (`A`, `B`, …) and annotate `Date:`; slug, serial, and filename stay fixed.
   This formalizes what ADR-0085 already did by hand (`Date: … (revised 2026-05-12 …)`).

4. **No forward-reservations.** Drafts live as `draft-<slug>.md`, `status: Proposed`, no serial. A
   forward-reference uses the slug of a doc that *exists*, never an unassigned number. The `traces:`
   invariant (below) enforces this.

5. **A facet block replaces implicit prose grouping.** Required: `domain` (the six ADR-0044 bounded
   contexts + `meta`), `type` (decision class), `status` (lifecycle). Optional: `gate`/`baseline`
   (NASA lifecycle facets, for decisions tied to a `/gated-slice` initiative), and `traces:` —
   **bidirectional** links (`supersedes`↔`superseded-by`, `amends`↔`amended-by`, `relates-to`
   (symmetric), `parent`/`part-of-series`), every value a slug that **must resolve to a file on disk**. `/adr publish` lints
   this; a dangling trace fails the lint — the structural cure for phantom reservations.

### Controlled vocabularies

- **`domain`** = `shell-host-composition | agent-graph | workflow-engine | gas-town-governance |
  observation | ui-components | meta`. The six are the ADR-0044 / `CONTEXT.md` bounded contexts; `meta`
  covers the decision process itself and cross-cutting platform/dev-infra not owned by one context.
- **`type`** = `architecture` (system structure/boundaries) · `convention` (a naming/format rule) ·
  `process` (how humans/agents work) · `infrastructure` (deploy/CI/runtime/dev-env) · `policy` (a
  governance rule with enforcement) · `tooling` (a skill/script).
- **`status`** = `Proposed | Accepted | Superseded | Deprecated`.

### SEH ↔ harness mapping (NASA Configuration Management)

Definitions quoted from `seh-study` `packages/shared/src/glossary.json` (NASA SEH). Each row is genuine
NASA vocabulary except the one flagged extension.

| Harness use | NASA SEH term (verbatim) |
|---|---|
| `slug` = the ADR's permanent identity | **Configuration Items (CI):** "…can be referred to by an **alphanumeric identifier which also serves as the unchanging base** for the assignment of serial numbers to uniquely identify individual units of the CI." |
| `serial` = the number assigned off the slug | the "serial numbers" assigned off that unchanging base (above) |
| `status` baseline transitions | **Baseline:** "An agreed set of requirements, designs, or documents whose changes are controlled through a formal approval and monitoring process." (Functional → Allocated → Product baselines map to the maturity ladder.) |
| `traces:` parent/children | **Bidirectional Traceability:** "The ability to trace any given requirement/expectation to its **parent** and to its **allocated children**…" |
| `rev:` (revise in place) | Document **revision** under **Configuration Management Process** — "control changes to … characteristics … any product change is … effected without adverse consequences." A controlled change ≠ a new identity. |
| `Status: Superseded/Deprecated` retains the file | a change processed through config control; cf. **Waiver:** "A documented authorization releasing a program or project from meeting a requirement **after the requirement is put under configuration control**." |

**Harness extension (flag every time):** *a draft slug with no serial.* NASA assigns the CI
identifier up front; we defer the **serial** until accept. The **slug** is still the unchanging base
from creation, so the spirit (stable identity decoupled from the serial) holds — but the deferral is
ours, not NASA's. This is the CM-side analog of ADR-0086's "vertical slice" / "shadow mode" extensions.

### What this amends

This **amends ADR-0065** (zero-point & provenance) on its numbering/branch/commit aspects only — the
zero-point and Provenance-table machinery is unchanged. The merge-commit key becomes dual: `ADR: <slug>`
(canonical) **and** `ADR: <serial>` retained (so `git log --grep "ADR: 0061"` history still resolves);
branch naming moves to `adr/<slug>`. It does **not** supersede the `/adr` skill — it rewrites it.

## Consequences

### Gains
- **Collisions and renumber-churn become structurally impossible** — the number is assigned once, at a
  serialization point, and never referenced load-bearingly.
- **Phantom reservations are forbidden** by the resolve-on-disk `traces:` invariant + the publish lint.
- **The corpus is filterable** by `domain`/`type`; the index groups by meaning, not by number.
- **Reuses mature SE thinking** (CM), consistent with ADR-0086, flagging the one genuine extension.

### Costs
- **Per-ADR frontmatter** (`slug`/`serial`/`domain`/`type`) — trivial for the first two, a small
  classification judgement for the latter two.
- **A vocabulary to maintain** — the `domain`/`type` controlled sets and the SEH-CM mapping.
- **Two ID surfaces during transition** — old `ADR-NNNN` prose refs coexist with new `adr:<slug>` refs.
  Acceptable: once renumbering is abolished, existing number-refs are permanently valid.

### Neutral
- Number **gaps** (`0031`, `0071`–`0078`) and the `0069/0085` artifact are now semantically inert —
  left as-is, never backfilled.
- Sibling repos read `decisions/` via a browse-only symlink and parse no ADR filenames — zero impact.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Keep sequential numbers as the identity, just add tags | Leaves the root cause (collisions, reservations, renumber-churn) untouched — only adds taxonomy. |
| Drop numbers entirely (slug-only files) | Cleanest conceptually, but breaks ~305 existing `ADR-NNNN` references and `git log --grep "ADR: 0061"`, and loses at-a-glance ordinal scanning. The serial costs nothing once it's non-load-bearing. |
| Domain-prefixed numbers (`ADR-WFE-001`) | Still sequential *within* a domain — re-introduces per-domain collisions and cross-domain reclassification churn; the slug already carries the meaning. |
| Invent harness-native identity terms | Throws away NASA CM's mature, precise vocabulary `seh-study` already curates; we reuse it and flag the one extension (per ADR-0086). |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | the 0069→0085 renumber + ADR-0066 phantom-reference cleanup (this session) as the motivating incident |
| SEH source | `seh-study` `packages/shared/src/glossary.json` (NASA SEH Configuration Management nomenclature) |
| Harness extension | "draft slug with no serial" (NASA assigns the CI identifier up front; we defer the serial) |
| Amends | ADR-0065 (numbering/branch/commit-key aspects; provenance machinery retained) |
| Implementation start | this PR (ADR + facet backfill of 86 ADRs + `/adr` rewrite + grouped index + catalog-tag migration) |
| Implementation end | _pending review_ |
