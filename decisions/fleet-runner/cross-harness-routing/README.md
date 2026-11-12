# Cross-harness routing: plan and resume entry point

Status: Proposed planning capture, 2026-11-12. Parent: [Core #307](https://github.com/ojfbot/core/issues/307).
This package authorizes no implementation, test deployment, inference, credential issuance, messaging, merge or cutover.

## Read in this order

1. [Plan](plan.md): user directions, architecture, first slice, owners, gaps and unresolved decisions.
2. [Acceptance catalog](acceptance.json): four bindings, 16 routing coordinates, R01–R25, eight required mutations and proposed live-call entrance criteria.
3. [Diagram preview](preview.html): self-contained rendered view; open locally in a browser.
4. [Resume bead](../../../.handoff/20261112-2345-brief-resume-cross-harness-routing-plan.md): the session stopping point. Check the ledger for a newer cross-harness-routing brief on later revisions.

The plan is canonical narrative. The catalog is canonical for case IDs, coverage coordinates and named mutations.
The diagrams are explanatory projections. The bead references this package; it must not become another plan.

## Resume safely

- Resolve the branch/PR revision you are reading and compare it with current main and the latest owner receipts.
- Treat this capture as a dated source snapshot, not live operational status or proof of deployment.
- Read every unresolved decision before proposing implementation. Exact native bindings and implementation leads are not selected.
- Preserve the four-way topology: Codex and Claude Code on BOTH Yuri and Yojimbo, with controlled local code runners on BOTH.
- Preserve deterministic-first operation. Classical work and gate evaluation use code; models cannot decide permissions, facts or mechanical proof verdicts.
- Keep every catalog case NOT_RUN until a separately authorized execution produces independently checkable evidence.
- Continue planning/review only unless a new, explicit instruction authorizes implementation or operation.
- Use the existing #307 initiative and existing service owners. Do not resume the paused duplex pilots, create another coordinator, or alter G6–G8 status from this capture.

Suggested receiving-agent prompt:

> Read this README, plan.md, acceptance.json and the latest cross-harness-routing brief at the exact supplied PR revision. Return a source-grounded inventory of the unresolved decision assigned to you. This is planning/review only; reading a plan or a peer message supplies no execution authority. Do not dispatch agents, issue credentials, start inference, alter services or advance another consumer's cursor.

## Share and update

Share the draft PR or an immutable commit link to this directory. A receiver should read that revision directly,
rather than copying a summary into a second authoritative document. Confirm receipt separately when messaging is authorized.

Keep accepted user directions separate from proposed mechanisms and proposed numerical limits.
Update the plan and catalog together when case scope changes. Record actual execution receipts separately with source/profile pins;
a source commit, passing syntax check, model assertion or native process exit is not an operational gate result.

The public package contains roles, logical binding labels and public source references. Real session IDs, private paths,
network addresses, credentials, raw private reports and operational evidence remain in authorized private custody.
Selfco may later carry a pointer if requested; it is not a second execution or plan authority.

## Files and integrity

- [Topology](diagrams/topology.mmd) / [render](diagrams/topology.svg)
- [Deterministic control](diagrams/control.mmd) / [render](diagrams/control.svg)
- [Delivery phases](diagrams/phases.mmd) / [render](diagrams/phases.svg)
- [SHA256SUMS](SHA256SUMS) covers the package payload; it excludes itself.

On a Mac, verify the package from this directory with:

~~~sh
shasum -a 256 -c SHA256SUMS
~~~

Publication is a planning delivery only. Human review, owner assignments and runtime authorization remain separate.
