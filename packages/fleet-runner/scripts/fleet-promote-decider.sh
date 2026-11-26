#!/bin/sh
# fleet-promote-decider: the ONE process that switches FleetRunner's production to a new revision and
# alone decides pass or undo (ojfbot/core#647, slice 4). It runs on the server, from the folder the
# Mac uploaded it into: <control folder>/promote-runs/<operation>/decider.sh, beside guard.pl
# (fleet-promote-guard.pl) and the operation's plan. POSIX sh; everything sh cannot do is in guard.pl.
#
#   sh promote-runs/<op>/decider.sh run <op>       do the operation the plan describes (promote or revert)
#   sh promote-runs/<op>/decider.sh recover <op>   finish an operation whose decider is gone: confirm a
#                                                  committed pass, or complete the undo. Safe to repeat.
#   sh promote-runs/<op>/decider.sh status <op>    read-only: what the journal says
#   sh promote-runs/<op>/decider.sh check <op>     read-only: every refusal the run would make
#   sh promote-runs/<op>/decider.sh current <op>   read-only: what production is now, by the journals
#   sh promote-runs/<op>/decider.sh prepare <op> <kind> <project> <revision> <root> <port> <address> <container>
#                                                  read-only for production: resolve the Compose config
#   sh fleet-promote-decider.sh bounds [<plan>]    the table of bounds and the worst case (also run on the Mac)
#
# THE RULES IT KEEPS
# - One decider. It holds an exclusive kernel lock on the control folder itself, on a descriptor it
#   keeps for its whole life; run, recover and revert all take it first. The lock is held by the
#   decider and by the helper that bounds each step; it is free only when both are gone.
# - The journal (promote-runs/<op>/journal) is the only authority: one line per completed step,
#   written and flushed to disk before the next step starts. What production runs now, which yes
#   was spent and whether an operation is unfinished are all read from the journals, nowhere else.
#   Only one operation may be unfinished: every mode refuses while another's journal has no "done"
#   line, except recover of that operation.
# - recover never goes forward: without a "committed" line it undoes, with one it confirms.
# - When the engine's or the disk's state is ambiguous it HALTS and says so. It never writes a
#   terminal outcome it did not just observe to be true.
# - Everything an undo will need is checked BEFORE the first disruptive call, in every mode.
# - Every engine call is bounded (guard.pl bound): at the bound the whole process group is ended
#   and verified gone before anything else happens; its group ID is recorded before it starts.
#   The processes this script starts are: perl (guard.pl), the engine client (docker) and its
#   Compose plugin, sh, and coreutils (date, sed, grep, sort, tail, head, cat, sleep, basename,
#   dirname, sha256sum, ps). Nothing else.
# - It prints and records nothing private: no host, address, account or path. Engine output goes to
#   promote-runs/<op>/engine.log, never to the journal.
#
# JOURNAL LINES: <UTC time> <state> [key=value ..]
#   begun go verified spent stopped snapshot starting started server-checked evidence committed
#   undoing undo-quiet undo-new-removed undo-state-aside undo-state-back undo-previous-stopped
#   undo-previous-started undo-healthy  done outcome=pass|undone|reverted|unchanged  halted reason=..
set -u
umask 077

say() { printf '%s\n' "$*" 2>/dev/null || true; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# ---- Bounds, in seconds. One table: the defaults, what a plan may change, and the sums. ---------
# Every figure printed is made here, from the same numbers the steps below are run with.
Q=10     # one quick engine query
P=5      # one poll of a wait
H=30     # one short helper container
END=11   # ending a step that ran into its bound: 5 s of grace, at most 5 s to see it gone, the guard's last look
HG=$((END + 2 * Q + END)) # the same for a helper container, whose removal by name is then asked and seen
WRITE=10 # local record writes (not timer-enforced; counted)
bound_names="b_first b_go b_stop b_copy b_integrity b_start b_health b_exec b_evidence b_undo_start b_undo_health b_settle"
b_default() {
  case "$1" in
    b_first) echo 15 ;; b_go) echo 30 ;; b_stop) echo 45 ;; b_copy) echo 120 ;; b_integrity) echo 60 ;;
    b_start) echo 60 ;; b_health) echo 60 ;; b_exec) echo 30 ;; b_evidence) echo 120 ;;
    b_undo_start) echo 60 ;; b_undo_health) echo 60 ;; b_settle) echo 10 ;;
  esac
}
b_floor() {
  case "$1" in
    b_stop) echo 40 ;; b_evidence) echo 60 ;; b_first | b_go | b_copy | b_integrity | b_start | b_exec | b_undo_start) echo 10 ;;
    # A health wait is one budget for all its polls, each poll's ending included: room for at least two.
    b_health | b_undo_health) echo 20 ;;
    b_settle) echo 1 ;;
  esac
}
# The most a plan may ask for. Far above what the rehearsal on a real server measured (a stop under
# 1 s, a 1 MB copy 2 s, a start 1 s, healthy in 6 s), with room for a state folder of gigabytes.
b_ceiling() {
  case "$1" in
    b_first) echo 120 ;; b_go) echo 300 ;; b_stop) echo 300 ;; b_copy) echo 3600 ;; b_integrity) echo 900 ;;
    b_start) echo 600 ;; b_health) echo 600 ;; b_exec) echo 300 ;; b_evidence) echo 600 ;;
    b_undo_start) echo 600 ;; b_undo_health) echo 600 ;; b_settle) echo 120 ;;
  esac
}
# load_bounds <plan or empty>: sets every b_* and the sums; 1 and a message for an impossible setting.
load_bounds() {
  lb_plan="$1"
  for lb_n in $bound_names; do
    lb_v=""
    [ -z "$lb_plan" ] || lb_v="$(sed -n "s/^$lb_n=//p" "$lb_plan" | head -n 1)"
    [ -n "$lb_v" ] || lb_v="$(b_default "$lb_n")"
    # Plain decimal only: a leading zero would be read as octal by the arithmetic and as decimal by
    # the timer, and the table would then not be what the steps are run with.
    case "$lb_v" in "" | *[!0-9]* | 0*) say "REFUSED $lb_n must be a whole number of seconds, written plainly (no sign, no leading zero)"; return 1 ;; esac
    [ "${#lb_v}" -le 4 ] || { say "REFUSED $lb_n must be at most $(b_ceiling "$lb_n") seconds"; return 1; }
    [ "$lb_v" -ge "$(b_floor "$lb_n")" ] || { say "REFUSED $lb_n must be at least $(b_floor "$lb_n") seconds"; return 1; }
    [ "$lb_v" -le "$(b_ceiling "$lb_n")" ] || { say "REFUSED $lb_n must be at most $(b_ceiling "$lb_n") seconds"; return 1; }
    eval "$lb_n=$lb_v"
  done
  # The engine's own stop grace must fit inside the stop bound.
  stop_grace=$((b_stop - 15))
  # Production offline: (stop, then seen) (copy) (integrity) (name) (start, listed, identified).
  t_fwd_down=$((b_stop + Q + b_copy + b_integrity + H + b_start + 2 * Q))
  # The new revision up, unconfirmed: (healthy: one budget) (keys, jobs) (the evidence window).
  t_fwd_up=$((b_health + 2 * b_exec + b_evidence))
  # The undo: (helpers: Q, one listing; a step that failed or was ended has already seen its own helper
  # gone) (new revision: Q + stop + 2Q) (state: 3H) (previous stopped: 2Q + stop) (started: start + 2Q)
  # (healthy: 2Q + one budget) (settle: settle + 2Q + P) (jobs H, record WRITE)
  t_undo=$((Q + Q + b_stop + 2 * Q + 3 * H + 2 * Q + b_stop + b_undo_start + 2 * Q + 2 * Q + b_undo_health + b_settle + 2 * Q + P + H + WRITE))
  # Steps that may run into their bound WITHOUT ending the run, and so add their ending to it: the
  # stop of the previous production (asked, then seen), and in the undo the stop and the removal of
  # the new revision, the second stop of the previous production, and the count of set-aside jobs
  # (a helper). Any other step that runs into its bound ends the switch, or halts the undo.
  t_ends_pass=$END
  t_ends=$((4 * END + HG))
  # Offline or on an unconfirmed build, the longest path: every step slow, the evidence at the end
  # of its window, then the look right before the commit runs into its bound (and is ended), then
  # a full undo.
  t_worst=$((t_fwd_down + t_fwd_up + Q + END + t_undo + t_ends))
  # A pass: the switch, the evidence, the two looks at the new revision around the commit, the record.
  t_pass=$((t_fwd_down + t_fwd_up + 2 * Q + WRITE + t_ends_pass))
  # Nothing answering: the start runs into its bound (and is ended), or it succeeds and the new
  # revision never gets healthy (its whole health budget, the longer of the two), then a slow undo.
  t_sl_up=$b_health
  [ "$t_sl_up" -ge "$END" ] || t_sl_up=$END
  t_silent=$((t_fwd_down + t_sl_up + t_undo + t_ends))
  # The checks before the stop (production still up): at most 18 queries and 3 helpers.
  t_checks=$((18 * Q + 3 * H))
  t_before=$((b_first + b_go + t_checks))
  # How long recover waits for the lock: the longest single step, and ending it.
  lock_wait=$b_copy
  for lb_n in $b_stop $b_integrity $b_start $b_exec $b_undo_start; do [ "$lb_n" -le "$lock_wait" ] || lock_wait=$lb_n; done
  lock_wait=$((lock_wait + HG))
}
print_bounds() {
  say "bounds, in seconds (each step is ended at its bound):"
  say "  before production is touched:"
  say "    $b_first  this Mac waits for the decider's first journal line"
  say "    $b_go  the decider waits for this Mac's go"
  say "    $t_checks  the decider's checks, production still up"
  say "  production offline:"
  say "    $((b_stop + Q))  stop the previous production and see it stopped"
  say "    $b_copy  copy the state folder (the snapshot)"
  say "    $b_integrity  the snapshot's read-only integrity check"
  say "    $H  name the verified snapshot"
  say "    $((b_start + 2 * Q))  start the new revision and identify it"
  say "  the new revision up, not yet confirmed:"
  say "    $b_health  wait for the engine to report it healthy (one budget for the whole wait)"
  say "    $((2 * b_exec))  enrolled keys and job count in the new container"
  say "    $b_evidence  wait for this Mac's evidence"
  say "    $((Q + END))  look at it once more right before the commit (if that look hangs: ended, then the undo)"
  say "  the undo, if it comes to that:"
  say "    $Q  see that no helper container of this run is left"
  say "    $((b_stop + 3 * Q))  stop and remove the new revision"
  say "    $((3 * H))  look at the state folders, set the changed state aside, put the snapshot back"
  say "    $((b_stop + 2 * Q))  stop the previous production again and see it stopped"
  say "    $((b_undo_start + 2 * Q))  start the previous production and identify it"
  say "    $((b_undo_health + 2 * Q))  identify it and wait for the engine to report it healthy"
  say "    $((b_settle + 2 * Q + P))  settle, then check it is still the same and still healthy"
  say "    $((H + WRITE))  count the jobs set aside (best effort) and write the record"
  say "    $t_ends  ending the five steps that may run into their bound without ending the undo"
  say "worst case, production offline or on an unconfirmed build: $t_worst seconds (about $(((t_worst + 30) / 60)) minutes)"
  say "  a pass takes at most $t_pass seconds; the longest stretch with nothing answering is $t_silent seconds"
  say "  These hold while the engine and the disk answer within their bounds. If an undo step itself"
  say "  fails, the decider halts, says production may be down, and waits for recover."
  say "worst_case=$t_worst pass_path=$t_pass silent_max=$t_silent before=$t_before"
}

mode="${1:-}"
if [ "$mode" = bounds ]; then
  load_bounds "${2:-}" || exit 1
  print_bounds
  exit 0
fi

# ---- Where this is, and which operation. ------------------------------------------------------
op="${2:-}"
case "$mode" in run | recover | status | check | current | prepare) ;; *) say "usage: decider.sh run|recover|status|check|current <operation> | prepare <operation> .. | bounds [<plan>]"; exit 2 ;; esac
case "$op" in "" | *[!A-Za-z0-9-]*) say "REFUSED the operation name is not one"; exit 2 ;; esac
here="$(cd "$(dirname "$0")" 2>/dev/null && pwd -P)" || exit 2
runs="$(dirname "$here")"
ctl="$(dirname "$runs")"
[ "$(basename "$here")" = "$op" ] && [ "$(basename "$runs")" = promote-runs ] ||
  { say "REFUSED this decider is not in promote-runs/$op of a control folder"; exit 2; }
[ -f "$ctl/.fleet-runner-production" ] || { say "REFUSED the folder above promote-runs is not marked as production's control folder"; exit 2; }
guard="$here/guard.pl"
plan="$here/plan"
journal="$here/journal"
groups="$here/groups"
englog="$here/engine.log"
records="$ctl/promote-records"
[ -f "$guard" ] || { say "REFUSED guard.pl is missing beside the decider"; exit 2; }
# Whatever the shell or a tool writes to stderr may name a path: it goes to this run's own log,
# never to the output a person or the Mac reads.
case "$mode" in status | current) exec 2> /dev/null ;; *) exec 2>> "$englog" ;; esac
# Every bound and wait is on the monotonic clock: if it cannot be read, nothing is started (the
# Mac's preflight runs check, so this is asked before anything is uploaded for a run).
case "$mode" in check | run | recover)
  perl "$guard" now > /dev/null || { say "REFUSED the server's monotonic clock cannot be read: no step could be bounded or timed. Nothing was changed."; exit 1; } ;;
esac

# ---- The plan: plain KEY=value lines, read as text, never run. ---------------------------------
pv() { sed -n "s/^$1=//p" "$plan" 2>/dev/null | head -n 1; }
plan_ok() {
  [ -f "$plan" ] || { say "REFUSED this operation has no plan"; return 1; }
  if grep -v -e '^[a-z][a-z0-9_]*=' "$plan" | grep -q .; then say "REFUSED the plan holds a line that is not key=value"; return 1; fi
  [ -z "$(sed -n 's/^\([a-z][a-z0-9_]*\)=.*/\1/p' "$plan" | sort | uniq -d)" ] || { say "REFUSED the plan names a key twice"; return 1; }
  [ "$(pv format)" = 1 ] || { say "REFUSED the plan's format is not one this decider knows"; return 1; }
  [ "$(pv op)" = "$op" ] || { say "REFUSED the plan is for another operation"; return 1; }
  p_mode="$(pv mode)" p_project="$(pv project)" p_root="$(pv root)" p_lan="$(pv lan)" p_port="$(pv port)"
  p_approval_sha="$(pv approval_sha256)" p_rehearsal="$(pv rehearsal)"
  case "$p_mode" in promote | revert) ;; *) say "REFUSED the plan's mode is not promote or revert"; return 1 ;; esac
  case "$p_project" in "" | [!a-z0-9]* | *[!a-z0-9_-]*) say "REFUSED the plan's project is not a Compose project name"; return 1 ;; esac
  case "$p_root" in /*) ;; *) say "REFUSED the plan's service root is not an absolute path"; return 1 ;; esac
  case "$p_root" in *[!A-Za-z0-9._/@+-]*) say "REFUSED the plan's service root holds an unexpected character"; return 1 ;; esac
  case "$p_lan" in "" | *[!0-9a-fA-F.:]*) say "REFUSED the plan's address is not one"; return 1 ;; esac
  case "$p_port" in "" | *[!0-9]*) say "REFUSED the plan's port is not a number"; return 1 ;; esac
  case "$p_approval_sha" in *[!0-9a-f]*) say "REFUSED the plan's approval hash is not one"; return 1 ;; esac
  [ "${#p_approval_sha}" -eq 64 ] || { say "REFUSED the plan's approval hash is not one"; return 1; }
  case "$p_rehearsal" in yes | no) ;; *) say "REFUSED the plan does not say whether this is a rehearsal"; return 1 ;; esac
  if [ "$p_mode" = promote ]; then
    p_rev="$(pv revision)" p_kind="$(pv kind)" p_container="$(pv container)" p_new_image="$(pv new_image)"
    p_cfg="$(pv resolved_sha256)" p_uidgid="$(pv uidgid)" p_prev_op="$(pv prev_op)" p_prev_cfg="$(pv prev_resolved_sha256)"
    p_key_ids="$(pv key_ids)" p_tls="$(pv tls_before)" p_stage_dir="$(pv stage_dir)"
    case "$p_stage_dir" in /*) ;; *) say "REFUSED the plan does not name the test copy's folder"; return 1 ;; esac
    case "$p_stage_dir" in *[!A-Za-z0-9._/@+-]*) say "REFUSED the plan's test copy folder holds an unexpected character"; return 1 ;; esac
    case "$p_rev" in *[!0-9a-f]*) say "REFUSED the plan's revision is not a commit ID"; return 1 ;; esac
    [ "${#p_rev}" -eq 40 ] || { say "REFUSED the plan's revision is not a full commit ID"; return 1; }
    case "$p_kind" in container | compose) ;; *) say "REFUSED the plan's kind is not container or compose"; return 1 ;; esac
    case "$p_container" in "" | [!A-Za-z0-9]* | *[!A-Za-z0-9_.-]*) say "REFUSED the plan's container is not a container name"; return 1 ;; esac
    is_image "$p_new_image" || { say "REFUSED the plan's image is not an image ID"; return 1; }
    is_sha "$p_cfg" || { say "REFUSED the plan's config hash is not one"; return 1; }
    case "$p_uidgid" in [1-9]*:[0-9]*) ;; *) say "REFUSED the plan's service account is not uid:gid"; return 1 ;; esac
    case "$p_uidgid" in *[!0-9:]*) say "REFUSED the plan's service account is not uid:gid"; return 1 ;; esac
    case "$p_key_ids" in "" | *[!a-z0-9,-]*) say "REFUSED the plan's key list is not a list of identities"; return 1 ;; esac
    case "$p_tls" in "" | *[!0-9A-F:]*) say "REFUSED the plan's certificate fingerprint is not one"; return 1 ;; esac
    if [ "$p_kind" = compose ]; then
      case "$p_prev_op" in "" | *[!A-Za-z0-9-]*) say "REFUSED the plan does not name the previous operation"; return 1 ;; esac
      is_sha "$p_prev_cfg" || { say "REFUSED the plan does not carry this Mac's hash of the previous config"; return 1; }
    fi
  else
    p_target="$(pv target)"
    case "$p_target" in "" | *[!A-Za-z0-9-]*) say "REFUSED the plan does not name the run to revert"; return 1 ;; esac
  fi
  # The control folder is where this decider is; a plan cannot name another. Neither may be inside the other.
  pk_root="$(cd "$p_root" 2>/dev/null && pwd -P)" || { say "REFUSED the plan's service root is not a folder"; return 1; }
  case "$pk_root/" in "$ctl"/*) say "REFUSED the service root is inside the control folder"; return 1 ;; esac
  case "$ctl/" in "$pk_root"/*) say "REFUSED the control folder is inside the service root"; return 1 ;; esac
  load_bounds "$plan" || return 1
  plan_sha="$(sha_file "$plan")"
}
# The SHA-256 of a file's bytes, exactly as they are on disk; empty if it cannot be read.
sha_file() { sha256sum "$1" 2>/dev/null | cut -d' ' -f1; }
is_sha() { case "$1" in *[!0-9a-f]*) return 1 ;; esac; [ "${#1}" -eq 64 ]; }
is_image() { case "$1" in sha256:*) is_sha "${1#sha256:}" ;; *) return 1 ;; esac; }
is_hex() { case "$1" in "" | *[!0-9a-f]*) return 1 ;; esac; }

# ---- The journals. ------------------------------------------------------------------------------
# Every journal is read ONCE, in this shell, by the guard, and checked: an absent journal, an empty
# one and a torn last line (cut) are states an operation can be in; a complete line that is not a
# record, or a journal that cannot be read, is not: load_journals fails, and whoever asked halts
# and changes nothing. What was read is kept in ALLJ ("<operation> <line>" per line) and every
# reader below reads ALLJ, so a later read can neither fail nor differ. The one line this decider
# itself appends is added to ALLJ when its append succeeded; when an append reports a failure the
# journals are read again (the line may or may not be there).
ALLJ="" JSTALE=no lj_bad=""
load_journals() {
  lj_out="$(perl "$guard" journals "$runs")"
  lj_rc=$?
  if [ "$lj_rc" -ne 0 ]; then
    lj_bad="$(printf '%s\n' "$lj_out" | sed -n 's/^BAD //p' | tail -n 1)"
    [ -n "$lj_bad" ] || lj_bad="the journals cannot be read"
    return 1
  fi
  ALLJ="$lj_out"
  JSTALE=no
}
# J <operation>: that operation's journal lines.
J() { printf '%s\n' "$ALLJ" | sed -n "s/^$1 //p"; }
jot() {
  jt_line="$(now) $*"
  if perl "$guard" append "$journal" "$jt_line"; then
    ALLJ="$ALLJ
$op $jt_line"
    return 0
  fi
  load_journals || JSTALE=yes
  return 1
}
jhas_of() { J "$1" | grep -q "^[^ ]* $2\( .*\)\{0,1\}\$"; }
jget_of() { J "$1" | sed -n "s/^[^ ]* $2 \(.*\)\$/ \1 /p" | tail -n 1 | sed -n "s/.* $3=\([^ ]*\) .*/\1/p"; }
jhas() { jhas_of "$op" "$1"; }
jget() { jget_of "$op" "$1" "$2"; }
# The operations that have a journal line, oldest folder name first.
ops_named() { printf '%s\n' "$ALLJ" | sed -n 's/^\([A-Za-z0-9-][A-Za-z0-9-]*\) .*/\1/p' | uniq; }

# Every operation, oldest first: "<seq> <op> <mode> <outcome or none>".
ops_table() {
  for ot_o in $(ops_named); do
    ot_seq="$(jget_of "$ot_o" begun seq)"
    [ -n "$ot_seq" ] || ot_seq="$(jget_of "$ot_o" done seq)"
    case "$ot_seq" in "" | *[!0-9]*) ot_seq=0 ;; esac
    ot_mode="$(jget_of "$ot_o" begun mode)"
    ot_out="$(jget_of "$ot_o" done outcome)"
    echo "$ot_seq $ot_o ${ot_mode:-none} ${ot_out:-none}"
  done | sort -n
}
# What production is now, by the journals: cur (container, or compose with cur_op), the highest
# sequence number, and any operation without a "done" line.
scan_ops() {
  cur=container cur_op=- maxseq=0 unfinished=""
  so_table="$(ops_table)"
  while read -r so_seq so_op so_mode so_out; do
    [ -n "$so_op" ] || continue
    maxseq="$so_seq"
    case "$so_mode:$so_out" in
      *:none) unfinished="$unfinished $so_op" ;;
      promote:pass) cur=compose; cur_op="$so_op" ;;
      revert:reverted)
        so_prev="$(jget_of "$so_op" verified prev)"
        if [ "$so_prev" = container ] || [ -z "$so_prev" ]; then cur=container; cur_op=-; else cur=compose; cur_op="$so_prev"; fi ;;
    esac
  done <<EOF_OPS
$so_table
EOF_OPS
  unfinished="${unfinished# }"
}
approval_spent() { printf '%s\n' "$ALLJ" | grep -q " spent approval=$1\$"; }
# Before anything is decided by the journals: read them, or stop here having changed nothing.
# (No line is written: the journal that cannot be read is not written to either.)
journals_or_stop() {
  load_journals && return 0
  say "HALTED $lj_bad."
  say "  Nothing was changed. A journal is the only record of what an operation did: until it can be"
  say "  read, no promote, recover or revert will run."
  exit 4
}

# ---- Ending: a halt names what is unresolved, changes nothing more, and blocks every other mode. --
halt() {
  h_code="$1"
  shift
  # (check is read-only: it holds no lock and writes no journal line, so it can block nothing.)
  [ "$mode" = check ] || jot halted "reason=$h_code" 2>/dev/null || true
  say "HALTED $*"
  say "  Nothing more was changed. This operation is unfinished, and no other promote, recover or revert"
  say "  will run until it is resolved; then run recover for $op again."
  exit 4
}
# A step that would not end: it may still be changing things, so nothing else may.
stuck() {
  st_who="$(perl "$guard" groups-alive "$groups" 2>/dev/null | sed 's/^/  still running: /')"
  [ "$mode" = check ] || jot halted "reason=step-would-not-end step=$1" 2>/dev/null || true
  st_msg="HALTED the step $1 could not be ended; production may be down until that process is ended."
  [ -z "$st_who" ] || st_msg="$st_msg
$st_who"
  say "$st_msg
  Nothing more was changed. This operation is unfinished, and no other promote, recover or revert
  will run until that process has ended; then run recover for $op."
  exit 4
}

# ---- Engine calls: each bounded, its process group recorded before it starts. --------------------
notes=no soft=""
bound_run() {
  br_label="$1" br_secs="$2"
  shift 2
  echo "$br_label $br_secs" >> "$here/steps.log" 2>/dev/null || true
  if [ "$notes" = yes ]; then
    perl "$guard" bound --note "$groups" "$br_label" $soft "$br_secs" 5 -- "$@" < /dev/null 2>> "$englog"
  else
    perl "$guard" bound "$br_secs" 5 -- "$@" < /dev/null 2>> "$englog"
  fi
}
# q <label> <seconds> cmd..: a query; its output is in OUT, never in a log.
q() {
  q_label="$1"
  OUT="$(bound_run "$@")"
  q_rc=$?
  [ "$q_rc" -ne 125 ] || stuck "$q_label"
  return "$q_rc"
}
# act <label> <seconds> cmd..: a call that changes something; its output goes to the engine log.
act() {
  a_label="$1"
  bound_run "$@" >> "$englog"
  a_rc=$?
  [ "$a_rc" -ne 125 ] || stuck "$a_label"
  return "$a_rc"
}
F_ID='{{.Id}} {{.Image}} {{.State.Running}} {{.State.Status}} policy={{.HostConfig.RestartPolicy.Name}}'
F_HEALTH='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
LABEL=com.docker.compose.project
# ident <label> <container>: sets i_id i_image i_running i_status i_policy; 1 if it cannot be inspected.
ident() {
  i_id="" i_image="" i_running="" i_status="" i_policy=""
  q "$1" "$Q" docker inspect --format "$F_ID" "$2" || return 1
  set -- $OUT
  [ "$#" -eq 5 ] || return 1
  i_id="$1" i_image="$2" i_running="$3" i_status="$4" i_policy="${5#policy=}"
}
project_ids() { q "$1" "$Q" docker ps -aq --no-trunc --filter "label=$LABEL=$p_project"; }

# ---- Helper containers: this run's own, named for it, never on a network. ----------------------
hname() { printf 'fleet-promote-%s-%s' "$op" "$1"; }
# After a helper failed or was ended, its container must be seen gone before anything else happens.
helper_gone() {
  hg_n="$(hname "$1")"
  act "rm-$1" "$Q" docker rm -f "$hg_n" || true
  q "gone-$1" "$Q" docker ps -aq --filter "name=^/$hg_n\$" || halt helper-unknown "could not see whether the helper container $1 is gone"
  [ -z "$OUT" ] || halt helper-remains "the helper container $1 could not be removed"
}
# helper <what> <seconds> <user> <rw|ro|only:<folder>> <entry> args..: a container of the checked
# image, on no network.
#   rw, ro           the whole service root at /srv (for root, 0:0)
#   only:<folder>    that ONE folder of the service root, at /srv/<folder>, writable
# only: is how the service account looks into a state folder. The service root itself is not that
# account's to pass through, and SQLite cannot open a database that is in write-ahead mode from a
# folder it may not write its index file to; the database itself is still opened read-only. (Both
# were found by the rehearsal on a real server; the copy and its check are otherwise untouched.)
helper() {
  hp_what="$1" hp_secs="$2" hp_user="$3" hp_mode="$4" hp_entry="$5"
  shift 5
  case "$hp_mode" in
    rw) hp_mount="$p_root:/srv" ;;
    only:*) hp_mount="$p_root/${hp_mode#only:}:/srv/${hp_mode#only:}" ;;
    *) hp_mount="$p_root:/srv:ro" ;;
  esac
  hp_rc=0
  OUT="$(bound_run "$hp_what" "$hp_secs" docker run --rm --name "$(hname "$hp_what")" --network none --user "$hp_user" \
    --entrypoint "$hp_entry" -v "$hp_mount" "$helper_image" "$@")" || hp_rc=$?
  [ "$hp_rc" -ne 125 ] || stuck "$hp_what"
  [ "$hp_rc" -eq 0 ] || helper_gone "$hp_what"
  return "$hp_rc"
}
PROBE_JS='const fs = require("fs");
const [snap, aside] = process.argv.slice(1);
const has = (n) => fs.existsSync("/srv/" + n);
const mark = (n) => { try { const m = /^op=([A-Za-z0-9-]+)$/m.exec(fs.readFileSync("/srv/" + n + "/.fleet-promote-snapshot", "utf8")); return m ? m[1] : "none"; } catch { return "none"; } };
const size = (p) => { let t = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = p + "/" + e.name; t += e.isDirectory() ? size(f) : fs.lstatSync(f).size; } return t; };
const out = { state: has("state"), state_marker: has("state") ? mark("state") : "none", pre: has("state.pre-" + snap), pre_marker: has("state.pre-" + snap) ? mark("state.pre-" + snap) : "none", part: has("state.pre-" + snap + ".part"), aside: has("state.failed-" + aside), aside_marker: has("state.failed-" + aside) ? mark("state.failed-" + aside) : "none" };
out.state_kb = out.state ? Math.ceil(size("/srv/state") / 1024) : 0;
const s = fs.statfsSync("/srv");
out.free_kb = Math.floor((s.bavail * s.bsize) / 1024);
out.same_fs = out.state ? fs.statSync("/srv/state").dev === fs.statSync("/srv").dev : true;
for (const [k, v] of Object.entries(out)) console.log(k + "=" + (v === true ? "yes" : v === false ? "no" : v));'
# probe: how the state folders lie. Sets s_state s_state_marker s_pre s_pre_marker s_part s_aside
# s_aside_marker s_state_kb s_free_kb s_same_fs. Changes nothing.
probe() {
  helper "probe-$1" "$H" 0:0 ro node -e "$PROBE_JS" "$u_snap" "$u_aside" || return 1
  pr_out="$OUT"
  pr() { printf '%s\n' "$pr_out" | sed -n "s/^$1=//p" | head -n 1; }
  s_state="$(pr state)" s_state_marker="$(pr state_marker)" s_pre="$(pr pre)" s_pre_marker="$(pr pre_marker)"
  s_part="$(pr part)" s_aside="$(pr aside)" s_aside_marker="$(pr aside_marker)" s_state_kb="$(pr state_kb)"
  s_free_kb="$(pr free_kb)" s_same_fs="$(pr same_fs)"
  [ -n "$s_state" ] && [ -n "$s_free_kb" ]
}
# quiet_helpers <label>: this run's helper containers, by name, removed and SEEN gone (and with
# them any copy or probe still running). They touch nothing of production's; removing them is
# never disruptive. 1 if they could not be listed or one remains.
quiet_helpers() {
  q "$1" "$Q" docker ps -aq --filter "name=^/fleet-promote-$op-" || return 1
  [ -n "$OUT" ] || return 0
  for qh_h in $OUT; do act "$1-rm" "$Q" docker rm -f "$qh_h" || true; done
  q "$1-seen" "$Q" docker ps -aq --filter "name=^/fleet-promote-$op-" || return 1
  [ -z "$OUT" ]
}
# The three layouts a snapshot swap can be in, by name AND by the marker inside the snapshot.
#   1: the live state and the snapshot, nothing set aside        (nothing done yet)
#   2: the state set aside, the snapshot not yet in its place    (the first rename done)
#   3: the state set aside, the snapshot in place as the state   (both done)
#   0: anything else
layout() {
  if [ "$s_state" = yes ] && [ "$s_state_marker" != "$u_snap" ] && [ "$s_pre" = yes ] && [ "$s_pre_marker" = "$u_snap" ] && [ "$s_aside" = no ]; then echo 1
  elif [ "$s_state" = no ] && [ "$s_pre" = yes ] && [ "$s_pre_marker" = "$u_snap" ] && [ "$s_aside" = yes ] && [ "$s_aside_marker" != "$u_snap" ]; then echo 2
  elif [ "$s_state" = yes ] && [ "$s_state_marker" = "$u_snap" ] && [ "$s_pre" = no ] && [ "$s_aside" = yes ] && [ "$s_aside_marker" != "$u_snap" ]; then echo 3
  else echo 0; fi
}
RENAME_JS='const fs = require("fs");
const [from, to] = process.argv.slice(1);
if (fs.existsSync("/srv/" + to)) { console.log("exists"); process.exit(1); }
fs.renameSync("/srv/" + from, "/srv/" + to);
const d = fs.openSync("/srv", "r"); fs.fsyncSync(d); fs.closeSync(d);
console.log("renamed");'
NAME_JS='const fs = require("fs");
const [name] = process.argv.slice(1);
const part = "/srv/state.pre-" + name + ".part";
const f = fs.openSync(part + "/.fleet-promote-snapshot", "w"); fs.writeSync(f, "op=" + name + "\n"); fs.fsyncSync(f); fs.closeSync(f);
const p = fs.openSync(part, "r"); fs.fsyncSync(p); fs.closeSync(p);
fs.renameSync(part, "/srv/state.pre-" + name);
const d = fs.openSync("/srv", "r"); fs.fsyncSync(d); fs.closeSync(d);
console.log("named");'
SNAP_JS='const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const check = db.prepare("PRAGMA integrity_check").all().map((r) => Object.values(r)[0]);
const version = db.prepare("PRAGMA user_version").get().user_version;
const jobs = db.prepare("SELECT count(*) AS n FROM jobs").get().n;
db.close();
if (check.length !== 1 || check[0] !== "ok") { console.log("integrity-failed"); process.exit(1); }
console.log("ok " + version + " " + jobs);'

# ---- What an undo needs, read from this operation's own journal and folder. ---------------------
# u_prev (container, or the previous operation) u_prev_id u_prev_image u_prev_rev u_prev_cfg
# u_snap (whose snapshot) u_aside (the name the changed state is set aside under) helper_image
load_undo_facts() {
  u_prev="$(jget verified prev)" u_prev_id="$(jget verified prev_id)" u_prev_image="$(jget verified prev_image)"
  u_prev_rev="$(jget verified prev_rev)" u_prev_cfg="$(jget verified prev_cfg)" u_snap="$(jget verified snap)"
  u_aside="$op" helper_image="$(jget verified helper_image)" u_keys="$(jget verified keys)"
  [ -n "$u_prev" ] && [ -n "$u_snap" ] && [ -n "$helper_image" ]
}
swap_needed() { [ "$p_mode" = revert ] || jhas starting; }
# Everything the undo will need, checked without changing anything. Says what is missing.
prerequisites() {
  pq_missing=""
  if [ "$u_prev" = container ]; then
    if ident prereq-previous "$u_prev_id"; then
      [ "$i_image" = "$u_prev_image" ] || pq_missing="$pq_missing; the previous container no longer has the image it had"
      case "$i_policy" in no | unless-stopped) ;; *) pq_missing="$pq_missing; the previous container's restart policy is no longer one that stays stopped" ;; esac
      # The image it would run from, by ID: a container can outlive its image.
      if q prereq-image "$Q" docker image inspect --format '{{.Id}}' "$u_prev_image" && [ "$OUT" = "$u_prev_image" ]; then :; else
        pq_missing="$pq_missing; the image of the previous production's container is no longer on the server"
      fi
    else
      pq_missing="$pq_missing; the previous production's container is gone"
    fi
  else
    if [ "$(sha_file "$here/previous.json")" != "$u_prev_cfg" ]; then
      pq_missing="$pq_missing; this run's copy of the previous config is missing or changed"
    fi
    if q prereq-image "$Q" docker image inspect --format '{{.Id}}' "$u_prev_image" && [ "$OUT" = "$u_prev_image" ]; then :; else
      pq_missing="$pq_missing; the previous revision's image is no longer on the server"
    fi
    if q prereq-tag "$Q" docker image inspect --format '{{.Id}}' "fleet-runner:$u_prev_rev" && [ "$OUT" = "$u_prev_image" ]; then :; else
      pq_missing="$pq_missing; the previous revision's image name no longer names that image"
    fi
  fi
  if q prereq-helper "$Q" docker image inspect --format '{{.Id}}' "$helper_image" && [ "$OUT" = "$helper_image" ]; then
    if probe prereq; then
      [ "$s_same_fs" = yes ] || pq_missing="$pq_missing; the state folder is not on the service root's own filesystem"
      if swap_needed; then
        [ "$(layout)" != 0 ] || pq_missing="$pq_missing; the state folders are not in a layout this operation left (state, its snapshot with its marker, the set-aside copy)"
      else
        [ "$s_state" = yes ] || pq_missing="$pq_missing; the state folder is missing"
      fi
    else
      pq_missing="$pq_missing; the state folders could not be read"
    fi
  else
    pq_missing="$pq_missing; the image the helper containers run from is gone"
  fi
  pq_missing="${pq_missing#; }"
  [ -z "$pq_missing" ]
}

# ---- The lock. ---------------------------------------------------------------------------------
# take_lock <seconds to keep trying>: descriptor 9 on the control folder, kept for this process's life.
take_lock() {
  exec 9< "$ctl" || { say "REFUSED the control folder cannot be opened"; exit 2; }
  tl_i=0
  while :; do
    perl "$guard" lock 9
    tl_rc=$?
    [ "$tl_rc" -ne 0 ] || break
    [ "$tl_rc" -eq 1 ] || { say "REFUSED this server gave no kernel lock on the control folder; nothing was changed"; exit 2; }
    if [ "$tl_i" -ge "$1" ]; then
      # Who holds it is looked up first and the whole answer said in one write: whoever reads this
      # output while it is written sees all of it or none.
      # (Not in a pipeline: whatever shared it would hold the folder's descriptor too, and be named.)
      tl_who="$(perl "$guard" holders "$ctl" "$$" 2>/dev/null)"
      [ -z "$tl_who" ] || tl_who="$(printf '%s\n' "$tl_who" | sed 's/^/  holding it: process /')"
      tl_msg="REFUSED another promote, recover or revert holds the lock: its decider, or a step it started that is still running. Nothing was changed."
      [ -z "$tl_who" ] || tl_msg="$tl_msg
$tl_who"
      [ "$1" -eq 0 ] || tl_msg="$tl_msg
  If a step is stuck, production may be down until that process is ended."
      say "$tl_msg"
      exit 75
    fi
    tl_i=$((tl_i + 1))
    sleep 1
  done
  # A filesystem that grants the same lock twice is no lock.
  if (exec 9<&-; exec 9< "$ctl"; perl "$guard" lock 9); then
    say "REFUSED this server's filesystem does not keep an exclusive lock on the control folder; nothing was changed"
    exit 2
  fi
}

# wait_file <file> <nonce> <seconds>: 0 once <file> holds nonce=<nonce>; anything else is ignored.
# The guard waits, by a clock that cannot be set: the window is the stated number of seconds, not
# a count of sleeps that a busy server would stretch.
wait_file() { perl "$guard" wait-nonce "$1" "$2" "$3"; }
# mono: whole seconds on that clock, in MONO; 1 if it cannot be read.
mono() {
  MONO="$(perl "$guard" now)" || return 1
  case "$MONO" in "" | *[!0-9]*) return 1 ;; esac
}
# health_of <label> <container> <seconds>: one look. Sets health to what the engine says: healthy,
# starting, unhealthy, or none (the container has no health check). 1 if it could not be read.
health_of() {
  health=""
  # The look's status is taken in the else branch: after an if whose branch did not run, $? is 0.
  if bound_run "$1" "$3" docker inspect --format "$F_HEALTH" "$2" > "$here/.health" 2>> "$englog"; then
    health="$(head -n 1 "$here/.health")"
    case "$health" in healthy | starting | unhealthy | none) return 0 ;; esac
    health=""
    return 1
  else
    ho_rc=$?
  fi
  [ "$ho_rc" -ne 125 ] || stuck "$1"
  return 1
}
# wait_health <label> <container> <seconds>: 0 once the engine reports it healthy, or says it has no
# health check for it (health=none: then "running" is all that was observed, and that is what gets
# recorded, never "healthy"). ONE budget for the whole wait: a look is only started if its bound
# and the ending of a look that runs into it still fit, so the wait never runs past <seconds>.
wait_health() {
  mono || return 1
  wh_until=$((MONO + $3))
  while :; do
    mono || return 1
    # (Less a second: the clock is read in whole seconds, so up to one may already be gone.)
    wh_b=$((wh_until - MONO - END - 1))
    [ "$wh_b" -le "$P" ] || wh_b=$P
    [ "$wh_b" -ge 1 ] || return 1
    if health_of "$1" "$2" "$wh_b"; then
      case "$health" in healthy | none) return 0 ;; esac
    fi
    sleep 1
  done
}
# In words, for a person and for the record.
health_words() { if [ "$1" = none ]; then printf 'running (the engine has no health check for it)'; else printf 'healthy, by the engine'; fi; }
# stop_seen <label> <container>: stop it and SEE it not running. A stop the engine accepted goes on
# after its client is gone, so "running" is never trusted after a stop that failed or timed out:
# the stop is asked again and the container must be observed stopped. 1: it could not be observed.
stop_seen() {
  act "$1" "$b_stop" docker stop -t "$stop_grace" "$2" || true
  ident "$1-seen" "$2" || return 1
  [ "$i_running" = false ]
}

# ---- Records. ----------------------------------------------------------------------------------
prev_words() {
  if [ "$u_prev" = container ]; then printf 'the hand-started container %s' "$(printf '%s' "$u_prev_id" | cut -c1-12)"
  else printf 'revision %s (run %s)' "$(printf '%s' "$u_prev_rev" | cut -c1-12)" "$u_prev"; fi
}
publish() { perl "$guard" publish "$records/$1"; }

# =================================================================================================
# The undo. Every step is "make it so" and looks at what is there; it is entered by the run itself
# on any failure once the yes is spent, by recover, and (as its whole purpose) by a revert.
# A journal line that cannot be written does not stop it: production coming back matters more
# than the line, and recover completes the record later.
# =================================================================================================
journal_broken=no
ujot() {
  [ "$journal_broken" = no ] || return 0
  jot "$@" || { journal_broken=yes; say "the journal cannot be written; the undo carries on, and its record will be incomplete"; }
}
# already_undone: LOOKS, changes nothing that runs. True when what an undo would bring about is
# already there: no helper of this run, the previous production running with its recorded identity
# and nothing of the project beside it, and the state folders as the undo leaves them. Asked only
# by recover, and only where no stop of the previous production can still be on its way (the
# journal says it was SEEN stopped, or this is a revert, which never stops it before the undo):
# then a previous production that runs was started by an undo whose lines did not get written,
# and stopping it again would take a healthy production down for nothing.
already_undone() {
  [ "$p_mode" = revert ] || jhas stopped || return 1
  quiet_helpers undo-observe || return 1
  previous_now || return 1
  if swap_needed; then
    probe observe || return 1
    [ "$(layout)" = 3 ] || return 1
  fi
  return 0
}
undo_observed=no
undo() {
  ud_reason="$1"
  soft="--soft-note"
  load_undo_facts || halt undo-facts "this operation's journal does not say what to put back"
  say "undoing ($ud_reason): putting back $(prev_words)"
  if [ "$undo_observed" = ask ] && already_undone; then
    # Nothing is stopped, removed, renamed or started: only looked at, then recorded.
    undo_observed=yes
    say "what the undo brings about is already there: the previous production runs; it is checked and recorded, not stopped again"
    jhas undoing || ujot undoing "reason=$ud_reason"
    jhas undo-quiet || ujot undo-quiet observed=1
    jhas undo-new-removed || ujot undo-new-removed observed=1
    jhas undo-state-aside || ujot undo-state-aside observed=1
    jhas undo-state-back || ujot undo-state-back observed=1
    jhas undo-previous-stopped || ujot undo-previous-stopped observed=1
    jhas undo-previous-started || ujot undo-previous-started "id=$prev_now" observed=1
  fi
  [ "$undo_observed" = yes ] || undo_steps
  # 5. Healthy, by the engine, or running where the engine has no health check for it. (Its signed
  # status is the Mac's to check; the server has no key.)
  previous_now || halt previous-identity "what runs now is not the previous production; production state is unknown"
  wait_health undo-health "$prev_now" "$b_undo_health" || halt previous-unhealthy "the previous production is started but the engine does not report it healthy"
  ud_health="$health"
  jhas undo-healthy || ujot undo-healthy "health=$ud_health"
  # 6. Settle, then look again: only what was just seen to be true is recorded as done.
  sleep "$b_settle"
  previous_now || halt previous-identity "after settling, what runs is not the previous production; production state is unknown"
  health_of undo-recheck "$prev_now" "$P" && [ "$health" = "$ud_health" ] || halt previous-unhealthy "after settling, the engine no longer reports the previous production as it did"
  ud_checked="$(now)"
  # 7. What the unconfirmed build accepted, for the owner. Best effort; never fails the undo.
  ud_jobs="unknown"
  if swap_needed; then
    if helper jobs-aside "$H" "$u_uidgid" "only:state.failed-$u_aside" node -e "$SNAP_JS" "/srv/state.failed-$u_aside/fleet.sqlite" 2>/dev/null; then
      ud_jobs="$(printf '%s' "$OUT" | sed -n 's/^ok [0-9]* \([0-9][0-9]*\)$/\1/p')"
    fi
  fi
  finish_undo
}
# The undo's own steps, 1 to 4: each makes it so and then looks.
undo_steps() {
  # 1. This run's helper containers, by name, and with them any copy still being written.
  if ! jhas undo-quiet; then
    quiet_helpers undo-quiet || halt helpers-remain "a helper container of this run could not be listed or removed"
    # A copy that was never verified is only in the way (and is the likeliest thing to have filled
    # the disk). Only this run's own, only the unverified one.
    if [ "$p_mode" = promote ] && ! jhas snapshot; then
      helper drop-partial "$H" 0:0 rw sh -c 'rm -rf "/srv/state.pre-$1.part"' sh "$op" || say "this run's unverified snapshot copy could not be removed (it is left; nothing uses it)"
    fi
    jhas undoing || ujot undoing "reason=$ud_reason"
    ujot undo-quiet
  fi
  # 2. The new revision, gone: stopped, removed, and seen to be gone. (Compose is a client: with
  # its group ended it sends nothing more. One call already accepted may still land; a container
  # created late is never started, and the check at every mode's entry finds it.)
  if ! jhas undo-new-removed; then
    if swap_needed; then
      project_ids undo-list || halt engine-unknown "could not list the production project's containers"
      if [ -n "$OUT" ]; then
        ud_ids="$OUT"
        act undo-stop-new "$b_stop" docker stop -t "$stop_grace" $ud_ids || true
        act undo-rm-new "$Q" docker rm -f $ud_ids || true
      fi
      project_ids undo-list-seen || halt engine-unknown "could not list the production project's containers"
      [ -z "$OUT" ] || halt new-remains "the new revision's container could not be removed; production state is unknown"
      ujot undo-new-removed
    else
      ujot undo-new-removed skipped=1
    fi
  fi
  # 3. The state folder: the changed one aside, the verified snapshot back. Two renames, each one
  # atomic and flushed; where they stand is read from the folders and the snapshot's marker.
  if ! jhas undo-state-back; then
    if swap_needed; then
      probe undo || halt state-unknown "the state folders could not be read; production state is unknown"
      case "$(layout)" in
        1)
          helper state-aside "$H" 0:0 rw node -e "$RENAME_JS" state "state.failed-$u_aside" || halt state-rename "the changed state folder could not be set aside; production is down"
          ujot undo-state-aside
          helper state-back "$H" 0:0 rw node -e "$RENAME_JS" "state.pre-$u_snap" state || halt state-rename "the snapshot could not be put back as the state folder; production is down"
          ;;
        2)
          jhas undo-state-aside || ujot undo-state-aside
          helper state-back "$H" 0:0 rw node -e "$RENAME_JS" "state.pre-$u_snap" state || halt state-rename "the snapshot could not be put back as the state folder; production is down"
          ;;
        3) jhas undo-state-aside || ujot undo-state-aside ;;
        *) halt state-layout "the state folders are not in a layout this operation left; nothing was renamed and production is down" ;;
      esac
      ujot undo-state-back
    else
      ujot undo-state-aside skipped=1
      ujot undo-state-back skipped=1
    fi
  fi
  # 4. The previous production. If its own container still exists it is stopped first and SEEN
  # stopped (an earlier stop may still be on its way), and only then started.
  # (A journal line saying it was started is not taken for an answer either: a stop that was on
  # its way may have landed since. What counts is what runs now.)
  if jhas undo-previous-started && previous_now; then :; else
    ud_have=no
    if [ "$u_prev_id" != - ] && ident undo-previous "$u_prev_id"; then ud_have=yes; fi
    if [ "$ud_have" = yes ]; then
      [ "$i_image" = "$u_prev_image" ] || halt previous-changed "the previous production's container no longer has the image it had; it was not started"
      stop_seen undo-stop-previous "$u_prev_id" || halt previous-unknown "the previous production could not be seen stopped before starting it; production state is unknown"
      jhas undo-previous-stopped || ujot undo-previous-stopped
      act undo-start-previous "$b_undo_start" docker start "$u_prev_id" || halt previous-start "the previous production could not be started; production is down"
    elif [ "$u_prev" = container ]; then
      halt previous-gone "the previous production's container is gone; production is down"
    else
      jhas undo-previous-stopped || ujot undo-previous-stopped skipped=1
      echo "undo-start-previous $b_undo_start" >> "$here/steps.log" 2>/dev/null || true
      perl "$guard" bound --note "$groups" undo-start-previous $soft --stdin-checked "$here/previous.json" "$u_prev_cfg" "$b_undo_start" 5 -- \
        docker compose -p "$p_project" --env-file /dev/null -f - up -d --pull never >> "$englog" 2>&1
      ud_rc=$?
      [ "$ud_rc" -ne 125 ] || stuck undo-start-previous
      [ "$ud_rc" -ne 122 ] || halt previous-config "this run's copy of the previous config is not the one that was checked; it was not started and production is down"
      [ "$ud_rc" -eq 0 ] || halt previous-start "the previous production could not be started; production is down"
    fi
    previous_now || halt previous-identity "what runs now is not the previous production; production state is unknown"
    jhas undo-previous-started || ujot undo-previous-started "id=$prev_now"
  fi
}
# previous_now: the previous production, running, with the identity recorded, and nothing else of
# the production project running beside it. Sets prev_now. (A container an interrupted call created
# late and nobody started does not run; the check at the next operation's entry finds it.)
running_ids() { q "$1" "$Q" docker ps -q --no-trunc --filter "label=$LABEL=$p_project"; }
previous_now() {
  running_ids undo-identify-list || return 1
  pn_running="$OUT"
  if [ "$u_prev" = container ]; then
    [ -z "$pn_running" ] || return 1
    ident undo-identify "$u_prev_id" || return 1
  else
    set -- $pn_running
    [ "$#" -eq 1 ] || return 1
    ident undo-identify "$1" || return 1
  fi
  prev_now="$i_id"
  [ "$i_image" = "$u_prev_image" ] && [ "$i_running" = true ]
}
finish_undo() {
  if [ "$p_mode" = revert ]; then fu_outcome=reverted fu_record="revert-$op.txt"; else fu_outcome=undone fu_record="undo-$op.txt"; fi
  fu_snap_jobs="$(jget_of "$u_snap" snapshot jobs)"
  # The record is made in memory and written whole by one checked writer (the guard's publish).
  fu_text="$({
    if [ "$p_mode" = revert ]; then echo "revert $op of run $(pv target): production put back to $(prev_words)"
    else echo "undo of promote $op: production put back to $(prev_words); $(printf '%s' "$p_rev" | cut -c1-12) was NOT promoted"; fi
    echo "reason: $(jget undoing reason)"
    echo "checked: $ud_checked, by the engine: the previous production runs with the identity recorded before the switch; it is $(health_words "$ud_health")."
    echo "  Its signed status was not checked from the server (the server holds no client key)."
    if swap_needed; then
      echo "state: the snapshot state.pre-$u_snap is the state folder again; the state the other build ran on is state.failed-$u_aside"
      echo "jobs: the set-aside state holds ${ud_jobs:-unknown}; the snapshot held ${fu_snap_jobs:-unknown}. Jobs accepted in between are only in the set-aside state."
    else
      echo "state: the state folder was never changed. A snapshot copy this run made, if any, is left unused."
    fi
    echo "approval_sha256: $(jget spent approval)"
  } 2>/dev/null)"
  fu_ok=yes
  [ "$journal_broken" = no ] || fu_ok=no
  if [ "$fu_ok" = yes ]; then printf '%s\n' "$fu_text" | publish "$fu_record" || fu_ok=no; fi
  if [ "$fu_ok" = yes ]; then jot done "outcome=$fu_outcome" "checked=$ud_checked" "record=$fu_record" || fu_ok=no; fi
  if [ "$fu_ok" = yes ]; then
    if [ "$p_mode" = revert ]; then say "REVERTED production is back on $(prev_words) (checked $ud_checked; record: promote-records/$fu_record)"
    else say "UNDONE production is back on $(prev_words) (checked $ud_checked; record: promote-records/$fu_record)"; fi
    [ "$p_mode" = revert ] && exit 0
    exit 1
  fi
  say "UNDONE, RECORD INCOMPLETE production is back on $(prev_words) (checked $ud_checked), but the journal or the record could not be written."
  # Said as recover will act: it decides by the journal (already_undone), not by what this run saw.
  if [ "$p_mode" = revert ] || jhas stopped; then
    say "  Run recover for $op once the disk can be written; it completes the record."
  else
    say "  Run recover for $op once the disk can be written. The journal does not show the previous production seen stopped, so recover cannot rule out a stop still on its way:"
    say "  recover will stop the previous production, see it stopped and start it again (a short outage), then complete the record."
  fi
  exit 3
}
# A committed pass: its record, then "done". Entered by the run right after "committed", and by
# recover when a decider died between the two. It never undoes. It writes "done outcome=pass" only
# if the new revision is seen running right now.
commit_records() {
  cr_time="$(J "$op" | sed -n 's/^\([^ ]*\) committed$/\1/p' | tail -n 1)"
  cr_cid="$(jget started cid)" cr_image="$(jget verified new_image)"
  if ident commit-seen "$cr_cid" && [ "$i_image" = "$cr_image" ] && [ "$i_running" = true ]; then :; else
    jot halted reason=committed-not-running 2>/dev/null || true
    say "HALTED the pass of $op was committed at $cr_time, but the revision is NOT seen running now."
    say "  A committed pass is never undone by recover. Nothing was changed. Once the revision runs again,"
    say "  run recover for $op; it then completes the record. Until then no other operation will run."
    exit 4
  fi
  cr_checked="$(now)"
  # Made in memory and written whole by one checked writer; "done" only after it is written.
  cr_text="$({
    echo "promote $op: $(prev_words) -> $(jget begun rev)"
    echo "committed: $cr_time; seen running: $cr_checked"
    echo "approval_sha256: $(jget spent approval)"
    printf 'approval: %s\n' "$(pv approval)"
    echo "snapshot: state.pre-$op ($(jget snapshot jobs) jobs, schema $(jget snapshot schema))"
    echo "config sha256: $(jget verified cfg); image: $cr_image"
    echo "evidence from the Mac: signed status answered with this revision; the same TLS certificate"
    echo "to go back to $(prev_words): fleet-promote.sh revert $op --owner-approved '<the owner's yes, naming $op>'"
    echo "  An owner-run command: it sets aside every job accepted since this promote. No agent runs it without the owner's yes naming this run."
    if [ "$u_prev" = container ]; then echo "  The hand-started container stays stopped for that; the owner may remove it once a revert is no longer wanted."; fi
  } 2>/dev/null)"
  if printf '%s\n' "$cr_text" | publish "promote-$op.txt" && jot done outcome=pass "checked=$cr_checked" "record=promote-$op.txt"; then
    say "PASS production runs $(jget begun rev) (committed $cr_time, seen running $cr_checked; record: promote-records/promote-$op.txt)"
    exit 0
  fi
  say "COMMITTED, RECORD INCOMPLETE the pass of $op is committed, but its record or the journal's last line could not be written."
  say "  Not reported as a pass. Run recover for $op once the disk can be written; it completes the record."
  exit 3
}
# Compose prefers a variable of the calling shell over its env file: none is inherited.
clean_env() {
  for ce_v in $(env | sed -n -e 's/^\(FLEET_[A-Za-z0-9_]*\)=.*/\1/p' -e 's/^\(COMPOSE_[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$ce_v"; done
}
# An operation that changed nothing in production ends here.
close_unchanged() {
  cu_reason="$1"
  shift
  say "REFUSED $*"
  say "nothing was changed in production"
  cu_text="$({
    echo "operation $op: nothing was changed in production"
    echo "reason: $cu_reason ($*)"
    echo "the owner's yes was $(if jhas spent; then echo spent; else echo not spent; fi)"
  } 2>/dev/null)"
  if printf '%s\n' "$cu_text" | publish "undo-$op.txt" && jot done outcome=unchanged "reason=$cu_reason" "seq=${seq:-0}" "record=undo-$op.txt"; then exit 1; fi
  say "  (the journal or the record could not be written; run recover for $op to close it)"
  exit 3
}

# =================================================================================================
# The checks, used by check (read-only, no lock) and by run (under the lock): everything a run
# would refuse on, and every prerequisite of its undo. Sets the v_* facts the journal records.
# =================================================================================================
verify_form() {
  scan_ops
  vf_others=""
  for vf_o in $unfinished; do [ "$vf_o" = "$op" ] || vf_others="$vf_others $vf_o"; done
  [ -z "$vf_others" ] || { why="operation${vf_others} is unfinished: run recover for it first"; return 1; }
  ! approval_spent "$p_approval_sha" || { why="this approval was already used: each yes covers one operation"; return 1; }
  # A rehearsal is marked in BOTH places, its control folder and its service root, and a real
  # promote in neither: a throwaway control folder cannot be paired with production's own folders.
  vf_rm=.fleet-runner-promote-rehearsal
  if [ "$p_rehearsal" = yes ]; then
    [ -f "$ctl/$vf_rm" ] || { why="a rehearsal needs a throwaway production (its control folder carries the rehearsal marker)"; return 1; }
    [ -f "$p_root/$vf_rm" ] || { why="a rehearsal needs a throwaway production: this service root does not carry the rehearsal marker, so it may be production's own"; return 1; }
  else
    [ ! -f "$ctl/$vf_rm" ] || { why="this control folder is a rehearsal's; a real promote does not run in it"; return 1; }
    [ ! -f "$p_root/$vf_rm" ] || { why="this service root is a rehearsal's; a real promote does not run on it"; return 1; }
  fi
  v_ctl="$(perl -e '@s = stat($ARGV[0]); print "$s[0]:$s[1]\n" if @s' "$ctl")"
  for vf_j in $(ops_named); do
    vf_c="$(jget_of "$vf_j" begun ctl)"
    [ -z "$vf_c" ] || [ "$vf_c" = "$v_ctl" ] || { why="the control folder is not the folder earlier operations ran in (it was replaced or copied)"; return 1; }
  done
  return 0
}
# The port, the five mounts and no privileges: what the plan and the Compose file say, on what runs.
runs_as_planned() {
  q verify-port "$Q" docker inspect --format '{{json .HostConfig.PortBindings}}' "$1" || { why="the running production cannot be inspected"; return 1; }
  [ "$OUT" = "{\"8787/tcp\":[{\"HostIp\":\"$p_lan\",\"HostPort\":\"$p_port\"}]}" ] || { why="the running production's published address and port are not the plan's"; return 1; }
  q verify-mounts "$Q" docker inspect --format '{{range .Mounts}}{{.Type}} {{.Source}} {{.Destination}} {{.RW}}{{println}}{{end}}' "$1" || { why="the running production cannot be inspected"; return 1; }
  rp_have="$(printf '%s\n' "$OUT" | grep -v '^$' | sort)"
  rp_want="$(printf 'bind %s/%s %s %s\n' \
    "$p_root" state /var/lib/fleet-runner/state true "$p_root" output /var/lib/fleet-runner/output true \
    "$p_root" inputs /var/lib/fleet-runner/inputs true "$p_root" public-keys /run/fleet-runner/public-keys false \
    "$p_root" tls /run/fleet-runner/tls false | sort)"
  [ "$rp_have" = "$rp_want" ] || { why="the running production's mounts are not the five service folders under the plan's root"; return 1; }
  q verify-privileges "$Q" docker inspect --format '{{.HostConfig.Privileged}} {{len .HostConfig.CapAdd}} {{len .HostConfig.Devices}} {{.HostConfig.NetworkMode}} {{.HostConfig.AutoRemove}}' "$1" || { why="the running production cannot be inspected"; return 1; }
  case "$OUT" in "false 0 0 bridge false" | "false 0 0 ${p_project}_default false") ;; *) why="the running production has privileges, devices, a network or an auto-remove the Compose file does not give"; return 1 ;; esac
}
# The first cutover: the hand-started container's settings must be exactly what the Compose file
# reproduces. Names only are ever printed, never a setting's value.
first_env_check() {
  q verify-env "$Q" docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" || { why="the hand-started container cannot be inspected"; return 1; }
  fe_envs="$OUT"
  q verify-image-env "$Q" docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$2" || { why="the hand-started container's image cannot be inspected"; return 1; }
  fe_ienv="$OUT"
  for fe_k in $(printf '%s\n' "$fe_envs" | sed -n 's/=.*//p'); do
    fe_v="$(printf '%s\n' "$fe_envs" | sed -n "s|^$fe_k=||p" | tail -n 1)"
    case "$fe_k" in
      FLEET_BUILD_REF) ;;
      FLEET_WORKERS | FLEET_OBSERVERS) case "$fe_v" in "" | *[!a-z0-9,-]*) why="$fe_k is not a plain list of identity names"; return 1 ;; esac ;;
      FLEET_DB) [ "$fe_v" = /var/lib/fleet-runner/state/fleet.sqlite ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      FLEET_OUT_DIR) [ "$fe_v" = /var/lib/fleet-runner/output ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      FLEET_INPUT_DIR) [ "$fe_v" = /var/lib/fleet-runner/inputs ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      FLEET_PUBLIC_KEYS_DIR) [ "$fe_v" = /run/fleet-runner/public-keys ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      FLEET_PORT) [ "$fe_v" = 8787 ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      FLEET_TLS_CERT) [ "$fe_v" = /run/fleet-runner/tls/server.crt ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      FLEET_TLS_KEY) [ "$fe_v" = /run/fleet-runner/tls/server.key ] || { why="$fe_k differs from the standard one"; return 1; } ;;
      *) printf '%s\n' "$fe_ienv" | grep -qxF -- "$fe_k=$fe_v" || { why="$fe_k is set on the container and would not carry over"; return 1; } ;;
    esac
  done
  for fe_k in FLEET_WORKERS FLEET_OBSERVERS FLEET_INPUT_DIR FLEET_TLS_CERT FLEET_TLS_KEY; do
    printf '%s\n' "$fe_envs" | grep -q "^$fe_k=" || { why="$fe_k is not set on the container"; return 1; }
  done
}
# This run carries its own copy of the config it would go back to (into its own folder only):
# checked here, journaled by its hash, and checked again before any use.
carry_previous() {
  cp "$1" "$here/previous.json" && perl "$guard" sync-path "$here/previous.json" "$here" && [ "$(sha_file "$here/previous.json")" = "$v_prev_cfg" ] ||
    { why="the config to go back to could not be copied into this run's folder"; return 1; }
}
keys_hash() { printf '%s\n' "$1" | sort | sha256sum | cut -d' ' -f1; }
keys_named() { printf '%s\n' "$1" | sed -n 's/^[0-9a-f]\{64\}  \(.*\)\.pub$/\1/p' | sort | tr '\n' ',' | sed 's/,$//'; }
verify_promote() {
  v_helper="$p_new_image"
  helper_image="$v_helper" u_snap="$op" u_aside="$op"
  [ "$p_kind" = "$cur" ] || { why="the plan says production is a $p_kind production, the journals say $cur"; return 1; }
  q verify-new-image "$Q" docker image inspect --format '{{.Id}}' "fleet-runner:$p_rev" || { why="the staged image of this revision is not on the server"; return 1; }
  [ "$OUT" = "$p_new_image" ] || { why="the server's image of this revision is not the one this Mac's receipt names"; return 1; }
  [ "$(sha_file "$here/resolved.json")" = "$p_cfg" ] || { why="the Compose config in this run's folder is not the one that was checked"; return 1; }
  project_ids verify-project || { why="the production project's containers cannot be listed"; return 1; }
  vp_ids="$OUT"
  if [ "$p_kind" = container ]; then
    [ -z "$vp_ids" ] || { why="a container of the production project already exists, although no promote has passed"; return 1; }
    ident verify-previous "$p_container" || { why="the hand-started container cannot be inspected"; return 1; }
    [ "$i_running" = true ] || { why="the hand-started container is not running"; return 1; }
    # A container with restart policy "always" comes back at a reboot even though it was stopped,
    # on top of the new revision's state. Changing a policy is the owner's step, never this script's.
    # ("on-failure" is refused too: the engine's documentation says a manual stop is only honoured
    # "until the Docker daemon restarts", and does not say what then happens to a stopped
    # on-failure container whose stop ended in a kill. Only what is known to stay stopped passes.)
    case "$i_policy" in
      no | unless-stopped) ;;
      *) why="the hand-started container's restart policy ($i_policy) would bring it back at a reboot after it was stopped; changing it is the owner's step"; return 1 ;;
    esac
    v_prev=container v_prev_id="$i_id" v_prev_image="$i_image" v_prev_rev=- v_prev_cfg=- v_policy="$i_policy"
    runs_as_planned "$v_prev_id" || return 1
    first_env_check "$v_prev_id" "$v_prev_image" || return 1
  else
    [ "$p_prev_op" = "$cur_op" ] || { why="the plan says production is run $p_prev_op, the journals say $cur_op"; return 1; }
    vp_pj="$cur_op"
    v_prev="$cur_op" v_prev_image="$(jget_of "$vp_pj" verified new_image)" v_prev_rev="$(jget_of "$vp_pj" begun rev)" v_prev_cfg="$(jget_of "$vp_pj" verified cfg)"
    [ "$v_prev_rev" != "$p_rev" ] || { why="production already runs this revision"; return 1; }
    is_image "$v_prev_image" && is_sha "$v_prev_cfg" || { why="the previous run's journal does not say what it started"; return 1; }
    [ "$p_prev_cfg" = "$v_prev_cfg" ] || { why="this Mac's receipt of the previous config is not the config the previous run started"; return 1; }
    [ "$(sha_file "$runs/$cur_op/resolved.json")" = "$v_prev_cfg" ] || { why="the previous run's saved config is missing or is not the one it started"; return 1; }
    set -- $vp_ids
    [ "$#" -eq 1 ] || { why="the production project has $# containers, not the one the journals say"; return 1; }
    ident verify-previous "$1" || { why="the running production cannot be inspected"; return 1; }
    [ "$i_running" = true ] && [ "$i_image" = "$v_prev_image" ] || { why="the production project's container is not the previous run's revision, running"; return 1; }
    v_prev_id="$i_id" v_policy="$i_policy"
    q verify-prev-tag "$Q" docker image inspect --format '{{.Id}}' "fleet-runner:$v_prev_rev" && [ "$OUT" = "$v_prev_image" ] || { why="the previous revision's image name no longer names the image it ran"; return 1; }
    carry_previous "$runs/$cur_op/resolved.json" || return 1
    if ident verify-hand "$p_container"; then [ "$i_running" = false ] || { why="the hand-started container runs beside the Compose production"; return 1; }; fi
    runs_as_planned "$v_prev_id" || return 1
  fi
  # The enrolled keys, by hash, exactly the ones the plan names.
  helper keys-before "$H" 0:0 ro sh -c 'cd /srv/public-keys && sha256sum -- *.pub' || { why="production's enrolled keys cannot be listed"; return 1; }
  [ "$(keys_named "$OUT")" = "$(printf '%s' "$p_key_ids" | tr ',' '\n' | sort | tr '\n' ',' | sed 's/,$//')" ] || { why="production's enrolled keys are not exactly the ones the plan names"; return 1; }
  v_keys="$(keys_hash "$OUT")"
  probe verify || { why="the state folders cannot be read"; return 1; }
  [ "$s_state" = yes ] || { why="the state folder is missing"; return 1; }
  [ "$s_same_fs" = yes ] || { why="the state folder is not on the service root's own filesystem, so it cannot be swapped by a rename"; return 1; }
  [ "$s_pre" = no ] && [ "$s_part" = no ] && [ "$s_aside" = no ] || { why="a snapshot or set-aside state of this very run already exists"; return 1; }
  v_state_kb="$s_state_kb" v_free_kb="$s_free_kb"
  vp_need=$((2 * s_state_kb + 51200))
  say "disk: the state folder is $((s_state_kb / 1024 + 1)) MB, $((s_free_kb / 1024)) MB are free; the snapshot needs $((vp_need / 1024 + 1)) MB free (twice the state folder plus 50 MB)"
  [ "$s_free_kb" -ge "$vp_need" ] || { why="not enough free disk for the snapshot"; return 1; }
  u_prev="$v_prev" u_prev_id="$v_prev_id" u_prev_image="$v_prev_image" u_prev_rev="$v_prev_rev" u_prev_cfg="$v_prev_cfg"
  return 0
}
verify_revert() {
  [ "$cur" = compose ] && [ "$cur_op" = "$p_target" ] || { why="run $p_target is not what production runs now (the journals say: $cur $cur_op); only the current run can be reverted"; return 1; }
  vr_j="$p_target"
  [ "$(jget_of "$vr_j" done outcome)" = pass ] || { why="run $p_target did not pass"; return 1; }
  # The run being reverted, as it was begun: its plan unchanged, and this revert for the same
  # project and the same service root (a revert acts on what that plan named, nothing else).
  vr_plan="$runs/$p_target/plan"
  [ -n "$(jget_of "$vr_j" begun plan)" ] && [ "$(sha_file "$vr_plan")" = "$(jget_of "$vr_j" begun plan)" ] ||
    { why="the plan of run $p_target is not the plan it was begun with"; return 1; }
  [ "$(sed -n 's/^project=//p' "$vr_plan" | head -n 1)" = "$p_project" ] && [ "$(sed -n 's/^root=//p' "$vr_plan" | head -n 1)" = "$p_root" ] ||
    { why="this revert does not name the project and the service root that run $p_target used"; return 1; }
  v_prev="$(jget_of "$vr_j" verified prev)" v_prev_id="$(jget_of "$vr_j" verified prev_id)" v_prev_image="$(jget_of "$vr_j" verified prev_image)"
  v_prev_rev="$(jget_of "$vr_j" verified prev_rev)" v_prev_cfg="$(jget_of "$vr_j" verified prev_cfg)"
  v_helper="$(jget_of "$vr_j" verified new_image)" v_keys="$(jget_of "$vr_j" verified keys)" v_policy=-
  p_uidgid="$(jget_of "$vr_j" verified uidgid)"
  [ -n "$v_prev" ] && is_image "$v_prev_image" && is_image "$v_helper" || { why="run $p_target's journal does not say what it replaced"; return 1; }
  # The previous production of a Compose run was recreated by that run: only its config can bring it back.
  [ "$v_prev" = container ] || v_prev_id=-
  helper_image="$v_helper" u_snap="$p_target" u_aside="$op"
  project_ids verify-project || { why="the production project's containers cannot be listed"; return 1; }
  set -- $OUT
  [ "$#" -eq 1 ] || { why="the production project has $# containers, not the one the journals say"; return 1; }
  ident verify-current "$1" || { why="the running production cannot be inspected"; return 1; }
  [ "$i_running" = true ] && [ "$i_image" = "$v_helper" ] || { why="the production project's container is not run $p_target's revision, running"; return 1; }
  vr_cid="$i_id"
  u_prev="$v_prev" u_prev_id="$v_prev_id" u_prev_image="$v_prev_image" u_prev_rev="$v_prev_rev" u_prev_cfg="$v_prev_cfg"
  if [ "$v_prev" != container ]; then
    [ "$(sha_file "$runs/$p_target/previous.json")" = "$v_prev_cfg" ] || { why="run $p_target's copy of the config it replaced is missing or changed"; return 1; }
    carry_previous "$runs/$p_target/previous.json" || return 1
  fi
  probe verify || { why="the state folders cannot be read"; return 1; }
  [ "$(layout)" = 1 ] || { why="the snapshot run $p_target took (with its marker) is not there beside the state folder, or a set-aside state of this revert already exists"; return 1; }
  v_state_kb="$s_state_kb" v_free_kb="$s_free_kb"
  # What the revert will set aside: the jobs accepted since the promote. Best effort, read-only.
  v_jobs_snap="$(jget_of "$vr_j" snapshot jobs)"
  v_jobs_now=unknown
  if q verify-jobs "$b_exec" docker exec "$vr_cid" node -e "$SNAP_JS" /var/lib/fleet-runner/state/fleet.sqlite; then
    v_jobs_now="$(printf '%s' "$OUT" | sed -n 's/^ok [0-9]* \([0-9][0-9]*\)$/\1/p')"
  fi
  case "$v_jobs_now:$v_jobs_snap" in
    *[!0-9:]* | :* | *:) say "jobs: production holds ${v_jobs_now:-unknown} now, the snapshot of run $p_target holds ${v_jobs_snap:-unknown}; every job accepted since that promote will be set aside" ;;
    *) say "jobs: production holds $v_jobs_now now, the snapshot of run $p_target holds $v_jobs_snap: this revert sets aside $((v_jobs_now - v_jobs_snap)) job(s) accepted since that promote (they stay in state.failed-$op)" ;;
  esac
  return 0
}
# stage_still: the test copy's record, read ONCE (it is replaced by one rename, so one read is one
# state), must name this revision as both the last that passed and the one staged now.
stage_still() {
  ss_text="$(cat "$p_stage_dir/stage-state" 2>/dev/null)" || { why="the test copy's record of what is staged cannot be read"; return 1; }
  ss_last="$(printf '%s\n' "$ss_text" | sed -n 's/^last_passed=//p' | tail -n 1)"
  ss_staged="$(printf '%s\n' "$ss_text" | sed -n 's/^staged_ok=//p' | tail -n 1)"
  [ "$ss_last" = "$p_rev" ] && [ "$ss_staged" = "$p_rev" ] ||
    { why="this revision is no longer the one the test copy passed and has staged (it was staged again since the Mac looked)"; return 1; }
}
# stage_hold / stage_release: the test copy's own run lock (the one fleet-stage.sh takes, a folder
# made by mkdir), taken WITHOUT waiting around the one read of its record and the spending of the
# yes, so no stage run can change what is staged in between. If a stage run holds it, the promote is
# refused with nothing changed. (A decider killed in that instant leaves the lock, naming this
# operation; fleet-stage.sh then says so, and a person removes it.)
stage_lock_dir() { printf '%s/.stage-lock' "$p_stage_dir"; }
stage_hold() {
  if ! mkdir "$(stage_lock_dir)" 2>/dev/null; then
    why="a stage run holds the test copy's lock ($(head -c 80 "$(stage_lock_dir)/owner" 2>/dev/null | tr -cd 'A-Za-z0-9._ -')): what is staged may be about to change. Promote again once it has finished"
    return 1
  fi
  printf 'promote %s\n' "$op" > "$(stage_lock_dir)/owner" 2>/dev/null || true
}
stage_release() {
  rm -f "$(stage_lock_dir)/owner" 2>/dev/null
  rmdir "$(stage_lock_dir)" 2>/dev/null || say "the test copy's stage lock could not be released: remove $(stage_lock_dir) once this operation has ended"
}
# verify_all: 0 with every v_* set, or 1 with $why.
verify_all() {
  why=""
  verify_form || return 1
  # A check of this run that was interrupted may have left a helper container of its own.
  quiet_helpers verify-quiet || { why="a helper container of this run, left by an interrupted check, could not be removed"; return 1; }
  # (check says it early, without the lock; the run reads the test copy's record once, itself,
  # at the moment it spends the yes.)
  if [ "$p_mode" = promote ] && [ "$mode" = check ]; then stage_still || return 1; fi
  if [ "$p_mode" = promote ]; then verify_promote || return 1; else verify_revert || return 1; fi
  if ! prerequisites; then why="the undo's prerequisites are not all there: $pq_missing"; return 1; fi
  return 0
}

# =================================================================================================
case "$mode" in
prepare)
  # prepare <op> <kind> <project> <revision> <root> <port> <address> <container>: read-only for
  # production. Writes this run's env file and the config Compose resolves from it, into this
  # run's folder; prints the service account and the SHA-256 of production's identity lists.
  [ "$#" -eq 9 ] || { say "usage: decider.sh prepare <op> <kind> <project> <revision> <root> <port> <address> <container>"; exit 2; }
  pp_kind="$3" p_project="$4" pp_rev="$5" p_root="$6" pp_port="$7" pp_lan="$8" pp_container="$9"
  clean_env
  pp_owner="$(perl -e '@s = stat($ARGV[0]); print "$s[4]:$s[5]\n" if @s' "$p_root/state")"
  case "$pp_owner" in "" | 0:* | *[!0-9:]*) say "FAIL the state folder has no service account owner"; exit 1 ;; esac
  if [ "$pp_kind" = container ]; then pp_cur="$pp_container"
  else project_ids prepare-list && set -- $OUT && [ "$#" -eq 1 ] || { say "FAIL the production project does not have exactly one container"; exit 1; }; pp_cur="$1"; fi
  q prepare-env "$Q" docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$pp_cur" || { say "FAIL the running production cannot be inspected"; exit 1; }
  pp_envs="$OUT"
  {
    echo "FLEET_COMPOSE_PROJECT=$p_project"
    echo "FLEET_PROD_ROOT=$p_root"
    echo "FLEET_LAN_IP=$pp_lan"
    echo "FLEET_HOST_PORT=$pp_port"
    echo "FLEET_UID=${pp_owner%:*}"
    echo "FLEET_GID=${pp_owner#*:}"
    printf '%s\n' "$pp_envs" | grep -e '^FLEET_WORKERS=' -e '^FLEET_OBSERVERS='
    echo "FLEET_REVISION=$pp_rev"
    echo "FLEET_IMAGE=fleet-runner:$pp_rev"
  } > "$here/env"
  if grep -v -e '^$' "$here/env" | grep -qv -e '^[A-Z][A-Z0-9_]*=[A-Za-z0-9_.,/:@+-]*$'; then say "FAIL the env file is not one plain KEY=value per line"; exit 1; fi
  [ "$(grep -c -e '^FLEET_WORKERS=' -e '^FLEET_OBSERVERS=' "$here/env")" -eq 2 ] || { say "FAIL production does not set both identity lists once"; exit 1; }
  bound_run prepare-config "$H" docker compose -p "$p_project" --env-file "$here/env" -f "$here/compose.yaml" config --format json > "$here/resolved.candidate.json" 2>> "$englog" ||
    { say "FAIL Compose could not resolve the new config"; exit 1; }
  [ -s "$here/resolved.candidate.json" ] || { say "FAIL Compose resolved an empty config"; exit 1; }
  for pp_k in FLEET_WORKERS FLEET_OBSERVERS; do
    echo "$pp_k=$(printf '%s' "$(sed -n "s/^$pp_k=//p" "$here/env")" | sha256sum | cut -d' ' -f1)"
  done
  echo "uidgid=$pp_owner"
  exit 0
  ;;

current)
  journals_or_stop
  scan_ops
  cu_j="$cur_op"
  echo "current kind=$cur op=$cur_op rev=$(jget_of "$cu_j" begun rev) cfg=$(jget_of "$cu_j" verified cfg) image=$(jget_of "$cu_j" verified new_image) unfinished=$(printf '%s' "$unfinished" | tr ' ' ',')"
  exit 0
  ;;

status)
  journals_or_stop
  if [ -z "$(J "$op" | head -n 1)" ]; then say "operation $op: its decider never began; production was not changed by it"; exit 0; fi
  st_out="$(jget done outcome)"
  st_last="$(J "$op" | grep -v ' halted ' | tail -n 1 | cut -d' ' -f2)"
  say "operation $op ($(jget begun mode)): last completed step: $st_last"
  case "$st_out" in
    pass) say "outcome: PASSED at $(J "$op" | sed -n 's/^\([^ ]*\) committed.*/\1/p' | tail -n 1) (record: promote-records/$(jget done record))" ;;
    undone | reverted | unchanged) say "outcome: $st_out (record: promote-records/$(jget done record))" ;;
    *) say "outcome: UNFINISHED. If no decider of it is running, run recover for $op."
      if jhas halted; then say "  it halted: $(J "$op" | sed -n 's/^[^ ]* halted \(.*\)$/\1/p' | tail -n 1)"; fi ;;
  esac
  say "This is that operation's result, not a statement about what production runs now."
  exit 0
  ;;

check)
  plan_ok || exit 1
  clean_env
  journals_or_stop
  if verify_all; then
    say "PASS every check the decider makes before it touches production"
    exit 0
  fi
  say "REFUSED $why"
  exit 1
  ;;
esac

# ---- run and recover: the two modes that may change production. ---------------------------------
trap '' HUP INT TERM PIPE
clean_env
plan_ok || exit 1
mkdir -p "$records" || { say "REFUSED the records folder cannot be made"; exit 1; }
u_uidgid="${p_uidgid:-0:0}"

if [ "$mode" = recover ]; then
  take_lock "$lock_wait"
  notes=yes
  journals_or_stop
  scan_ops
  for rc_o in $unfinished; do
    [ "$rc_o" = "$op" ] || { say "REFUSED operation $rc_o is unfinished: recover that one first. Nothing was changed."; exit 1; }
  done
  # Nothing of this operation may still be running: not a step, not a helper it was bounding.
  rc_live="$(perl "$guard" groups-alive "$groups" 2>/dev/null)"
  rc_rc=$?
  if [ "$rc_rc" -eq 2 ]; then
    say "HALTED the record of the steps operation $op started cannot be read, so whether one still runs is not known; production may be down."
    say "  Nothing was changed. Run recover for $op again once the run folder can be read."
    exit 4
  fi
  if [ "$rc_rc" -ne 0 ]; then
    say "HALTED a step of operation $op is still running; production may be down until that process is ended."
    printf '%s\n' "$rc_live" | sed 's/^/  still running: /'
    say "  Nothing was changed. Run recover for $op again once it has ended."
    exit 4
  fi
  if [ -z "$(J "$op" | head -n 1)" ]; then
    seq=$((maxseq + 1))
    close_unchanged never-began "the decider of $op never began"
  fi
  # This must be the operation that was begun: the same plan, in the same control folder. A plan
  # that was changed since (it names the project and the folders an undo acts on), or a copy of the
  # control folder (whose lock is another lock), is not: nothing is touched.
  rc_ctl="$(perl -e '@s = stat($ARGV[0]); print "$s[0]:$s[1]\n" if @s' "$ctl")"
  if [ "$(jget begun plan)" != "$plan_sha" ] || [ -z "$plan_sha" ]; then
    say "HALTED the plan of operation $op is not the plan it was begun with. Nothing was changed."
    say "  recover acts by the plan (the project, the folders): put the run folder's own plan back, then run recover for $op again."
    exit 4
  fi
  if [ "$(jget begun ctl)" != "$rc_ctl" ] || [ -z "$rc_ctl" ]; then
    say "HALTED this is not the control folder operation $op was begun in (it was replaced or copied). Nothing was changed."
    say "  Run recover for $op in production's own control folder."
    exit 4
  fi
  seq="$(jget begun seq)"
  rc_out="$(jget done outcome)"
  if [ -n "$rc_out" ]; then
    say "operation $op is finished: $rc_out (record: promote-records/$(jget done record)). Nothing was changed."
    say "This is that operation's result, not a statement about what production runs now."
    [ "$rc_out" = pass ] || [ "$rc_out" = reverted ] && exit 0
    exit 1
  fi
  if ! jhas spent; then
    # It was interrupted in its checks: a helper container of those may still be there.
    quiet_helpers recover-quiet || halt helpers-remain "a helper container of this run could not be listed or removed"
    close_unchanged interrupted "operation $op was interrupted before it touched production"
  fi
  p_uidgid="${p_uidgid:-$(jget verified uidgid)}"
  u_uidgid="$p_uidgid"
  if jhas committed; then
    load_undo_facts || halt undo-facts "this operation's journal does not say what it replaced"
    commit_records
  fi
  # Uncommitted: undo. Everything the undo needs first; if something is missing, whatever runs now
  # is left running, because that beats taking it down and then halting.
  load_undo_facts || halt undo-facts "this operation's journal does not say what to put back"
  soft="--soft-note"
  if ! prerequisites; then
    jot halted reason=prerequisite-missing 2>/dev/null || true
    say "HALTED the undo of $op cannot be completed: $pq_missing."
    say "  Nothing was changed: whatever runs now was left running. Put back what is missing, then run recover for $op again."
    exit 4
  fi
  # The undo looks first: if what it would bring about is already there, it only checks and records.
  undo_observed=ask
  if jhas undoing; then undo "$(jget undoing reason)"; fi
  if [ "$p_mode" = revert ]; then undo revert; fi
  undo interrupted
fi

# ---- run ---------------------------------------------------------------------------------------
take_lock 0
notes=yes
journals_or_stop
if [ -e "$journal" ] || [ -n "$(J "$op" | head -n 1)" ]; then say "REFUSED operation $op already has a journal: an operation name is used once. Use status or recover."; exit 1; fi
scan_ops
for rn_o in $unfinished; do say "REFUSED operation $rn_o is unfinished: run recover for it first. Nothing was changed."; exit 1; done
seq=$((maxseq + 1))
go_nonce="$(perl "$guard" nonce)" || exit 1
is_hex "$go_nonce" || exit 1
rm -f "$here/go" "$here/evidence" 2>/dev/null
# The run folder and everything in it, on disk before the journal that refers to it.
perl "$guard" sync-path "$plan" "$here/decider.sh" "$guard" "$here" "$runs" "$ctl" || { say "REFUSED this run's folder could not be flushed to disk; nothing was changed"; exit 1; }
v_ctl="$(perl -e '@s = stat($ARGV[0]); print "$s[0]:$s[1]\n" if @s' "$ctl")"
jot begun "seq=$seq" "mode=$p_mode" "op=$op" "rev=${p_rev:--}" "target=${p_target:--}" "ctl=$v_ctl" \
  "decider=$(sha_file "$here/decider.sh")" "plan=$plan_sha" "go=$go_nonce" ||
  { say "REFUSED the journal cannot be written; nothing was changed"; exit 1; }
say "begun: waiting up to $b_go seconds for this Mac's go"
# The Mac must be there NOW: a start that arrives late, with nobody watching, changes nothing.
wait_file "$here/go" "$go_nonce" "$b_go" || close_unchanged no-go "the Mac's go did not arrive within $b_go seconds"
jot go || close_unchanged journal "the journal cannot be written"

verify_all || close_unchanged refused "$why"
jot verified "prev=$v_prev" "prev_id=$v_prev_id" "prev_image=$v_prev_image" "prev_rev=$v_prev_rev" "prev_cfg=$v_prev_cfg" \
  "new_image=${p_new_image:--}" "cfg=${p_cfg:--}" "keys=$v_keys" "policy=$v_policy" "snap=$u_snap" "helper_image=$v_helper" \
  "uidgid=$p_uidgid" "state_kb=$v_state_kb" "free_kb=$v_free_kb" "jobs_now=${v_jobs_now:--}" "offline_max=$t_worst" ||
  close_unchanged journal "the journal cannot be written"
say "verified: everything the switch and its undo need is there"
u_uidgid="$p_uidgid"

# The yes is spent here, under the lock, and nowhere else. And only for a revision that is, at this
# very moment, still the one the test copy passed and has staged: read here, by the decider itself
# (the Mac's own look, earlier, was only an early refusal).
if [ "$p_mode" = promote ]; then
  stage_hold || close_unchanged refused "$why"
  stage_still || { stage_release; close_unchanged refused "$why"; }
fi
if ! jot spent "approval=$p_approval_sha"; then
  [ "$p_mode" != promote ] || stage_release
  close_unchanged journal "the journal cannot be written"
fi
[ "$p_mode" != promote ] || stage_release
load_undo_facts || halt undo-facts "the journal does not hold what was just written"

if [ "$p_mode" = revert ]; then undo revert; fi

# ---- The switch. Any failure from here on is undone. --------------------------------------------
say "stopping the previous production"
stop_seen stop-previous "$v_prev_id" || undo stop-failed
jot stopped || undo journal-failed

say "copying the state folder"
helper copy "$b_copy" 0:0 rw sh -c 'rm -rf "/srv/state.pre-$1.part" && cp -a /srv/state "/srv/state.pre-$1.part" && sync' sh "$op" || undo snapshot-copy-failed
helper integrity "$b_integrity" "$p_uidgid" "only:state.pre-$op.part" node -e "$SNAP_JS" "/srv/state.pre-$op.part/fleet.sqlite" || undo snapshot-integrity-failed
set -- $OUT
[ "$#" -eq 3 ] && [ "$1" = ok ] || undo snapshot-integrity-failed
snap_schema="$2" snap_jobs="$3"
helper name "$H" 0:0 rw node -e "$NAME_JS" "$op" || undo snapshot-name-failed
jot snapshot "jobs=$snap_jobs" "schema=$snap_schema" || undo journal-failed
say "snapshot state.pre-$op verified: $snap_jobs jobs"

# From this line on the new revision may have run and changed the state folder.
jot starting || undo journal-failed
say "starting the new revision from the checked config"
echo "start-new $b_start" >> "$here/steps.log" 2>/dev/null || true
perl "$guard" bound --note "$groups" start-new --stdin-checked "$here/resolved.json" "$p_cfg" "$b_start" 5 -- \
  docker compose -p "$p_project" --env-file /dev/null -f - up -d --pull never >> "$englog" 2>&1
rn_rc=$?
[ "$rn_rc" -ne 125 ] || stuck start-new
[ "$rn_rc" -ne 122 ] || undo config-changed-after-check
[ "$rn_rc" -eq 0 ] || undo start-failed
project_ids start-list || undo start-unknown
set -- $OUT
[ "$#" -eq 1 ] || undo start-not-one-container
new_cid="$1"
ident start-identify "$new_cid" || undo start-unknown
[ "$i_image" = "$p_new_image" ] && [ "$i_running" = true ] || undo start-wrong-image
jot started "cid=$new_cid" || undo journal-failed

wait_health new-health "$new_cid" "$b_health" || undo new-not-healthy
new_health="$health"
q new-keys "$b_exec" docker exec "$new_cid" sh -c 'cd /run/fleet-runner/public-keys && sha256sum -- *.pub' || undo keys-unreadable
[ "$(keys_hash "$OUT")" = "$v_keys" ] || undo keys-changed
q new-jobs "$b_exec" docker exec "$new_cid" node -e "$SNAP_JS" /var/lib/fleet-runner/state/fleet.sqlite || undo jobs-unreadable
new_jobs="$(printf '%s' "$OUT" | sed -n 's/^ok [0-9]* \([0-9][0-9]*\)$/\1/p')"
[ -n "$new_jobs" ] && [ "$new_jobs" -ge "$snap_jobs" ] || undo jobs-fewer
ev_nonce="$(perl "$guard" nonce)" || undo nonce-failed
is_hex "$ev_nonce" || undo nonce-failed
jot server-checked "jobs=$new_jobs" "nonce=$ev_nonce" "window=$b_evidence" "health=$new_health" || undo journal-failed
say "the new revision is $(health_words "$new_health"), has the same keys and $new_jobs jobs: waiting up to $b_evidence seconds for this Mac's evidence"

# Evidence must answer THIS challenge; anything else in the file is ignored and the wait goes on.
wait_file "$here/evidence" "$ev_nonce" "$b_evidence" || undo no-evidence
ev() { sed -n "s/^$1=//p" "$here/evidence" | head -n 1; }
[ "$(ev op)" = "$op" ] && [ "$(ev revision)" = "$p_rev" ] && [ "$(ev plan)" = "$plan_sha" ] || undo evidence-for-another-run
[ "$(ev client)" = ok ] || undo client-reported-failure
[ "$(ev build)" = "$p_rev" ] || undo wrong-build
[ "$(ev tls)" = "$p_tls" ] || undo certificate-changed
ident commit-identify "$new_cid" || undo new-gone-before-commit
[ "$i_image" = "$p_new_image" ] && [ "$i_running" = true ] || undo new-gone-before-commit
jot evidence "build=$p_rev" tls=same || undo journal-failed

# THE decision. If writing it reports a failure, the journal itself says which way it went.
if ! jot committed; then
  # Whether the line is there is read from the journal. If the journal cannot be read either,
  # nobody knows which way it went: that is never undone on a guess, and never called a pass.
  if [ "$JSTALE" = yes ]; then
    say "HALTED the commit line may or may not be in the journal, and the journal cannot be read now."
    say "  Nothing more was changed: the new revision is left running. Run recover for $op once the journal can be read;"
    say "  it confirms the pass or, if the line did not survive, undoes."
    exit 4
  fi
  if jhas committed; then
    say "COMMITTED, RECORD INCOMPLETE the pass is in the journal but could not be confirmed flushed to disk."
    say "  Not reported as a pass. Run recover for $op: it confirms the pass or, if the line did not survive, undoes."
    exit 3
  fi
  undo journal-failed
fi
commit_records
