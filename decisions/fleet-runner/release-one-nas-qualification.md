# Isolated NAS qualification (G3)

This is the G3 execution procedure following the corrected #586 candidate.
Refs #307, #578 and hosting #309. It does not merge the stack, switch the live
queue, install or replace Mac LaunchAgents, migrate HelpDesk, or unlock backups.
The appliance owner retains account, firewall, volume and reboot controls.

Use the exact image ID and source commit from a passing, retained G2 packaging
report. Use a clean checkout of this qualifier with its compiled client library,
Node 24.22.2 and pnpm 9.15.4. Keep Docker/Buildx tools task-local if the
workstation has no installation. `DOCKER_HOST=ssh://<approved-alias>` uses the
existing host key and agent access; no private SSH key is copied.

Set these privately; no concrete host identity, address, path or credential
belongs in this repository or a public receipt:

- `FLEET_NAS_SSH`: existing approved SSH alias.
- `FLEET_NAS_ROOT`: a **new** dedicated directory on the NAS NVMe filesystem.
- `FLEET_LAN_IP` and `FLEET_HOST_PORT`: LAN-only address and unused test port.
- `FLEET_IMAGE` and `FLEET_IMAGE_SOURCE_COMMIT`: G2 image/source identity.
- `FLEET_SOURCE_ROOT`: this isolated Core checkout.
- `FLEET_QUALIFY_CONFIRM=isolated-only`: explicit scope assertion.

Create a new private local evidence directory; it must not exist yet:

```sh
pnpm exec node scripts/fleet-runner/qualify-nas.mjs prepare "$FLEET_NAS_EVIDENCE"
pnpm exec node scripts/fleet-runner/qualify-nas.mjs run "$FLEET_NAS_EVIDENCE"
```

Preparation generates qualification signing keys on this workstation, transfers
only public verifiers, generates the separate TLS server key on the NAS, and
copies only its public certificate back. UGOS SFTP may expose a different
namespace from the SSH shell; the public-file transfers explicitly use SSH SCP
transport (`scp -O`). No private credential or TLS key is transferred.
`resume-prepare` may finish a failed preparation using the same persisted
manifest; it does not regenerate its identities. Review the manifest's state
before any retry. A failed in-progress trial must be reconciled, not blindly
readmitted or reset.

The service has fresh bind-mounted state/output, a read-only public registry
and TLS directory, an explicit host LAN publication, `unless-stopped` restart
policy and a 30-second stop grace. It is separate from every live queue and
credential registry. The client trusts the public certificate through a fresh
Node process using `NODE_EXTRA_CA_CERTS`; untrusted TLS must fail.

The runner completes ten fixed synthetic jobs. Each is independently compared
with fixed expected bytes from a read-only artifact mount. For each of ten
SIGKILL trials it measures recovery under 60 seconds, verifies all acknowledged
outputs and rejects a pre-crash signed request within its still-valid window.
It separately tests graceful stop/start, manual-stop behavior, replacement,
unwritable storage readiness, a future schema, a read-only output mount and a
missing owner verifier. Logs carry aggregate states and allowlisted codes only.

## Actual appliance reboots: owner action

The script **never reboots the appliance**. Container crashes and replacement
cannot stand in for three actual appliance reboots. Complete all non-reboot
checks first. Then coordinate each trial with the owner and other appliance
users. An encrypted backup share can remain locked after boot; qualification
does not unlock it or claim backup health.

For each of three trials, arm immediately before the owner reboots:

```sh
pnpm exec node scripts/fleet-runner/qualify-nas.mjs arm-reboot "$FLEET_NAS_EVIDENCE"
# Owner runs the appliance reboot through its approved UI or SSH/sudo session.
pnpm exec node scripts/fleet-runner/qualify-nas.mjs after-reboot "$FLEET_NAS_EVIDENCE"
```

The private manifest records the old kernel boot ID, requires a changed boot,
checks recovery within five minutes of the owner reboot command returning, verifies all ten accepted files
and confirms the existing Docker access still works. The original queue stays
on its original host throughout. A missing reboot remains UNTESTED, never PASS.

Compare the final private manifest with fixed source/image expectations:

```sh
pnpm exec node scripts/fleet-runner/check-g3-evidence.mjs \
  "$FLEET_NAS_EVIDENCE/manifest.json" "$FLEET_IMAGE" "$FLEET_IMAGE_SOURCE_COMMIT"
```

The checker does not import the queue reducer or run live commands. It rejects
missing boots, over-bound recovery, failed storage readiness or output checks,
and a different source/image. It checks recorded observations; it is not
external attestation that another operator performed the trials. Preserve the
private raw manifest, source/image identities and G2 bundle for reproduction.
Public status reports only aggregate counts, integrity verdicts and remaining
gates. A qualified sandbox is not approval to cut over or claim G4–G8.

Recovery timing excludes the interactive sudo-password wait. Arming still captures
the pre-reboot kernel identity; after-reboot starts the five-minute recovery
window immediately after the owner command returns/disconnects. The private
receipt records password/command wait separately. A changed kernel boot and
all accepted-output checks are still required; a failed command cannot pass.

## Observed qualification — 2026-11-08

The isolated NAS candidate passed the G3 checker. The live coordinator and both
installed application workers were not changed, and no PR was merged.

| Case | Recorded result |
| --- | --- |
| Service process crashes | 10/10 recovered in 2.196–2.527 seconds; replay rejected and accepted data preserved |
| Appliance reboot 1 | Changed kernel boot; recovery verified within 94.708 seconds; 10/10 output checks passed |
| Appliance reboot 2 | Changed kernel boot; recovery 70.852 seconds after reboot-command return; 10/10 output checks passed |
| Appliance reboot 3 | Changed kernel boot; recovery 63.993 seconds after reboot-command return; 10/10 output checks passed |
| Lifecycle and storage | Graceful stop/start, container replacement, trusted TLS and invalid-storage/configuration checks passed |
| Independent checker | Valid, 10 crash trials, 3 appliance reboots, 10 completions, no errors |

Measured runtime: Linux kernel 6.18.15, local btrfs service state, Docker 29.4.3
and Node 24.22.2 in the nonroot Linux/amd64 image. Image source is
`28eb9eaf83ab08daa9ddedb1162ce0b1e36f35ca`; the image identity is
`sha256:277b0181b8ea7e0bf924ec75174113dbd6c9415fc0e78e826e0b68211666048e`.
The first reboot used the earlier controller and a conservative arming-based
measurement. The remaining two used the corrected controller pinned at
`d3fc506`, which records owner/password wait separately. Their controller
source and artifact hashes remain in the private receipts.

One earlier appliance attempt is retained as an uncounted exception: the old
controller window expired during the interactive password wait before its
verification began. It was not promoted into a passing trial. The three rows
above are the separately verified observations.

The owner controller required Apple Terminal on this Mac: its Node process
reached the LAN there, while the same runtime in iTerm returned EHOSTUNREACH
even though curl and SSH worked. No network/privacy setting was weakened.
This does not qualify application LaunchAgent networking or resolve that
platform-context difference.

Scope remains the isolated service. Mac enrollment and automatic inputs (G4),
operations controls/projections (G5), worker/physical interruption cases (G6),
backup and restore (G7), and explicit production cutover/soak (G8) remain open.
Source review, merging, appliance permission persistence and backup availability
are separate from this bounded result.
