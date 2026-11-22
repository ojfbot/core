#!/usr/bin/env bash
# fleet-stage-setup: create the FleetRunner TEST COPY's own folders, keys and (optionally)
# certificate, once (ojfbot/core#647, slice 2). Idempotent: it never overwrites an existing key,
# certificate or env file. It does not start anything and does not touch production.
#
#   scripts/fleet-stage-setup.sh [--tls]
#
# On the server it creates, from the private config: the deploy folder (compose.yaml,
# fleet-staging.env, releases/) and the service root (state/, output/, public-keys/, tls/), both
# carrying a marker file that fleet-stage.sh requires before it will change anything, so a run can
# only ever target a folder this script created for the test copy. It refuses a root that already
# holds files but no marker. The env file holds no secret: the port, the folders, the account the
# container runs as, and the worker identity.
# On this Mac, in STAGE_KEYS_DIR, it makes the test copy's own signing keys with `fleet-runner
# keygen` (owner and stage-worker). They are generated here and never leave here; only the .pub
# files go to the server's public-keys/ folder. These are not production's keys.
# With --tls it makes the server's TLS key on the server (the key never leaves it), signs the
# certificate here with the private CA named by STAGE_CA_DIR (ca.crt, ca.key), names STAGE_HOST and
# STAGE_LAN_IP in it, and puts only the certificate on the server and the CA certificate in
# STAGE_KEYS_DIR. If the CA key is passphrase-protected this step stops: it never asks for or types
# a passphrase.
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/fleet-stage-lib.sh
. "$here/lib/fleet-stage-lib.sh"

tls=no
for a in "$@"; do
  case "$a" in
    --tls) tls=yes ;;
    *) echo "usage: fleet-stage-setup.sh [--tls]" >&2; exit 2 ;;
  esac
done

load_conf
repo="$(git -C "$here" rev-parse --show-toplevel)"
cd "$repo"
say "== set up the test copy $STAGE_PROJECT"

# 1. Folders, marker, env file, compose.yaml.
nas "$ENV_PLAIN_FN"'
deploy="$1" root="$2" project="$3" lan="$4" port="$5"
mark=.fleet-runner-staging
# A folder that already holds files but has no marker is not ours to use.
for d in "$deploy" "$root"; do
  if [ -d "$d" ] && [ ! -f "$d/$mark" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    echo "FAIL $d already holds files and is not marked as the test copy"; exit 1
  fi
done
umask 077
mkdir -p "$deploy/releases" "$root/state" "$root/output" "$root/public-keys" "$root/tls"
: > "$deploy/$mark"; : > "$root/$mark"
if [ ! -f "$deploy/fleet-staging.env" ]; then
  {
    echo "FLEET_COMPOSE_PROJECT=$project"
    echo "FLEET_STAGE_ROOT=$root"
    echo "FLEET_LAN_IP=$lan"
    echo "FLEET_HOST_PORT=$port"
    echo "FLEET_WORKERS=stage-worker"
    echo "FLEET_UID=$(id -u)"
    echo "FLEET_GID=$(id -g)"
  } > "$deploy/fleet-staging.env.new" && mv "$deploy/fleet-staging.env.new" "$deploy/fleet-staging.env"
  echo "PASS wrote fleet-staging.env"
else
  # It is the configuration the container runs with: it must still say what the private config says.
  env_is_plain "$deploy/fleet-staging.env" ||
    { echo "FAIL fleet-staging.env is not one plain KEY=value per line (no export, quotes or duplicate keys)"; exit 1; }
  envv() { sed -n "s/^$1=//p" "$deploy/fleet-staging.env" | tail -n 1; }
  for pair in "FLEET_STAGE_ROOT=$root" "FLEET_HOST_PORT=$port" "FLEET_LAN_IP=$lan" "FLEET_COMPOSE_PROJECT=$project"; do
    k="${pair%%=*}"; v="${pair#*=}"
    [ "$(envv "$k")" = "$v" ] || { echo "FAIL fleet-staging.env $k differs from the private config; fix one of them"; exit 1; }
  done
  echo "PASS fleet-staging.env already exists and matches the private config; left as it is"
fi
echo "PASS test copy folders are ready and marked"
' "$NAS_STAGE_DIR" "$NAS_STAGE_ROOT" "$STAGE_PROJECT" "$STAGE_LAN_IP" "$STAGE_PORT"
# The first compose.yaml, so a stage run has something to back up; each stage replaces it with the
# one from the revision it stages.
nas '[ -f "$1/compose.yaml" ] && echo present || echo absent' "$NAS_STAGE_DIR" | grep -q absent &&
  nas_put "$NAS_STAGE_DIR" "$repo/packages/fleet-runner/deploy/compose.yaml"

# 2. The test copy's own keys, made here. A key that exists is never replaced.
pnpm --filter @core/fleet-runner build >/dev/null || die "could not build the fleet-runner CLI"
for id in owner stage-worker; do
  token="$STAGE_KEYS_DIR/$id.token"
  if [ -e "$token" ]; then
    say "PASS $id key already exists; left as it is"
  else
    (umask 077 && node "$repo/packages/fleet-runner/dist/cli.js" keygen "$token") || die "keygen failed for $id"
    say "PASS made the $id key"
  fi
  openssl pkey -pubin -in "$token.pub" -noout 2>/dev/null || die "$token.pub is not a public key"
  # Only the public half goes to the server, as <id>.pub in the registry.
  tmp_pub="$(mktemp "${TMPDIR:-/tmp}/fleet-pub.XXXXXX")"
  cp "$token.pub" "$tmp_pub"
  nas_put "$NAS_STAGE_ROOT/public-keys" "$tmp_pub"
  nas 'mv "$1/$3" "$1/$2.pub"' "$NAS_STAGE_ROOT/public-keys" "$id" "$(basename "$tmp_pub")"
  rm -f "$tmp_pub"
done
say "PASS public keys are in the test copy's registry"

# 3. The certificate, only on request.
if [ "$tls" = yes ]; then
  : "${STAGE_CA_DIR:?config must set STAGE_CA_DIR for --tls}"
  [ -f "$STAGE_CA_DIR/ca.crt" ] && [ -f "$STAGE_CA_DIR/ca.key" ] || die "STAGE_CA_DIR needs ca.crt and ca.key"
  if nas '[ -f "$1/tls/server.crt" ] && echo yes || echo no' "$NAS_STAGE_ROOT" | grep -q yes; then
    say "PASS a certificate already exists; left as it is"
  else
    work="$(mktemp -d "${TMPDIR:-/tmp}/fleet-tls.XXXXXX")"
    trap 'rm -rf "$work"' EXIT
    # The key is made on the server and stays there; only the request comes back.
    nas '
      umask 077
      openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
        -keyout "$1/tls/server.key" -out "$1/tls/server.csr" -subj "/CN=$2" >/dev/null 2>&1
      cat "$1/tls/server.csr"
    ' "$NAS_STAGE_ROOT" "$STAGE_HOST" >"$work/server.csr"
    printf 'subjectAltName=DNS:%s,IP:%s\nextendedKeyUsage=serverAuth\n' "$STAGE_HOST" "$STAGE_LAN_IP" >"$work/ext.cnf"
    openssl x509 -req -in "$work/server.csr" -CA "$STAGE_CA_DIR/ca.crt" -CAkey "$STAGE_CA_DIR/ca.key" \
      -CAcreateserial -CAserial "$work/ca.srl" -days 397 -sha256 -extfile "$work/ext.cnf" -out "$work/server.crt" \
      >/dev/null 2>&1 || die "could not sign the certificate (is the CA key passphrase-protected? this script does not handle one)"
    nas_put "$NAS_STAGE_ROOT/tls" "$work/server.crt"
    nas 'rm -f "$1/tls/server.csr"; chmod 0600 "$1/tls/server.key"; chmod 0644 "$1/tls/server.crt"' "$NAS_STAGE_ROOT"
    say "PASS issued the test copy's certificate for $STAGE_HOST"
  fi
  [ -f "$STAGE_KEYS_DIR/ca.crt" ] || cp "$STAGE_CA_DIR/ca.crt" "$STAGE_KEYS_DIR/ca.crt"
fi
[ -f "$STAGE_KEYS_DIR/ca.crt" ] || say "NOTE: $STAGE_KEYS_DIR/ca.crt (the CA certificate clients trust) is not there yet"
say "PASS set up: next, scripts/fleet-stage.sh <revision>"
