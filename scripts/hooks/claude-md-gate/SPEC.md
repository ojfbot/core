# CLAUDE.md loading-discipline gate — spec (ADR-0081 Slice 2)

The enforcement control for the loading-discipline. A `PreToolUse` hook on `Edit|Write` that
stops an oversized always-loaded `CLAUDE.md` from growing with *conditional* content. Built as
**Control-Gated Slices** (see the gated-slices ADR): it matures through a **Brassboard / shadow
stage** (observe-only) before **Operational** (enforcing) promotion, which is a **RIDM** decision
gated on the TPMs below.

## Modes (`CLAUDE_MD_GATE_MODE`)

| Mode | Behavior |
|------|----------|
| `shadow` (default) | Runs tripwire → judge, **logs a TPM event, never blocks** (always exits 0). This is the Brassboard stage. |
| `enforce` | On a judged violation that isn't session-cleared: **blocks** (`exit 2`) and routes the author to `/grill-with-docs --scope=claude-md-routing`. Promotion to this mode is RIDM-gated on M3/M5. |
| `off` | No-op. |

## Two-stage gate (cheap → expensive)

1. **Tripwire (C1, deterministic, no LLM).** `tripwire.mjs`. Trips only when the edited file is an
   **always-loaded** layer (repo-root `CLAUDE.md`, or a `.claude/rules/*.md` *without* `paths:`),
   the proposed content is **oversized** (`> CLAUDE_MD_GATE_THRESHOLD` tokens, default 3000), **and**
   it is **growing** (after > before). Nested `CLAUDE.md` and path-scoped rules are conditional by
   construction → never trip (they're the *correct* destinations). Most edits aren't CLAUDE.md → the
   hook exits instantly. This keeps the LLM off the common path.
2. **Judge (C2, scoped Haiku).** `judge.mjs`. Only runs when the tripwire trips. Judges whether the
   *added* content is conditional (belongs in Layer 1/2) → `{isConditional, suggestedLayer,
   confidence, reasoning}`. Degrades safely: if no `ANTHROPIC_API_KEY` or the call errors, the event
   is logged with `verdict: null` and the gate **never blocks**.

## Clearance (C5)

Per-session marker (`clearance.mjs`, file keyed by `session_id`). After an author resolves a block
(via `/grill-with-docs`), the session is marked cleared and subsequent CLAUDE.md edits in that
session pass — this kills the infinite block→edit→block loop. Inert in shadow mode.

## TPM event log (C3) — the measurement spine

Every tripwire firing appends one JSONL line to `~/.claude/claude-md-gate-telemetry.jsonl`:

```json
{ "ts", "session_id", "repo", "file", "mode",
  "tripwire": { "tripped", "before", "after", "threshold" },
  "verdict": { "isConditional", "suggestedLayer", "confidence" } | null,
  "action": "allow-shadow" | "allow-shadow-nojudge" | "block" | "allow-cleared" | "allow-no-violation",
  "cleared": false }
```

`analyze.mjs` computes the Technical Performance Measures that gate the shadow→enforce promotion:

- **M3 — gate precision (MOP).** Of judged violations, the rate later overridden / dismissed. Target
  override rate **< 30%** (higher ⇒ the gate is overfit; do **not** promote to enforce).
- **M5 — judge reliability (MOP).** False-block / false-flag rate. In shadow this is the "would-block"
  rate; once enforcing, the override-of-block rate. Target **low and stable**.

## Control Gates for this slice

| Checkpoint | Success Criteria (TPM / verification) |
|---|---|
| C1 tripwire | unit-tested: trips only on always-loaded + oversized + growing; never on nested/path-scoped |
| C2 judge | runs on a labeled fixture set; degrades safely without a key |
| C3 events | events land; `analyze.mjs` reports M3/M5 |
| C4 shadow (Brassboard) | hook wired in `settings.json`, mode defaults to `shadow`, **observe-only** |
| C5 clearance + block→ask | flagged; block path routes to `/grill-with-docs`; clearance kills re-fire |
| **C6 enforce (Operational)** | **NOT in this slice** — RIDM-gated on ~4 weeks of M3 (<30%) + low M5 |
| C7 generalization (ADR-0083) | NOT in this slice |
