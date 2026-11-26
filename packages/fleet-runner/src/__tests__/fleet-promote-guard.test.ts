import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The promote's kernel lock, step bound, detach and journal append (fleet-promote-guard.pl), and the
// rule that an argument sent to the server is one line (nas, in the lib). EVERYTHING HERE IS
// SYNTHETIC. The helper is driven from dash, the strictest sh there is, on macOS and on Linux alike:
// the server-side decider is POSIX sh and must not depend on which sh a machine has.
vi.setConfig({ testTimeout: 60_000 });
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GUARD = join(pkg, "scripts/fleet-promote-guard.pl");
const LIB = join(pkg, "scripts/lib/fleet-stage-lib.sh");
const DASH = "/bin/dash";

let box = "";
beforeEach(() => {
  if (!existsSync(DASH)) throw new Error("these tests need dash at /bin/dash (macOS and Ubuntu both have it)");
  box = mkdtempSync(join(tmpdir(), "fleet-guard-"));
  mkdirSync(join(box, "deploy"));
});
afterEach(() => {
  rmSync(box, { recursive: true, force: true });
});

const deploy = () => join(box, "deploy");
/** Run a POSIX sh script under dash; $G is the guard, $D the folder that is the lock, $B the box.
 * It returns when the script AND everything still holding its output have ended, so a script that
 * leaves something running gives that thing its own output (> /dev/null). */
function dash(script: string, env: Record<string, string> = {}) {
  const r = spawnSync(DASH, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, G: GUARD, D: deploy(), B: box, ...env },
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const pidIn = (name: string) => Number(readFileSync(join(box, name), "utf8").trim());
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
async function until(what: () => boolean, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (what()) return true;
    await sleep(100);
  }
  return what();
}
/** Whether a newcomer can take the lock right now (it lets go at once). */
const lockIsFree = () => dash('exec 9< "$D"; perl "$G" lock 9').status === 0;

describe("fleet-promote-guard.pl lock", () => {
  it("takes the lock on the folder, refuses a second taker, and frees it when the holder is gone", () => {
    const r = dash(`
      exec 9< "$D"
      perl "$G" lock 9; echo "first=$?"
      ( exec 9<&-; exec 9< "$D"; perl "$G" lock 9; echo "second=$?" )
      perl "$G" lock 9; echo "again=$?"
    `);
    expect(r.out).toContain("first=0");
    expect(r.out).toContain("second=1");
    // The holder asking again is not refused: the lock is the open folder's, and it holds that.
    expect(r.out).toContain("again=0");
    expect(lockIsFree()).toBe(true);
  });

  it("says 2, not 'busy', when it cannot try at all (no such descriptor)", () => {
    expect(dash('perl "$G" lock 9').status).toBe(2);
    expect(dash('perl "$G" lock nine').status).toBe(2);
  });

  it("stays held after the taker is gone while anything it started still holds the folder", async () => {
    const r = dash(`
      exec 9< "$D"
      perl "$G" lock 9 || exit 1
      sleep 3 > /dev/null 2>&1 &
      echo $! > "$B/child.pid"
    `);
    expect(r.status).toBe(0);
    expect(lockIsFree()).toBe(false);
    expect(await until(() => !alive(pidIn("child.pid")), 8000)).toBe(true);
    expect(await until(lockIsFree, 3000)).toBe(true);
  });

  it("when the holder is killed (SIGKILL) mid-step, the lock stays until the bounded step has ended, then frees", async () => {
    writeFileSync(
      join(box, "holder.sh"),
      `exec 9< "$D"
perl "$G" lock 9 || exit 1
echo $$ > "$B/holder.pid"
perl "$G" bound 3 1 -- sh -c 'echo $$ > "$B/step.pid"; sleep 60'
echo "must never get here" > "$B/after"
`,
    );
    const child = spawn(DASH, [join(box, "holder.sh")], {
      env: { ...process.env, G: GUARD, D: deploy(), B: box },
      stdio: "ignore",
    });
    expect(await until(() => existsSync(join(box, "step.pid")), 5000)).toBe(true);
    process.kill(pidIn("holder.pid"), "SIGKILL");
    await new Promise((ok) => child.once("exit", ok));
    // The decider is dead; its step is not, and nobody may change production on top of it.
    expect(alive(pidIn("step.pid"))).toBe(true);
    expect(lockIsFree()).toBe(false);
    // The bound is a process of its own: it still ends the step, and only then is the lock free.
    expect(await until(lockIsFree, 10_000)).toBe(true);
    expect(alive(pidIn("step.pid"))).toBe(false);
    expect(existsSync(join(box, "after"))).toBe(false);
  });
});

describe("fleet-promote-guard.pl bound", () => {
  it("passes the step's status, stdin and output through when it ends in time", () => {
    expect(dash(`perl "$G" bound 5 1 -- sh -c 'exit 7'`).status).toBe(7);
    const r = dash(`printf 'checked bytes\\n' | perl "$G" bound 5 1 -- cat`);
    expect(r.status).toBe(0);
    expect(r.out).toBe("checked bytes\n");
    expect(dash(`perl "$G" bound 5 1 -- sh -c 'kill -9 $$'`).status).toBe(137);
    // 122 to 126 are the helper's own verdicts: a command that ends with one of them cannot be
    // mistaken for "could not be ended" (125) or "was ended at the bound" (124).
    for (const own of [122, 123, 124, 125, 126]) expect(dash(`perl "$G" bound 5 1 -- sh -c 'exit ${own}'`).status).toBe(121);
    // A caller that ignores TERM (the decider does) must not make the step deaf to it.
    const t0 = Date.now();
    expect(dash(`trap '' TERM INT HUP; perl "$G" bound 1 20 -- sleep 30`).status).toBe(124);
    expect(Date.now() - t0).toBeLessThan(6000);
  });

  it("ends a step that ignores TERM, and its grandchild, at the bound, and only then returns 124", () => {
    const t0 = Date.now();
    const r = dash(`
      perl "$G" bound 2 1 -- sh -c '
        trap "" TERM
        ( trap "" TERM; echo $$ > /dev/null; sh -c "echo \\$\\$ > \\"$B/grandchild.pid\\"; trap \\"\\" TERM; sleep 60" ) &
        echo $$ > "$B/step.pid"
        sleep 60'
      echo "status=$?"
    `);
    const took = Date.now() - t0;
    expect(r.out).toContain("status=124");
    // The bound (2 s), the grace (1 s), and not much more: it does not wait for the 60 seconds.
    expect(took).toBeGreaterThanOrEqual(2900);
    expect(took).toBeLessThan(9000);
    expect(alive(pidIn("step.pid"))).toBe(false);
    expect(alive(pidIn("grandchild.pid"))).toBe(false);
  });

  it("does not call a step finished while something it started still runs: when the leader exits first, the rest is ended at once", () => {
    const t0 = Date.now();
    const r = dash(`
      perl "$G" bound 30 1 -- sh -c 'sleep 60 & echo $! > "$B/straggler.pid"; exit 0'
      echo "status=$?"
    `);
    expect(r.out).toContain("status=124");
    expect(alive(pidIn("straggler.pid"))).toBe(false);
    // Not after the 30-second bound: about a second after the leader was seen to have ended.
    expect(Date.now() - t0).toBeLessThan(8000);
  });

  it("a child that closes every descriptor it inherited is still found and ended: an empty pipe is a hint, never proof", () => {
    // The step's leader exits at once and leaves a child that shut the pipe the guard watches.
    const t0 = Date.now();
    const r = dash(`
      perl "$G" bound 30 1 -- perl -e '
        my $k = fork();
        if (!$k) { require POSIX; POSIX::close($_) for (0 .. 255); sleep 60; exit 0 }
        open(my $f, ">", "$ENV{B}/quiet.pid"); print $f "$k\n"; close($f); exit 0'
      echo "status=$?"
    `);
    expect(r.out).toContain("status=124");
    expect(alive(pidIn("quiet.pid"))).toBe(false);
    expect(Date.now() - t0).toBeLessThan(9000);
  });

  it("a leader that closes its descriptors does not run past its bound: the wait for it is inside the bound too", () => {
    const t0 = Date.now();
    const r = dash(`
      perl "$G" bound 1 1 -- perl -e 'require POSIX; POSIX::close($_) for (3 .. 255); sleep 8; exit 0'
      echo "status=$?"
    `);
    const took = Date.now() - t0;
    expect(r.out).toContain("status=124");
    expect(took).toBeGreaterThanOrEqual(900);
    expect(took).toBeLessThan(4000);
  });

  it("keeps to the bound by a clock that cannot be set, to within a second, also with a step that never reads the bytes it is handed", () => {
    // 16,000 bytes (the most it accepts) for a step that never reads them: writing them must not block the guard.
    writeFileSync(join(box, "big.json"), "x".repeat(16000));
    const hash = sha256(readFileSync(join(box, "big.json")));
    const t0 = Date.now();
    const r = dash(`perl "$G" bound --stdin-checked "$B/big.json" ${hash} 2 1 -- sleep 30; echo "status=$?"`);
    const took = Date.now() - t0;
    expect(r.out).toContain("status=124");
    expect(took).toBeGreaterThanOrEqual(1900);
    expect(took).toBeLessThan(4500);
    // And the same bytes still arrive whole at a step that does read them.
    expect(dash(`perl "$G" bound --stdin-checked "$B/big.json" ${hash} 5 1 -- wc -c`).out.trim()).toBe("16000");
  });

  it("records the step's process group, durably, BEFORE the step runs; without the record the step never runs", () => {
    const r = dash(`
      perl "$G" bound --note "$B/groups" stop-previous 5 1 -- sh -c 'echo "pid=$$"; echo "seen=$(cat "$B/groups")"'
      echo "status=$?"
    `);
    expect(r.out).toContain("status=0");
    const pid = /pid=(\d+)/.exec(r.out)?.[1];
    const line = readFileSync(join(box, "groups"), "utf8");
    expect(line).toMatch(new RegExp(`^${pid} \\S+ stop-previous\\n$`));
    // The step itself saw its own record: it was written before the step started.
    expect(r.out).toContain(`seen=${line.trim()}`);
    const bad = dash(`
      perl "$G" bound --note "$B/missing/groups" x 5 1 -- sh -c 'echo ran > "$B/ran"'; echo "status=$?"
      perl "$G" bound --note "$B/missing/groups" x --soft-note 5 1 -- sh -c 'echo ran > "$B/ran-soft"'; echo "soft=$?"
    `);
    expect(bad.out).toContain("status=123");
    expect(existsSync(join(box, "ran"))).toBe(false);
    // In an undo the record is wanted but must not stop the step that brings production back.
    expect(bad.out).toContain("soft=0");
    expect(existsSync(join(box, "ran-soft"))).toBe(true);
  });

  it("tells whether anything of a recorded group still runs, naming members by command only, and is not fooled by a reused number", async () => {
    expect(dash(`perl "$G" groups-alive "$B/groups"`).status).toBe(0);
    dash(`perl "$G" bound --note "$B/groups" quick 5 1 -- true`);
    expect(dash(`perl "$G" groups-alive "$B/groups"`).status).toBe(0);
    // A double fault: the bound itself is killed, so its step runs on with nobody to end it.
    const r = dash(`
      perl "$G" bound --note "$B/groups" start-new 60 1 -- sleep 61 > /dev/null 2>&1 &
      echo $! > "$B/bound.pid"
      while [ "$(wc -l < "$B/groups")" -lt 2 ]; do sleep 0.1; done
      # The group is recorded before the step is let go: wait until the step itself runs (a bound
      # killed before that never starts its step, and there would be nothing left to find).
      g="$(sed -n 2p "$B/groups" | cut -d' ' -f1)"
      while [ "$(ps -o comm= -p "$g" 2>/dev/null | sed 's|.*/||')" != sleep ]; do sleep 0.1; done
    `);
    expect(r.status).toBe(0);
    process.kill(pidIn("bound.pid"), "SIGKILL");
    const group = Number(readFileSync(join(box, "groups"), "utf8").trim().split("\n")[1]?.split(" ")[0]);
    await sleep(300);
    const live = dash(`perl "$G" groups-alive "$B/groups"`);
    expect(live.status).toBe(1);
    expect(live.out).toMatch(new RegExp(`^group ${group} \\(start-new\\): ${group} sleep\\n$`));
    expect(live.out).not.toContain("61");
    process.kill(-group, "SIGKILL");
    expect(await until(() => dash(`perl "$G" groups-alive "$B/groups"`).status === 0, 5000)).toBe(true);
    // A record whose number now belongs to a process that started at another time: not this group.
    const other = dash(`perl "$G" detach "$B/o.log" -- sleep 5`).out.trim();
    writeFileSync(join(box, "old-groups"), `${other} Thu_Jan__1_00:00:00_1970 long-ago\n`);
    expect(dash(`perl "$G" groups-alive "$B/old-groups"`).status).toBe(0);
    process.kill(Number(other), "SIGKILL");
  });

  it("gives the step exactly the bytes whose hash was checked, and starts nothing when they differ", () => {
    for (const text of ["{\"a\": 1}\n", "{\"a\": 1}", "{\"a\": 1}\n\n\n"]) {
      const f = join(box, "resolved.json");
      writeFileSync(f, text);
      const sha = createHash("sha256").update(text).digest("hex");
      const r = spawnSync(DASH, ["-c", `perl "$G" bound --stdin-checked "$B/resolved.json" ${sha} 5 1 -- cat`], {
        env: { ...process.env, G: GUARD, B: box },
      });
      expect(r.status).toBe(0);
      // Byte for byte, trailing line breaks included: nothing is passed through a shell variable.
      expect(r.stdout.equals(Buffer.from(text))).toBe(true);
    }
    const wrong = "0".repeat(64);
    const bad = dash(`perl "$G" bound --stdin-checked "$B/resolved.json" ${wrong} 5 1 -- sh -c 'echo ran > "$B/ran"'; echo "status=$?"`);
    expect(bad.out).toContain("status=122");
    expect(existsSync(join(box, "ran"))).toBe(false);
    expect(dash(`perl "$G" bound --stdin-checked "$B/none.json" ${wrong} 5 1 -- true; echo "status=$?"`).out).toContain("status=122");
    writeFileSync(join(box, "big.json"), "x".repeat(16001));
    const bigSha = createHash("sha256").update("x".repeat(16001)).digest("hex");
    expect(dash(`perl "$G" bound --stdin-checked "$B/big.json" ${bigSha} 5 1 -- true; echo "status=$?"`).out).toContain("status=122");
  });

  it("returns 125, never 124, when something of the step escaped its group and is still running", async () => {
    const r = dash(`
      perl "$G" bound 1 1 -- sh -c '
        perl -MPOSIX -e "fork and exit; setsid(); exec @ARGV" sh -c "echo \\$\\$ > \\"$B/escaped.pid\\"; exec sleep 30" > /dev/null 2>&1
        sleep 30'
      echo "status=$?"
    `);
    expect(r.out).toContain("status=125");
    const pid = pidIn("escaped.pid");
    expect(alive(pid)).toBe(true);
    process.kill(pid, "SIGKILL");
    expect(await until(() => !alive(pid), 3000)).toBe(true);
  });

  // (What keeps it held is the bound, which keeps the caller's descriptor for as long as the step
  // runs. A step need not inherit it: the Compose plugin, started by the engine client, does not.)
  it("a step left running in the background keeps the lock held, through the bound that runs it, until it has ended", async () => {
    const r = dash(`
      exec 9< "$D"
      perl "$G" lock 9 || exit 1
      perl "$G" bound 4 1 -- sh -c 'echo $$ > "$B/step.pid"; sleep 2' > /dev/null 2>&1 &
    `);
    expect(r.status).toBe(0);
    expect(await until(() => existsSync(join(box, "step.pid")), 3000)).toBe(true);
    expect(lockIsFree()).toBe(false);
    expect(await until(lockIsFree, 8000)).toBe(true);
  });

  it("says 126 for a command that cannot start and 2 for a bad call", () => {
    expect(dash(`perl "$G" bound 5 1 -- /nonexistent/command`).status).toBe(126);
    expect(dash(`perl "$G" bound 0 1 -- true`).status).toBe(2);
    expect(dash(`perl "$G" bound five 1 -- true`).status).toBe(2);
    expect(dash(`perl "$G" bound 5 1 true`).status).toBe(2);
    expect(dash(`perl "$G" nothing`).status).toBe(2);
  });
});

describe("fleet-promote-guard.pl detach, append, holders, nonce", () => {
  it("starts a command in a session of its own that outlives its starter, with its output in the log", async () => {
    const r = dash(`
      pid="$(perl "$G" detach "$B/out.log" -- sh -c 'echo started; cat; sleep 2; echo finished')"
      echo "pid=$pid"
      echo "pgid=$(ps -o pgid= -p "$pid" | tr -d ' ')"
    `);
    const pid = Number(/pid=(\d+)/.exec(r.out)?.[1]);
    expect(pid).toBeGreaterThan(1);
    // A session and group of its own: nothing sent to the starter's group reaches it.
    expect(r.out).toContain(`pgid=${pid}`);
    expect(alive(pid)).toBe(true);
    expect(await until(() => !alive(pid), 8000)).toBe(true);
    // cat returned at once: stdin is /dev/null, so nothing can wait on the connection.
    expect(readFileSync(join(box, "out.log"), "utf8")).toBe("started\nfinished\n");
  });

  it("fails, and starts nothing, when the log cannot be written", () => {
    const r = dash(`perl "$G" detach "$B/missing/out.log" -- sh -c 'echo ran > "$B/ran"'; echo "status=$?"`);
    expect(r.out).toContain("status=1");
    expect(existsSync(join(box, "ran"))).toBe(false);
  });

  it("appends one whole line at a time, refuses a line break, and fails when the file cannot be written", () => {
    const j = join(box, "journal");
    expect(dash(`perl "$G" append "$B/journal" "1 2026-01-01T00:00:00Z begun run=r1"`).status).toBe(0);
    expect(dash(`perl "$G" append "$B/journal" "2 2026-01-01T00:00:01Z verified"`).status).toBe(0);
    expect(readFileSync(j, "utf8")).toBe("1 2026-01-01T00:00:00Z begun run=r1\n2 2026-01-01T00:00:01Z verified\n");
    expect(dash(`perl "$G" append "$B/journal" "3 two
lines"`).status).toBe(1);
    chmodSync(j, 0o400);
    const r = dash(`perl "$G" append "$B/journal" "3 x"`);
    chmodSync(j, 0o600);
    // Root (a container) can write anything; everywhere else a read-only journal is a failure.
    if (process.getuid?.() !== 0) expect(r.status).toBe(1);
    expect(dash(`perl "$G" append "$B/missing/journal" "1 x"`).status).toBe(1);
    expect(readFileSync(j, "utf8").split("\n").filter(Boolean).length).toBeLessThanOrEqual(3);
  });

  it("cuts off an incomplete last line before it appends, so a torn write never joins the next line", () => {
    const j = join(box, "journal");
    writeFileSync(j, "t1 begun\nt2 verif");
    expect(dash(`perl "$G" append "$B/journal" "t3 undoing reason=x"`).status).toBe(0);
    expect(readFileSync(j, "utf8")).toBe("t1 begun\nt3 undoing reason=x\n");
    writeFileSync(j, "only a torn first li");
    expect(dash(`perl "$G" append "$B/journal" "t1 begun"`).status).toBe(0);
    expect(readFileSync(j, "utf8")).toBe("t1 begun\n");
  });

  it("publishes a record whole or not at all, and flushes files and folders", () => {
    const r = dash(`printf 'line one\nline two\n' | perl "$G" publish "$B/record.txt"; echo "status=$?"`);
    expect(r.out).toContain("status=0");
    expect(readFileSync(join(box, "record.txt"), "utf8")).toBe("line one\nline two\n");
    expect(existsSync(join(box, "record.txt.part"))).toBe(false);
    expect(dash(`echo x | perl "$G" publish "$B/missing/record.txt"; echo "status=$?"`).out).toContain("status=1");
    expect(dash(`perl "$G" sync-path "$B/record.txt" "$B"; echo "status=$?"`).out).toContain("status=0");
    expect(dash(`perl "$G" sync-path "$B/record.txt" "$B/none"; echo "status=$?"`).out).toContain("status=1");
  });

  it("names what holds the folder by process ID and command name only, never arguments", async () => {
    const r = dash(`
      exec 9< "$D"
      perl "$G" lock 9 || exit 1
      sleep 4 > /dev/null 2>&1 &
      echo $! > "$B/holder.pid"
    `);
    expect(r.status).toBe(0);
    const pid = pidIn("holder.pid");
    const h = dash(`perl "$G" holders "$D"`);
    expect(h.status).toBe(0);
    expect(h.out.split("\n")).toContain(`${pid} sleep`);
    expect(h.out).not.toMatch(/sleep 4/);
    expect(await until(() => !alive(pid), 8000)).toBe(true);
    expect(dash(`perl "$G" holders "$D"`).out).toBe("");
  });

  it("makes a fresh 32-hex nonce each time", () => {
    const a = dash(`perl "$G" nonce`).out.trim();
    const b = dash(`perl "$G" nonce`).out.trim();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("nas (the lib): what travels to the server", () => {
  // A fake ssh that hands the command line to dash, as a Linux server's sh would read it, and keeps
  // every command line it was given.
  function nas(body: string) {
    const bin = join(box, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, "ssh"),
      `#!/bin/bash
while [ "$1" = -o ]; do shift 2; done
shift
printf '%s\\n=====\\n' "$1" >> "$BOX/ssh-cmds.log"
exec ${DASH} -c "$1"
`,
    );
    chmodSync(join(bin, "ssh"), 0o755);
    const r = spawnSync("bash", ["-c", `. "${LIB}"\nNAS_SSH=synthetic-server\n${body}`], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BOX: box },
    });
    const cmds = existsSync(join(box, "ssh-cmds.log")) ? readFileSync(join(box, "ssh-cmds.log"), "utf8") : "";
    return { status: r.status, out: r.stdout, err: r.stderr, cmds };
  }

  it("refuses an argument that holds a line break, before anything is sent", () => {
    const r = nas(`rc=0; nas 'echo "got: $1"' $'first line\\nsecond line' || rc=$?; echo "status=$rc"`);
    expect(r.out).toContain("status=2");
    expect(r.out).not.toContain("got:");
    expect(r.err).toContain("an argument holds a line break");
    expect(r.cmds).toBe("");
    // A tab, or a byte that is not text, takes the same $'..' form: refused the same way.
    for (const arg of ["$'a\\tb'", "$'caf\\303\\251'", "$'\\001'"]) {
      const t = nas(`rc=0; LC_ALL=C nas 'echo "got: $1"' ${arg} || rc=$?; echo "status=$rc"`);
      expect(t.out).toContain("status=2");
      expect(t.cmds).toBe("");
    }
    // Text that merely looks like that form is sent as what it is.
    const plain = nas(`nas 'printf "%s\\n" "$1"' "\$'not special'"`);
    expect(plain.out).toBe("$'not special'\n");
  });

  it("delivers one-line arguments unchanged to a dash server, and the script on stdin, not on the command line", () => {
    const r = nas(`nas 'for a in "$@"; do printf "[%s]\\n" "$a"; done
echo "a multi-line script ran"' "two words" 'a $dollar and a "quote"' "it's" ''`);
    expect(r.status).toBe(0);
    expect(r.out).toBe(`[two words]\n[a $dollar and a "quote"]\n[it's]\n[]\na multi-line script ran\n`);
    expect(r.cmds).not.toContain("a multi-line script ran");
    // No argument ever arrives in the $'..' form only some shells read.
    expect(r.cmds).not.toContain("$'");
  });
});
