# /adopt-stack decision: mattpocock/sandcastle (@ai-hero/sandcastle)

Decided 2026-08-11. Candidate pinned at main `e99f832f26dc9d245c019a9ddd19fa5dee792427`
(repo, 2026-06-29); npm `@ai-hero/sandcastle@0.12.0` (MIT). Sibling record from the same
cycle: `pocock-triage-refresh.md` (D44–D53); numbering continues at **D54**. Framework:
`adr:wrap-absorb-reject`. **Decision-only pass** — no code lands from this record; every
ABSORB routes to named prior art as a roadmap-slice suggestion.

Sandcastle is Pocock's TypeScript framework for orchestrating sandboxed AFK coding
agents: `run()` / `createSandbox()` / `createWorktree()` over Docker/Podman/Vercel
providers, branch strategies (head / merge-to-head / named branch), prompt files with
`{{ARG}}` + !`shell` expansion, completion signals, schema-validated structured output,
session capture/resume/fork, lifecycle hooks. It is the downstream consumer of triage's
`ready-for-agent` state — the backlog-driven fan-out half of the supply chain whose
upstream half D44–D53 absorbed.

## Gate 0: LIBRARY-shaped by measurement; the contested role is APPLICATION-shaped

`measure-pkg.mjs @ai-hero/sandcastle` (registry, 2026-08-11), table verbatim:

| Signal | Measurement |
|--------|-------------|
| Unpacked size | 14 MB |
| Direct dependencies | 1 (`@clack/prompts`) |
| Transitive tree | unknown (registry-only pass; not installed) |
| Engines | — |
| Telemetry SDKs | — |
| DB drivers | — |
| Server / router | — |
| UI frameworks | — |
| Auth stacks | — |
| Native-build hints (direct) | — |
| Package's own install scripts | — |
| Ships a bin/CLI | yes |
| Application-shaped signals | 0/6 |

Clean by import surface: one dependency, no telemetry, no phone-home. But Gate 0's
library test asks what *role* the candidate takes, and the role sandcastle is built for —
the deterministic harness that owns agent control flow, worktree lifecycle, and merge-back
— is a role the fleet already staffs: **`scripts/day-runner.mjs`** (queue → CAS claim →
worktree outside `~/ojfbot` → parallel headless spawns → rendered brief → post-exit
contract verification + shadow checks → human merge at Gate 0). Adopting sandcastle as
the runner is an application-role adoption regardless of its package shape, and it
collides with three standing decisions: **ADR-0082** (default-deny on any fourth agent
mechanism — "don't add a mechanism the model's native delegation already covers"),
**`draft-dispatch-queue-and-day-runner.md`** (the runner's trust envelope and its
deliberate gate structure), and **DIA-CROSSCHECK-2026-07-08** (worktree-per-agent +
PR-level coordination already adjudicated *convergent* with SOTA — no action). So: the
harness role is REJECT; the remaining calls are per-opinion ABSORBs into the incumbent.

## Decision table

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D54 | Adopt sandcastle as the fleet's agent orchestrator (its `run()`/`createSandbox()`/`createWorktree()` API owning spawn, isolation, and merge-back) | **REJECT** | README + API docs → ADR-0082 fourth-mechanism trap; day-runner is the incumbent with fleet-specific machinery sandcastle cannot host (Dolt queue beads, `autonomy_fit` demotion, movement records, shadow-check RIDM gates). Re-platforming would trade a working, instrumented harness for a generic one and re-open every promoted gate. FLEET-COORDINATION §2 ("what NOT to import") applies. |
| D55 | OS-level sandbox providers: agent runs inside a Docker/Podman bind-mount container (worktree mounted, network/mounts/cpu declared per-run), provider swappable behind `createBindMountSandboxProvider` | **ABSORB — route to gate-1 sandboxing** | `sandboxes/docker` provider docs → the runner's known open gap: `bypassPermissions` in a worktree is "containment by convention, not enclosure" (`draft-dispatch-queue-and-day-runner.md:60–79`, which already names sandboxed execution a candidate promotion). Sandcastle's bind-mount pattern (host worktree mounted into a container; no sync step; commits collected on the host) is the reference design: it slots *under* the existing spawn without touching queue/claim/brief logic. Roadmap slice: wrap the day-runner spawn in a Docker bind-mount when a `--sandbox` flag is set; shadow first per ADR-0086. |
| D56 | Implement-then-review in one warm sandbox: `sandbox.run()` twice — implement on the working model, review on a stronger model — with `sandbox.exec()` verification gates between runs | **ABSORB — route to F4** | `createSandbox()` docs → F4 (`FLEET-COORDINATION-EXTENSIONS-2026-07-04.md:111`) already flagged exactly this: "implementation and review in separate fresh contexts, reviewer on the stronger model — worth copying." Local shape: a second headless pass in the day-runner after the slice contract verifies, fresh context, reviewing the diff against the brief before the PR posts. ADR-0082-compatible (a runner stage, not a new mechanism). Roadmap slice under F4; shadow-stage (review comments recorded, never blocking) before any gate. |
| D57 | Explicit completion signals (`<promise>COMPLETE</promise>` / custom strings, `completionTimeoutSeconds` grace for hanging children) + schema-validated structured output with bounded auto-retry | **ABSORB — route to day-runner hardening** | run-options docs → the runner infers completion from process exit + after-the-fact contract check; a declared in-band completion signal distinguishes "finished and says so" from "died silently", and the hanging-child grace period addresses the leaked-headless-process failure mode F10 documented (141 orphaned Claudes). Structured output is already covered natively where workflows run (Workflow tool schema forcing) — the absorb is signals + grace, not an output-schema layer. Roadmap slice: add a completion-signal line to the slice-boundary contract in `renderBrief()` + a grace-period sweep at timeout. |
| D58 | Backlog-driven spawn: prompt files with !`gh issue list --label ready-for-agent …` expansion — the tracker itself is the queue | **ABSORB the seam, not the mechanism — route to duplex sync** | prompt-system docs → nothing reads `ready-for-agent` GitHub issues back into the dispatch queue; `draft-duplex-work-item-sync.md` is the unshipped design for that bridge. D44–D53 just made `/triage` emit exactly what such an ingest needs (route label + brief + `check:` command). The absorb is the *flow* — tracker state feeding the queue — implemented on the roadmap-compile rail (issues → task beads), not via prompt-string shell expansion, which would bypass the queue's admission rule (`check:` or demoted). Roadmap slice under the duplex-sync draft ADR. |
| D59 | Session capture/resume/fork as first-class run options; interactive-then-AFK on one worktree (`wt.interactive()` → `wt.run()`) | **REJECT for the runner; no action** | worktree docs → resume-across-runs contradicts F6's recorded doctrine: "full context resets over compaction — fresh `claude -p` per iteration" (context poisoning risk in unattended loops). Interactive-then-AFK is already covered by the native EnterWorktree + orchestrate flow for attended work. Recorded so a future sync doesn't re-import resume into the unattended rail. |

## Integration shape

Zero packages enter the tree; zero code lands from this record. One REJECT of the
harness role (D54) and one REJECT of session-resume in the unattended rail (D59); three
ABSORBs routed as roadmap-slice suggestions into prior art that already owns each seam —
gate-1 sandboxing (D55), F4 reviewer split (D56), completion-signal hardening (D57) — and
one seam-level ABSORB (D58) into the duplex work-item-sync draft. Each slice enters
`needs-triage` like any other inbound work and must pass ADR-0086 shadow staging before
any enforcement. Upstream tracking: pin + this record, per ADR-0083; the v1-2 weekly
watch routine (D43) covers the sandcastle repo from this cycle forward.
