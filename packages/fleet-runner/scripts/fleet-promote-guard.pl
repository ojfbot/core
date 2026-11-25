#!/usr/bin/perl
# fleet-promote-guard: the few things the promote's server-side decider (fleet-promote-decider.sh,
# POSIX sh) cannot do in sh, with only the perl modules a minimal install has (POSIX, Fcntl,
# IO::Handle), so that ONE code path runs on the Linux server, in CI and in the tests on macOS
# (which has no flock, setsid or timeout commands). ojfbot/core#647, slice 4.
#
#   lock <fd>
#       Take an exclusive, non-blocking kernel lock (flock) on the descriptor the caller already
#       holds open. The lock belongs to that open file, not to this process: it lasts until the
#       caller and every process that inherited the descriptor are gone.
#       0: taken. 1: someone else holds it. 2: could not try.
#
#   bound [--note <file> <label>] [--soft-note] [--stdin-checked <file> <sha256>] <seconds> <grace> -- cmd..
#       Run cmd in a session and process group of its own, with this process's stdout and stderr.
#       If cmd AND everything it started have ended within <seconds>, exit with cmd's status
#       (121 if cmd's own status was one of the verdicts below, so those are never ambiguous).
#       Otherwise (the time is up, or cmd itself ended and left something running) send TERM to
#       the group, wait <grace> seconds, send KILL, and wait until nothing of it is left.
#         124: it had to be ended, and nothing of it is left.
#         125: something of it is still running; the caller must stop and change nothing more.
#         126: cmd could not be started.
#       --note: BEFORE cmd runs, append "<group ID> <start time> <label>" to <file> and flush it
#         (123 and cmd never runs if that fails; with --soft-note it runs anyway). The start time
#         tells this group from a later, unrelated one that was given the same number.
#       --stdin-checked: read <file> ONCE into memory (at most 16000 bytes), require those bytes
#         to have the SHA-256 <sha256>, and give exactly those bytes to cmd on stdin
#         (122 and cmd never runs if they differ or cannot be read). Check and use are one buffer.
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
#       of that worked.
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
# How bound knows that nothing is left: cmd and all it starts inherit the write end of a pipe; the
# read end reaches end-of-file only when the last of them has exited. A signal is only ever sent to
# the group while its leader is still this process's unreaped child (running, or exited and not yet
# collected), so the group ID cannot have been given to anyone else; the leader is collected last.
use strict;
use warnings;
use POSIX qw(setsid :sys_wait_h);
use Fcntl qw(:flock :DEFAULT F_GETFD F_SETFD FD_CLOEXEC);
use IO::Handle;

sub usage {
  print STDERR "usage: fleet-promote-guard.pl lock|bound|detach|append|publish|sync-path|groups-alive|holders|nonce (see the file's header)\n";
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
  if (defined $note_file) {
    my $ok = append_line($note_file, "$pid " . (start_time_of($pid) || 'unknown') . " $note_label");
    if (!$ok && !$soft) {
      # The child has run nothing yet and is this process's own: ending it is exact.
      kill('KILL', $pid);
      waitpid($pid, 0);
      exit 123;
    }
  }
  # Only cmd's own end counts from here (looking up the start time ran a child of its own).
  $chld = 0;
  syswrite($go_w, 'g');
  close($go_w);
  if (defined $bytes) { write_all($in_w, $bytes); close($in_w); }
  # True once nothing that holds the write end is left, or false after <wait> seconds, or (with
  # $stop_on_exit) a second after cmd itself has ended while something of it lives on. Counted in
  # quarter-second waits, never read from the clock, so a clock that jumps changes nothing.
  my $unstarted = 0;
  my $gone = sub {
    my ($wait, $stop_on_exit) = @_;
    my $after_exit = 0;
    for (my $i = 0; $i < $wait * 4; $i++) {
      my $bits = '';
      vec($bits, fileno($rd), 1) = 1;
      my $n = select($bits, undef, undef, 0.25);
      if (defined $n && $n > 0) {
        my $got = sysread($rd, my $buf, 4096);
        return 1 if defined $got && $got == 0;
        $unstarted = 1 if defined $got && $got > 0;
        return 0 unless defined $got || $!{EINTR};
      }
      return 0 if $stop_on_exit && $chld && ++$after_exit > 4;
    }
    return 0;
  };
  my $ended = 0;
  if (!$gone->($secs, 1)) {
    $ended = 1;
    # The leader is this process's child, running or exited and not yet collected: the group ID is
    # still its own, whoever of the group is left.
    kill('TERM', -$pid);
    if (!$gone->($grace, 0)) {
      kill('KILL', -$pid);
      exit 125 unless $gone->(5, 0);
    }
  }
  waitpid($pid, 0);
  my $st = $?;
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
  my $text = do { local $/; <STDIN> } // '';
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
  my (%label, %start);
  while (my $row = <$fh>) {
    next unless $row =~ /\n\z/;    # an incomplete last line recorded nothing that ran
    my ($g, $t, $l) = split(' ', $row);
    next unless defined $l && $g =~ /^[0-9]+$/ && $g > 1;
    $label{$g} = $l;
    $start{$g} = $t;
  }
  close($fh);
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

usage();
