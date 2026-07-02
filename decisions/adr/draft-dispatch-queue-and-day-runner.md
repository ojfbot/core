# ADR: Dispatch queue + day-runner — the cockpit stages intents; a headless runner delivers slices
slug: dispatch-queue-and-day-runner
serial: draft
rev:
Date: 2026-07-02
Status: Proposed
domain: gas-town
type: architecture
OKR: 2026-Q3 / O-legibility / KR-delivery-pipeline
Commands affected: /day-run (new), /frame-standup (Step 7b posts through the same queue), /resume (corroborates runner sessions)
Repos affected: core (scripts/day-runner.mjs, scripts/hooks/bead-emit.mjs queue-post roadmap labels, .claude/skills/day-run); morning-cockpit (Available lane + Claim are the human face of the same queue)
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [roadmap-under-northstar, progressive-autonomy-gates, session-provenance-hardening]
  parent:
  part-of-series:

---

## Context

The goal is a day of relatively unsupervised agentic work driven from morning-cockpit. Three
control-plane shapes were considered: the cockpit spawning sessions itself (full driver), the
cockpit staging intents that a separate runner consumes (intent queue + runner), and the cockpit
merely assembling prompts for the human to launch (prompt stager). The cockpit's whole
architecture (ADR-0001 read-model, ADR-0005/0010 narrow gated writes) argues against full driver;
prompt-stager never reaches unsupervised. **Chosen: intent queue + runner** (user decision,
2026-07-02 grill).

The queue already existed: cockpit ADR-0002's `queue=available` label contract, `queue-claim`'s
CAS lease, `queue-sweep`'s dead-claim valve — all shipped in `bead-emit.mjs`, all starved of
producers (`bead_events` held one row; zero `available` beads before the first compile).

## Decision

- **The dispatch queue is the existing unassigned queue.** Compiled roadmap slices are ordinary
  `queue=available` task beads carrying `roadmap_ref` / `advances` / `autonomy_gate` / `why`
  labels (reserved-label extension in `bead-emit.mjs`). Cockpit Available lane and Claim, the
  standup's Step 7b, and the runner all speak this one queue — no parallel truth.
- **`day-runner.mjs` is the GUPP loop** ("work on the hook must run"): read the queue read-only,
  claim agent-eligible beads via `queue-claim --agent` (a lost CAS claim is normal contention),
  resolve the slice from the canonical file, and run a headless `claude -p` session per slice,
  bounded by a concurrency cap and a wall-clock timeout.
- **Isolation.** Every session runs in a fresh git worktree created off `origin`'s default branch
  under `~/.cache/day-runner/worktrees/` — outside `~/ojfbot`, so scratch copies of
  `.claude/northstar.md`/`roadmap.md` never pollute registry scans (the mc-perf/mc-motion
  lesson), and remote state is re-fetched at the last moment (concurrent agents move branches).
- **The slice-boundary contract** (TeamBot session-brief lineage; every brief is self-contained):
  a session must leave (1) work only in its worktree, (2) commits on its slice branch,
  (3) the branch pushed, (4) a PR whose body carries `Roadmap-Ref:` and a
  `Movement proposal: ns:<slug>#Pn N% -> M% — evidence: …` line, and (5) full stop — no merge, no
  `status.jsonl`, no northstar/roadmap edits, no unplanned work. The **runner verifies** each
  clause after exit and emits the report beads (`session-start/close`, `pr-created`, `task-done`)
  itself, so the Dolt record is deterministic rather than model-dependent — and `bead_events`
  gains rows as a by-product of every dispatched slice (closing the cockpit's liveness gap).
- **The runner is morning-invoked** (a CLI the human starts, surfaced as `/day-run`), not a
  daemon. An always-on host (launchd / the Pi) is a later slice, after the loop earns it.
- **Runner substrate trust envelope (Gate 0).** Sessions run
  `--permission-mode bypassPermissions` inside the isolated worktree; the containment is
  branch-only work + the human merge gate, not tool-level permission prompts (which cannot be
  answered headlessly). Tightening to sandboxed execution is a candidate promotion alongside
  gate-1 (adr:progressive-autonomy-gates).

## Consequences

### Gains
- The cockpit becomes a real control plane without violating its read-model posture: staging =
  compile + ready-flip + claim, all through existing core verbs.
- Every runner slice produces the full observable trail (branch, PR, beads, events, proposal) —
  `/resume --verify` can corroborate a runner day exactly like a human day.
- Contention, crashes, and abandonment are already handled by the queue's lease + sweep design.

### Costs
- `bypassPermissions` inside a worktree is containment by convention, not enclosure — a
  misbehaving session could reach outside its tree. Accepted at Gate 0 (small blast radius,
  human merge gate, logs retained); revisit with sandboxing at gate-1.
- Headless sessions cannot ask questions; under-specified slices fail their gate instead of
  clarifying. Mitigation: the brief template forces deliverable/success/entrance to be written
  down before a slice can be `ready`.

### Neutral
- Verdicts are printed and logged (`~/.cache/day-runner/logs/`); a failed slice keeps its lease
  until sweep reclaims it — visible in the cockpit as claimed-but-stale, which is honest.
