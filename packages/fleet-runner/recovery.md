# Fleet Runner backup and restore

These commands create and restore a private recovery bundle. Use synthetic fixtures for rehearsals. A successful command proves bundle integrity; it does not qualify backup freshness or an independent storage target.

## Create and verify an independent copy

The destination must be a new path on a separately managed device or service. The command rejects a destination that is the source path or nested with the live DB/input/output paths. It cannot determine whether two paths ultimately use the same physical storage.

```sh
fleet-runner backup /srv/fleet/queue.sqlite /srv/fleet/outputs /srv/fleet/inputs /mnt/independent/fleet-2026-11-10T1800Z
fleet-runner verify-backup /mnt/independent/fleet-2026-11-10T1800Z
```

Use `-` for the input directory only when the DB has no referenced inputs. The backup reads a SQLite `VACUUM INTO` snapshot, then copies the content addressed inputs and immutable accepted result files referenced by that snapshot. The manifest records the source service, schema version, database hash and size, per-file hashes and sizes, capture time, event cursor and row counts. It contains no signing key. Bundle files are private; the DB can contain private job payloads.

Verification checks the manifest shape, DB digest, SQLite integrity and exact schema, the complete input and accepted-result sets, and every byte hash. Missing, truncated, corrupt, unexpected or newer-schema material fails closed.

## Restore to new state

The target path must not exist. Restore validates the whole bundle before copying, stages beside the target, installs a new UUID service generation and persisted restore hold, retires claimed attempts, and atomically publishes the staged directory. It creates `fleet.sqlite`, `inputs/`, `outputs/`, and a private copy of the manifest.

```sh
fleet-runner restore /mnt/independent/fleet-2026-11-10T1800Z /srv/fleet-restored
```

Save the returned `generation` and `holdToken` in the private recovery record. Start the replacement service against `/srv/fleet-restored/fleet.sqlite` and `/srv/fleet-restored/outputs`, with `FLEET_INPUT_DIR=/srv/fleet-restored/inputs`. Set `FLEET_GENERATION` to the returned generation on every current owner and worker client. The signed URL target carries that value. Old clients and old signed requests omit it and receive HTTP 401; an old claimed attempt also has no current lease after restore. The new service refuses unsupported schema versions, including a downgrade to schema 4.

The restore hold survives process restart. Worker `resume` cannot clear it, and SQLite has a claim trigger as a second enforcement point. After the operator has inspected the recovery point and accepted the known gap, an owner can release the hold using the exact token from the restore command:

```sh
export FLEET_ENDPOINT=https://fleet.example
export FLEET_ID=owner
export FLEET_TOKEN_FILE=/secure/keys/owner
export FLEET_GENERATION='<generation from restore>'
fleet-runner release-recovery '<holdToken from restore>'
```

The hold release is owner authenticated and bound to both the new generation and exact restored recovery point. Replace worker client packages/configuration before routing them to the replacement endpoint. The same private key can sign a new generation-bound request if an operator deliberately supplies the new generation; this fencing protects against old software and stale traffic, not a compromised worker credential.

## Qualification boundary

This implementation does not schedule backups or create independent-target receipts. The advertised latest-backup age remains `unqualified` until qualification load and actual independent-copy receipts demonstrate the G7 freshness target. Code tests do not establish NAS restore time, physical independence, migration cutover safety, or target-machine validation.
