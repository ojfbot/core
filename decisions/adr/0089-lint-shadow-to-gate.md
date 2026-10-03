# ADR-0089: Promote vault lint from shadow mode to a commit gate
slug: lint-shadow-to-gate
serial: 0089
rev: A
Date: 2026-06-10 (revised 2026-10-02 — distinguish the transport inbox from raw items that block gated filing operations)
Date accepted: 2026-06-10
Status: Accepted
domain: observation
type: policy
OKR: 2026-Q2 / O-Knowledge / KR-cross-project-recall
Commands affected: /vault (lint mode)
Repos affected: core (lint.py, vault skill docs), selfco-box (pre-commit gate on the push path)
traces:
  amends: selfco-vault-and-skill
  relates-to: [control-gated-slices, vault-staleness-scanner]

---

## Context

ADR-0086 (control-gated-slices) put vault lint in shadow mode: `lint.py` emits an observe-only
report a human reviews; nothing is auto-fixed and nothing is enforced. At the original
acceptance, the vault's "0 broken links / 0 raw-without-source" invariant held only
because a human read the report — the headless selfco-box could commit and push a page
with a broken `[[link]]` and nothing would stop it. The 2026-06-10 best-practices audit
(`selfco/wiki/synthesis/selfco-vault-best-practices-audit.md` § Robustness) named this the
remaining single point of vigilance, and ADR-0086 explicitly teed up the Brassboard →
Operational promotion as a data-gated RIDM decision. The shadow data is in: months of lint
reports with sustained zeros show the deterministic checks are stable and non-noisy.

The later transport split lands captures under `raw/inbox/` before a filing session creates
source pages. The transport pass's own writes are inbox captures, and it constructs
`VaultGit` with the gate disabled. The original
blanket raw-without-source gate would nevertheless block a subsequent gated ingest, note,
or cultivate commit while those captures await filing. The originating requirement in
`selfco/wiki/synthesis/adr-draft-selfco-box-transport-split.md` makes pending inbox items
visible but advisory; unfiled raw material elsewhere remains a blocking finding.

## Decision

Promote the two deterministic, single-correct-answer checks — broken `[[links]]` and
raw-without-source outside `raw/inbox/` — to a blocking gate: `lint.py --gate` exits 1
when either class has findings. It lists uncited inbox captures as an advisory filing
queue. The selfco-box runs the gate for ingest, note, and cultivate commits; the
LLM-free transport path lands inbox captures without invoking it. Canvas fit remains
gate-blocking under ADR-0088 rev B; orphans and stale pages stay advisory. The gate
blocks, it never mutates a page; the
documented escape valve for an intentional mid-refactor dangling link is
`SELFCO_LINT_GATE_OVERRIDE=1`.

## Consequences

### Gains
- Gated wiki commits cannot introduce broken links or leave non-inbox raw material without a source page. Pending inbox captures remain visible without blocking later filing work.
- A gated failure surfaces loudly: the job fails, the Notion row flips to `status=failed` with the lint report excerpt — the operator sees it in the channel they already watch.

### Costs
- A failing gate can block an otherwise-good ingest when a broken link or unfiled non-inbox raw item remains (mitigated: only deterministic checks gate; the override flag exists; the agent can repair and retry).
- The box's gate spawns `python3` + core's `lint.py` (located via `VAULT_LINT_SCRIPT`, default `~/ojfbot/core/.claude/skills/vault/scripts/lint.py`) — a soft cross-repo dependency. Fail-open with a loud warning when the script or python3 is absent (a missing tool is not a lint failure); fail-closed when the gate runs and finds blocking classes.

### Neutral
- Hidden dot-entries under `raw/` (e.g. the gitignored `raw/.defuddle-shadow/` trial dir, adr:defuddle-ingest-fetch) are excluded from raw-without-source — scratch, not source material.
- Transport passes bypass the gate independently of this revision; the new inbox boundary removes only the backlog's blocker from gated ingest, note, and cultivate commits. A legacy `note` job that writes non-inbox raw without a source page remains blocked by its own new finding.
- Auto-*fix* stays out of scope: a separate, future, data-gated decision.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep lint shadow-only | The invariant depends on a human reading a report; the audit named it a SPOF. The RIDM data gate ADR-0086 demanded is satisfied. |
| Gate orphans/stale too | Judgment calls, not errors — blocking on them would force filler edits (the Goodhart failure the vault's guardrails exist to prevent). |
| Reimplement the checks in TypeScript inside the box | Two implementations of one invariant drift; lint.py stays the single authority, and the box already shells to it for `--suggest-links` (launchd-cultivate.sh precedent). |
| Auto-fix broken links at the gate | Violates the never-destructive property of the shadow stage; a wrong auto-fix is worse than a blocked commit. |
| git pre-commit hook in the vault clone | Hooks aren't committed/distributed and would also gate human Mac-side commits this ADR doesn't cover; the box's `commitAndPush()` is the actual push path being promoted. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | selfco `wiki/synthesis/adr-draft-lint-shadow-to-gate.md` (2026-06-10, vault best-practices audit § Robustness) |
| Implementation start | 2026-06-10 (core: `lint.py --gate`; selfco-box: gate in `commitAndPush()`) |
| Implementation end | 2026-06-10 (merged: core PR #145 + selfco-box PR #4) |
| Rev A requirement | `selfco/wiki/synthesis/adr-draft-selfco-box-transport-split.md` — inbox advisory, other unfiled raw gate-blocking |
| Rev A verification | core PR #499: `test_lint_gate.py` exercises inbox-only, non-inbox blocking, and source-page resolution |
