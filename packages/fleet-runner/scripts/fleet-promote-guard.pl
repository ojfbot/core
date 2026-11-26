#!/usr/bin/perl
# fleet-promote-guard: the few things the promote's server-side decider (fleet-promote-decider.sh,
# POSIX sh) cannot do in sh, with only the perl modules a minimal install has (POSIX, Fcntl,
# IO::Handle) and Time::HiRes, for the monotonic clock (on some Linux systems it comes with the
# full perl library rather than the smallest perl package; without it no mode of this file
# runs), so that ONE code path runs on the Linux server, in CI and in the tests on macOS
# (which has no flock, setsid or timeout commands). ojfbot/core#647, slice 4.
# A clock that cannot be read, or reads below zero, is fatal: status 2 and a message, never a
# bound or a wait that could not end (in bound, after the step has started: it is ended, 125).
#
#   lock <fd>
#       Take an exclusive, non-blocking kernel lock (flock) on the descriptor the caller already
#       holds open. The lock belongs to that open file, not to this process: it lasts until the
#       caller and every process that inherited the descriptor are gone.
#       0: taken. 1: someone else holds it. 2: could not try.
#
#   bound [--note <file> <label>] [--soft-note] [--stdin-checked <file> <sha256>] <seconds> <grace> -- cmd..
#       Run cmd in a session and process group of its own, with this process's stdout and stderr.
#       If cmd AND everything in its process group have ended within <seconds>, exit with cmd's
#       status (121 if cmd's own status was one of the verdicts below, so those are never
#       ambiguous). Otherwise (the time is up, or cmd itself ended and left something of its
#       group running) send TERM to the group, wait <grace> seconds, send KILL, and wait at most
#       5 seconds more until nothing of the group is left. So it returns within
#       <seconds> + <grace> + 5 (and a second), by a clock that cannot be set.
#         124: it had to be ended, and nothing of its group is left.
#         125: something of it is still running; the caller must stop and change nothing more.
#         126: cmd could not be started.
#       --note: BEFORE cmd runs, append "<group ID> <start time> <label>" to <file> and flush it
#         (123 and cmd never runs if that fails; with --soft-note it runs anyway). The start time
#         tells this group from a later, unrelated one that was given the same number.
#       --stdin-checked: read <file> ONCE into memory (at most 16000 bytes), require those bytes
#         to have the SHA-256 <sha256>, and give exactly those bytes to cmd on stdin
#         (122 and cmd never runs if they differ or cannot be read). Check and use are one buffer.
#         They are fed without ever blocking: a cmd that does not read them is ended at the bound.
#       Without --stdin-checked, cmd's stdin is this process's.
#
#   detach <log> -- cmd..
#       Start cmd in a session of its own, stdin from /dev/null, stdout and stderr appended to
#       <log>, and return at once. Prints its process ID (for a person and for tests; nothing
#       decides by it).
#
#   append <file> <line>
#       Append one line to <file> (created 0600) in ONE write and flush the file and its folder to
#       disk before returning. An incomplete last line left by an earlier failure is cut off first.
#       0 only if all of that worked.
#
#   publish <file>
#       Write stdin to <file>.part, flush it, rename it to <file>, flush the folder. 0 only if all
#       of that worked. A stdin that cannot be read to its end, or is empty, publishes nothing (1).
#
#   sync-path <path>..
#       Flush each file or folder to disk. 0 only if every one worked.
#
#   groups-alive <file>
#       For every group a --note recorded in <file>: is anything of it still running? Prints one
#       line per live group, "group <ID> (<label>): <pid> <command>, ..", command names only.
#       0: none is alive. 1: at least one is. 2: could not tell.
#
#   holders <folder> [<pid>..]
#       Best effort, for a message only: "pid command" of every other process holding a descriptor
#       on <folder> (not this one, its parent, or the given process IDs: the asker's own). Command
#       names only, never arguments. Always exits 0.
#
#   nonce
#       32 random hex characters.
#
#   wait-nonce <file> <nonce> <seconds>
#       Wait until <file> holds a first "nonce=" line equal to <nonce>: 0. After <seconds>, by a
#       clock that cannot be set: 1. A file that is absent, or holds another value, is waited out.
#
#   now
#       Whole seconds on that clock, for a caller that keeps a budget of its own.
#
#   journals <runs folder>
#       Every operation's journal under <runs folder>/<operation>/journal, read once and checked.
#       Prints "<operation> <line>" for every complete line; a last line without its line break
#       was never written and is left out. 0: all of them could be read and every complete line
#       is a record. Otherwise the last line printed is "BAD <what, in words>" and the status is
#       4 (a folder or a journal could not be read) or 5 (a complete line is not a record).
#       An absent journal and an empty one are not errors: they print nothing.
#
# How bound knows that a step has ended is written where it does it ("WHEN A STEP HAS ENDED").
use strict;
use warnings;
use POSIX qw(setsid :sys_wait_h);
use Fcntl qw(:flock :DEFAULT F_GETFD F_SETFD F_GETFL F_SETFL FD_CLOEXEC);
use IO::Handle;
use Time::HiRes qw(clock_gettime CLOCK_MONOTONIC);

# Seconds on a clock that cannot be set and never runs backwards. clock_gettime answers -1 when the
# clock cannot be read: every bound and wait would then never end. That is fatal, never ignored.
our $clock_failed = sub { print STDERR "FATAL the monotonic clock cannot be read: nothing can be bounded or timed\n"; exit 2 };
sub mono {
  my $t = eval { clock_gettime(CLOCK_MONOTONIC) };
  $clock_failed->() unless defined $t && $t >= 0;
  return $t;
}

sub usage {
  print STDERR "usage: fleet-promote-guard.pl lock|bound|detach|append|publish|sync-path|groups-alive|holders|nonce|wait-nonce|now|journals (see the file's header)\n";
  exit 2;
}
sub whole { my ($v) = @_; return defined $v && $v =~ /^[0-9]{1,6}$/ }
sub folder_of { my ($p) = @_; return $p =~ m{^(.*)/[^/]*$} ? ($1 eq '' ? '/' : $1) : '.' }
sub flush_path {
  my ($p) = @_;
  open(my $h, '<', $p) or return 0;
  my $ok = $h->sync;
  close($h);
  return $ok ? 1 : 0;
}
sub write_all {
  my ($h, $bytes) = @_;
  my $off = 0;
  while ($off < length($bytes)) {
    my $n = syswrite($h, $bytes, length($bytes) - $off, $off);
    next if !defined $n && $!{EINTR};
    return 0 unless defined $n && $n > 0;
    $off += $n;
  }
  return 1;
}
# Cut off an incomplete last line, write one line in one write, flush the file and its folder.
sub append_line {
  my ($file, $line) = @_;
  return 0 if $line =~ /[\r\n]/;
  sysopen(my $fh, $file, O_RDWR | O_APPEND | O_CREAT, 0600) or return 0;
  my $size = -s $fh;
  if ($size) {
    my $look = $size < 65536 ? $size : 65536;
    sysseek($fh, $size - $look, 0) // return 0;
    my $got = sysread($fh, my $tail, $look);
    return 0 unless defined $got && $got == $look;
    if (substr($tail, -1) ne "\n") {
      my $nl = rindex($tail, "\n");
      return 0 if $nl < 0 && $look < $size;
      truncate($fh, $size - $look + $nl + 1) or return 0;
    }
  }
  my $text = "$line\n";
  my $n = syswrite($fh, $text);
  return 0 unless defined $n && $n == length($text);
  $fh->sync or return 0;
  close($fh) or return 0;
  return flush_path(folder_of($file));
}
sub start_time_of {
  my ($pid) = @_;
  open(my $ps, '-|', 'ps', '-o', 'lstart=', '-p', $pid) or return '';
  my $t = <$ps> // '';
  close($ps);
  $t =~ s/^\s+|\s+$//g;
  $t =~ s/\s+/_/g;
  return $t;
}
sub sha256_of {
  my ($bytes) = @_;
  pipe(my $r, my $w) or return undef;
  my $pid = open(my $out, '-|');
  return undef unless defined $pid;
  if ($pid == 0) {
    close($w);
    open(STDIN, '<&', $r) or POSIX::_exit(127);
    { no warnings; exec { 'sha256sum' } 'sha256sum'; }
    POSIX::_exit(127);
  }
  close($r);
  local $SIG{PIPE} = 'IGNORE';
  my $ok = write_all($w, $bytes);
  close($w);
  my $line = <$out> // '';
  close($out);
  return ($ok && $line =~ /^([0-9a-f]{64})\b/) ? $1 : undef;
}

my $mode = shift @ARGV // usage();

if ($mode eq 'lock') {
  my $fd = shift @ARGV;
  usage() unless whole($fd) && !@ARGV;
  open(my $fh, '<&=', $fd) or exit 2;
  exit 0 if flock($fh, LOCK_EX | LOCK_NB);
  exit($!{EWOULDBLOCK} || $!{EAGAIN} ? 1 : 2);
}

if ($mode eq 'bound') {
  my ($note_file, $note_label, $soft, $in_file, $in_sha);
  while (@ARGV && $ARGV[0] =~ /^--/) {
    my $o = shift @ARGV;
    if ($o eq '--note') { $note_file = shift @ARGV; $note_label = shift @ARGV; usage() unless defined $note_label && $note_label =~ /^[A-Za-z0-9._-]+$/ }
    elsif ($o eq '--soft-note') { $soft = 1 }
    elsif ($o eq '--stdin-checked') { $in_file = shift @ARGV; $in_sha = shift @ARGV; usage() unless defined $in_sha && $in_sha =~ /^[0-9a-f]{64}$/ }
    else { usage() }
  }
  my ($secs, $grace, $dash, @cmd) = @ARGV;
  usage() unless whole($secs) && $secs >= 1 && whole($grace) && defined $dash && $dash eq '--' && @cmd;
  mono();    # before anything runs: a clock that cannot be read starts nothing
  my $bytes;
  if (defined $in_file) {
    open(my $f, '<', $in_file) or exit 122;
    binmode($f);
    my $got = read($f, $bytes, 16001);
    close($f);
    exit 122 unless defined $got && $got > 0 && $got <= 16000;
    my $sha = sha256_of($bytes);
    exit 122 unless defined $sha && $sha eq $in_sha;
  }
  pipe(my $rd, my $wr) or exit 126;
  pipe(my $go_r, my $go_w) or exit 126;
  my ($in_r, $in_w);
  if (defined $bytes) { pipe($in_r, $in_w) or exit 126 }
  # The write end must survive exec in cmd and in everything cmd starts; the others must not.
  my $flags = fcntl($wr, F_GETFD, 0);
  defined $flags && fcntl($wr, F_SETFD, $flags & ~FD_CLOEXEC) or exit 126;
  my $chld = 0;
  local $SIG{CHLD} = sub { $chld = 1 };
  local $SIG{PIPE} = 'IGNORE';
  my $pid = fork();
  exit 126 unless defined $pid;
  if ($pid == 0) {
    # The decider ignores these so that a closed terminal cannot cut an undo short, and an ignored
    # signal stays ignored across exec: cmd must get them back, or TERM could not end it.
    $SIG{$_} = 'DEFAULT' for qw(CHLD PIPE INT TERM HUP QUIT);
    close($rd);
    close($go_w);
    # "Could not start" is said through the pipe the parent watches, since any exit status could
    # also be the command's own.
    my $nostart = sub { syswrite($wr, 'x'); POSIX::_exit(126) };
    $nostart->() if setsid() == -1;
    if (defined $bytes) { close($in_w); open(STDIN, '<&', $in_r) or $nostart->(); close($in_r); }
    # Not before the parent has recorded this group and says go.
    my $got = sysread($go_r, my $go, 1);
    POSIX::_exit(126) unless defined $got && $got == 1;
    close($go_r);
    { no warnings; exec { $cmd[0] } @cmd; }
    $nostart->();
  }
  close($wr);
  close($go_r);
  close($in_r) if defined $bytes;
  # From here on the step may run: if the clock fails now, it is ended and that is said (125).
  $clock_failed = sub { print STDERR "FATAL the monotonic clock cannot be read: the step was ended\n"; kill('KILL', -$pid); kill('KILL', $pid); exit 125 };
  if (defined $note_file) {
    my $ok = append_line($note_file, "$pid " . (start_time_of($pid) || 'unknown') . " $note_label");
    if (!$ok && !$soft) {
      # The child has run nothing yet and is this process's own: ending it is exact.
      kill('KILL', $pid);
      waitpid($pid, 0);
      exit 123;
    }
  }
  syswrite($go_w, 'g');
  close($go_w);
  # The checked bytes are fed in the loop below, never in a write that could block: a step that
  # does not read them cannot hold this helper past its bound.
  my $fed = 0;
  if (defined $bytes) {
    my $fl = fcntl($in_w, F_GETFL, 0);
    defined $fl && fcntl($in_w, F_SETFL, $fl | O_NONBLOCK) or exit 126;
  }
  my $feed = sub {
    return unless defined $bytes && defined $in_w;
    while ($fed < length($bytes)) {
      my $n = syswrite($in_w, $bytes, length($bytes) - $fed, $fed);
      if (!defined $n) { next if $!{EINTR}; return if $!{EAGAIN} || $!{EWOULDBLOCK}; last }    # anything else: the step is not reading
      $fed += $n;
    }
    close($in_w);
    undef $in_w;
  };
  # WHEN A STEP HAS ENDED. Its leader has exited AND nothing else is left in its process group.
  # The group is looked at with ps while the leader is still this process's uncollected child, so
  # the group's number is still its own. (A signal-0 probe of the group cannot tell: with only the
  # exited, uncollected leader left, Linux still answers "there".) The pipe every descendant
  # inherits is only a HINT to look now: a process can close it and live on, so its end-of-file
  # proves nothing. A process that left the group (a session of its own) cannot be seen this way;
  # if it kept the pipe that is noticed (125), if it closed it too, nothing here knows of it, and
  # nothing the decider decides rests on "the client is gone": it looks at the engine's state.
  # Time is read from a clock that cannot be set, and everything, the collecting of the leader
  # and each look with ps included, is inside the deadline.
  # A look: ps, read without ever blocking past <until>. A look that is not answered in time, that
  # fails, or whose answer is incomplete or holds a row that is not one, says nothing (an empty
  # list): never "ended".
  my $state = sub {
    my ($until) = @_;
    return () if mono() >= $until;
    my $kid = open(my $ps, '-|', 'ps', '-A', '-o', 'pid=,pgid=,stat=') or return ();
    my ($out, $done) = ('', 0);
    while (1) {
      my $left = $until - mono();
      last if $left <= 0;
      my $bits = '';
      vec($bits, fileno($ps), 1) = 1;
      my $n = select($bits, undef, undef, $left);
      if ($n < 0) { next if $!{EINTR}; last }
      next if $n == 0;
      my $got = sysread($ps, $out, 65536, length($out));
      if (!defined $got) { next if $!{EINTR}; last }
      if ($got == 0) { $done = 1; last }
    }
    if (!$done) { kill('KILL', $kid); close($ps); return () }
    # Collected without blocking, inside the same deadline: a ps that closed its output and lives
    # on must not hold this helper past the bound either.
    my $st;
    while (1) {
      my $w = waitpid($kid, WNOHANG);
      if ($w == $kid) { $st = $?; last }
      if ($w == -1 || mono() >= $until) {
        kill('KILL', $kid);
        close($ps);
        return ();
      }
      select(undef, undef, undef, 0.02);
    }
    close($ps);    # its process is already collected: this only closes the pipe
    return () unless $st == 0 && $out =~ /\n\z/;
    my ($live, $leader) = (0, 'unseen');
    for my $row (split(/\n/, $out)) {
      my ($p, $g, $st) = split(' ', $row);
      return () unless defined $st && $p =~ /^[0-9]+$/ && $g =~ /^[0-9]+$/;
      next unless $g == $pid;
      if ($st =~ /^Z/) { $leader = 'exited' if $p == $pid; next }
      $leader = 'running' if $p == $pid;
      $live++;
    }
    return ($live, $leader);
  };
  my ($eof, $unstarted) = (0, 0);
  # Wait on the pipe for at most $wait seconds; note end-of-file and the "could not start" byte.
  my $watch = sub {
    my ($wait) = @_;
    if ($eof) { select(undef, undef, undef, $wait) if $wait > 0; return }
    my $bits = '';
    vec($bits, fileno($rd), 1) = 1;
    my $n = select($bits, undef, undef, $wait > 0 ? $wait : 0);
    return unless defined $n && $n > 0;
    my $got = sysread($rd, my $buf, 4096);
    if (defined $got && $got == 0) { $eof = 1 }
    elsif (defined $got && $got > 0) { $unstarted = 1 }
  };
  my $deadline = mono() + $secs;
  my ($finished, $leader_out_at, $look_at) = (0, undef, 0);
  $chld = 0;
  while (1) {
    $feed->();
    my $now = mono();
    if ($chld || $eof || $now >= $look_at) {
      my ($live, $leader) = $state->($deadline);
      # (Reset after the look: ps is a child of this process too, and its own end must not ask for
      # another look. An exit of the leader that this hides is seen at the next look, a second on
      # at most, and at once in the usual case, where the pipe's end-of-file says to look.)
      $chld = 0;
      $look_at = mono() + 1;
      if (defined $live && $leader eq 'exited') {
        # Ended only if seen so in time: a look that came back after the bound decides nothing.
        if ($live == 0 && mono() <= $deadline) { $finished = 1; last }
        # The leader is gone and left something running: a second for it to end by itself, then it is ended.
        $leader_out_at //= $now;
        last if $now - $leader_out_at >= 1;
      }
    }
    $now = mono();
    last if $now >= $deadline;
    my $wait = $deadline - $now;
    $watch->($wait < 0.25 ? $wait : 0.25);
  }
  my $ended = 0;
  if (!$finished) {
    $ended = 1;
    # The leader is this process's child, running or exited and not yet collected: the group ID is
    # still its own, whoever of the group is left.
    kill('TERM', -$pid);
    my $gone = sub {
      my ($wait) = @_;
      my $until = mono() + $wait;
      while (1) {
        my ($live, $leader) = $state->($until);
        return 1 if defined $live && $live == 0 && $leader eq 'exited';
        return 0 if mono() >= $until;
        $watch->(0.25);
      }
    };
    if (!$gone->($grace)) {
      kill('KILL', -$pid);
      exit 125 unless $gone->(5);
    }
  }
  # The leader has exited (it was just seen so), so collecting it does not wait.
  my $st = 0;
  for (my $i = 0; ; $i++) {
    my $got = waitpid($pid, WNOHANG);
    if ($got == $pid) { $st = $?; last }
    exit 125 if $got == -1 || $i >= 20;
    select(undef, undef, undef, 0.05);
  }
  # The hint, used the one way it can be: the group is empty and the leader collected, yet something
  # still holds the pipe. That is a process of the step that left its group and cannot be ended here.
  if (!$eof) {
    my $until = mono() + 1;
    $watch->(0.25) while !$eof && mono() < $until;
    exit 125 unless $eof;
  }
  exit 124 if $ended;
  my $code = ($st & 127) ? 128 + ($st & 127) : $st >> 8;
  # 122 to 126 are this helper's own verdicts; a command that ends with one of them is reported as 121.
  exit 126 if $unstarted;
  $code = 121 if $code >= 122 && $code <= 126;
  exit $code;
}

if ($mode eq 'detach') {
  my ($log, $dash, @cmd) = @ARGV;
  usage() unless defined $log && defined $dash && $dash eq '--' && @cmd;
  # Opened here, so a log that cannot be written is an error the caller sees.
  sysopen(my $out, $log, O_WRONLY | O_APPEND | O_CREAT, 0600) or do { print STDERR "cannot write the log\n"; exit 1 };
  my $pid = fork();
  exit 1 unless defined $pid;
  if ($pid) { print "$pid\n"; exit 0 }
  POSIX::_exit(126) if setsid() == -1;
  open(STDIN, '<', '/dev/null') or POSIX::_exit(126);
  open(STDOUT, '>&', $out) or POSIX::_exit(126);
  open(STDERR, '>&', $out) or POSIX::_exit(126);
  close($out);
  { no warnings; exec { $cmd[0] } @cmd; }
  POSIX::_exit(126);
}

if ($mode eq 'append') {
  my ($file, $line) = @ARGV;
  usage() unless defined $file && defined $line && @ARGV == 2;
  exit(append_line($file, $line) ? 0 : 1);
}

if ($mode eq 'publish') {
  my ($file) = @ARGV;
  usage() unless defined $file && @ARGV == 1;
  binmode(STDIN);
  # Every byte, or nothing: a read that fails is not taken for the end of the record, and an empty
  # record is never published.
  my $text = '';
  while (1) {
    my $n = sysread(STDIN, my $buf, 65536);
    if (!defined $n) { next if $!{EINTR}; exit 1 }
    last if $n == 0;
    $text .= $buf;
  }
  exit 1 if $text eq '';
  sysopen(my $fh, "$file.part", O_WRONLY | O_CREAT | O_TRUNC, 0600) or exit 1;
  write_all($fh, $text) or exit 1;
  $fh->sync or exit 1;
  close($fh) or exit 1;
  rename("$file.part", $file) or exit 1;
  exit(flush_path(folder_of($file)) ? 0 : 1);
}

if ($mode eq 'sync-path') {
  usage() unless @ARGV;
  for my $p (@ARGV) { flush_path($p) or exit 1 }
  exit 0;
}

if ($mode eq 'groups-alive') {
  my ($file) = @ARGV;
  usage() unless defined $file && @ARGV == 1;
  exit 0 unless -e $file;
  open(my $fh, '<', $file) or exit 2;
  # Read to its end or not at all: a read that fails is not the end of the file (2).
  my $text = '';
  while (1) {
    my $n = sysread($fh, my $buf, 65536);
    if (!defined $n) { next if $!{EINTR}; exit 2 }
    last if $n == 0;
    $text .= $buf;
  }
  close($fh);
  $text =~ s/[^\n]*\z//;    # an incomplete last line recorded nothing that ran
  my (%label, %start);
  for my $row (split(/\n/, $text)) {
    my ($g, $t, $l, @more) = split(' ', $row);
    # A complete line that is not "<group> <start time> <label>" cannot be read: 2, never "none".
    exit 2 unless defined $l && !@more && $g =~ /^[0-9]+$/ && $g > 1;
    $label{$g} = $l;
    $start{$g} = $t;
  }
  my @live;
  for my $g (sort { $a <=> $b } keys %label) {
    next unless kill(0, -$g) || $!{EPERM};
    # A process with this very number that started at another time is a later, unrelated one: the
    # number is only given out again once nothing of the recorded group is left.
    my $now = start_time_of($g);
    next if $now ne '' && $start{$g} ne 'unknown' && $now ne $start{$g};
    push @live, $g;
  }
  exit 0 unless @live;
  my %members;
  open(my $ps, '-|', 'ps', '-eo', 'pid=,pgid=,comm=') or exit 2;
  while (my $row = <$ps>) {
    my ($p, $g, $c) = split(' ', $row, 3);
    next unless defined $c && exists $label{$g};
    chomp $c;
    $c =~ s{^.*/}{};
    $c =~ s/[^A-Za-z0-9._+-]//g;
    push @{ $members{$g} }, "$p " . ($c || 'unknown');
  }
  close($ps);
  print "group $_ ($label{$_}): " . join(', ', @{ $members{$_} || ['unknown'] }) . "\n" for @live;
  exit 1;
}

if ($mode eq 'holders') {
  my ($dir, @skip) = @ARGV;
  usage() unless defined $dir && !grep { !/^[0-9]+$/ } @skip;
  my @want = stat($dir);
  exit 0 unless @want;
  my %skip = map { $_ => 1 } ($$, getppid(), @skip);
  my %seen;
  if (-d '/proc/self/fd') {
    # Linux: every descriptor of every process this account may look at, compared by device and inode.
    opendir(my $proc, '/proc') or exit 0;
    for my $p (grep { /^[0-9]+$/ } readdir($proc)) {
      next if $skip{$p};
      opendir(my $fds, "/proc/$p/fd") or next;
      for my $fd (grep { /^[0-9]+$/ } readdir($fds)) {
        my @st = stat("/proc/$p/fd/$fd") or next;
        next unless $st[0] == $want[0] && $st[1] == $want[1];
        my $comm = '';
        if (open(my $c, '<', "/proc/$p/comm")) { $comm = <$c> // ''; close($c); }
        $comm =~ s/[^A-Za-z0-9._+-]//g;
        $seen{$p} = $comm || 'unknown';
        last;
      }
      closedir($fds);
    }
    closedir($proc);
  } else {
    # Elsewhere (the tests on macOS): lsof, when there is one. -F prints p<pid>, c<command>, f<fd>.
    my ($p, $c);
    if (open(my $l, '-|', 'lsof', '-n', '-P', '-Fpcf', '--', $dir)) {
      while (my $row = <$l>) {
        chomp $row;
        if ($row =~ /^p([0-9]+)$/) { $p = $1; $c = 'unknown' }
        elsif ($row =~ /^c(.*)$/) { ($c = $1) =~ s/[^A-Za-z0-9._+-]//g; $c ||= 'unknown' }
        elsif ($row =~ /^f[0-9]+$/ && defined $p && !$skip{$p}) { $seen{$p} = $c }
      }
      close($l);
    }
  }
  print "$_ $seen{$_}\n" for sort { $a <=> $b } keys %seen;
  exit 0;
}

if ($mode eq 'nonce') {
  usage() if @ARGV;
  open(my $r, '<', '/dev/urandom') or exit 1;
  my $n = sysread($r, my $buf, 16);
  exit 1 unless defined $n && $n == 16;
  print unpack('H*', $buf), "\n";
  exit 0;
}

if ($mode eq 'wait-nonce') {
  my ($file, $nonce, $secs) = @ARGV;
  usage() unless @ARGV == 3 && defined $nonce && $nonce =~ /^[0-9a-f]+$/ && whole($secs);
  my $until = mono() + $secs;
  while (1) {
    if (open(my $f, '<', $file)) {
      while (my $row = <$f>) {
        next unless $row =~ /^nonce=(.*)$/;
        exit 0 if $1 eq $nonce;
        last;
      }
      close($f);
    }
    exit 1 if mono() >= $until;
    select(undef, undef, undef, 0.2);
  }
}

if ($mode eq 'now') {
  usage() if @ARGV;
  printf "%d\n", mono();
  exit 0;
}

if ($mode eq 'journals') {
  my ($dir) = @ARGV;
  usage() unless defined $dir && @ARGV == 1;
  # A record: "<UTC time> <state> [key=value ..]", the state one this decider writes.
  my $states = join('|', qw(begun go verified spent stopped snapshot starting started server-checked evidence committed
    undoing undo-quiet undo-new-removed undo-state-aside undo-state-back undo-previous-stopped undo-previous-started
    undo-healthy done halted));
  my $record = qr/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ (?:$states)(?: [a-z_]+=[^\s=]*)*$/;
  my $bad = sub { my ($status, $what) = @_; print "BAD $what\n"; exit $status };
  # A listing that fails part way reads like a shorter one: errno is cleared before it and looked at
  # after it, so a failed listing is a failed read, never "fewer operations".
  my $list = sub {
    my ($dh) = @_;
    local $! = 0;
    my @names = readdir($dh);
    return $! ? undef : \@names;
  };
  opendir(my $d, $dir) or $bad->(4, 'the folder of operations cannot be read');
  my $names = $list->($d) or $bad->(4, 'the folder of operations cannot be read');
  my @ops = sort grep { /^[A-Za-z0-9-]+$/ } @$names;
  closedir($d);
  for my $o (@ops) {
    # Whether there is a journal is read from the folder's own listing, never from a failed look.
    my $od;
    if (!opendir($od, "$dir/$o")) {
      next if $!{ENOTDIR} || $!{ENOENT};
      $bad->(4, "the folder of operation $o cannot be read");
    }
    my $in = $list->($od) or $bad->(4, "the folder of operation $o cannot be read");
    my $there = grep { $_ eq 'journal' } @$in;
    closedir($od);
    next unless $there;
    open(my $fh, '<', "$dir/$o/journal") or $bad->(4, "the journal of operation $o cannot be read");
    binmode($fh);
    my $text = '';
    while (1) {
      my $n = sysread($fh, my $buf, 65536);
      $bad->(4, "the journal of operation $o cannot be read") unless defined $n;
      last if $n == 0;
      $text .= $buf;
      $bad->(5, "the journal of operation $o is not a journal (it is far too long)") if length($text) > 4_000_000;
    }
    close($fh);
    $text =~ s/[^\n]*\z//;    # a last line without its line break was never written
    chomp(my $whole = $text);
    for my $line (split(/\n/, $whole, -1)) {
      last if $whole eq '';
      $bad->(5, "the journal of operation $o holds a complete line that is not a record") unless $line =~ $record;
      print "$o $line\n";
    }
  }
  exit 0;
}

usage();
