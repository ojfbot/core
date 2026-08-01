# DRAFT ADR — bead-substrate stability (Dolt as a data layer you can trust)

**Status: DRAFT** — plan staged 2026-08-01; no slice started. Gated-slice form (ADR-0086):
every slice ships shadow-first, promotion past each gate is a data-gated RIDM decision, and
the TPMs are written here, *before* any shadow runs (§4.4).

**Prompted by:** operator direction — *"I want Dolt running everywhere; it needs to be a
stable data layer."* This document first audits the pushback that reframed that ask, then
plans the stability requirement the audit left standing.

**Feeds:** wayfinder `control-plane-conductor` map — #309 (where the conductor runs),
#318 (who watches the watcher), #315 (census); S25 (day-runner operating mode).

---

## 1. Assumption audit

Every claim in the 2026-08-01 pushback, re-verified against the territory before planning
on top of it. Verdicts: CONFIRMED · SHARPENED (true, but the mechanism is more specific) ·
UNDER-CLAIMED (reality is worse than stated) · DOCTRINE (true by written convention, not code).

| # | Claim | Evidence | Verdict |
|---|---|---|---|
| A1 | Bead emissions fail silently (`\|\| true`) | `scripts/hooks/bead-session.sh:238–319` — every emit call wrapped `>/dev/null 2>&1 \|\| true`. **But** `bead-emit.mjs` itself is loud: `process.exit(1)` on every bad input (`:80–86` et al.). The silencing lives in the *shell wrappers*, not the emitter | **SHARPENED** — fix belongs in the wrappers; the emitter is already correct |
| A2 | `dolt-beads` has no verifier | registry entry: `verifier: "none today — T4 names the gap"`; nothing reads emission success | CONFIRMED |
| A3 | Fleet reads dead when Dolt is down | demonstrated live this session: `/api/fleet` → 35/35 dark, 0 beads, while `/api/control-plane` (file-spined) returned full data in the same request. Mitigated same day (`basis: 'no-data'`, morning-cockpit `68361de`) — mitigated ≠ solved: the data is still absent | CONFIRMED |
| A4 | Dolt can replicate like git | true of the product (remotes, `dolt backup`) — **but the cluster uses none of it**: zero hits for `dolt push\|pull\|remote\|backup\|clone\|dump` across `scripts/` and CI. `.beads-dolt` is one directory on one Mac | **UNDER-CLAIMED** — the store is not just unreachable off-box; it has **no second copy anywhere**. G0 below |
| A5 | CAS queue-claim is real and files can't do it | `bead-emit.mjs:876–916` — one atomic conditional `UPDATE` (compare-and-swap on the queue lane), self-expiring lease, `affectedRows===0` = lost race, `queue-sweep` reclaims | CONFIRMED — this is the part of Dolt that earns its keep |
| A6 | Beads are projections; files are canon | `/day-run`: *"the compiled bead is a projection … never by hand-editing beads"*; same rule for wayfinder maps and roadmaps | DOCTRINE |
| A7 | selfco is file-canonical by design | `selfco/CLAUDE.md`: markdown vault, GitHub mirror as hub, connector reads, LiveSync — the properties beads would break | DOCTRINE |
| A8 | A loud-failure ledger already has precedent | `reconcile-skill-acted.mjs:333` appends `reconciler-dead` events to `~/selfco/tracking/loop-health.jsonl`, with tests. DS1 reuses this pattern and file | CONFIRMED |

**Net effect on the plan:** A1 narrows DS1 to the wrappers. A4 adds G0 — durability — which
outranks every reachability concern: *a data layer with one copy is not stable no matter
where it can be reached from.*

## 2. The stability requirement, stated properly

MOE (what the operator means): **work recorded through beads is never silently lost, and its
health is legible from any vantage.**

Decomposed into measurable properties (TPMs at each gate below):

- **P-durable** — a second copy of the bead store exists, is fresh, and is *proven by
  restore*, not by the backup command exiting 0.
- **P-loud** — a failed emission always leaves a local trace; loss is measured, not assumed.
- **P-legible** — bead-store health is readable from a vantage that does not require
  `127.0.0.1:3307` (committed digest → cockpit pane 08 `file:` scheme; conductor-readable).
- **P-honest-degradation** — consumers distinguish "store down" from "no data" (shipped for
  the Fleet pane 2026-08-01; the contract generalizes).

Explicitly **rejected** as the mechanism: "Dolt sql-server on every host." Reach follows from
replication/digests, not from multiplying always-on servers (which would multiply the exact
unwatched-rail failure A2 names). "Dolt everywhere" resolves to **"the bead data everywhere
it's needed; the server only where writes happen."**

## 3. Gap register

- **G0 — no second copy.** No backup, no remote, no dump. Single disk. (A4)
- **G1 — silent write path.** Wrappers swallow every emission failure. (A1)
- **G2 — no verifier on the always-on rail.** Nothing measures emission loss; the registry
  says so itself. (A2)
- **G3 — spine invisible off-box.** Bead-store state unreadable from cloud sessions/routines;
  pane 08 shows the probe DOWN and nothing more. (A3, prototype finding #4)
- **G4 — substrate default undecided.** Server-mode vs replicated-mode for off-box agents is
  exactly wayfinder #309 / S25 Option C's split-brain question — a decision, not a build.

## 4. Gated slices

Order is dependency order; DS1→DS2 and DS3 are independent tracks. Every slice is gate-0
(human merges), shadow-first, and file-evidenced so pane 08 can watch it (`file:` scheme).

### DS1 — Loud wrappers (G1)
- **Deliverable:** `bead-session.sh` emit calls route failures to `~/selfco/tracking/loop-health.jsonl`
  (A8 pattern: `{ts, event: 'emit-failed', verb, repo, stderr_tail}`) instead of `\|\| true`.
  Still exit 0 — a failed emission must never break a session (shadow posture).
- **Entrance:** (a) the silent drop is **reproduced on the operator's Mac** — stop the Dolt
  server, run one real session, confirm the emission vanished with no trace anywhere (fixes
  land on demonstrated bugs, not narrated ones); (b) the existing hook test suite runs green
  locally, so the new test lands in a working harness; (c) `~/selfco/tracking/` exists and
  is writable from hook context (the `loop-health.jsonl` writer's own precondition).
- **Success:** a forced failure (Dolt stopped) leaves a ledger line; a
  normal session leaves none; session exit code unchanged in both cases.
  **Check:** hook test alongside `reconcile-skill-acted.test.mjs`.

### DS2 — Emission-loss verifier (G2 → the registry's missing `verifier:`)
- **Deliverable:** wrappers also append every *attempted* emission to a local intent ledger;
  a weekly reconciler (rides the existing `skill-architecture-audit` rail) diffs intent vs
  rows actually in Dolt → `loss_rate` line in a committed artifact. Two-source contract
  (ADR-0095 shape): the writer never grades itself.
- **Entrance:** DS1 merged. **Success:** first loss-rate artifact committed; registry entry's
  `verifier:` field updated to name it. **TPM (pre-committed):** loss < 1% over 14 days;
  if ≥ 1%, the *promotion is the fix work*, not a relaxed bar. Feeds #318.

### DS3 — Second copy, proven by restore (G0 — highest value, independent)
- **Deliverable:** nightly `dolt backup` (or dolt remote push; validate command surface on the
  Mac as step 1) on the existing launchd rail + a **restore drill**: restore into a scratch
  dir, `SELECT count(*)` sanity, append one line `{ts, backup_age_h, restore_ok, rows}` to a
  committed digest file in core.
- **Entrance:** (a) the installed Dolt's command surface is confirmed on the Mac —
  `dolt version` + `dolt backup --help` (if the installed version lacks `backup`, the slice
  re-plans onto `dolt push` to a file remote *before* any code); (b) store size and free
  space measured (`du -sh ~/.beads-dolt` vs destination headroom) — a backup that fills the
  disk is a new outage; (c) the backup **destination is chosen by the operator** (second
  local path is fine for the first gate; off-machine is a later gate, not a blocker);
  (d) does NOT wait on DS1/DS2 — durability first.
- **Success:** two consecutive
  drill lines with `restore_ok: true`. **TPMs:** backup age < 26h; drill passes on first
  *unattended* run. **Shadow note:** backup is read-only w.r.t. the live store — no
  enforcement stage needed; the drill IS the verifier.

### DS4 — Committed bead digest (G3)
- **Deliverable:** daily digest committed to core (rides the `sync-telemetry` rail — the
  proven "local publishes, cloud reads" pattern): row counts per table, last `bead_events`
  ts per repo, queue depth. Registry entry for `dolt-beads` gains a second, file-scheme
  `evidence_ref` so pane 08 and any conductor read real state from any vantage instead of
  UNVERIFIABLE.
- **Entrance:** (a) the rail it rides is proven alive — `telemetry/daily` has a commit
  < 48h old (a digest on a dead rail is a second corpse, the exact selfco failure mode);
  (b) digest schema agreed with the operator in one line (tables, per-repo last-event ts,
  queue depth — nothing that could leak bead *content* into a public repo);
  (c) read path confirmed read-only (SELECT-only queries, no verbs).
- **Success:** pane 08 renders dolt-beads freshness from the digest on a
  host where `:3307` is unreachable. **TPM:** digest age < 26h.

### DS5 — Substrate decision (G4 — RIDM gate, human, not a build)
- **The decision:** default posture for off-box/agent work — (a) digests-only (server stays
  Mac-local; cloud sessions read, never write beads), (b) Dolt remote replication with
  write-locality rules, or (c) hosted sql-server. Decide **with DS2/DS3/DS4 data in hand**
  (loss rate, restore reliability, digest sufficiency) + census #315.
- **Entrance:** DS2–DS4 each have ≥ 2 weeks of artifacts. **Output:** RIDM note (S16
  pattern), options rejected-with-reasons; updates wayfinder #309 and is S25 input.
  **Pre-commitment:** if digests turn out to answer every real off-box read, (a) wins and
  "Dolt everywhere" is closed as *satisfied by data, not by servers*.

## 5. Out of scope (re-affirmed, from the audited doctrine)

- Migrating selfco onto beads (A7 — different contract, deliberately).
- Inverting file-canon → bead-canon for work that has file sources of truth (A6).
- Multiplying always-on sql-servers across hosts (rejected in §2).
- Replacing the CAS/queue layer (A5 — it is the part that works; leave it alone).

## 6. Portability constraint (standing, from the conductor map)

Every artifact this plan produces is a committed file; every rail it rides already exists
(launchd + sync-telemetry). The only Dolt-specific surface added is the backup/restore
command pair in DS3, isolated in one script — swapping Dolt out later means swapping one
script and keeping every ledger, digest, TPM, and pane unchanged.
