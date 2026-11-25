import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DASH,
  GUARD,
  HAND_NAME,
  OLD_BUILD,
  PROJECT,
  alive,
  containers,
  dockerLog,
  field,
  imageId,
  jobsIn,
  journal,
  lockIsFree,
  opDir,
  reality,
  record,
  records,
  setFaults,
  sleep,
} from "./fakes/promote-harness.js";
import { GIT_ID, headRev, lastOp, macLog, ops, promote, promoteAsync, script, setSsh, setup, sh, sshCmds, staged, statusNow, useMacSandboxes, yes } from "./fakes/mac-harness.js";

// fleet-promote.sh end to end, without a server or a real engine. EVERYTHING HERE IS SYNTHETIC: the
// keys, certificates, revisions, folders, addresses and jobs are made by the test and mean nothing
// outside it. The real scripts run from a sandbox git repo (with its own origin); `ssh` runs the
// "server" side locally, under dash, in a sandbox folder; the engine is fake-docker.mjs; and every
// "container" is a real fleet-runner server over TLS from the built package, so the signed status
// calls and the certificate fingerprint are the real ones.
// (The sandbox is in fakes/mac-harness.ts. The sweep that kills the Mac at every call it makes is in
// fleet-promote-mac.sweep_test.ts, which CI runs when a change touches the promote.)
vi.setConfig({ testTimeout: 400_000 });
useMacSandboxes();

describe("fleet-promote.sh refuses before anything changes", () => {
  it("without the owner's yes, with a yes that does not name the revision, or that names another commit; a dated sentence is fine", async () => {
    const e = await setup();
    const head = headRev(e);
    const [a] = e.revs as [string];
    const none = promote(e, [head]);
    expect(none.status).toBe(3);
    expect(none.out).toContain("needs the owner's yes");
    expect(promote(e, [head, "--owner-approved", "   "]).status).toBe(3);
    const vague = promote(e, [head, "--owner-approved", "Yes, go ahead"]);
    expect(vague.out).toContain("must name the revision it approves");
    const other = promote(e, [head, "--owner-approved", `Yes, promote ${a.slice(0, 7)}`]);
    expect(other.out).toMatch(/the approval names [0-9a-f]{7}, which is [0-9a-f]{12}, not/);
    // A branch named like a short commit ID must not redirect the promote.
    sh(e.repo, "git", ["branch", a.slice(0, 7), head]);
    const redirected = promote(e, [a.slice(0, 7), "--owner-approved", `Yes, promote ${a.slice(0, 7)}`]);
    expect(redirected.out).toMatch(/does not start with it|unknown commit|must be a commit ID|refname .* is ambiguous/);
    expect(redirected.status).not.toBe(0);
    for (const r of [none, vague, other, redirected]) expect(r.out).not.toContain("PASS production runs");
    expect(ops(e)).toEqual([]);
    expect(dockerLog(e.box)).toEqual([]);
    // A hex-looking word that names no commit (a date) is ignored: this approval passes the gate
    // and the run is refused later only because the checkout is not clean.
    writeFileSync(join(e.repo, "untracked.txt"), "x");
    const dated = promote(e, [head, "--owner-approved", `Yes, promote ${head.slice(0, 9)} on 20261125, feedback welcome`]);
    expect(dated.out).toContain("this checkout has uncommitted changes");
  });

  it("a revision that is not staged, has no receipt on this Mac, or whose server release is not the one this Mac verified", async () => {
    const e = await setup();
    const head = headRev(e);
    writeFileSync(join(e.stageDeploy, "stage-state"), `last_passed=${head}\nstaged_ok=\n`);
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("is not staged");
    staged(e, head, false);
    rmSync(join(dirname(e.conf), "receipts", `${head}.receipt`));
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("this Mac has no receipt");
    staged(e, head);
    writeFileSync(join(e.stageDeploy, "releases", head, "release.json"), "{}\n");
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("is not the one this Mac verified");
    expect(ops(e)).toEqual([]);
    expect(reality(e.box).running.map((c) => c.name)).toEqual([HAND_NAME]);
  });

  it("a Compose file that drops the hardening: refused by the allowlist on this Mac, before the decider is started", async () => {
    const e = await setup();
    const f = join(e.repo, "packages/fleet-runner/deploy/compose.production.yaml");
    writeFileSync(f, readFileSync(f, "utf8").replace("read_only: true", "read_only: false\n    privileged: true"));
    sh(e.repo, "git", ["commit", "-q", "-am", "a weaker compose file"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const head = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, head);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    expect(r.out).toContain("is not production's allowlisted shape; nothing was changed");
    expect(r.status).toBe(1);
    expect(journal(e.box, lastOp(e))).toEqual([]);
    expect(reality(e.box).running.map((c) => c.name)).toEqual([HAND_NAME]);
    // The decider of that run was never started: its folder holds no plan and no journal.
    expect(existsSync(join(opDir(e.box, lastOp(e)), "plan"))).toBe(false);
  });

  it("an impossible bound is refused here, with the decider's own arithmetic, before a plan is uploaded", async () => {
    const e = await setup();
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head)], { FLEET_B_EVIDENCE: "20" });
    expect(r.out).toContain("REFUSED b_evidence must be at least 60 seconds");
    expect(r.out).toContain("the bounds are not possible; nothing was changed");
    expect(existsSync(join(opDir(e.box, lastOp(e)), "plan"))).toBe(false);
  });
});

describe("fleet-promote.sh end to end", () => {
  it("promotes: prints the bounds before the yes is spent, sends go and evidence, prints PASS only from the decider's record; then a second promote and a revert", async () => {
    const e = await setup();
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    const op = lastOp(e);
    expect(r.out).toContain(`PASS production runs ${head.slice(0, 7)} (was the hand-started container (build ${OLD_BUILD.slice(0, 12)})), by the decider's record promote-records/promote-${op}.txt:`);
    expect(r.status).toBe(0);
    expect(statusNow(e)).toBe(head);
    // The table and the worst case come before the decider is started, so before the yes is spent.
    expect(r.out.indexOf("worst case, production offline or on an unconfirmed build:")).toBeGreaterThan(-1);
    expect(r.out.indexOf("worst case, production offline")).toBeLessThan(r.out.indexOf("the owner's yes is spent"));
    expect(r.out).toContain("10  this Mac waits for the decider's first journal line");
    expect(r.out).toContain("this Mac: the signed status answers ready, build");
    expect(r.out).toContain("this Mac: the same TLS certificate");
    expect(r.out).toContain("COMMITTED on the server");
    expect(field(e.box, op, "done", "outcome")).toBe("pass");
    // Nothing private in what the Mac printed or logged: no folder, no address, no port, no ssh name.
    for (const text of [r.out, macLog(e)]) for (const secret of [e.box.root, tmpdir(), "127.0.0.1", "synthetic-server", String(e.box.port), "localhost"]) expect(text).not.toContain(secret);
    expect(macLog(e)).toContain("PASS production runs");
    // This Mac's receipt of what it checked for this run.
    const receipt = readFileSync(join(dirname(e.conf), "receipts", `promote-${op}.receipt`), "utf8");
    expect(receipt).toContain(`resolved_sha256=${field(e.box, op, "verified", "cfg")}`);
    expect(receipt).toContain(`prev_build=${OLD_BUILD}`);
    // Every argument that crossed to the server was one plain line; scripts went on stdin.
    expect(sshCmds(e)).not.toContain("$'");
    for (const cmd of sshCmds(e).split("\n=====\n")) expect(cmd.trim().split("\n").length).toBeLessThanOrEqual(1);

    // A later promote: Compose to Compose, checked against this Mac's receipt of the run before.
    writeFileSync(join(e.repo, "third.txt"), "third");
    sh(e.repo, "git", ["add", "-A"]);
    sh(e.repo, "git", ["commit", "-q", "-m", "third"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const next = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, next);
    const again = promote(e, [next, "--owner-approved", yes(head)]);
    expect(again.out).toMatch(/the approval names [0-9a-f]+, which is [0-9a-f]{12}, not/);
    const second = promote(e, [next, "--owner-approved", yes(next)]);
    expect(second.out).toContain(`PASS production runs ${next.slice(0, 7)} (was ${head.slice(0, 7)} (run ${op}))`);
    expect(statusNow(e)).toBe(next);
    const op2 = lastOp(e);

    // status, read-only, from this Mac.
    const st = promote(e, ["status", op2]);
    expect(st.out).toContain("outcome: PASSED");
    expect(st.out).toContain("not a statement about what production runs now");

    // A revert: its own yes, naming the run whole.
    const vague = promote(e, ["revert", op2, "--owner-approved", "Yes, revert it"]);
    expect(vague.out).toContain(`must name the run it reverts (${op2})`);
    const rv = promote(e, ["revert", op2, "--owner-approved", `Yes, revert ${op2} (synthetic)`]);
    expect(rv.out).toMatch(/jobs: production holds \d+ now, the snapshot of run .* holds 3/);
    expect(rv.out).toContain("REVERTED by the decider");
    expect(rv.out).toContain(`CHECKED from this Mac: the signed status answers ready, build ${head.slice(0, 12)}, as before`);
    expect(rv.status).toBe(0);
    expect(statusNow(e)).toBe(head);
    expect(field(e.box, op2, "done", "outcome")).toBe("pass");
  });

  it("PASS needs the decider's record, read: a journal that says 'done pass' is not enough on its own", async () => {
    const e = await setup();
    const head = headRev(e);
    // The record cannot be read back (the connection fails for exactly that call).
    setSsh(e, ['fail_match=promote-records/promote-$2.txt']);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    const op = lastOp(e);
    expect(field(e.box, op, "done", "outcome")).toBe("pass");
    expect(r.out).not.toContain("PASS production runs");
    expect(r.out).toContain("FAIL the journal says the pass is done, but its record could not be read: not reported as PASS.");
    expect(r.status).toBe(1);
    setSsh(e, []);
    expect(promote(e, ["status", op]).out).toContain("outcome: PASSED");
  });

  it("without this Mac's receipt of the run production is on, a later promote is refused", async () => {
    const e = await setup();
    const head = headRev(e);
    expect(promote(e, [head, "--owner-approved", yes(head)]).status).toBe(0);
    const op = lastOp(e);
    rmSync(join(dirname(e.conf), "receipts", `promote-${op}.receipt`));
    writeFileSync(join(e.repo, "third.txt"), "third");
    sh(e.repo, "git", ["add", "-A"]);
    sh(e.repo, "git", ["commit", "-q", "-m", "third"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const next = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, next);
    const r = promote(e, [next, "--owner-approved", yes(next)]);
    expect(r.out).toContain(`this Mac has no receipt of run ${op}`);
    expect(statusNow(e)).toBe(head);
  });

  it("a new revision that answers as another build, or with another certificate: the decider undoes; the Mac prints UNDONE and its own check, never PASS", async () => {
    for (const fault of ["FAKE_BAD_BUILD_FOR", "FAKE_OTHER_CERT_FOR"]) {
      const e = await setup();
      const head = headRev(e);
      const service = JSON.parse(readFileSync(join(e.box.fake, "service.json"), "utf8"));
      service.env[fault] = imageId(head);
      writeFileSync(join(e.box.fake, "service.json"), JSON.stringify(service));
      const r = promote(e, [head, "--owner-approved", yes(head)]);
      const op = lastOp(e);
      expect(r.status, fault).toBe(1);
      expect(r.out, fault).not.toContain("PASS production runs");
      expect(r.out, fault).toContain("UNDONE by the decider (record promote-records/undo-");
      expect(r.out, fault).toContain(`CHECKED from this Mac: the signed status answers ready, build ${OLD_BUILD.slice(0, 12)}, as before`);
      expect(r.out, fault).toContain(`${head.slice(0, 7)} was NOT promoted.`);
      expect(field(e.box, op, "undoing", "reason"), fault).toBe(fault === "FAKE_BAD_BUILD_FOR" ? "client-reported-failure" : "certificate-changed");
      expect(statusNow(e), fault).toBe(OLD_BUILD);
      expect(jobsIn(join(e.box.prodRoot, "state/fleet.sqlite")), fault).toBe(3);
      expect(records(e.box), fault).toEqual([`undo-${op}.txt`]);
    }
  });

  it("the rehearsal's forced failure needs a throwaway production, and ends in the undo", async () => {
    const real = await setup();
    const h1 = headRev(real);
    expect(promote(real, [h1, "--owner-approved", yes(h1)], { FLEET_PROMOTE_FAULT: "health" }).out).toContain("FLEET_PROMOTE_FAULT needs --rehearsal");
    expect(promote(real, [h1, "--owner-approved", yes(h1), "--rehearsal"], { FLEET_PROMOTE_FAULT: "health" }).out).toContain("--rehearsal is only for a throwaway production");
    expect(ops(real)).toEqual([]);
    const e = await setup({ rehearsal: true });
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head), "--rehearsal"], { FLEET_PROMOTE_FAULT: "health" });
    expect(r.out).toContain("REHEARSAL: this Mac's evidence will be made to fail (health)");
    expect(r.out).toContain("UNDONE by the decider");
    expect(field(e.box, lastOp(e), "undoing", "reason")).toBe("wrong-build");
    expect(statusNow(e)).toBe(OLD_BUILD);
  });

  it("an approval used once is refused the second time, by the decider's own check, before anything changes", async () => {
    const e = await setup({ rehearsal: true });
    const head = headRev(e);
    const words = yes(head);
    const first = promote(e, [head, "--owner-approved", words, "--rehearsal"], { FLEET_PROMOTE_FAULT: "health" });
    expect(first.out).toContain("UNDONE by the decider");
    const before = dockerLog(e.box).filter((l) => /^(stop|start|rm|compose .* up)/.test(l)).length;
    const second = promote(e, [head, "--owner-approved", words.toUpperCase().replace(head.toUpperCase(), head), "--rehearsal"]);
    expect(second.out).toContain("REFUSED this approval was already used: each yes covers one operation");
    expect(second.out).toContain("the decider's checks refuse this promote; nothing was changed");
    expect(dockerLog(e.box).filter((l) => /^(stop|start|rm|compose .* up)/.test(l)).length).toBe(before);
    expect(journal(e.box, lastOp(e))).toEqual([]);
  });

  it("the lock is held by someone else: the Mac says a holder exists (the decider, or a step), that nothing was changed, and gives no advice to remove anything", async () => {
    const e = await setup();
    const head = headRev(e);
    const holder = spawn(DASH, ["-c", `exec 9< "$1"; perl "$2" lock 9 || exit 1; exec sleep 60`, "sh", e.box.ctl, GUARD], { stdio: "ignore" });
    while (lockIsFree(e.box)) await sleep(50);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    holder.kill("SIGKILL");
    expect(r.status).toBe(1);
    expect(r.out).toContain("REFUSED another promote, recover or revert holds the lock: its decider, or a step it started that is still running. Nothing was changed.");
    expect(r.out).toMatch(/holding it: process \d+ sleep/);
    expect(r.out).toContain("REFUSED the decider did not begin: nothing was changed in production by this run.");
    // From the refusal on, nothing tells anyone to remove or delete anything (the table of bounds,
    // printed earlier, names the undo's own removal of the new revision).
    expect(r.out.slice(r.out.indexOf("REFUSED another promote"))).not.toMatch(/\b(remove|delete)\b/i);
    expect(r.out).not.toMatch(/holding it: process \d+ (sed|perl|sh|dash)\b/);
    expect(r.out).not.toContain("PASS production runs");
    expect(journal(e.box, lastOp(e))).toEqual([]);
    expect(statusNow(e)).toBe(OLD_BUILD);
  });

  it("Ctrl-C after the start is a request, not a decision: 'interruption requested; outcome pending', then the outcome as the decider recorded it", async () => {
    const e = await setup();
    const head = headRev(e);
    const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
    while (!m.out().includes("the previous production is stopped") && m.status() === null) await sleep(50);
    process.kill(-m.pid, "SIGINT");
    await m.done;
    const out = m.out();
    const op = lastOp(e);
    expect(out).toContain("interruption requested; outcome pending");
    expect(out).not.toMatch(/told the server to undo/i);
    expect(out).not.toContain("PASS production runs");
    expect(out).toContain("UNDONE by the decider");
    expect(field(e.box, op, "undoing", "reason")).toBe("client-reported-failure");
    expect(m.status()).toBe(1);
    expect(statusNow(e)).toBe(OLD_BUILD);
  });
  it("Ctrl-C at the very moment the Mac reads its clock: the lost answer is asked again, and it reads on to the outcome, never UNKNOWN", async () => {
    // An interrupt ends whatever process the script is waiting for at that moment. If that is the
    // one that tells it the time, the script must not take "no answer" for "time is up".
    // (Read 1 is before the start, where an interrupt simply ends the script. Read 2 is the start;
    // reads 3 and 4 are the read loop's own, and one of them is always its end-of-round check.)
    for (const nth of [2, 3, 4]) {
      const e = await setup();
      const head = headRev(e);
      writeFileSync(join(e.box.fake, "interrupt-at-clock"), String(nth));
      const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
      await m.done;
      const out = m.out();
      const op = lastOp(e);
      expect(existsSync(join(e.box.fake, "interrupt-at-clock.hit")), `read ${nth}`).toBe(true);
      expect(out, `read ${nth}`).toContain("interruption requested; outcome pending");
      expect(out, `read ${nth}`).not.toMatch(/integer (expression )?expected/);
      expect(out, `read ${nth}`).not.toContain(e.box.root);
      expect(out, `read ${nth}`).not.toContain("the decider did not begin");
      expect(out, `read ${nth}`).not.toContain("UNKNOWN");
      expect(out, `read ${nth}`).not.toContain("PASS production runs");
      // It read on until the decider had decided, and says what the decider recorded.
      expect(["undone", "unchanged"], `read ${nth}`).toContain(field(e.box, op, "done", "outcome"));
      expect(out, `read ${nth}`).toMatch(/UNDONE by the decider|REFUSED by the decider: nothing was changed/);
      expect(m.status(), `read ${nth}`).toBe(1);
      expect(statusNow(e), `read ${nth}`).toBe(OLD_BUILD);
    }
  });
});

describe("fleet-promote.sh when the Mac goes away", () => {
  it("the Mac cannot reach the server any more: it says what it last read, never PASS, never anything about a lock; the decider undoes alone", async () => {
    const e = await setup();
    const head = headRev(e);
    const m = promoteAsync(e, [head, "--owner-approved", yes(head)], { FLEET_MAC_WAIT_SECS: "25" });
    while (!m.out().includes("the previous production is stopped") && m.status() === null) await sleep(50);
    setSsh(e, ["fail_from=1"]);
    await m.done;
    const out = m.out();
    const op = lastOp(e);
    expect(m.status()).toBe(1);
    expect(out).toContain("this Mac cannot reach the server; it keeps trying (the decider does not need this Mac to decide)");
    expect(out).toContain("UNKNOWN this Mac did not read the outcome. This is NOT a pass.");
    expect(out).toMatch(/Last read from the server: "\w[\w-]*" at \d{4}-/);
    expect(out).toContain("This Mac's evidence was not delivered. Without it the decider undoes by itself when its window closes (an estimate:");
    expect(out).toContain(`sh promote-runs/${op}/decider.sh recover ${op}`);
    expect(out).toContain(`scripts/fleet-promote.sh status ${op}`);
    expect(out).not.toContain("PASS production runs");
    expect(out).not.toMatch(/\block\b/i);
    for (const secret of [e.box.root, "synthetic-server"]) expect(out).not.toContain(secret);
    // The decider, alone: no evidence in its window, so it undoes. No second decider was needed.
    for (let i = 0; i < 900 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
    expect(field(e.box, op, "undoing", "reason")).toBe("no-evidence");
    expect(field(e.box, op, "done", "outcome")).toBe("undone");
    expect(statusNow(e)).toBe(OLD_BUILD);
    setSsh(e, []);
    expect(promote(e, ["status", op]).out).toContain("outcome: undone");
  });

  it("the Mac killed before its evidence: the decider undoes by itself when its window closes, and says why", async () => {
    const e = await setup();
    const head = headRev(e);
    const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
    while (!m.out().includes("the new revision runs") && m.status() === null) await sleep(50);
    process.kill(-m.pid, "SIGKILL");
    try {
      process.kill(m.pid, "SIGKILL");
    } catch {}
    spawnSync("pkill", ["-9", "-f", script(e)]);
    await m.done;
    const op = lastOp(e);
    for (let i = 0; i < 900 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
    expect(field(e.box, op, "done", "outcome")).toBe("undone");
    expect(["no-evidence", "client-reported-failure"]).toContain(field(e.box, op, "undoing", "reason"));
    expect(statusNow(e)).toBe(OLD_BUILD);
    expect(record(e.box, `undo-${op}.txt`)).toContain("production put back to the hand-started container");
    expect(containers(e.box).filter((c) => c.project === PROJECT)).toEqual([]);
    expect(alive(m.pid)).toBe(false);
    void setFaults;
  });
});
