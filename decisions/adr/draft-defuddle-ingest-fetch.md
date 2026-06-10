# ADR-XXXX: defuddle as a reversible, shadow-mode ingest trial
slug: defuddle-ingest-fetch
serial: draft
rev:
Date: 2026-06-10
Status: Proposed
domain: observation
type: tooling
OKR: 2026-Q2 / O-Knowledge / KR-cross-project-recall
Commands affected: /vault (ingest/research fetch path — unchanged during the trial)
Repos affected: selfco-box (shadow-compare in the URL ingest path), selfco (gitignore for the shadow dir)
traces:
  amends: selfco-vault-and-skill
  relates-to: [control-gated-slices, lint-shadow-to-gate]

---

## Context

The ingest/research fetch downloads a URL to `raw/<slug>.md` as-is, carrying nav chrome and
boilerplate that inflate the capture and every later read's tokens. kepano's defuddle
extracts clean markdown — but it is opinionated (it strips aggressively and reshapes
structure), and `raw/` is append-only and immutable, therefore unforgiving of a bad
extraction. Going all-in risks silently losing source text. The 2026-06-10 best-practices
audit reframed this from "adopt defuddle" to "get evidence on defuddle without committing
the canonical ingest path to it."

## Decision

Run defuddle in shadow, never as the canonical writer, until the data says otherwise:
behind the off-by-default `INGEST_DEFUDDLE_SHADOW=1` flag, each selfco-box URL ingest
*additionally* writes the defuddle extraction to the gitignored
`raw/.defuddle-shadow/<url-slug>.md` and appends a one-line diff stat (chars kept, links
kept/dropped, headings) to `raw/.defuddle-shadow/_stats.jsonl`. The canonical
`raw/<slug>.md` is still produced from the unmodified fetch. Evaluate over the next ~15–20
web ingests; promotion to canonical normaliser is a separate, data-gated ADR.

## Consequences

### Gains
- Real evidence on an opinionated tool with zero risk to `raw/` immutability or any canonical page; "does defuddle keep the substance" becomes a measured question, not a vibe.
- Reuses the shadow-mode pattern the operator already trusts (ADR: control-gated-slices); zero rollback cost — unset the flag, delete the dir; no canonical page, raw entry, link, or log section was ever written by defuddle.
- The trial dependency is dynamically imported and all failures are swallowed: it cannot break or fail an ingest even when enabled.

### Costs
- Dual extraction cost during the trial window (bounded, ~20 ingests).
- The shadow diffs need a human read — acceptable; that *is* the data gate.
- The real token-savings benefit is deferred until after the evaluation (intended).

### Neutral
- `lint.py` skips hidden dot-entries under `raw/`, so shadow files never trip raw-without-source (coordinated with adr:lint-shadow-to-gate).
- The shadow slug is URL-derived and throwaway — it intentionally does not match the canonical page slug.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Adopt defuddle as the canonical fetch normaliser now | `raw/` is immutable; a silently-bad extraction is permanent. No sample data yet. |
| Skip defuddle entirely | The clutter/token cost is real; the audit's verdict was "worth trialling, not committing". |
| Shadow via the ingest agent (give it the defuddle output too) | Pollutes the agent's context and risks the extraction leaking into canonical pages; the worker-side shadow never reaches the agent. |
| Store shadows outside the vault (e.g. /tmp) | The diffs must survive reboots and sit next to what they mirror for the human review; gitignore already keeps them out of history. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | selfco `wiki/synthesis/adr-draft-defuddle-ingest-fetch.md` (2026-06-10, vault best-practices audit § defuddle) |
| Implementation start | 2026-06-10 (selfco-box: shadow-compare; selfco: gitignore) |
| Implementation end | _pending_ (trial sample collection not started) |
