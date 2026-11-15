# NAS applications-account migration: planning handoff

Status: planning input for the existing FleetRunner and HelpDesk conductors.
No live-operation authority is conveyed.

## Scope

The owner requested a dedicated deployment account, `applications`, and
application-owned storage outside workstation-account homes. Existing services
need a controlled migration; future services should begin with the approved layout.
The current instruction authorizes a sanitized draft PR and delivery of this handoff.
**No NAS changes are authorized. Keep Selfco paused.**

Canonical registration:
[Wayfinder — fleet-runner](../decisions/wayfinder/control-plane-conductor.md#nas-application-deployment-ownership-2026-11-12).
Retain #307, its existing decision venues, each service's delivery work and the current
conductor owners. Do not create replacement tickets or infer implementation completion.

## Planning inputs by owner

**FleetRunner conductor:** use existing receipts and authorized read-only access to
inventory deployment identity, daemon/context, runtime UID/GID, image digest, mounts,
queue/artifact references, lifecycle configuration, backup/recovery jobs and dependent
workers/observers. Plan how relocation preserves admission, leases, fencing/recovery
generation, accepted artifacts and stop controls.

**HelpDesk conductor:** reconcile the corresponding inventory for the service, object
store, journal, attachments, key registry, lifecycle, backup tiers and browser/MCP
consumers. Preserve stream identity, sequence, replay cursors, deduplication identifiers,
object integrity, device identities and client trust. Retain the
[existing HelpDesk map](https://github.com/ojfbot/LocalHelp/blob/main/decisions/wayfinder/helpdesk.md)
and [NAS runbook](https://github.com/ojfbot/LocalHelp/blob/main/docs/nas-runbook.md).

Return a proposed layout, unresolved decisions, service-by-service migration/rollback
ordering, and independent validation responsibilities. Keep actual host addresses,
private paths, credentials, session identifiers and operational receipts out of public
planning records. Inventory secret references and access requirements, never values.

## Existing decision ownership

- Hosting and reach (#309): supported locations, storage tiers, restart/unlock behavior.
- Authority (#313): attributable deployment access, administrative recovery, daemon
  privileges, restricted runtime UID/GID and secret-file access.
- Portability (#311): stable identity mappings, parameterized paths, deployment project
  identity, upgrade/rollback references and dependent consumers.
- Supervision/recovery (#318): permission checks before exposure, independent restore,
  rollback and restart evidence.
- Census (#315): complete dependency inventory and evidence of actual consumers.

Rootful Docker access is host-privileged. Renaming its operator does not contain that
privilege. Rootless Docker is a separate feasibility/authority decision; do not silently
bundle daemon replacement, networking changes or a new scheduler into relocation.
Application signing identities remain separate from the deployment account.

## Future qualification after separate authorization

1. Pin source/image/configuration references and establish a verified consistent backup
   and rollback point before any move.
2. Qualify the target account, directories and ACLs on the supported NAS platform,
   including persistence after reboot. File-mode changes alone are not proof.
3. Drain or stop one stack's writers, copy state consistently, verify integrity, apply
   reviewed UID/GID mappings and start the replacement. Never operate divergent
   writable copies as simultaneous authorities.
4. Verify native continuity invariants and actual client readbacks. A healthy container
   does not establish journal, queue, artifact or consumption correctness.
5. Verify restart without a workstation login, permissions immediately after boot,
   LAN/TLS boundaries, scheduled backups and independent restore from the new locations.
6. Retain the old stopped deployment for an agreed rollback period. After new writes
   have been accepted, rollback must reconcile them; restarting an older database can
   lose accepted work or fork history.
7. Update manifests, lifecycle/backup jobs, monitors and runbooks. Retire old paths or
   privileges only under agreed cleanup authority after the rollback window. New
   deployments use the approved profile from their first deployment.

Acceptance: services have explicit deployment ownership, runtime permissions, durable
storage and tested recovery, without workstation-home or login dependencies.

## Delivery and authority boundaries

Publication of this document does not prove recipient acceptance or completed work.
Record handoff delivery, receiver acknowledgement, planning disposition and any later
effect separately. Reconcile sequencing with the conductors' current work.

The complete audit stays private. This PR contains only the sanitized planning input.
Do not resume ingestion, run Sync, launch a client to trigger Sync or change NAS
configuration in order to read or acknowledge this handoff.

Start with /wayfinder; use /grill-with-docs for unresolved owner decisions. Implementation
returns to existing service delivery work after scope, entrance criteria and authority
are concrete.

## References

- [Existing tracker #307](https://github.com/ojfbot/core/issues/307)
- [Compute tracer #578](https://github.com/ojfbot/core/issues/578)
- [HelpDesk map #3](https://github.com/ojfbot/LocalHelp/issues/3)
- [Docker privilege model](https://docs.docker.com/engine/install/linux-postinstall/)
- [Rootless prerequisites](https://docs.docker.com/engine/security/rootless/)
