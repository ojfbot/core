# Yuri read-vision pilot (historical Yojimbo endpoint)

For a NAS-hosted candidate, follow [deployment.md](deployment.md): use a separate
qualification endpoint and generated credential; do not change the installed
worker or reuse the live queue. The commands below reproduce the historical
Yojimbo-hosted pilot only.

Use one upright JPEG with readable text. The pilot keeps its SQLite database,
accepted output, and credentials in a private directory on Yojimbo. Use the
LAN endpoint from the `endpoint` file in that directory.

## Owner steps on Yojimbo

1. Set `PILOT_ROOT="$HOME/data/bookcase-discovery/fleet-pilot-578"`. The
   running server uses the IPv4 address in `"$PILOT_ROOT/endpoint"` and TCP port
   8787. Add the firewall rule allowing inbound TCP 8787 from Yuri's LAN
   address to that Yojimbo address.
2. Put the selected JPEG at `"$PILOT_ROOT/pilot.jpg"`. Over the LAN, copy that
   JPEG and `"$PILOT_ROOT/ocr-vision"` to Yuri's private data directory below.
   Copy both byte for byte. The server pins the existing Yojimbo helper build.
3. After generating the Yuri credential below, transfer its `.pub` file over
   the LAN and install it as `"$PILOT_ROOT/registry/yuri.pub"`. The private
   token stays on Yuri.

## Owner steps on Yuri

1. Install Node 24 and pnpm 12.15.0. Clone the BookcaseDiscovery client branch
   and install its locked dependencies.

   ```sh
   git clone https://github.com/ojfbot/BookcaseDiscovery.git
   cd BookcaseDiscovery
   git switch --detach 3e3a0058197f0ec6d55e555f9a21e5967be35aeb
   pnpm install --frozen-lockfile
   ```

2. Set up Yuri's local data directory and paste the Yojimbo endpoint into
   `FLEET_ENDPOINT`. Place the two copied files at the locations below, then
   stage the JPEG and generate the host credential.

   ```sh
   umask 077
   export BOOKCASE_DATA="$HOME/data/bookcase-discovery/fleet-pilot-578"
   export BOOKCASE_OCR_VISION="$BOOKCASE_DATA/ocr-vision"
   export FLEET_TOKEN_FILE="$BOOKCASE_DATA/yuri"
   export FLEET_ENDPOINT='http://<yojimbo-lan-ip>:8787'
   mkdir -p "$BOOKCASE_DATA"
   test -f "$BOOKCASE_OCR_VISION"
   chmod 700 "$BOOKCASE_OCR_VISION"
   pnpm exec ./bin/bookcase fleet stage "$BOOKCASE_DATA/pilot.jpg"
   pnpm exec ./bin/bookcase fleet keygen
   ```

   Register `"$FLEET_TOKEN_FILE.pub"` on Yojimbo as described above.
   Tell the operator when the firewall, JPEG, and public key are ready for
   admission.

3. Once the operator confirms admission, pull and run the job from the same
   terminal. The worker prints `fleet worker completed` when Yojimbo accepts
   the upload.

   ```sh
   pnpm exec ./bin/bookcase fleet work yuri
   ```

## Yojimbo admission and verification

From the pinned BookcaseDiscovery checkout on Yojimbo, with the pilot server
running, set the local environment, enqueue once, and verify after Yuri
finishes.

```sh
export BOOKCASE_DATA="$HOME/data/bookcase-discovery/fleet-pilot-578"
export BOOKCASE_OCR_VISION="$BOOKCASE_DATA/ocr-vision"
export FLEET_TOKEN_FILE="$BOOKCASE_DATA/owner"
export FLEET_ENDPOINT="$(cat "$BOOKCASE_DATA/endpoint")"
pnpm exec ./bin/bookcase fleet enqueue "$BOOKCASE_DATA/pilot.jpg"
# After Yuri finishes
pnpm exec ./bin/bookcase fleet verify yuri
```

The verification should print `worker yuri: 1 completed` and
`accepted output SHA-256: matches`. Share only those two lines as evidence.
