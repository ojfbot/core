# ADR-XXXX: NAS tenant identity model — environment is the account, app is the folder, host is the operator
slug: nas-tenant-identity-model
serial: draft
rev:
Date: 2026-11-08
Status: Proposed
domain: meta
type: infrastructure
OKR:
Commands affected: none (bookcase backup keeps `--target <mount>`; future cards take a mount or a state folder as an argument)
Repos affected: core (fleet-runner service hosting), BookcaseDiscovery (backup target), any app that later writes to the home NAS
gate: owner creates the environment shares and accounts; first integration run passes verify
baseline: two per-host admin accounts, one encrypted data share, one app-state share (2026-11-07)
traces:
  supersedes:
  amends:
  relates-to: [fleet-runner-in-core]
  parent:
  part-of-series:

---

> Private details (the NAS's name, address, share names, account names, mount paths, keys) live only in the
> owner's vault entity page for the NAS. This ADR uses roles and counts. Nothing here is a credential.

## Context

The home NAS (a two-bay unit: a RAID 1 HDD mirror of about 2 TB usable, shared with other tenants, plus a
separate NVMe volume for app state and containers) came online on 2026-11-07. Two agent hosts, the Mac mini
and the laptop, each got **their own NAS account**, after a shared service account was created
and deleted the same day. The first fleet app now writes to it: `bookcase backup` (BookcaseDiscovery, merged
2026-11-08) puts versioned, content-addressed snapshots under its own `bookcase-discovery/` folder on a share
whose mount path it receives as `--target`. The Fleet Runner service container has been qualified in isolation
on the NVMe volume, so the NAS is becoming a **deploy target**, not only storage.

The owner asked for an account model that stays stable as apps arrive: cheap to add an app, cheap to add an
environment, bounded blast radius, clear audit, low tech debt. Two shapes were on the table: an account per
app, or an account per environment (`production` beside `integration`, so agents can verify a pre-release
build is non-breaking before promoting it).

Facts that constrain every option (read from the vault page, the DL-6 card and the merged backup docs):

1. **UGOS grants SSH only to Administrators**, and both host accounts are also in the `docker` group, which is
   root-equivalent on the appliance. Any identity that needs SSH is therefore root in practice, and isolation
   between such identities on the NAS is **advisory**. Real, enforced isolation exists only for **SMB-only,
   non-admin accounts**, and UGOS enforces it **per share** (read/write, read-only, none). Sub-folder ACLs are
   not relied on: the data share's root is world-writable (vendor default) and no ACLs are set.
2. **Agents never change NAS settings.** Accounts, shares, quotas, encryption and firewall are the owner's work
   in the UGOS web UI. Every account or share in a model is a manual owner step, repeated on every change.
3. The encrypted data share has **no auto-unlock**: after a NAS reboot it is locked until the owner unlocks it.
   `bookcase backup` already handles this (reports "mounted and unlocked?", exit 3, no retry, never creates the
   target folder).
4. `bookcase backup` writes **only inside `<target>/bookcase-discovery/`**, never overwrites, never propagates a
   delete, and prunes to `--keep` snapshots (default 4). Its never-delete guarantee rests on its own manifests,
   not on NAS permissions. Because the target is an argument, an environment can be expressed as a target
   subfolder or a separate mount **with zero code change**.
5. The laptop holds **no SMB credential by design** (owner, 2026-11-07); it works against the NAS over SSH as its
   host account. The Mac mini mounts the data share over SMB as its host account, as a Login Item.
6. Scale accepted by the owner for the grill (2026-11-08): at most about six apps and two environments in the
   next twelve months; integration data is small or synthetic, not a second production-sized copy.

Grill answers (owner, 2026-11-08, "go with recommendations"): (Q1) the NAS **must prevent** a pre-release build
from touching production data on the SMB path, accepting that admin SSH from the hosts bypasses it; (Q2) the NAS
**is a deploy target**, and a service running on it gets a container identity, never a UGOS login; (Q3) the
scale above.

## Decision

Three different things have been called "the account". We separate them:

| Axis | Unit | Mechanism | Who creates it |
|---|---|---|---|
| **Identity** (what a client authenticates as over SMB) | the **environment** | one SMB-only, non-admin UGOS account per environment: a production account and an integration account | owner, once per environment |
| **Ownership** (where an app's bytes live) | the **app** | one top-level folder per app inside the environment's share (`<env share>/<app>/`), created by the app on first write | nobody; it appears |
| **Operation** (SSH, Docker, repairs) | the **host** | the existing per-host admin accounts, unchanged; they are operator identities, not app identities | already exists |
| **Service identity** (a process that runs *on* the NAS) | the **app × environment** | a fixed non-root uid/gid per service in its compose file, state under the app-state volume's `<service>[-<env>]/` folder, bound to the NAS address; no UGOS login | the card that deploys it |

Concretely:

1. **One encrypted share per environment on the HDD mirror.** The existing encrypted data share *is* the
   production share; the owner creates a second encrypted share for integration. Each environment account has
   read/write on its own share and no access to the other. Both stay LAN-only with the vendor's cloud features off.
2. **Apps own folders, not accounts.** Adding an app to an environment costs nothing on the NAS: it writes into
   `<env share>/<app>/`. Adding an environment costs one share, one account and one keychain entry per host that
   mounts it.
3. **Credentials never reach a repo or an app.** The environment account's SMB password lives in the mounting
   Mac's Keychain (entered once by the owner through Finder's "Connect to Server", remembered, and mounted as a
   Login Item). Apps receive a **mount path as an argument** (DL-6's rule) and never see a password. Cards name
   the environment, never the mount; the conductor maps environment to mount from the vault page.
4. **Hosts keep SSH as operators.** The per-host admin accounts are for Docker control, rsync repairs and
   inspection. Their SMB access to the environment shares is set to *none* (read-only if UGOS does not let an
   admin be denied). Their root-equivalence is documented and accepted: a host is a trusted operator, so
   environment isolation protects against **mistakes in app code**, not against a compromised host.
5. **Services on the NAS get a uid, not a login.** Fleet Runner (and any later container) runs as its own fixed
   non-root uid, owns only its state folder on the NVMe volume, and an integration instance is a separate compose
   project with its own uid, folder and port. "App × environment" therefore exists for NAS-hosted services, for
   free, without UGOS accounts.
6. **Promotion is a data-gated step.** A pre-release build runs against the integration mount; it is promoted
   when its own verification passes there (for `bookcase backup`: `verify` and `restore-drill` clean on the
   integration share). Only then does the production schedule point the released build at the production mount.

## Consequences

### Gains
- **Enforced blast radius on the write path that matters.** A pre-release `bookcase backup` mounted as the
  integration account *cannot* prune or overwrite production snapshots, whatever its bugs. Today, as the host
  account, it can.
- **Adding an app is free on the NAS**; adding an environment is three owner steps. The cost curve is flat in
  the number of apps, which is the dimension that grows.
- **Audit by construction.** Every file is owned by the environment account's uid and sits under an app folder,
  so "who wrote what" reads as environment × app from `ls -l`, plus the app's own manifest. Operator actions
  show up under a host account over SSH.
- **Revocation is one switch per environment** (disable the account in UGOS) and one keychain edit per host on
  rotation. Host revocation is unchanged (remove its key line or disable its account).
- **Zero code change for the first tenant.** Production keeps the folder it already has; integration is a
  different `--target`.
- **Reboot behaviour is unchanged in kind.** A locked share still yields exit 3 and no retry; the owner now unlocks
  two shares instead of one, in the same UI session.

### Costs
- One more encrypted share to unlock after every NAS reboot, and one more Login Item per mounting host.
- Two Keychain credentials on the Mac mini instead of zero (today it mounts as its host account, whose password
  the owner typed once). The laptop stays SMB-free; its integration runs, if any, go over SSH and are advisory.
- The owner performs about eight UGOS steps once (below). Agents cannot do them.
- `ls -l` audit grain is environment × app, not app × run. Finer attribution stays in app manifests.
- Existing production files are owned by the host account's uid. With the share root world-writable this does
  not block the production account; if the owner ever tightens the share root, the app folder must be re-owned
  first (one `chown -R` as root on the NAS, owner step).

### Neutral
- The world-writable share root is left as is: with one account per environment, share-level permissions do the
  enforcing, and the root mode only matters among accounts already allowed into that share.
- "Integration" for the NAS means *a pre-release build's target*, not a copy of production data. Capacity
  planning for the mirror stays about production snapshots plus whatever a drill writes.
- Per-share quotas (if UGOS offers them on this firmware) are recommended on the integration share so a runaway
  pre-release cannot fill the mirror, and optional on production. Verify in Storage Manager; not assumed.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **(a) One account per app** (FleetRunner, HelpDesk, BookcaseDiscovery, …) | Every new app is owner work (account, password, share grant, keychain entry, mount) in the dimension that grows. It does not bound the failure that matters: an app's pre-release build and its production run share the account, so a bug still reaches production data. Any app that needs SSH (rsync from the laptop) becomes an admin, which is root, so the account isolates nothing there. Audit grain "app" is already given by the app folder. |
| **(c) One account per app × environment** | Twice the sprawl of (a) with the same SSH caveat. Correct in the abstract (least privilege per workload), wrong for a two-host, one-owner NAS where every account is a manual UI step. For NAS-hosted services this grain is adopted anyway, via container uids, where it costs nothing. |
| **(d) Per host, the current state** | Simplest, already working, key-only. But the host account is an admin and root through Docker, so it bounds nothing: a pre-release run on the Mac mini writes as the same identity as production and can prune production snapshots. Kept as the *operator* layer, not as the *app* layer. |
| **Single shared service account** | Created and deleted 2026-11-07. No attribution, one password for everything, revocation stops the whole fleet. |
| **Folders only, no second account** (environment as a target subfolder on the one share) | Zero owner steps and zero code change, but enforcement is convention: the same account can write anywhere on the share. Acceptable as an interim while the owner creates the integration share, not as the model. |
| **Sub-folder ACLs on one share** | Would avoid a second share, but the share root is vendor-default world-writable, no ACLs exist, and changing them is root work on the appliance that UGOS may rewrite on update. Share-level permission is the one control UGOS exposes first-class. |

## Migration from the per-host state

Order matters: nothing in production moves, so every step is reversible until step 6.

1. **Owner, UGOS:** create the integration share on the HDD mirror: encrypted with the owner's key, no auto-unlock,
   LAN-only, vendor cloud/relay off (same posture as the production share). Optional: a quota.
2. **Owner, UGOS:** create two SMB-only, non-admin accounts, one per environment. No SSH, no Administrators
   group, no `docker` group. Grant each read/write on its own share only. Set the host accounts' SMB access to the
   two environment shares to none (or read-only).
3. **Owner, Mac mini:** Finder → Connect to Server, mount the production share as the production account and the
   integration share as the integration account, "remember in Keychain", both as Login Items, at two mount paths.
   Tell the conductor the environment → mount mapping privately; it goes on the vault page only.
4. **Conductor, Mac mini:** run the pre-release `bookcase backup run`, `verify` and `restore-drill` against the
   integration mount. Report counts, bytes and seconds.
5. **Conductor, Mac mini:** point the weekly production run (when scheduled) at the production mount. The
   existing `bookcase-discovery/` folder and its snapshots stay where they are; only the mounting identity changes.
   First production run under the new identity: `verify` clean.
6. **Owner, Mac mini:** remove the old host-account SMB Login Item. The host account keeps SSH and Docker.
7. **Vault page:** record the two accounts, the two shares, the two mount paths and the unlock-after-reboot list
   (now two shares). **This ADR:** `/adr accept nas-tenant-identity-model`.
8. **Fleet Runner cutover card (later, Core #309 lineage):** fixed non-root uid, state under the app-state
   volume's service folder, published on the NAS address only; an integration instance as a second compose
   project. No UGOS account.

## Owner's manual steps on the NAS (summary)

| # | Where | Step | Once per |
|---|---|---|---|
| 1 | UGOS Storage | Create the integration share (encrypted, no auto-unlock, LAN-only) | environment |
| 2 | UGOS Users | Create a non-admin, SMB-only account for each environment | environment |
| 3 | UGOS Shares | Grant each account rw on its own share; host accounts none/ro on both | environment |
| 4 | UGOS Storage | Quota on the integration share, if offered | environment |
| 5 | Mac mini Finder | Mount each share as its environment account, Keychain, Login Item | environment × host |
| 6 | UGOS Storage | After every reboot: unlock both encrypted shares | reboot |
| 7 | Vault page | Record names, paths, unlock list | change |

## Vocabulary (proposed for core `domain-knowledge/GLOSSARY.md`; apply after acceptance)

- **Environment (NAS)** — the identity a client authenticates with over SMB and the share it may write:
  `production` or `integration`. One non-admin account per environment. Not a copy of data.
- **App folder** — `<environment share>/<app>/`, the one place an app writes on the NAS; created by the app,
  owned by the environment account. Unit of ownership and of `ls -l` audit.
- **Host account** — a per-Mac admin NAS account used for SSH and Docker. An operator identity; never used by
  an app as its own identity after this ADR.
- **Service identity** — a fixed non-root container uid/gid for a service that runs on the NAS, owning only its
  state folder. The NAS-hosted form of "app × environment".
- **Promotion (NAS)** — pointing a released build at the production mount after its own verification passed on
  the integration mount.

## Open questions

1. Does this UGOS firmware expose per-share quotas, and can an Administrators-group account be denied SMB access
   to a share? Both are owner readbacks in Storage Manager; the model does not depend on either, but the cost
   table does.
2. Does the laptop ever need an SMB credential for an integration run, or do all NAS-writing apps run on the Mac
   mini? Today: Mac mini only. If the laptop joins, it gets the same two Keychain entries (owner step), or stays
   SSH-only and advisory.
3. What is the promotion gate for apps other than `bookcase backup`? Proposed: each card names its own
   verification on the integration target, in the DL-6 pattern (verify + restore drill).
4. Does the `docker` group membership of the host accounts survive a firmware update (vault open thread)? If
   UGOS rewrites `/etc/group`, operator access breaks but nothing in this model does.
5. Off-site copy. RAID 1 plus versioned snapshots cover disk failure and mistakes, not fire or theft. Out of scope
   here; still uncovered (DL-6).
6. Retention and capacity per environment on a shared mirror: who owns the number (today `--keep 4` for one app),
   and should the integration share's retention be shorter by default?

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-11-08 owner request for an enterprise-grade account model after the per-host accounts and the DL-6 merge |
| Decision authority | Owner, grill of 2026-11-08 ("go with recommendations": enforce on the SMB path, NAS is a deploy target, ≤6 apps / 2 environments) |
| Acceptance scope | Identity, ownership and operator layers for fleet apps on the home NAS; migration order; owner steps. Not: off-site backup, VLAN/VPN reach, Fleet Runner cutover itself |
| Source baseline | BookcaseDiscovery main `0b2c1bb` (DL-6 merged); vault NAS entity page as of 2026-11-08 |
| Implementation start | _pending_ (owner steps 1–3) |
| Implementation end | _pending_ (step 6 and `/adr accept`) |

## Revision history

- 2026-11-08 — draft, after the owner's grill.
