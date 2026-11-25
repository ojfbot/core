import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type Box,
  DASH,
  DECIDER,
  GUARD,
  HAND_NAME,
  PROJECT,
  alive,
  decider,
  deciderAsync,
  destroyBoxAsync,
  docker,
  dockerLog,
  dropImageName,
  field,
  imageId,
  jobsIn,
  journal,
  lockIsFree,
  makeBox,
  newOp,
  opDir,
  perlCount,
  playMac,
  readOut,
  reality,
  record,
  records,
  revOf,
  run,
  setFaults,
  setPerlFaults,
  sha,
  sleep,
  startDecider,
  states,
} from "./fakes/promote-harness.js";
import { HAND, POOL, disruptive, killAll, killedAt, nextPlan, passed, pool, recoverUntilDone, useBoxes, wrong } from "./fakes/decider-kit.js";

// The promote's server-side decider (fleet-promote-decider.sh) against the fake engine, under dash:
// engine calls that land late, recover, the undo's prerequisites, a failing disk, and revert.
// The rest is in fleet-promote-decider.test.ts; the kill sweeps are in
// fleet-promote-decider.sweep_test.ts. EVERYTHING HERE IS SYNTHETIC. No server, no real engine.
vi.setConfig({ testTimeout: 600_000 });
const box = useBoxes();

describe("the decider: an engine call that takes effect after its client is gone", () => {
  it("after an interrupted stop, 'it runs' is not taken for an answer: the stop is asked again and seen, then the start", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // The stop of the previous production: accepted, its client hangs, its effect lands later.
    setFaults(b, { late: { match: "stop -t", ms: 600 } });
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")));
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    killAll(b, op, s.pid);
    await s.done;
    setFaults(b, {});
    const from = dockerLog(b).length;
    const r = await recoverUntilDone(b, op);
    const calls = dockerLog(b).slice(from).map((l) => l.split(" ")[0]);
    expect(calls).toContain("stop");
    expect(calls.indexOf("stop")).toBeLessThan(calls.indexOf("start"));
    expect(r.out).toContain("UNDONE production is back on");
    await sleep(1000);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a stop that lands after the previous production was started again is caught by the settle check: no 'undone' over a stopped production", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev, bounds: { b_settle: 6 } });
    await killedAt(b, op, "started");
    // During recover's undo, a stop that someone's dead client left behind lands 2 s after the
    // previous production was started again.
    const watcher = (async () => {
      while (!states(b, op).includes("undo-previous-started")) await sleep(50);
      await sleep(2000);
      docker(b, ["stop", "-t", "1", HAND_NAME]);
    })();
    const rec = startDecider(b, op, "recover");
    await rec.done;
    await watcher;
    expect(rec.status()).toBe(4);
    expect(readOut(b, op)).toMatch(/HALTED after settling, /);
    expect(states(b, op)).not.toContain("done");
    expect(records(b).filter((f) => f.includes(op))).toEqual([]);
    // Nothing else may run while it is unresolved; recover then finishes it for real.
    expect(decider(b, newOp(b, { rev: revOf(2), skipPrepare: true }), "run").out).toContain("is unfinished");
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    expect(record(b, `undo-${op}.txt`)).toMatch(/checked: \d{4}-\d\d-\d\dT/);
  });

  it("a Compose up ended at its bound: a container its last call creates late is never started, and the next operation's entry check finds it", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // Accepted; the client hangs and is ended at the 10-second bound; the create lands at 14 s.
    setFaults(b, { late: { match: "up -d", ms: 14_000 } });
    const r = await run(b, op);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason")).toBe("start-failed");
    expect(r.out).toContain("UNDONE production is back on");
    for (let i = 0; i < 100 && reality(b).strays === 0; i++) await sleep(100);
    const now = reality(b);
    expect(now.strays).toBe(1);
    expect(now.running.map((c) => c.name)).toEqual([HAND_NAME]);
    const next = newOp(b, { rev: revOf(2) });
    const n = await run(b, next);
    expect(n.out).toContain("a container of the production project already exists");
    expect(field(b, next, "done", "outcome")).toBe("unchanged");
  });
});

describe("the decider: recover", () => {
  it("killing ONLY the decider: recover waits for the lock, which is free only once the bounded step has been ended, then undoes", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setFaults(b, { hang: { match: "cp -a", when: "before" } });
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")));
    const hungPid = Number(readFileSync(join(b.fake, "hung"), "utf8").trim().split(" ")[1]);
    process.kill(s.pid, "SIGKILL");
    await s.done;
    setFaults(b, {});
    // The decider is dead; the step it was bounding is not, and it keeps the lock.
    expect(alive(hungPid)).toBe(true);
    expect(lockIsFree(b)).toBe(false);
    const t0 = Date.now();
    const r = decider(b, op, "recover");
    expect(r.out).toContain("UNDONE production is back on");
    // It could only start once the bound (10 s here) had ended the step.
    expect(Date.now() - t0).toBeGreaterThan(4000);
    expect(alive(hungPid)).toBe(false);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a step that outlives the decider AND its bound keeps the lock: recover refuses, names the holder by command name, and deletes nothing", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev, bounds: { b_copy: 10, b_stop: 40, b_integrity: 10, b_start: 10, b_exec: 10, b_undo_start: 10 } });
    setFaults(b, { hang: { match: "cp -a", when: "before" } });
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")));
    const hungPid = Number(readFileSync(join(b.fake, "hung"), "utf8").trim().split(" ")[1]);
    // The decider and the bound are killed (their own group); the engine client they bounded lives on.
    for (const target of [-s.pid, s.pid]) {
      try {
        process.kill(target, "SIGKILL");
      } catch {}
    }
    await s.done;
    setFaults(b, {});
    expect(alive(hungPid)).toBe(true);
    const before = dockerLog(b).length;
    const r = decider(b, op, "recover");
    expect(r.status).toBe(75);
    expect(r.out).toContain("REFUSED another promote, recover or revert holds the lock: its decider, or a step it started that is still running. Nothing was changed.");
    expect(r.out).toMatch(new RegExp(`holding it: process ${hungPid} \\w+`));
    expect(r.out).toContain("production may be down until that process is ended");
    expect(r.out).not.toMatch(/\b(remove|delete|rm)\b/i);
    expect(r.out).not.toContain(b.root);
    expect(dockerLog(b).length).toBe(before);
    process.kill(hungPid, "SIGKILL");
    await sleep(500);
    expect((await recoverUntilDone(b, op)).out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a recorded step still running with the lock free: recover halts, names the group's processes, and changes nothing", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    await killedAt(b, op, "started");
    // A step of this run that outlived everything and does not hold the lock: its bound was killed.
    const groups = join(opDir(b, op), "groups");
    const lines = readFileSync(groups, "utf8").split("\n").length;
    const started = spawnSync(DASH, ["-c", `perl "$1" bound --note "$2" start-new 60 1 -- sleep 61 > /dev/null 2>&1 & echo $!`, "sh", GUARD, groups], { encoding: "utf8" });
    while (readFileSync(groups, "utf8").split("\n").length === lines) await sleep(50);
    const pgid = Number(readFileSync(groups, "utf8").trim().split("\n").pop()?.split(" ")[0]);
    // The group is recorded before the step is let go: wait until the step itself runs (a bound
    // killed before that never starts its step).
    const comm = () => spawnSync("ps", ["-o", "comm=", "-p", String(pgid)], { encoding: "utf8" }).stdout.trim().replace(/^.*\//, "");
    for (let i = 0; i < 100 && comm() !== "sleep"; i++) await sleep(50);
    expect(comm()).toBe("sleep");
    process.kill(Number(started.stdout.trim()), "SIGKILL");
    await sleep(300);
    const before = dockerLog(b).length;
    const r = decider(b, op, "recover");
    expect(r.status).toBe(4);
    expect(r.out).toContain(`HALTED a step of operation ${op} is still running; production may be down until that process is ended.`);
    expect(r.out).toContain(`still running: group ${pgid} (start-new): ${pgid} sleep`);
    expect(r.out).not.toMatch(/\b(remove|delete)\b/i);
    expect(dockerLog(b).length).toBe(before);
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(rev)]);
    process.kill(-pgid, "SIGKILL");
    await sleep(500);
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("works from the server's own console with nothing from the Mac: the uploaded run folder is all it needs", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    await killedAt(b, op, "started");
    // The documented one line, with only a PATH: cd <control folder> && sh promote-runs/<op>/decider.sh recover <op>
    const r = spawnSync("sh", ["-c", `cd "$1" && ${DASH} "promote-runs/$2/decider.sh" recover "$2"`, "sh", b.ctl, op], {
      env: { PATH: b.env.PATH as string, FAKE_STATE: b.fake, FAKE_BIN: b.bin, FAKE_REPO_ROOT: b.env.FAKE_REPO_ROOT as string },
      encoding: "utf8",
    });
    expect(r.stdout).toContain("UNDONE production is back on the hand-started container");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    const st = decider(b, op, "status");
    expect(st.out).toContain("outcome: undone");
    expect(st.out).toContain("not a statement about what production runs now");
    // Safe to repeat: recover of a finished operation only reads. It calls the engine for nothing,
    // writes no journal line and no record, and says so.
    const calls = dockerLog(b).length;
    const lines = journal(b, op).length;
    const again = decider(b, op, "recover");
    expect(again.out).toContain(`operation ${op} is finished: undone`);
    expect(again.out).toContain("Nothing was changed.");
    expect(dockerLog(b).length).toBe(calls);
    expect(journal(b, op).length).toBe(lines);
    expect(journal(b, op).filter((l) => l.split(" ")[1] === "done")).toHaveLength(1);
  });

  it("an operation whose decider never began is closed, so a late start of it is refused; recover of one run while another is unfinished is refused", async () => {
    const b = box();
    const never = newOp(b, { rev: revOf(1) });
    const r = decider(b, never, "recover");
    expect(r.out).toContain(`the decider of ${never} never began`);
    expect(field(b, never, "done", "outcome")).toBe("unchanged");
    expect(decider(b, never, "run").out).toContain("already has a journal");
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    const open = newOp(b, { rev: revOf(2) });
    await killedAt(b, open, "stopped");
    const other = newOp(b, { rev: revOf(3), skipPrepare: true });
    expect(decider(b, other, "recover").out).toContain(`REFUSED operation ${open} is unfinished: recover that one first`);
    expect(decider(b, open, "recover").out).toContain("UNDONE");
  });

  it("a committed pass is confirmed, never undone: its record is completed; if the revision does not run, it halts and says so", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // The decider dies right after writing "committed" (its 11th journal line), before the record.
    setPerlFaults(b, ["append 11 kill-after"]);
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => !alive(s.pid));
    await s.done;
    setPerlFaults(b, []);
    expect(states(b, op).slice(-1)).toEqual(["committed"]);
    expect(records(b)).toEqual([]);
    // The revision is stopped by something else: recover must not call that a pass, nor undo it.
    const cid = field(b, op, "started", "cid");
    docker(b, ["stop", "-t", "1", cid]);
    const halted = decider(b, op, "recover");
    expect(halted.status).toBe(4);
    expect(halted.out).toContain("was committed at");
    expect(halted.out).toContain("NOT seen running now");
    expect(states(b, op)).not.toContain("done");
    expect(states(b, op)).not.toContain("undoing");
    docker(b, ["start", cid]);
    const ok = decider(b, op, "recover");
    expect(ok.out).toContain(`PASS production runs ${rev}`);
    expect(ok.status).toBe(0);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });
});

describe("the decider: what the undo needs is checked before the first disruptive call, in every mode", () => {
  it("recover with the unconfirmed build running: a missing prerequisite refuses and leaves that build running", async () => {
    const cases = ["previous-container", "previous-policy", "snapshot", "snapshot-marker", "helper-image"] as const;
    await pool([...cases], POOL, async (what) => {
      const b = makeBox();
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        await killedAt(b, op, "server-checked");
        const handFile = join(b.fake, "containers", `${"c".repeat(64)}.json`);
        const hand = readFileSync(handFile, "utf8");
        const snap = join(b.prodRoot, `state.pre-${op}`);
        const marker = join(snap, ".fleet-promote-snapshot");
        const images = readFileSync(join(b.fake, "images.json"), "utf8");
        let put = () => {};
        let say = /./;
        if (what === "previous-container") {
          unlinkSync(handFile);
          put = () => writeFileSync(handFile, hand);
          say = /the previous production's container is gone/;
        } else if (what === "previous-policy") {
          writeFileSync(handFile, JSON.stringify({ ...JSON.parse(hand), policy: "always" }));
          put = () => writeFileSync(handFile, hand);
          say = /restart policy is no longer one that stays stopped/;
        } else if (what === "snapshot") {
          spawnSync("mv", [snap, `${snap}.moved`]);
          put = () => spawnSync("mv", [`${snap}.moved`, snap]);
          say = /the state folders are not in a layout this operation left/;
        } else if (what === "snapshot-marker") {
          writeFileSync(marker, "op=some-other-run\n");
          put = () => writeFileSync(marker, `op=${op}\n`);
          say = /the state folders are not in a layout this operation left/;
        } else {
          dropImageName(b, imageId(rev));
          dropImageName(b, `fleet-runner:${rev}`);
          put = () => writeFileSync(join(b.fake, "images.json"), images);
          say = /the image the helper containers run from is gone/;
        }
        const before = dockerLog(b).length;
        const r = await deciderAsync(b, op, "recover");
        expect(r.status, what).toBe(4);
        expect(r.out, what).toMatch(say);
        expect(r.out, what).toContain("whatever runs now was left running");
        expect(disruptive(b, before), what).toEqual([]);
        expect(reality(b).running.map((c) => c.image), what).toEqual([imageId(rev)]);
        expect(states(b, op), what).not.toContain("done");
        put();
        expect((await deciderAsync(b, op, "recover")).out, what).toContain("UNDONE production is back on");
        expect(wrong(b, op, HAND, imageId(rev)), what).toEqual([]);
      } finally {
        await destroyBoxAsync(b);
      }
    });
  });

  it("a later promote: the previous image gone, its name pointing elsewhere, or the previous run's config changed refuses the RUN before the stop", async () => {
    const cases = ["image-gone", "name-drift", "previous-config"] as const;
    await pool([...cases], POOL, async (what) => {
      const b = makeBox();
      try {
        const first = await passed(b);
        const op = newOp(b, nextPlan(b, first, revOf(2)));
        if (what === "image-gone") {
          dropImageName(b, imageId(revOf(1)));
          dropImageName(b, `fleet-runner:${revOf(1)}`);
        } else if (what === "name-drift") {
          const file = join(b.fake, "images.json");
          const all = JSON.parse(readFileSync(file, "utf8"));
          all[`fleet-runner:${revOf(1)}`] = all[`fleet-runner:${revOf(2)}`];
          writeFileSync(file, JSON.stringify(all));
        } else {
          const f = join(opDir(b, first), "resolved.json");
          writeFileSync(f, `${readFileSync(f, "utf8")}\n`);
        }
        const before = dockerLog(b).length;
        const r = await run(b, op);
        expect(field(b, op, "done", "outcome"), what).toBe("unchanged");
        expect(r.out, what).toMatch(/REFUSED .*(previous revision's image|previous run's saved config)/);
        expect(disruptive(b, before), what).toEqual([]);
        expect(reality(b).running.map((c) => c.image), what).toEqual([imageId(revOf(1))]);
      } finally {
        await destroyBoxAsync(b);
      }
    });
  });
});

describe("the decider: the journal and the records when the disk fails", () => {
  it("a journal that cannot be written during the undo does not stop the undo: production comes back, the run says 'record incomplete'", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const s = startDecider(b, op, "run");
    await playMac(b, op, { vanish: (st) => st.includes("server-checked") }, () => false);
    // From here on nothing can be appended (a full disk): every later append fails.
    setPerlFaults(b, Array.from({ length: 40 }, (_, i) => `append ${i + 1} fail`));
    await playMac(b, op, { evidence: "wrong-build" }, () => !alive(s.pid));
    await s.done;
    expect(s.status()).toBe(3);
    const out = readOut(b, op);
    expect(out).toContain("the journal cannot be written; the undo carries on");
    expect(out).toContain("UNDONE, RECORD INCOMPLETE production is back on the hand-started container");
    expect(out).not.toMatch(/^UNDONE production/m);
    expect(states(b, op)).not.toContain("done");
    // Production IS back, though the journal does not say so yet.
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    expect(reality(b).jobs).toBe(3);
    setPerlFaults(b, []);
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("an uncertain commit: 'committed' is in the journal but the write reported failure: never undone, never called a pass", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setPerlFaults(b, ["append 11 wrote-failed"]);
    const r = await run(b, op);
    setPerlFaults(b, []);
    expect(r.status).toBe(3);
    expect(r.out).toContain("COMMITTED, RECORD INCOMPLETE");
    expect(r.out).not.toContain("PASS production runs");
    expect(states(b, op).slice(-1)).toEqual(["committed"]);
    expect(states(b, op)).not.toContain("undoing");
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(rev)]);
    expect(decider(b, op, "recover").out).toContain(`PASS production runs ${rev}`);
    // And when the line did NOT make it: that is no commit, and it is undone.
    const b2 = box();
    const op2 = newOp(b2, { rev });
    setPerlFaults(b2, ["append 11 torn"]);
    const r2 = await run(b2, op2);
    setPerlFaults(b2, []);
    expect(field(b2, op2, "undoing", "reason")).toBe("journal-failed");
    expect(r2.out).toContain("UNDONE production is back on");
    expect(wrong(b2, op2, HAND, imageId(rev))).toEqual([]);
  });

  it("the disk filled by this run's own snapshot copy: the undo removes the unverified copy first, never a verified snapshot or another run's", async () => {
    const b = box();
    // A verified snapshot of an earlier run: not this run's to touch.
    const earlier = await passed(b);
    const rev = revOf(2);
    const op = newOp(b, nextPlan(b, earlier, rev));
    setFaults(b, { hang: { match: "cp -a", when: "after" } });
    const r = await run(b, op);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason")).toBe("snapshot-copy-failed");
    expect(r.out).toContain("UNDONE");
    const folders = readdirSync(b.prodRoot).filter((f) => f.startsWith("state"));
    expect(folders).toContain(`state.pre-${earlier}`);
    expect(folders).not.toContain(`state.pre-${op}.part`);
    // The removal names this run's own unverified copy, and came before the undo's first journal line.
    const log = dockerLog(b);
    const drop = log.findIndex((l) => l.includes(`fleet-promote-${op}-drop-partial`));
    expect(drop).toBeGreaterThan(-1);
    expect(log[drop]).toContain('rm -rf "/srv/state.pre-$1.part"');
    expect(log[drop]?.trim().endsWith(`sh ${op}`)).toBe(true);
  });

  it("flushes to disk in the order that makes the journal true: the run folder before the journal, the copy before 'snapshot', each rename before its line", async () => {
    const b = box();
    const op = newOp(b, { rev: revOf(1) });
    setPerlFaults(b, ["append 0 none"]);
    await run(b, op);
    expect(perlCount(b, "sync-path")).toBe(1);
    // The snapshot copy is flushed inside the same helper, before the integrity check runs.
    const copy = dockerLog(b).find((l) => l.includes("-copy "));
    expect(copy).toMatch(/cp -a \/srv\/state .* && sync/);
    expect(readFileSync(join(b.fake, "sync.log"), "utf8")).toContain("sync");
    // The rename helpers are real renames that flush the folder they renamed in.
    const src = readFileSync(DECIDER, "utf8");
    expect(src).toMatch(/RENAME_JS='[^']*renameSync[^']*fsyncSync\(d\)/);
    expect(src).toMatch(/NAME_JS='[^']*fsyncSync\(f\)[^']*renameSync[^']*fsyncSync\(d\)/);
  });
});

describe("the decider: revert, an operation of its own", () => {
  const revertPlan = (b: Box, target: string, approval?: string) => newOp(b, { mode: "revert", target, approval });

  it("after a first cutover: needs its own yes, says how many jobs it sets aside, brings the hand-started container back", async () => {
    const b = box();
    setFaults(b, { addJobs: { [imageId(revOf(1))]: 2 } });
    const first = await passed(b);
    setFaults(b, {});
    expect(reality(b).jobs).toBe(5);
    const z = revertPlan(b, first);
    const check = decider(b, z, "check");
    expect(check.out).toContain(`jobs: production holds 5 now, the snapshot of run ${first} holds 3: this revert sets aside 2 job(s) accepted since that promote`);
    expect(check.out).toContain("PASS every check");
    const r = await run(b, z);
    expect(r.out).toContain("REVERTED production is back on the hand-started container");
    expect(r.status).toBe(0);
    expect(states(b, z)).toEqual(["begun", "go", "verified", "spent", "undoing", "undo-quiet", "undo-new-removed", "undo-state-aside", "undo-state-back", "undo-previous-stopped", "undo-previous-started", "undo-healthy", "done"]);
    expect(field(b, z, "done", "outcome")).toBe("reverted");
    expect(field(b, z, "begun", "target")).toBe(first);
    const now = reality(b);
    expect(now.running.map((c) => c.name)).toEqual([HAND_NAME]);
    expect(now.projectContainers).toBe(0);
    expect(now.jobs).toBe(3);
    expect(now.stateFolders).toEqual(["state", `state.failed-${z}`]);
    expect(jobsIn(join(b.prodRoot, `state.failed-${z}`, "fleet.sqlite"))).toBe(5);
    expect(record(b, `revert-${z}.txt`)).toContain(`revert ${z} of run ${first}`);
    expect(record(b, `revert-${z}.txt`)).toContain("jobs: the set-aside state holds 5; the snapshot held 3");
    // The promote's own journal and record are untouched history.
    expect(field(b, first, "done", "outcome")).toBe("pass");
    expect(states(b, first)).not.toContain("undoing");
    expect(record(b, `promote-${first}.txt`)).toContain("committed:");
    // Production is the hand-started container again, by the journals: a new first cutover works.
    const again = newOp(b, { rev: revOf(2) });
    expect((await run(b, again)).out).toContain("PASS production runs");
  });

  it("after a later promote: back to the previous revision, from the config that run replaced", async () => {
    const b = box();
    const one = await passed(b);
    const two = newOp(b, nextPlan(b, one, revOf(2)));
    expect((await run(b, two)).status).toBe(0);
    const z = revertPlan(b, two);
    const r = await run(b, z);
    expect(r.out).toContain(`REVERTED production is back on revision ${revOf(1).slice(0, 12)} (run ${one})`);
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(revOf(1))]);
    expect(sha(readFileSync(join(b.fake, "started", `${PROJECT}.json`)))).toBe(field(b, one, "verified", "cfg"));
    // By the journals production is run one again: the next promote names it as its previous.
    const three = newOp(b, nextPlan(b, one, revOf(3)));
    expect((await run(b, three)).out).toContain("PASS production runs");
  });

  it("refuses: a run that is not the current one, the promote's own yes used again, a missing snapshot, another unfinished operation", async () => {
    const b = box();
    const one = await passed(b, revOf(1));
    const two = newOp(b, nextPlan(b, one, revOf(2)));
    expect((await run(b, two)).status).toBe(0);
    const before = dockerLog(b).length;
    const old = revertPlan(b, one);
    expect((await run(b, old)).out).toMatch(new RegExp(`run ${one} is not what production runs now`));
    const reused = revertPlan(b, two, /^approval=(.*)$/m.exec(readFileSync(join(opDir(b, two), "plan"), "utf8"))?.[1]);
    expect((await run(b, reused)).out).toContain("this approval was already used");
    const snap = join(b.prodRoot, `state.pre-${two}`);
    spawnSync("mv", [snap, `${snap}.moved`]);
    const noSnap = revertPlan(b, two);
    expect((await run(b, noSnap)).out).toContain(`the snapshot run ${two} took (with its marker) is not there`);
    spawnSync("mv", [`${snap}.moved`, snap]);
    for (const op of [old, reused, noSnap]) {
      expect(field(b, op, "done", "outcome")).toBe("unchanged");
      expect(states(b, op)).not.toContain("spent");
    }
    expect(disruptive(b, before)).toEqual([]);
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(revOf(2))]);
    // An unfinished promote: no revert of anything until it is recovered.
    const three = newOp(b, nextPlan(b, two, revOf(3)));
    await killedAt(b, three, "stopped");
    const blocked = revertPlan(b, two);
    expect(decider(b, blocked, "run").out).toContain(`REFUSED operation ${three} is unfinished`);
    expect(journal(b, blocked)).toEqual([]);
  });
});
