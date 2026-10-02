# ADR-0109: Hold the affected item while publication is uncertain
slug: fleet-runner-publication-hold
serial: 0109
Date: 2026-10-01
Date accepted: 2026-10-01
Status: Accepted
domain: meta
type: policy
OKR: ns:l2-ojfbot#P2
Commands affected: future fleet-runner admission, reassignment and publication
Repos affected: core; consumers through the accepted execution contract
traces:
  relates-to: [fleet-runner-in-core]

---

## Context

A controlled publisher can send an authorized GitHub write and lose its response.
Until reconciliation, the executor cannot know whether the request failed, completed,
or may still complete. Reassigning the item or sending a conflicting publication can
create duplicate or competing artifacts and review duties.

The approved home and succession are recorded in [adr:fleet-runner-in-core](0108-fleet-runner-in-core.md).
This decision records only the operator's Q1 hold choice for the first pilot. It selects
neither a runtime nor a state store and proves no enforcement mechanism.

## Decision

**For the first pilot, block reassignment and conflicting GitHub publication for an
item while an earlier authorized write has an unknown outcome, until reconciliation
accounts for its outstanding effects. Unrelated independent work continues.**

The operator selected this policy on 2026-10-01, answering "Yes, hold the affected item"
after considering immutable successor outputs and later deduplication.

### Meaning of the hold

- The hold belongs to the affected logical work item. It blocks reassignment as well
  as conflicting publication; the pilot does not dispatch a local-only successor to
  bypass it. This deliberately sacrifices successor progress for that item.
- Timeout, lease expiry, publisher restart or a missing artifact on one read does not
  by itself resolve uncertainty. A deadline may prompt escalation; it cannot make an
  unknown write count as failed or release the hold by itself.
- Reconciliation must account for outstanding requests that could still create a
  conflicting effect. Observing one artifact does not settle other pending requests.
  Record real remote outcomes rather than denying them because local ownership changed.
- Other independent items may continue within their existing grants and dependency
  rules. This decision grants no additional execution or publication authority.

### Scope of acceptance and remaining decisions

Q1's hold policy is accepted. The authorization point, treatment of effects under later
scope revision or revocation, trustworthy grants, reconciliation mechanism, accountable
reopening authority and escalation deadlines remain to be decided. A request already
sent may complete remotely; that observation is not permission to accept its artifact
as compliant delivery or to settle the original item without the required review.

Older-backup restoration must separately address surviving workers, publishers, remote
effects and an old authority. Q3 retains its sole-authority and reopening decisions,
data-loss tolerance, recovery-time target and recovery owner. No numerical target is
selected here. The committed-history and vendor-independent reconstruction obligations
remain in #311/#318; neither ticket is resolved by this hold rule.

The affected item may remain blocked indefinitely when sufficient evidence is unavailable.
Any later exception to the hold needs an explicit human policy decision; silence or
pressure to restore availability is not an exception.

This policy does not approve a runtime experiment, register a delivery slice, mutate a
queue, deploy a service, permit private export or authorize automatic merge. Core #495
continues to gate the operative correspondence contract for the governed pilot. Isolated
experiments still need their own approved scope and registration. S25 must be reconciled
before overlapping implementation; its status and criteria are unchanged by this record.

## Consequences

### Gains

- Uncertainty remains visible rather than becoming an unsupported failure claim.
- A successor cannot compound an unresolved publication with conflicting work.
- Unrelated independent work can continue without pausing the whole fleet.

### Costs

- The affected item loses reassignment availability, including local successor progress.
- A sink outage or insufficient retained evidence can keep it blocked indefinitely.
- Publication and recovery implementations must retain enough evidence to account for
  outstanding effects before releasing the hold.

### Neutral

- Controlled publication and human merge remain required.
- Runtime, hosting, recovery mechanics and broader autonomy remain open.

## Alternatives considered

| Alternative | Why not selected for the first pilot |
| --- | --- |
| Reassign using immutable successor outputs, then deduplicate | Preserves progress but can still create duplicate PRs, notifications, review and cleanup duties; immutability alone does not prove one logical publication or original-item settlement. |
| Block conflicting publication but allow a local-only successor | Improves local progress, but is weaker than the operator's accepted reassignment hold and adds successor-adoption decisions. |
| Treat timeout as failure and retry or replace | A delayed request may still apply, so timeout alone cannot justify replacement. |
| Pause the entire fleet | Blocks unrelated independent work beyond the affected-item policy. |

## Verification obligations

The hold is a policy decision, not executed evidence. Before claiming enforcement,
an approved isolated proof must exercise these counterexamples with independent remote
readback and original-item observations:

- Send a request, change ownership, delay remote acceptance, lose the response and
  restart the publisher. Conflicting reassignment/publication must stay blocked while
  the outcome is unknown; reconcile any real remote effect before resolving the hold.
- Observe no artifact while the old request is still delayed. That single absence
  must not release the hold. Account for every outstanding conflicting request.
- Demonstrate that unrelated independent work can continue under its existing authority.
- At recovery integration, restore older state while newer actors, remote effects and
  an old authority survive. Demonstrate the separately accepted Q3 reopening rule;
  this document cannot substitute for that rule or its proof.

No such experiment ran for this record. Test scope, fixtures, numerical deadlines,
reopening authority and implementation checks require their later approved slices.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | core main 59d413a045345fad0e1a85bc3a2c512b0d91e354 after human merge of placement PR #497 |
| Decision authority | Human operator selected the affected-item hold for the first pilot on 2026-10-01 |
| Decision scope | Reassignment and conflicting-publication hold during unknown outcomes; unrelated independent work continues |
| Review context | Independent Codex challenge considered indefinite blocking, insufficient absence evidence and immutable successor outputs |
| Implementation start | Not applicable; policy documentation only |
| Implementation end | Not applicable; no runtime enforcement delivered |
| Continuing tracker | core #307; inherited decisions remain open |

## Sources

- [Continuing initiative #307](https://github.com/ojfbot/core/issues/307).
- [Merged placement and succession PR #497](https://github.com/ojfbot/core/pull/497).
- [Correspondence dependency #495](https://github.com/ojfbot/core/pull/495).
- [GitHub PR creation](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request)
  and [reference update](https://docs.github.com/en/rest/git/refs#update-a-reference)
  APIs. Their documented parameters do not carry the private executor's generation;
  inference: local ownership checks are not atomic sink enforcement.
