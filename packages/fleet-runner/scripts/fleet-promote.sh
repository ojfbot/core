#!/usr/bin/env bash
# fleet-promote: put a FleetRunner revision that passed in the TEST COPY onto PRODUCTION, with an
# undo (ojfbot/core#647, slice 4). It refuses without the owner's yes, given as a flag:
#
#   scripts/fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>'
#   scripts/fleet-promote.sh revert <run> --owner-approved '<the owner's yes, naming the run>'
#   scripts/fleet-promote.sh status <run>
#
# WHO DECIDES. Not this script. ONE process decides whether the switch passed or is undone: the
# decider (fleet-promote-decider.sh), which this script uploads and starts on the server and which
# then runs there on its own, under a kernel lock, writing a journal. This Mac:
#   - makes every check that can be made before production is touched, and refuses on any of them;
#   - uploads the run's folder (the decider, its helper, the checked Compose config, the plan);
#   - answers the decider's two challenges: a "go" at the start (so a start that arrives late, with
#     nobody watching, changes nothing) and, once the new revision runs, the EVIDENCE only a client
#     can give: what the signed status answers (as the read-only identity PROD_STATUS_ID, never the
#     owner key) and the TLS certificate's fingerprint. The decider compares the values itself;
#   - reads the journal and prints it in plain words. It prints PASS only after reading the
#     decider's "done outcome=pass" AND the record the decider wrote.
# It never undoes, never decides and never writes the journal or a record. If it is interrupted or
# dies, the decider gets no evidence and undoes by itself. If it cannot reach the server it says
# what it last read, and never PASS.
#
# Refuses, before anything changes, unless:
#   - the approval is given, is one line, and holds the start (7 to 40 hex characters) of exactly
#     this revision's commit ID (a hex word that is the start of no commit is ignored; one that
#     names another commit, or more than one, refuses); for a revert it must hold the run's name;
#   - it runs from a clean checkout at origin/main (--rehearsal, for a throwaway production only,
#     lifts this; the decider refuses it unless the control folder carries the rehearsal marker);
#   - stage-state says this exact revision is both the last that passed and the one staged;
#   - this Mac holds the receipt fleet-stage.sh wrote when the revision passed, and the server's
#     release.json and image match it (so the server's account cannot forge the evidence);
#   - production's folders are not the test copy's, and everything the decider's own check finds
#     (see fleet-promote-decider.sh: the approval never used, no unfinished operation, production
#     in exactly the form the journals say, the hand-started container exactly what the Compose
#     file reproduces and with a restart policy that stays stopped, the enrolled keys exactly
#     PROD_KEY_IDS, enough disk, and everything an undo would need).
# The Compose config is resolved ONCE on the server, checked here against an exact allowlist
# (compose-check.mjs), and exactly those bytes are what the decider starts.
# Before the yes is spent it prints the table of bounds and the worst case (computed by the
# decider's own "bounds" mode, run here on the same plan).
# Output also goes to a durable log beside the private config (logs/promote-<run>.log). It prints
# no host, address, account or path. Config: the lib's header (load_prod_conf).
here="$(cd "$(dirname "$0")" && pwd)"
# A closed or broken stdout must never kill this run.
trap '' PIPE
# shellcheck source=lib/fleet-stage-lib.sh
. "$here/lib/fleet-stage-lib.sh"

usage() {
  echo "usage: fleet-promote.sh <revision> --owner-approved '<the owner's yes, naming the revision>' [--rehearsal]" >&2
  echo "       fleet-promote.sh revert <run> --owner-approved '<the owner's yes, naming the run>' [--rehearsal]" >&2
  echo "       fleet-promote.sh status <run>" >&2
  exit 2
}
[ "$#" -ge 1 ] || usage
action=promote
case "$1" in
  revert | status) action="$1"; shift; [ "$#" -ge 1 ] || usage ;;
esac
target="$1"
shift
approval=""
rehearsal=no
while [ "$#" -gt 0 ]; do
  case "$1" in
    --owner-approved) [ "$#" -ge 2 ] || usage; approval="$2"; shift 2 ;;
    --rehearsal) rehearsal=yes; shift ;;
    *) usage ;;
  esac
done
is_run() { [[ "$1" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]]; }

load_conf
load_prod_conf
repo="$(git -C "$here" rev-parse --show-toplevel)"
cd "$repo"
# ctl_run <run> <mode> [args]: this run's own decider, in the control folder, in a read-only mode.
ctl_run() { nas 'd="$1" op="$2" mode="$3"; shift 3; cd "$d" && sh "promote-runs/$op/decider.sh" "$mode" "$op" "$@"' "$NAS_PROD_DIR" "$@"; }

if [ "$action" = status ]; then
  is_run "$target" || die "status needs a run's name (as printed when it started)"
  nas 'cd "$1" && sh "promote-runs/$2/decider.sh" status "$2"' "$NAS_PROD_DIR" "$target" || die "could not read that run on the server"
  exit 0
fi

if [ -z "${approval//[[:space:]]/}" ]; then
  (echo "REFUSED this changes production and needs the owner's yes." >&2 2>/dev/null) || true
  (echo "Ask the owner, then pass their answer, which names what it approves: --owner-approved '<their words>'" >&2 2>/dev/null) || true
  exit 3
fi
case "$approval" in *$'\n'* | *$'\r'*) die "--owner-approved must be one line" ;; esac
# A rehearsal against a throwaway production can make the evidence wrong or withhold it; never production.
fault="${FLEET_PROMOTE_FAULT:-}"
case "$fault" in "" | health | silent) ;; *) die "FLEET_PROMOTE_FAULT may only be health or silent" ;; esac
[ -z "$fault" ] || [ "$rehearsal" = yes ] || die "FLEET_PROMOTE_FAULT needs --rehearsal (a throwaway production)"

rev="" short=""
if [ "$action" = promote ]; then
  rev="$(full_revision "$target")"
  short="${rev:0:7}"
  # The revision argument must be the start of the commit ID it resolved to: a branch or tag named like
  # a short commit ID must not redirect the promote to another commit.
  rev_lc="$(printf '%s' "$target" | tr 'A-F' 'a-f')"
  case "$rev" in "$rev_lc"*) ;; *) die "$target resolves to ${rev:0:12}, which does not start with it (a branch or tag of that name?); name the commit ID; nothing was changed" ;; esac
  # One yes, one revision. The rule: the approval must hold a hex string of 7 to 40 characters (bounded
  # by non-hex, any case) that is the start of exactly this revision's commit ID, matched against commit
  # IDs only (never branch or tag names). A hex-looking word that is the start of no commit (a date,
  # "deadbeef") is ignored. One that is the start of another commit, or of more than one commit, refuses.
  approval_rule="the approval must hold the start (7 to 40 hex characters) of $short's commit ID; hex words that are the start of no commit are ignored, one that names another commit or more than one refuses"
  tokens="$(printf '%s' "$approval" | tr -c '0-9a-fA-F' '\n' | tr 'A-F' 'a-f' | grep -E '^[0-9a-f]{7,}$' || true)"
  named=no
  for tok in $tokens; do
    [ "${#tok}" -le 40 ] || continue
    commits="$(git rev-parse --disambiguate="$tok" 2>/dev/null | while read -r o; do [ "$(git cat-file -t "$o" 2>/dev/null)" = commit ] && echo "$o"; done || true)"
    n="$(printf '%s' "$commits" | grep -c . || true)"
    case "$n" in
      0) continue ;;
      1) [ "$commits" = "$rev" ] || die "the approval names $tok, which is ${commits:0:12}, not $short ($approval_rule); nothing was changed"
         named=yes ;;
      *) die "the approval names $tok, which is the start of more than one commit ($approval_rule); nothing was changed" ;;
    esac
  done
  [ "$named" = yes ] || die "the owner's approval must name the revision it approves ($approval_rule); nothing was changed"
  what="promote $short"
else
  is_run "$target" || die "revert needs the name of the run to go back from (as printed when it passed)"
  # One yes, one run: the approval must hold the run's whole name, as a word of its own.
  case " $approval " in *[!A-Za-z0-9-]"$target"[!A-Za-z0-9-]*) ;; *) die "the owner's approval must name the run it reverts ($target), whole; nothing was changed" ;; esac
  what="revert $target"
fi
# This runs only what main holds: a clean checkout at origin/main (the decider, its helper, the
# Compose allowlist and the status client all come from here).
if [ "$rehearsal" = no ]; then
  [ -z "$(git status --porcelain 2>/dev/null)" ] || die "this checkout has uncommitted changes; run from a clean checkout of origin/main"
  git fetch --quiet origin main 2>/dev/null || die "could not fetch origin main"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
    die "this checkout is not at origin/main ($(git rev-parse --short=7 HEAD)); run from origin/main"
fi
# The same words with other spacing or case are the same yes.
approval_sha="$(printf '%s' "$approval" | tr '[:upper:]' '[:lower:]' | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//' |
  shasum -a 256 | cut -d' ' -f1)"
op="$(date -u +%Y%m%dT%H%M%SZ)-$$"
confdir="$(dirname "$FLEET_CONF_FILE")"
logfile="$confdir/logs/promote-$op.log"

# ---- This Mac's own observations. ---------------------------------------------------------------
status_secs="${FLEET_STATUS_TIMEOUT_SECS:-10}"
[[ "$status_secs" =~ ^[0-9]+$ ]] && [ "$status_secs" -ge 1 ] || die "FLEET_STATUS_TIMEOUT_SECS must be a whole number of seconds"
poll_secs="${FLEET_POLL_SECS:-2}"
[[ "$poll_secs" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "FLEET_POLL_SECS must be a number of seconds"
# Seconds on a clock that never jumps (the wall clock may be set while this waits), left in $MONO.
# ALWAYS called as a plain command, never as $(mono): an interrupt (Ctrl-C) ends every process this
# script is waiting for at that moment, a command substitution's whole subshell included, and the
# answer would come back empty, to be taken for "time is up". Here the loop runs in this shell,
# which only notes the interrupt, and the question is asked again until it is answered.
perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e 1 2>/dev/null || die "this Mac's perl has no Time::HiRes with a monotonic clock"
MONO=""
mono() {
  MONO=""
  while :; do
    MONO="$(perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e 'printf "%d\n", clock_gettime(CLOCK_MONOTONIC)' 2>/dev/null)" || MONO=""
    case "$MONO" in "" | *[!0-9]*) ;; *) return 0 ;; esac
  done
}
prod_node() { CLIENT_TIMEOUT_MS="$((status_secs * 1000))" client_node "$PROD_HOST" "$PROD_PORT" "$PROD_KEYS_DIR" "$PROD_STATUS_ID" "$here/stage-smoke.mjs" "$@"; }
read_build() {
  local out
  out="$(prod_node build 2>/dev/null)" || return 1
  printf '%s' "$out" | json_field build
}
tls_fingerprint() { prod_node fingerprint 2>/dev/null; }
# Only a revision-shaped build is printed.
build_label() { if [[ "$1" =~ ^[0-9a-f]{7,40}$ ]]; then printf 'build %s' "${1:0:12}"; else printf 'its non-revision build label'; fi; }
# Ask the signed status until it answers ready with exactly <build>, for at most <seconds>.
# Prints nothing; the build last seen is in $seen_build.
seen_build="" interrupted=no
wait_build() {
  local want="$1" until_t got=""
  mono
  until_t=$((MONO + $2))
  while :; do
    if got="$(read_build)"; then
      seen_build="$got"
      [ "$got" != "$want" ] || return 0
    fi
    [ "$interrupted" = no ] || return 1
    mono
    [ "$MONO" -lt "$until_t" ] || return 1
    sleep "$poll_secs" || true
  done
}
receipt_of() { printf '%s/receipts/promote-%s.receipt' "$confdir" "$1"; }

# ---- What the journal says, in plain words. -----------------------------------------------------
jfield() { printf '%s\n' "$1" | sed -n "s/.* $2=\([^ ]*\).*/\1/p" | head -n 1; }
# The same, left in $JVAL, by the shell itself: no process is started, so an interrupt cannot lose
# the answer. For what the read loop decides by (the state, the two challenges, the outcome).
JVAL=""
jval() {
  JVAL=""
  case " $1 " in *" $2="*) JVAL="${1##* $2=}"; JVAL="${JVAL%% *}" ;; esac
}
explain() {
  local state="$1" line="$2"
  case "$state" in
    begun) say "  the decider began on the server (operation $(jfield "$line" seq))" ;;
    go) say "  it has this Mac's go" ;;
    verified) say "  it checked everything the switch and its undo need (worst case $(jfield "$line" offline_max) seconds)" ;;
    spent) say "  the owner's yes is spent" ;;
    stopped) say "  the previous production is stopped" ;;
    snapshot) say "  the snapshot is verified: $(jfield "$line" jobs) jobs" ;;
    starting) say "  starting the new revision from the checked config" ;;
    started) say "  the new revision runs, on the checked image" ;;
    server-checked) say "  healthy, the same enrolled keys, $(jfield "$line" jobs) jobs: it waits $(jfield "$line" window) seconds for this Mac's evidence" ;;
    evidence) say "  it accepted this Mac's evidence" ;;
    committed) say "  COMMITTED on the server" ;;
    undoing) say "  the decider is undoing: $(jfield "$line" reason)" ;;
    undo-quiet) say "  undo: this run's helper containers are gone" ;;
    undo-new-removed) if [ -n "$(jfield "$line" skipped)" ]; then say "  undo: the new revision never started"; else say "  undo: the new revision is removed"; fi ;;
    undo-state-aside) [ -n "$(jfield "$line" skipped)" ] || say "  undo: the changed state folder is set aside" ;;
    undo-state-back) if [ -n "$(jfield "$line" skipped)" ]; then say "  undo: the state folder was never changed"; else say "  undo: the snapshot is the state folder again"; fi ;;
    undo-previous-stopped) ;;
    undo-previous-started) say "  undo: the previous production is started" ;;
    undo-healthy) say "  undo: the engine reports it healthy" ;;
    halted) say "  the decider HALTED: $(jfield "$line" reason)" ;;
    done) say "  the decider finished: $(jfield "$line" outcome)" ;;
  esac
}
recover_line() {
  say "  On the server, in production's control folder (NAS_PROD_DIR in the private config):"
  say "      sh promote-runs/$op/decider.sh recover $op"
  say "  It confirms a committed pass or completes the undo, and is safe to repeat. From this Mac, to only read:"
  say "      scripts/fleet-promote.sh status $op"
}

main() {
  say "== $what on production (run $op)$([ "$rehearsal" = yes ] && printf ', REHEARSAL against a throwaway production')"
  say "log: logs/promote-$op.log, beside the private config"
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/fleet-promote-$op.XXXXXX")"
  started=no sent_evidence=no last_read="nothing yet" last_state=""
  cleanup() { local rc=$?; trap - EXIT; rm -rf "$tmp"; exit "$rc"; }
  trap cleanup EXIT
  # Before the start an interrupt just ends this script: nothing was changed. After the start it is
  # a request, noted, and this script keeps reading until it knows the outcome.
  on_signal() {
    if [ "$started" = yes ]; then
      [ "$interrupted" = yes ] || say "interruption requested; outcome pending (the decider on the server decides, not this script)"
      interrupted=yes
    else
      exit "$1"
    fi
  }
  trap 'on_signal 130' INT
  trap 'on_signal 143' TERM
  trap 'on_signal 129' HUP

  # 1. Refusals that read the server and change nothing in production.
  check_prod_isolation
  if [ "$rehearsal" = yes ]; then
    nas '[ -f "$1/.fleet-runner-promote-rehearsal" ]' "$NAS_PROD_DIR" ||
      die "--rehearsal is only for a throwaway production (its control folder carries .fleet-runner-promote-rehearsal); nothing was changed"
    [ -z "$fault" ] || say "REHEARSAL: this Mac's evidence will be made to fail ($fault)"
  fi
  local receipt image_id="" prev_build="" kind="" prev_op="-" prev_cfg="-" prev_label="" resolved_sha="" compose_from="" uidgid=""
  if [ "$action" = promote ]; then
    local last staged manifest_digest archive_sha tag
    last="$(nas "$STATE_FN"'read_state "$1" last_passed' "$NAS_STAGE_DIR")"
    staged="$(nas "$STATE_FN"'read_state "$1" staged_ok' "$NAS_STAGE_DIR")"
    [ "$last" = "$rev" ] && [ "$staged" = "$rev" ] ||
      die "$short is not staged: stage-state does not name it as both the last that passed and the one staged (run scripts/fleet-stage.sh $short); nothing was changed"
    receipt="$(receipt_file "$rev")"
    [ -f "$receipt" ] && [ "$(receipt_value "$receipt" revision)" = "$rev" ] ||
      die "this Mac has no receipt for $short (fleet-stage.sh writes one when a revision passes); stage it from here first; nothing was changed"
    image_id="$(receipt_value "$receipt" image_id)"
    manifest_digest="$(receipt_value "$receipt" manifest_digest)"
    archive_sha="$(receipt_value "$receipt" archive_sha256)"
    tag="$(receipt_value "$receipt" tag)"
    [ "$tag" = "fleet-runner:$rev" ] || die "the receipt names an unexpected image tag"
    nas 'cat "$1/releases/$2/release.json"' "$NAS_STAGE_DIR" "$rev" >"$tmp/release.json" ||
      die "the test copy has no release of $short; nothing was changed"
    [ "$(shasum -a 256 "$tmp/release.json" | cut -d' ' -f1)" = "$(receipt_value "$receipt" release_json_sha256)" ] ||
      die "the server's release.json of $short is not the one this Mac verified (receipt); nothing was changed"
    say "PASS stage-state and this Mac's receipt: $short passed in the test copy and is promotable"
    # The staged image, checked where it will run by THIS checkout's load-release.sh with the
    # receipt's values (the archive is re-hashed; the loaded image's ID must be the receipt's).
    nas "$(cat "$here/load-release.sh")" "$NAS_STAGE_DIR/releases/$rev/fleet-runner-image.tar" \
      "$archive_sha" "$image_id" "$tag" "$manifest_digest" ||
      die "the staged image of $short does not match this Mac's receipt on the server; nothing was changed"
    local img_ref
    img_ref="$(nas 'docker image inspect --format "{{.Id}}" "$1"' "$tag")"
    [ "$img_ref" = "$image_id" ] || { [ -n "$manifest_digest" ] && [ "$img_ref" = "$manifest_digest" ]; } ||
      die "the server's $tag is not the receipt's image; nothing was changed"
    image_id="$img_ref"
  fi

  # 2. This run's folder on the server, made once and never reused: the decider and its helper.
  nas "$PROD_MKDIR" "$NAS_PROD_DIR" || die "could not create production's control folder"
  nas 'umask 077; mkdir -p "$1/promote-runs" "$1/promote-records" && mkdir "$1/promote-runs/$2"' "$NAS_PROD_DIR" "$op" ||
    die "could not make this run's folder on the server (a run's name is used once); nothing was changed"
  local rundir="$NAS_PROD_DIR/promote-runs/$op"
  nas_write "$rundir/decider.sh" "$here/fleet-promote-decider.sh" && nas_write "$rundir/guard.pl" "$here/fleet-promote-guard.pl" ||
    die "could not upload the decider; nothing was changed"

  # 3. What production is now: by the server's journals, and by what it answers to a client.
  local cur
  cur="$(ctl_run "$op" current)" || die "could not read what production is now; nothing was changed"
  [ -z "$(jfield " $cur" unfinished)" ] ||
    die "operation $(jfield " $cur" unfinished) is unfinished on the server: run its recover first (scripts/fleet-promote.sh status $(jfield " $cur" unfinished | cut -d, -f1)); nothing was changed"
  kind="$(jfield " $cur" kind)"
  if [ "$action" = promote ]; then
    prev_build="$(read_build)" || die "production does not answer a signed status now; the promote will not replace a service it could not prove it brought back"
    [ -n "$prev_build" ] || die "production's signed status names no build"
    if [ "$kind" = compose ]; then
      prev_op="$(jfield " $cur" op)"
      local prev_rev
      prev_rev="$(jfield " $cur" rev)"
      [ "$prev_rev" != "$rev" ] || { say "production already runs $short; nothing to do"; exit 0; }
      [ "$prev_build" = "$prev_rev" ] || die "production answers as $(build_label "$prev_build"), not the ${prev_rev:0:7} the server's journals name"
      # The config the previous run started, by THIS Mac's own receipt of it: the undo may only
      # start bytes this Mac checked.
      [ -f "$(receipt_of "$prev_op")" ] || die "this Mac has no receipt of run $prev_op, the run production is on: the undo could not be checked against what this Mac verified; nothing was changed"
      prev_cfg="$(receipt_value "$(receipt_of "$prev_op")" resolved_sha256)"
      [ "$prev_cfg" = "$(jfield " $cur" cfg)" ] || die "this Mac's receipt of run $prev_op does not match the config the server's journal says it started; nothing was changed"
      prev_label="${prev_rev:0:7} (run $prev_op)"
    elif [ "$kind" = container ]; then
      prev_label="the hand-started container ($(build_label "$prev_build"))"
    else
      die "could not read which form production is in; nothing was changed"
    fi
    say "production now: $prev_label"
    local tls_before
    tls_before="$(tls_fingerprint)"
    [ -n "$tls_before" ] || die "could not read production's TLS certificate"

    # 4. The Compose file: the promoted revision's own if it has one, else this checkout's. Resolved
    # ONCE on the server, checked here, and exactly those bytes are what the decider starts.
    if git cat-file -e "$rev:packages/fleet-runner/deploy/compose.production.yaml" 2>/dev/null; then
      git show "$rev:packages/fleet-runner/deploy/compose.production.yaml" >"$tmp/compose.yaml"
      compose_from="$short's own"
    else
      cp "$here/../deploy/compose.production.yaml" "$tmp/compose.yaml" || die "this checkout has no deploy/compose.production.yaml"
      compose_from="this checkout's ($short predates it)"
    fi
    nas_write "$rundir/compose.yaml" "$tmp/compose.yaml" || die "could not copy the compose file"
    ctl_run "$op" prepare "$kind" "$PROD_PROJECT" "$rev" "$NAS_PROD_ROOT" "$PROD_PORT" "$PROD_LAN_IP" "$PROD_CONTAINER" >"$tmp/prepare" ||
      { grep '^FAIL' "$tmp/prepare" || true; die "could not prepare the new compose config; nothing was changed"; }
    nas 'cat "$1/promote-runs/$2/resolved.candidate.json"' "$NAS_PROD_DIR" "$op" >"$tmp/resolved.json" || die "could not read the resolved compose config"
    uidgid="$(sed -n 's/^uidgid=//p' "$tmp/prepare")"
    node "$here/compose-check.mjs" "$tmp/resolved.json" "$PROD_PROJECT" "$NAS_PROD_ROOT" "$PROD_LAN_IP" "$PROD_PORT" "$uidgid" "$rev" \
      "$(sed -n 's/^FLEET_WORKERS=//p' "$tmp/prepare")" "$(sed -n 's/^FLEET_OBSERVERS=//p' "$tmp/prepare")" ||
      die "the compose config $short would run with is not production's allowlisted shape; nothing was changed"
    # The checked bytes themselves go to the server: what starts is what was checked HERE.
    nas_write "$rundir/resolved.json" "$tmp/resolved.json" || die "could not upload the checked compose config"
    resolved_sha="$(shasum -a 256 "$tmp/resolved.json" | cut -d' ' -f1)"
  fi

  # 5. The plan, and this Mac's receipt of what it checked for this run.
  {
    echo "format=1"
    echo "op=$op"
    echo "mode=$action"
    echo "project=$PROD_PROJECT"
    echo "root=$NAS_PROD_ROOT"
    echo "lan=$PROD_LAN_IP"
    echo "port=$PROD_PORT"
    echo "approval_sha256=$approval_sha"
    echo "approval=$approval"
    echo "rehearsal=$rehearsal"
    if [ "$action" = promote ]; then
      echo "revision=$rev"
      echo "kind=$kind"
      echo "container=$PROD_CONTAINER"
      echo "new_image=$image_id"
      echo "resolved_sha256=$resolved_sha"
      echo "uidgid=$uidgid"
      echo "prev_op=$prev_op"
      echo "prev_resolved_sha256=$prev_cfg"
      echo "key_ids=$(printf '%s\n' $PROD_KEY_IDS | sort | tr '\n' ',' | sed 's/,$//')"
      echo "tls_before=$tls_before"
    else
      echo "target=$target"
    fi
    local b
    for b in FIRST GO STOP COPY INTEGRITY START HEALTH EXEC EVIDENCE UNDO_START UNDO_HEALTH SETTLE; do
      local name="FLEET_B_$b"
      [ -z "${!name:-}" ] || echo "b_$(printf '%s' "$b" | tr 'A-Z' 'a-z')=${!name}"
    done
  } >"$tmp/plan"
  local plan_sha
  plan_sha="$(shasum -a 256 "$tmp/plan" | cut -d' ' -f1)"
  # The bounds and the worst case, from the decider's own arithmetic on this very plan: an
  # impossible setting is refused here, before anything is uploaded that could start.
  sh "$here/fleet-promote-decider.sh" bounds "$tmp/plan" >"$tmp/bounds" || { cat "$tmp/bounds"; die "the bounds are not possible; nothing was changed"; }
  local t_worst t_before b_first b_evidence
  t_worst="$(sed -n 's/^worst_case=\([0-9]*\) .*/\1/p' "$tmp/bounds")"
  t_before="$(sed -n 's/.* before=\([0-9]*\)$/\1/p' "$tmp/bounds")"
  b_first="$(sed -n 's/^ *\([0-9]*\)  this Mac waits for the decider.s first journal line$/\1/p' "$tmp/bounds")"
  b_evidence="$(sed -n 's/^ *\([0-9]*\)  wait for this Mac.s evidence$/\1/p' "$tmp/bounds")"
  [ -n "$t_worst" ] && [ -n "$t_before" ] && [ -n "$b_first" ] && [ -n "$b_evidence" ] || die "could not read the bounds table"
  nas_write "$rundir/plan" "$tmp/plan" || die "could not upload the plan; nothing was changed"
  if [ "$action" = promote ]; then
    (umask 077 && mkdir -p "$confdir/receipts") || die "could not write this Mac's receipt"
    {
      echo "op=$op"
      echo "revision=$rev"
      echo "resolved_sha256=$resolved_sha"
      echo "image_id=$image_id"
      echo "prev_build=$prev_build"
    } >"$(receipt_of "$op").part" && chmod 0600 "$(receipt_of "$op").part" && mv "$(receipt_of "$op").part" "$(receipt_of "$op")" ||
      die "could not write this Mac's receipt"
  fi

  # 6. Every refusal the decider itself would make, said now (it makes them again under its lock).
  ctl_run "$op" check >"$tmp/check" || { grep -v '^$' "$tmp/check" || true; die "the decider's checks refuse this $action; nothing was changed"; }
  grep -e '^PASS' -e '^disk:' -e '^jobs:' "$tmp/check" || true

  say "approved by the owner: $approval"
  if [ "$action" = promote ]; then
    say "changes: production goes from $prev_label to $short under the Compose project $PROD_PROJECT, with $compose_from compose.production.yaml"
    say "         (same folders, enrolled keys, certificate, address, port and identities); it is offline for the switch"
  else
    say "changes: production goes back from run $target to what ran before it; every job accepted since that promote is set aside"
  fi
  sed '$d' "$tmp/bounds" | while IFS= read -r line; do say "$line"; done
  say "decides: the decider on the server, alone. With no evidence from this Mac it undoes by itself."

  # 7. Start it: in a session of its own on the server, so it outlives this connection.
  started=yes
  local start_at
  mono
  start_at="$MONO"
  nas 'cd "$1" || exit 1
d="promote-runs/$2"
[ "$(sha256sum "$d/decider.sh" | cut -d" " -f1)" = "$3" ] && [ "$(sha256sum "$d/guard.pl" | cut -d" " -f1)" = "$4" ] || { echo "FAIL the uploaded decider is not the one this checkout holds"; exit 1; }
perl "$d/guard.pl" detach "$d/decider.out" -- sh "$d/decider.sh" run "$2" > /dev/null' \
    "$NAS_PROD_DIR" "$op" "$(shasum -a 256 "$here/fleet-promote-decider.sh" | cut -d' ' -f1)" "$(shasum -a 256 "$here/fleet-promote-guard.pl" | cut -d' ' -f1)" ||
    say "the start may not have reached the server; reading its journal to find out"

  # 8. Read the journal until the decider has finished; answer its two challenges on the way.
  local deadline shown=0 lines="" out="" prev_out="-" settled=no unreachable=no go_nonce="" ev_nonce="" outcome="" halted=no incomplete=""
  # How long this Mac keeps reading: the whole worst case and a margin, unless told otherwise
  # (FLEET_MAC_WAIT_SECS changes this Mac's patience only, never what the decider does).
  local mac_wait="${FLEET_MAC_WAIT_SECS:-$((t_before + t_worst + 90))}"
  [[ "$mac_wait" =~ ^[0-9]+$ ]] && [ "$mac_wait" -ge 20 ] || mac_wait=$((t_before + t_worst + 90))
  deadline=$((start_at + mac_wait))
  while :; do
    # Only the journal's complete lines: a line without its line break was never written.
    if lines="$(nas 'j="$1/promote-runs/$2/journal"
if [ -f "$j" ]; then head -n "$(wc -l < "$j" | tr -d " ")" "$j"; fi
echo "=====OUT"
cat "$1/promote-runs/$2/decider.out" 2>/dev/null
true' "$NAS_PROD_DIR" "$op" 2>/dev/null)"; then
      [ "$unreachable" != said ] || say "the server answers again"
      unreachable=no
      out="${lines#*=====OUT}"
      lines="${lines%%=====OUT*}"
      local n=0 line state
      while IFS= read -r line; do
        [ -n "$line" ] || continue
        n=$((n + 1))
        [ "$n" -gt "$shown" ] || continue
        shown="$n"
        # Read with the shell's own means, never a command substitution: see mono.
        state="${line#* }"
        state="${state%% *}"
        last_state="$state"
        last_read="\"$state\" at ${line%% *}"
        explain "$state" "$line"
        case "$state" in
          begun) jval "$line" go; go_nonce="$JVAL" ;;
          server-checked) jval "$line" nonce; ev_nonce="$JVAL" ;;
          halted) halted=yes ;;
          done) jval "$line" outcome; outcome="$JVAL" ;;
        esac
      done <<EOF_LINES
$lines
EOF_LINES
      # The decider's go: it must have it within its bound, or it changes nothing.
      if [ -n "$go_nonce" ]; then
        printf 'nonce=%s\n' "$go_nonce" >"$tmp/go"
        nas_write "$rundir/go" "$tmp/go" 2>/dev/null && go_nonce="" || true
      fi
      # The evidence, once, answering this run's challenge.
      if [ -n "$ev_nonce" ] && [ "$sent_evidence" = no ]; then
        local client=ok build="" tls=""
        if [ "$interrupted" = yes ]; then
          client=interrupted
        elif [ "$fault" = silent ]; then
          say "REHEARSAL: no evidence is sent"
          sent_evidence=withheld
        else
          # This Mac's own checks, inside the decider's window (less the time to deliver them).
          if wait_build "$rev" "$((b_evidence > 45 ? b_evidence - 30 : 15))"; then
            say "  this Mac: the signed status answers ready, $(build_label "$rev")"
          else
            say "  this Mac: the signed status did NOT answer ready on $(build_label "$rev")"
            client=failed
          fi
          build="$seen_build"
          [ "$fault" != health ] || build="0000000000000000000000000000000000000000"
          tls="$(tls_fingerprint)" || tls=""
          if [ "$tls" = "$tls_before" ]; then say "  this Mac: the same TLS certificate"; else say "  this Mac: the TLS certificate is NOT the one production had"; fi
          [ "$interrupted" = no ] || client=interrupted
        fi
        if [ "$sent_evidence" = no ]; then
          {
            echo "op=$op"
            echo "revision=$rev"
            echo "plan=$plan_sha"
            echo "nonce=$ev_nonce"
            echo "build=$build"
            echo "tls=$tls"
            echo "client=$client"
          } >"$tmp/evidence"
          if nas_write "$rundir/evidence" "$tmp/evidence" 2>/dev/null; then
            sent_evidence=yes
            say "  this Mac sent its evidence ($client); the decider decides"
          else
            say "  this Mac could not deliver its evidence; trying again"
          fi
        fi
      fi
      [ -z "$outcome" ] || break
      # The decider ended without a "done": halted, or its record could not be written. What it said
      # is taken only once two reads in a row are the same: it may still be writing its last lines.
      settled=no
      [ "$out" != "$prev_out" ] || settled=yes
      prev_out="$out"
      case "$out" in
        *"RECORD INCOMPLETE"*) if [ "$settled" = yes ]; then incomplete="$(printf '%s\n' "$out" | grep 'RECORD INCOMPLETE' | tail -n 1)"; break; fi ;;
        *"HALTED "*) halted=yes ;;
      esac
      if [ "$halted" = yes ] && [ "$settled" = yes ]; then break; fi
      # It never began: the lock is held, the plan was refused, or the start never arrived.
      if [ "$shown" -eq 0 ]; then
        case "$out" in *REFUSED*) [ "$settled" = no ] || break ;; esac
        mono
        if [ "$MONO" -ge $((start_at + b_first)) ]; then
          say "the decider wrote no journal line within $b_first seconds of the start"
          break
        fi
      fi
    elif [ "$unreachable" = no ]; then
      unreachable=once
    elif [ "$unreachable" = once ]; then
      say "this Mac cannot reach the server; it keeps trying (the decider does not need this Mac to decide)"
      unreachable=said
    fi
    mono
    [ "$MONO" -lt "$deadline" ] || break
    sleep "$poll_secs" || true
  done
  mono

  # 9. Say what is known. PASS only from the decider's own "done" and its record.
  local rc=1
  if [ "$outcome" = pass ]; then
    if nas 'cat "$1/promote-records/promote-$2.txt"' "$NAS_PROD_DIR" "$op" >"$tmp/record" 2>/dev/null && grep -q "^promote $op: .* -> $rev\$" "$tmp/record"; then
      say "PASS production runs $short (was $prev_label), by the decider's record promote-records/promote-$op.txt:"
      sed 's/^/    /' "$tmp/record" | while IFS= read -r line; do say "$line"; done
      [ "$interrupted" = no ] || say "(the interruption came after the evidence was delivered: the decider had already committed)"
      rc=0
    else
      say "FAIL the journal says the pass is done, but its record could not be read: not reported as PASS."
      recover_line
    fi
  elif [ "$outcome" = undone ] || [ "$outcome" = reverted ]; then
    local word=UNDONE
    [ "$outcome" != reverted ] || word=REVERTED
    nas 'cat "$1/promote-records/$2"' "$NAS_PROD_DIR" "$([ "$outcome" = reverted ] && echo "revert-$op.txt" || echo "undo-$op.txt")" >"$tmp/record" 2>/dev/null || true
    say "$word by the decider (record promote-records/$([ "$outcome" = reverted ] && echo revert || echo undo)-$op.txt):"
    [ ! -s "$tmp/record" ] || sed 's/^/    /' "$tmp/record" | while IFS= read -r line; do say "$line"; done
    # The one thing the server could not check: what the previous production answers to a client.
    local want="$prev_build"
    if [ "$action" = revert ] && [ -f "$(receipt_of "$target")" ]; then want="$(receipt_value "$(receipt_of "$target")" prev_build)"; fi
    if [ -z "$want" ]; then
      say "this Mac has no receipt of run $target, so it did not check what production answers now"
      [ "$outcome" != reverted ] || rc=0
    elif wait_build "$want" "${FLEET_UNDO_STATUS_SECS:-60}"; then
      say "CHECKED from this Mac: the signed status answers ready, $(build_label "$want"), as before"
      [ "$outcome" != reverted ] || rc=0
    else
      say "FAIL from this Mac: the signed status does NOT answer ready on $(build_label "$want"); the server's record says it runs. Look at it."
      rc=1
    fi
    [ "$action" = revert ] || say "$short was NOT promoted."
  elif [ "$outcome" = unchanged ]; then
    printf '%s\n' "$out" | grep -e '^REFUSED' -e '^disk:' | while IFS= read -r line; do say "$line"; done || true
    say "REFUSED by the decider: nothing was changed in production."
  elif [ -n "$incomplete" ]; then
    say "$incomplete"
    say "FAIL the decider ended without its record: this is NOT reported as a pass or as a finished undo."
    recover_line
  elif [ "$halted" = yes ]; then
    printf '%s\n' "$out" | sed -n '/^HALTED /,$p' | while IFS= read -r line; do say "$line"; done
    say "FAIL the decider halted: production may be down. No other promote, recover or revert will run until this is resolved."
    recover_line
  elif [ "$shown" -eq 0 ] && [ "$unreachable" = no ] && [ "$MONO" -lt "$deadline" ]; then
    printf '%s\n' "$out" | grep -v '^$' | while IFS= read -r line; do say "$line"; done || true
    say "REFUSED the decider did not begin: nothing was changed in production by this run."
    say "  (If its start arrives late, it gets no go from this Mac and changes nothing.)"
  else
    say "UNKNOWN this Mac did not read the outcome. This is NOT a pass."
    say "  Last read from the server: $last_read."
    case "$sent_evidence" in
      yes) say "  This Mac's evidence was delivered: the decider may have committed, or undone; only its journal says." ;;
      *) say "  This Mac's evidence was not delivered. Without it the decider undoes by itself when its window closes (an estimate: within $t_worst seconds of the start), unless it halts; only its journal says." ;;
    esac
    [ "$interrupted" = no ] || say "  An interruption was requested; the outcome is pending."
    recover_line
  fi
  return "$rc"
}

run_logged "$logfile" main
