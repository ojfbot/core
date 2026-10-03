# ADR: Bounded correspondence and evidence contract for the core pilot
slug: correspondence-speech-act-tiers
serial: draft
rev:
Date: 2026-09-24 (scope narrowed 2026-10-02)
Status: Proposed
domain: gas-town-governance
type: architecture
OKR: ns:l2-ojfbot#P2
Commands affected: future fleet-runner correspondence; existing commands retain their contracts
Repos affected: core (proposed pilot contract); consumers remain subject to separate decisions
traces:
  relates-to: []

---

## Context

Core needs a bounded contract for the correspondence and evidence a governed fleet-runner
pilot would use. The original #495 draft proposed fleet-wide bead/memo unification, GitHub
issue-minted identity, a generated register, schemas, hooks and a LEGO cutover. Current
registered work does not establish the necessity of that entire program.

[adr:fleet-runner-in-core](0108-fleet-runner-in-core.md) assigns shared correspondence,
authorization semantics, identities and review contracts to core; execution admission,
attempts, publication and recovery to fleet-runner; credentials and runtime identities to
its deployment. [adr:fleet-runner-publication-hold](0109-fleet-runner-publication-hold.md)
accepts an affected-item hold during uncertain publication. Both name #495 as the venue
for the governed-pilot contract; neither accepts its proposed mechanisms.

Registered `rm:rm-l2-ojfbot#S25` asks for a day-runner operating-mode decision with an
allowlist/spend cap and one real PR carrying checks and trace evidence. That narrower
criterion does not require this broader correspondence replacement. Its overlap with
fleet-runner must be reconciled before dispatch. The continuing
[wayfinder map](../wayfinder/control-plane-conductor.md) retains open authority, evidence,
consumption, portability, overlap and independent-supervision decisions under #307.

[#501](https://github.com/ojfbot/core/pull/501), inspected at `80036b3a`, proposes
informational skill-observation reports with pinned claims, corrections, remote readback
and consumption evidence. It explicitly treats #495 as proposed and requests a stronger
human-authority prerequisite. It is a proposed consumer, not evidence of acceptance.
[#502](https://github.com/ojfbot/core/pull/502), inspected at `a0b0db5`, registers a
read-only Codex-loop observation path; it does not require a correspondence cutover.

### Evidence from play-well

The existing lvp correspondence system provides real lessons about collisions,
review-state pins, register contention and unsupported authority claims. It also already
supports its registered decision/procurement provenance needs. No current requirement
inspected makes its replacement a prerequisite for the October procurement gates.

Recounted at lvp `0cf92a3d05acf4f404377788112e7767ff4de782`:

| Measure and denominator | Value |
| --- | --- |
| Top-level CORR-/HANDOFF-/REVIEW- Markdown files, revisions counted separately | 23 files; 638,374 bytes |
| Committed files under correspondence/register/versions/ | 32 |
| GitHub pull requests created through 2026-09-24 UTC | 27; #20/#22 are issues, #31 is later |

At core main `e90d0621`, five tracked `scripts/*-lint.mjs` entry points exist: bead,
defects, loops, northstar and roadmap. A tracked case-insensitive content search for
`correspondence` matches two files at original base `5b43c97` and seven at `e90d0621`.
The original fleet census has no available committed manifest/count recipe; its
207/14/~160/type subtotals are author-reported historical evidence, not verified counts.
They are not a rollout justification.

lvp's corrected CORR-029/register record says six reviewed commits were absent from a
fresh clone but retrievable through the hosting platform's PR API/direct lookup. The
problem is repository reconstruction depending on vendor retention, not proven loss of
those SHAs. Preserve exact reviewed evidence rather than promising git alone can recover
all relevant events or prove a report was consumed.

## Proposed decision

**Limit this draft to a core pilot's work/revision references, authored claims,
evidence-derived assessments, trustworthy authority prerequisites and delivery receipts;
defer shared grammar, schema implementation, register automation and fleet migration.**

The operator authorized preparing this narrower draft on 2026-10-02. That scope choice
is not ADR acceptance, approval of the unresolved policies below, or implementation
permission. The filename/slug remain stable so existing references retain their venue.

### D1. Preserve existing artifacts; distinguish claims from outcomes

Existing beads keep their schema, terminology and lifecycle. An informational report
states claims, evidence, limits and corrections. A binding request names its recipient,
exact subject and requested act; it is not operative merely because an agent labels it a
work order, review or ruling. No common grammar or tier-subtype relationship is selected.

### D2. Issue creation does not promote an artifact or authorize work

Creating or attaching a GitHub issue is a tracking/publication operation. It does not
convert a bead or informational report into an operative request. Receiving a document,
reviewing it, accepting it and authorizing execution are separate facts requiring their
own applicable evidence and authority.

### D3. Separate logical identity, revision identity and remote references

A pilot must correlate a correspondence artifact to its work item and exact subject
revision without depending on a mutable filename, title or GitHub issue locator.
`owner/repo#N` is a location/display reference: transfer can change its repository/number
and deletion can remove remote evidence. An API object identifier alone is not a retained
evidence or recovery policy. Preserve observed remote references and provenance; do not
silently re-key an existing work item after transfer, retries or duplicate publication.

The identity mechanism and canonical-state owner remain open. The
[duplex-work-item-sync draft](draft-duplex-work-item-sync.md) proposes beads canonical
and issues mirrored, but is itself Proposed. This draft neither reverses nor accepts
that proposal. Before pilot acceptance, choose whether correspondence is evidence attached
to an existing work item or a separately identified object, define the mapping and
reconcile both proposals with adr:fleet-runner-in-core's single execution authority. No issue-per-artifact
requirement is imposed here.

### D4. Projections need pinned evidence, not an authored register

If the pilot displays a derived view, it must identify the subject revisions, source
observations, derivation policy and evidence limits used. A projection cannot become an
independent execution-state owner. No automatic register, committed cache, post-merge
writer or equality-to-lvp-register promise is included in this proposal.

### D5. Lifecycle and dates have explicit sources

Authored input carries intent, claims and evidence references. Verified lifecycle,
review outcome, delivery and consumption are assessments based on applicable evidence;
an agent's authored status string is not proof of them. Existing bead status fields retain
their existing meaning and do not become pilot-authority fields by reinterpretation.

Before accepting a pilot profile, declare its lifecycle events, precedence, authorized
writers and unknown-result behavior. Distinguish an authored statement date from observed
creation, collection, publication and landing times; retain their origins. This draft
selects no replacement date field, lifecycle enum or revision-counting algorithm.
A ruling that merely names an artifact cannot establish acceptance of its exact revision.

### D6. Availability, delivery and consumption require distinct evidence

A committed file establishes availability at a repository/path/revision. It does not
prove receipt by a recipient without repository access. Identify the exact bytes and
channel used; a remote publication receipt must identify the actual remote object and
independent readback of the intended revision. A prepared body, subprocess success or
publisher self-claim alone does not demonstrate delivery. Receipt likewise does not prove
that a human read or acted on the artifact; consumption needs attributable response or
consumer evidence referring to the exact subject.

This requirement does not abolish lvp's repository-native/attachment transfer lanes or
hash requirements. Publication requests remain subject to their existing grants and
adr:fleet-runner-publication-hold's unknown-outcome hold. A receipt cannot release that hold without accounting
for other outstanding conflicting requests under the applicable reconciliation policy.

### D7. Human authority remains gated on a trustworthy boundary

GitHub authorship authenticates the transmitting account. Agents and the human operator
share `ojfbot`, as lvp issue #30 explicitly discloses. A comment URL, actor field, commit
trailer or branch-protection check cannot distinguish the human's ruling from an agent's
write using that account. Distinct agent accounts alone also do not establish the whole
grant, delegation and revision-binding model.

Before the pilot can treat a ruling as verified human authority, a separately approved
mechanism must bind the human decision to its exact subject revision, scope and permitted
act through a boundary the acting worker cannot forge. Verification must address
replayed evidence, changed subjects, scope changes/revocation and worker-originated writes
through shared credentials. Missing or inconclusive proof stays unverified and cannot
establish authorization. Select and demonstrate the mechanism in the existing authority
venue; this draft chooses neither signatures nor credential architecture. It grants no
merge or ratification permissions.

### D8. Authored records and assessments have different writers

Claims and submitted evidence remain distinguishable from verifier assessments and
rendered views. Authored outcome assertions cannot be accepted as derived verification.
Assessment provenance identifies the subject revision, evidence, method, policy version,
coverage and verifier; an attributed logical actor and authenticated transmitting account
remain separate. An actor label or strict record shape never grants a role permission.
Who may assess, and how their independence is established, remain pilot prerequisites.

### D9. Exchange schemas and tooling are deferred

No TypeBox package, generated JSON Schema/types, validator or writer API is selected or
authorized. A later bounded profile may propose an exchange format when its actual
consumers and acceptance checks are known. #501's D8–D10 adaptations remain proposals.

### D10. Evidence obligations precede enforcement claims

A later approved proof must exercise positive and counterexample cases for each claimed
control and demonstrate nonzero executed cases. Required scenarios include a worker posting
as the operator's account, a ruling for a different revision, an issue transfer/deletion,
an unavailable remote check and an unknown publication outcome. Fixtures alone cannot
prove the chosen deployed credential boundary. This is a verification obligation, not
permission to build a validator or run a live experiment.

### D11. Acceptance and execution are separate gates

Before claiming an operative pilot contract, resolve the identity/canonical-state and
human-authority choices, specify the bounded profile and obtain explicit acceptance.
Before any experiment or implementation, obtain its own authorized scope, owner,
registered roadmap reference and checks; reconcile S25's overlapping remit. A reference
from adr:fleet-runner-in-core / adr:fleet-runner-publication-hold or #501 clears none of these gates. Runtime enforcement needs separate
proof; a drafted or accepted contract does not demonstrate deployed behavior.

lvp and play-well-library are not migration targets under this proposal. Any later cutover
must follow lvp CORR-021 §D as amended by CORR-022: full proposed contract, explicit steward
responses, operator ratification, declared migration and capable validation. Silence is
not assent; their current operative protocol and tooling remain in force.

### D12. Offline structure and remote verification are separate

Offline checks may establish record shape and local references. Live GitHub verification
or declared retained observations are needed for remote existence/content/account claims.
A future profile must state evidence freshness/snapshot policy, access requirements,
API failures, unavailable/deleted sources and replay handling. A shape pass cannot upgrade
unknown authority or delivery to verified. This draft grants no library or network
exception to existing lint conventions; tooling exceptions require their own decision.

## Deferred broader proposal

The original [draft at PR head 62d7d7a](https://github.com/ojfbot/core/blob/62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb/decisions/adr/draft-correspondence-speech-act-tiers.md)
remains historical design input. Its D labels above retain citation continuity while
changing the proposed acceptance scope: D1/D2 no longer unify/promote beads; D3 leaves
identity open; D4/D5 remove automatic-register/complete-derivation claims; D6 retains
channel-specific evidence; D7 replaces account-authorship sufficiency with an unresolved
authority prerequisite; D8 keeps claim/assessment separation; D9/D12 defer implementation
and exceptions; D10 retains proof obligations; D11 replaces S0–S5 with prerequisite gates.

Fleet-wide grammar, automatic issue minting, register generation/publishing, hook
installation, cockpit rendering and Python-tool retirement are deferred, not future
promises of this ADR. Reviving any of them requires a demonstrated consumer need and a
separately reviewed scope. This draft does not claim to solve the bead closure loop,
prove human consumption, or preserve compatibility through an unimplemented parser.

## Consequences

### Gains

- Pilot consumers have a bounded decision venue without adopting an entire fleet program.
- Shared-account authorship and authored status can no longer be presented as sufficient
  proof in the proposed contract.
- Existing work identities, bead consumers and play-well protocols avoid an implicit cutover.

### Costs

- The governed pilot remains blocked until identity, authority and its operative profile
  are accepted and demonstrated; narrower scope does not supply those proofs.
- Evidence retention, revision mapping and trustworthy verification still require real
  design and later implementation effort. Unavailable evidence can leave outcomes unknown.
- #501 must reconcile its profile against the accepted version when one exists.

### Neutral

- adr:fleet-runner-in-core's ownership boundary and adr:fleet-runner-publication-hold's affected-item hold remain operative.
- Existing commands, schemas, deployment, queue and roadmap state are unchanged.
- A broader coordination program can be reconsidered when actual demand justifies it.

## Alternatives considered

| Alternative | Why not selected for this draft |
| --- | --- |
| Accept the original fleet-wide proposal | No registered near-term work establishes a need for all mechanisms; authority/identity and compatibility claims are unresolved. |
| Close #495 and create a new bounded-contract venue | Valid, but creates reference migration across adr:fleet-runner-in-core / adr:fleet-runner-publication-hold, #307 and #501 without a demonstrated need for a second venue. |
| Keep the original proposal indefinitely on HOLD | Preserves scope ambiguity and does not resolve the substantive backlog. |
| Treat shared-account comments as human approval | An agent can produce the same authenticated authorship; fails the required human boundary. |

## Open decisions before acceptance

1. **Human-authority boundary:** separately authenticated human grants with protected,
   revision-bound evidence, or keep human rulings outside automatic verification and keep
   the governed automated pilot blocked. Exact mechanism and counterexample proof remain open.
2. **Identity and canonical state:** attach correspondence/evidence revisions to existing
   canonical work items, or define separate stable correspondence identities with an explicit
   mapping. Reconcile the duplex-sync draft; no automatic transfer of state ownership.
3. **Bounded profile:** its event/date meanings, authorized writers/verifiers, evidence
   retention/freshness, remote-error behavior and publication/recovery reconciliation.

The scope choice to prepare this draft resolves none of these decisions. Register delivery
only after their applicable acceptance and experiment/implementation authorizations.

## Sources

- [adr:fleet-runner-in-core](0108-fleet-runner-in-core.md),
  [adr:fleet-runner-publication-hold](0109-fleet-runner-publication-hold.md),
  [duplex-work-item-sync (Proposed)](draft-duplex-work-item-sync.md).
- [Registered roadmap](../northstar/roadmap-l2-ojfbot.md),
  [continuing wayfinder](../wayfinder/control-plane-conductor.md).
- [adr:stable-identity-and-facet-tags](0087-stable-identity-and-facet-tags.md),
  [adr:session-beads-meta-coordination](0040-session-beads-meta-coordination.md),
  [adr:control-gated-slices](0086-control-gated-slices.md),
  [adr:defect-ledger-and-closure-loop](0104-defect-ledger-and-closure-loop.md).
- lvp at `0cf92a3`: `docs/correspondence/REGISTER.md` Rule 11 and Rules 14/17/18;
  CORR-021 §D, CORR-022, CORR-027/028/029, HANDOFF-032-R1 and `register/versions/`.
- [lvp tracking #30](https://github.com/ojfbot/lego-village-pipeline/issues/30)
  (tracking only; account/actor disclosure and original artifact hash),
  [independent Claude review](https://github.com/ojfbot/core/pull/495#pullrequestreview-5398642713).
- [#501 profile at the inspected revision](https://github.com/ojfbot/core/blob/80036b3a42dd42a01fb4ae432f3c55e62e2bde19/decisions/fleet-runner/skill-observation-correspondence.md).
- [GitHub issue transfer](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/transferring-an-issue-to-another-repository)
  and [issue deletion](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/deleting-an-issue).

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 83fc432 (empty commit; base 5b43c97) |
| Reviewed original PR head | 62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb |
| Isolated repair baseline | e90d0621741e227375c1265d424ba5cf26526aad |
| Scope preparation | Operator chose KEEP AND REPAIR with bounded pilot scope on 2026-10-02; acceptance and unresolved policies remain pending |
| PR number | #495; Proposed documentation only, not ADR acceptance |
| Inspection commit | Not applicable; documentation-only preparation, no existing runtime surface changed |
| Implementation start | Not applicable; no pilot implementation authorized or performed |
| Implementation end | Not applicable; no pilot implementation authorized or performed |
| Convoy id | |
