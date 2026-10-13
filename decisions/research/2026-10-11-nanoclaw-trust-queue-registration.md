# NanoClaw trust, queue, and evidence research registration

Date: 2026-10-11

Status: supplemental research input

Registry: [core #528](https://github.com/ojfbot/core/issues/528)

Receiving initiative: [fleet-runner #307](https://github.com/ojfbot/core/issues/307), `ns:l2-ojfbot#P2`

Inspected core revision: `8a70a5f43fc970d016659cd3544ff381db80745c`

This record connects the NanoClaw interview and current-source research to existing decisions,
issues, and pending delivery work. The operator authorized research filing and these links on
October 11. Filing establishes availability of research. It does not accept a design, qualify a
runtime, amend an accepted decision, authorize publication, or promote a roadmap slice.

The [file-canonical fleet-runner map](../wayfinder/control-plane-conductor.md) retains decision
ownership and its existing dependencies. The four new lanes supplement that map. They are not
replacement decision tickets or a second execution program.

## Research lanes and receiving decisions

| Lane | Research question and completion evidence | Existing receiving issues |
| --- | --- | --- |
| [#529: transactions and state](https://github.com/ojfbot/core/issues/529) | Compare the existing Dolt path, one host-owned SQLite execution store, and separate runtime/history stores. Name every authoritative writer. Test lost updates, identical claim values, counters, transaction/event/outbox boundaries, commit failure, unavailable storage, backup, and restoration in isolation. | [#310](https://github.com/ojfbot/core/issues/310), [#311](https://github.com/ojfbot/core/issues/311), [#315](https://github.com/ojfbot/core/issues/315), [#316](https://github.com/ojfbot/core/issues/316), [#317](https://github.com/ojfbot/core/issues/317), [#318](https://github.com/ojfbot/core/issues/318), [#505](https://github.com/ojfbot/core/issues/505), [#510](https://github.com/ojfbot/core/issues/510) |
| [#530: leases, fences, and publication](https://github.com/ojfbot/core/issues/530) | Test a worker that survives expiry, renewal, stale completion, cancellation, delayed publication, and restart after remote success. Keep logical operation identity separate from attempt generation. Observe the external sink and retain the accepted unknown-outcome hold. | [#313](https://github.com/ojfbot/core/issues/313), [#316](https://github.com/ojfbot/core/issues/316), [#318](https://github.com/ojfbot/core/issues/318), [#505](https://github.com/ojfbot/core/issues/505) |
| [#531: tags, state, and serial allocation](https://github.com/ojfbot/core/issues/531) | Inventory actual keys, namespaces, values, cardinality, writers, and selectors. Separate classification from lifecycle, queue membership, eligibility, evidence, and authority. Test malformed enums, terminal correction, stale label events, and two branches allocating the same display serial. | [#524](https://github.com/ojfbot/core/issues/524), [#512](https://github.com/ojfbot/core/issues/512), [#513](https://github.com/ojfbot/core/issues/513), [#516](https://github.com/ojfbot/core/issues/516), [#517](https://github.com/ojfbot/core/issues/517), [#520](https://github.com/ojfbot/core/issues/520), [#505](https://github.com/ojfbot/core/issues/505) |
| [#532: sandbox and mailbox boundaries](https://github.com/ojfbot/core/issues/532) | Compare Docker, Apple Container, and current host execution. Pin the runtime and filesystem topology. Test headless restart, mounts, egress, secrets, process death, read-only enforcement, every mailbox writer, stale visibility, and hot-journal recovery on the target host. | [#308](https://github.com/ojfbot/core/issues/308), [#309](https://github.com/ojfbot/core/issues/309), [#311](https://github.com/ojfbot/core/issues/311), [#313](https://github.com/ojfbot/core/issues/313), [#318](https://github.com/ojfbot/core/issues/318), [#511](https://github.com/ojfbot/core/issues/511) |
| Existing identity and exchange lane | Preserve logical author, process/session, authenticated publisher, verifier, human authority, exact subject revision, and evidence strength. Test forged, replayed, changed-revision, and revoked-scope records before an enforcing consumer relies on them. | [#511](https://github.com/ojfbot/core/issues/511), [#505](https://github.com/ojfbot/core/issues/505), [#513](https://github.com/ojfbot/core/issues/513), [#313](https://github.com/ojfbot/core/issues/313) |
| Existing verification and consumption lane | Keep trace correlation, operational health, schema conformance, and outcome verification separate. Derive adversarial cases from the stated invariants. Record the exact artifact, independent oracle, executed checks, limits, and resulting disposition to the original action. | [#510](https://github.com/ojfbot/core/issues/510), [#523](https://github.com/ojfbot/core/issues/523), [#318](https://github.com/ojfbot/core/issues/318), [#316](https://github.com/ojfbot/core/issues/316), [#512](https://github.com/ojfbot/core/issues/512), [#514](https://github.com/ojfbot/core/issues/514), [#515](https://github.com/ojfbot/core/issues/515) |

#524 remains the specific invalid-queue/audit-locked-correction defect. #531 supplies research
to that work without replacing its acceptance criteria. The existing decision venues retain
their owners. #313 supplies grants, revocation, budgets, and promotion policy. #311 and #318
supply storage, recovery, and independent supervision decisions before runtime acceptance.

## ADR references and status at inspection

The links below resolve stable `adr:<slug>` identities. Status describes the inspected source,
not a finding that the implementation enforces every sentence of the ADR.

| Stable identity | Status | Research input |
| --- | --- | --- |
| [adr:dolt-bead-store](../adr/0039-dolt-bead-store.md) | Accepted | #529 qualifies application transactions, commit ownership, and audit parity. |
| [adr:framebead-work-primitive](../adr/0016-framebead-work-primitive.md) | Proposed | #529 and #531 separate the work object, projections, and validated state. |
| [adr:dispatch-queue-and-day-runner](../adr/draft-dispatch-queue-and-day-runner.md) | Proposed | #529, #530, and #532 qualify the current runner. |
| [adr:duplex-work-item-sync](../adr/draft-duplex-work-item-sync.md) | Proposed | #529 and #530 test transactional outbox, causal revisions, fencing, and effect deduplication. |
| [adr:fleet-runner-in-core](../adr/0108-fleet-runner-in-core.md) | Accepted | #528 connects research to the assigned component and deployment responsibilities. |
| [adr:fleet-runner-publication-hold](../adr/0109-fleet-runner-publication-hold.md) | Accepted | #530 qualifies enforcement and reconciliation of the accepted affected-item hold. |
| [adr:g3-approval-queue-as-security-primitive](../adr/0024-g3-approval-queue-as-security-primitive.md) | Accepted, shell-specific | #532 and #511 examine approval boundaries. Shell behavior does not prove fleet-runner authority. |
| [adr:control-gated-slices](../adr/0086-control-gated-slices.md) | Accepted | #528 and #515 preserve qualification and promotion gates. |
| [adr:agent-bead-bridge](../adr/0043-agent-bead-bridge.md) | Accepted | #511 separates persistent role attribution from authenticated workload identity. |
| [adr:session-beads-meta-coordination](../adr/0040-session-beads-meta-coordination.md) | Accepted | #511 and #505 distinguish a session record from authority. |
| [adr:correspondence-speech-act-tiers](../adr/draft-correspondence-speech-act-tiers.md) | Proposed | #505, #511, and #529 address D3/D4/D7/D8/D11 prerequisites and evidence limits. |
| [adr:fleet-runner-skill-observation](../adr/draft-fleet-runner-skill-observation.md) | Proposed | #510 and #505 retain correction lineage, coverage, and separate authored/assessed records. |
| [adr:reserved-framebead-label-keys](../adr/0062-reserved-framebead-label-keys.md) | Proposed | #531 and #524 examine namespace ownership and validation before mutation. |
| [adr:stable-identity-and-facet-tags](../adr/0087-stable-identity-and-facet-tags.md) | Accepted | #531 tests the assumed acceptance serialization point while preserving stable slugs. |
| [adr:suggestion-identity-and-denominator](../adr/0093-suggestion-identity-and-denominator.md) | Accepted | #531 preserves source identity and declared measurement populations. |
| [adr:two-axis-review-hardening](../adr/0099-two-axis-review-hardening.md) | Accepted | #523 examines selectable executable review methods. |
| [adr:skill-action-instrumentation](../adr/0095-skill-action-instrumentation.md) | Accepted | #510 and #318 retain independent evidence and qualification limits. |
| [adr:vault-multi-surface-access](../adr/0070-vault-multi-surface-access.md) | Accepted | [selfco-box #5](https://github.com/ojfbot/selfco-box/issues/5) tests capture, commit, push, acknowledgment, and replay. |
| [adr:selfco-ingest-removes-draft-gate](../adr/0073-selfco-ingest-removes-draft-gate.md) | Proposed | selfco-box #5 distinguishes the present transport from historical ingestion policy. |

[Sandcastle D55/D56/D57](../adopt-stack/sandcastle.md) supply the sandbox, fresh-reviewer,
and completion/lifecycle research inputs. They are not evidence of a deployed enclosure.
The [recovered OPAV plan](../OPAV-LOOP-PLAN-RECOVERED-SUMMARY.md) records a historical S4
duplex queue and S5 autonomy program. Those section names are not `rm:rm-l2-ojfbot#S4`
or `rm:rm-l2-ojfbot#S5`. No runtime research slice is invented by this registration.

## Pending roadmap consumers

The [L2 roadmap](../northstar/roadmap-l2-ojfbot.md) retains its frontmatter and lifecycle.
These are research dependencies for future proposals, not new readiness conditions imposed here.

| Registered reference | Status at inspection | Receiving research |
| --- | --- | --- |
| `rm:rm-l2-ojfbot#S25` | ready, human_only, gate-0 | #529/#530/#532 inform operating mode, allowlist, spend, and the existing live proof. Reconcile the narrower day-runner criterion with #307 before dispatch. |
| `rm:rm-l2-ojfbot#S20` | queued | #510/#523 inform independent judge calibration. |
| `rm:rm-l2-ojfbot#S22`, `rm:rm-l2-ojfbot#S23` | queued | #510 informs capture quality and validator promotion. |
| `rm:rm-l2-ojfbot#S26` | queued | #510/#531 inform trace sampling, taxonomy, and proposal evidence. |
| `rm:rm-l2-ojfbot#S31` | queued | #510/#523 inform claim-versus-enforcement and the OPM verdict. |
| `rm:rm-l2-ojfbot#S32`, `rm:rm-l2-ojfbot#S33` | ready | #529/#531/#316 inform `.handoff` identity, liveness, and evidence-backed closure. |
| `rm:rm-l2-ojfbot#S37` | queued | #531 informs `governs:` and decision facets. |
| `rm:rm-l2-ojfbot#S38`, `rm:rm-l2-ojfbot#S39` | queued | #529/#531 inform generated projections and their promotion evidence. |
| `rm:rm-l1-core#S18` | queued | #510/#505 inform the [dispatch-channel experiment](../../.claude/roadmap.md). |

The pending local documents named with serials 0108 and 0109 concern different slugs from
the canonical fleet-runner ADRs. Their collision is evidence about divergent checkout
allocation. It is not proof that canonical main is damaged. This record uses the inspected
canonical slugs and leaves those pending documents untouched.

## Evidence pins and limits

| Source | Observation | Limit |
| --- | --- | --- |
| [Episode page](https://changelog.com/podcast/686) and [third-party transcript](https://podscripts.co/podcasts/the-changelog-software-development-open-source/from-zero-to-nanoclaw-interview), discussion around 02:18–02:21 in the linked transcript | Gavriel describes two directional session SQLite files and reports intermittent corruption in other modes he tried. Adam states a general SQLite preference. | Transcript renderings use different timings; the precise paragraph interval retained in local Apple TTML is not a timestamp in the linked public transcript. No error code, damaged-page example, failing mode, rate, or reproducible integrity test establishes the corruption class. The passage does not identify Agent Flow's database. |
| NanoClaw [cab10bbc9413a8d25c83a5302fddff06be2d6072](https://github.com/nanocoai/nanoclaw/commit/cab10bbc9413a8d25c83a5302fddff06be2d6072) | The [central SQLite composition](https://github.com/nanocoai/nanoclaw/blob/cab10bbc9413a8d25c83a5302fddff06be2d6072/src/db/compose.ts) enables WAL on writable connections; the [driver](https://github.com/nanocoai/nanoclaw/blob/cab10bbc9413a8d25c83a5302fddff06be2d6072/src/db/drivers/sqlite.ts) implements explicit transactions. [Worker mailbox connections](https://github.com/nanocoai/nanoclaw/blob/cab10bbc9413a8d25c83a5302fddff06be2d6072/container/agent-runner/src/mailbox/sqlite/connection.ts) select DELETE journals across the container mount. [Allocation](https://github.com/nanocoai/nanoclaw/blob/cab10bbc9413a8d25c83a5302fddff06be2d6072/container/agent-runner/src/mailbox/sqlite/operations.ts) uses `BEGIN IMMEDIATE`. | Central-store and mailbox assumptions differ. A read-only SQLite connection alone does not prevent a worker from replacing a mounted file. The [polling experiment](https://github.com/nanocoai/nanoclaw/blob/cab10bbc9413a8d25c83a5302fddff06be2d6072/scripts/sanity-live-poll.ts) was inspected, not executed on the target Mac mini. |
| NanoClaw [#2125](https://github.com/nanocoai/nanoclaw/pull/2125), [#2597](https://github.com/nanocoai/nanoclaw/pull/2597), [#4056](https://github.com/nanocoai/nanoclaw/issues/4056), [#2506](https://github.com/nanocoai/nanoclaw/issues/2506) | Reports distinguish sequence rejection, guest-read errors with healthy host files, hot-journal recovery stalls, and deduplication loss. | Reports are separate failure classes. Historical PR or issue status does not establish current code behavior or the guest's intended corruption claim. |
| Core at `8a70a5f` | [Generic store](../../packages/workflows/src/bead-store/DoltBeadStore.ts) commits before event insertion. [CLI](../../scripts/hooks/bead-emit.mjs) inserts events before commit. Whole-row updates, suppressed commit errors, and automatic writable filesystem fallback need qualification. `queue-renew` exists; [day-runner](../../scripts/day-runner.mjs) does not invoke it. | Source inspection is not a live Dolt contention or crash test. Dolt history and an application SQL transaction are distinct. |
| [MC-UX-01 R3 validation](../fleet-runner/mc-ux-01-validation-r3-2026-10-10.md), candidate `3c4c940` | A read-only run of the [checker](../../scripts/mc-ux-01-contract-check.mjs) passed 21/21 synthetic cases against manifest SHA-256 `b9aa0e1fdf9dbde3b9d0ad998d3de5c465daa8f9b7b60df8af8af2195437f73f`. #523's original bypasses were repaired in #522. | The checker validates declarations and relations. It does not authenticate a deployed producer or prove live publication, consumption, or settlement. The validation document reports 24 focused tests; this research did not rerun that suite. |
| [selfco-box transport guide at dc02fbf](https://github.com/ojfbot/selfco-box/blob/dc02fbfac910ca049a3762d28c43f4df337e63b1/docs/transport-setup.md) | The recorded deployed path captures raw input, commits/pushes it, then acknowledges the source. | selfco-box #5 qualifies the crash windows. Historical legacy incidents do not prove the present transport still has those defects. Disabled legacy rails remain outside this research scope. |

Primary mechanism references are [SQLite isolation](https://www.sqlite.org/isolation.html),
[WAL](https://www.sqlite.org/wal.html), [corruption mechanisms](https://www.sqlite.org/howtocorrupt.html),
[backup](https://www.sqlite.org/backup.html), [Dolt concurrency](https://www.dolthub.com/blog/2026-02-17-dolt-concurrency/),
[transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html),
[fencing guidance](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/),
[CloudEvents identity](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md), and
[GitHub labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels).

## Cross-repository consumers and retained research

[Selfco-box #5](https://github.com/ojfbot/selfco-box/issues/5) owns the transport replay study.
Morning-cockpit consumes source identities, claimed-state projections, and correction lineage.
Daily-logger consumes action identity, attributed decisions, delivery evidence, and original-action
settlement. Shell consumes approval boundaries through its existing G3 decisions. LEGO correspondence
provides documented parallel-allocation and register-finalization lessons. Gastown-pilot remains a
stub/read consumer, not a newly registered execution authority. The live consumer backlinks are
collected in #528.

The [selfco synthesis](https://github.com/ojfbot/selfco/blob/main/wiki/synthesis/nanoclaw-fleet-trust-and-queue-research.md)
and five source pages retain the longer research in the private vault:

- `wiki/sources/changelog-zero-to-nanoclaw.md`
- `wiki/sources/nanoclaw-sqlite-mailbox-code-2026-10-11.md`
- `wiki/sources/nanoclaw-sqlite-incident-history-2026-10-11.md`
- `wiki/sources/durable-queue-storage-primary-research-2026-10-11.md`
- `wiki/sources/fleet-runner-nanoclaw-research-session-2026-10-11.md`

Vault access is optional for public research workers. #528 and this registration expose the
source pins, questions, receiving decisions, and evidence limits needed to start a lane.

Each lane returns a falsifiable question, versioned sources, writer/authority inventory,
failure case, bounded reproducer, observed result or explicit unknown, alternatives and costs,
and a disposition to the named existing owner. A future runtime experiment or implementation
still needs its own scope and gates. Research availability does not clear those gates.
