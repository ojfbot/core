import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type Box,
  DASH,
  DECIDER,
  HAND_NAME,
  PROJECT,
  TLS,
  alive,
  containers,
  decider,
  dockerLog,
  field,
  imageId,
  jobsIn,
  journal,
  lockIsFree,
  newOp,
  opDir,
  planSha,
  playMac,
  putFile,
  readOut,
  reality,
  record,
  records,
  revOf,
  run,
  setFaults,
  staged,
  sha,
  sleep,
  startDecider,
  states,
} from "./fakes/promote-harness.js";
import { HAND, OLD_IMAGE, POOL, disruptive, killedAt, nextPlan, passed, pool, useBoxes, wrong } from "./fakes/decider-kit.js";

// The promote's server-side decider (fleet-promote-decider.sh) against the fake engine, under dash:
// a promote that passes, the bounds, the refusals, and the undo, wherever a test sits through a
// real wait (so not in `pnpm test`: see vitest.promote-sweeps.config.ts). The tests that take
// seconds are in fleet-promote-decider.test.ts; recover, the disk and revert are in
// fleet-promote-recover.slow_test.ts; the kill sweeps are in fleet-promote-decider.sweep_test.ts.
// EVERYTHING HERE IS SYNTHETIC: folders, revisions, image IDs, keys and jobs mean nothing outside
// this file. No server and no real engine are involved.
vi.setConfig({ testTimeout: 600_000 });
const box = useBoxes();

describe("the decider: a promote that passes", () => {

  it("a later promote replaces the Compose production, carrying its own checked copy of the previous config", async () => {
    const b = box();
    const first = await passed(b);
    const rev = revOf(2);
    const op = newOp(b, nextPlan(b, first, rev));
    const r = await run(b, op);
    expect(r.out).toContain(`PASS production runs ${rev}`);
    expect(sha(readFileSync(join(opDir(b, op), "previous.json")))).toBe(field(b, first, "verified", "cfg"));
    expect(field(b, op, "verified", "prev")).toBe(first);
    expect(field(b, op, "verified", "prev_cfg")).toBe(field(b, first, "verified", "cfg"));
    expect(field(b, op, "verified", "prev_image")).toBe(imageId(revOf(1)));
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(rev)]);
    expect(reality(b).projectContainers).toBe(1);
  });

  it("prints and records nothing private: no path, no address, in the journal, the records or its output (pass and undo)", async () => {
    const b = box();
    const a = newOp(b, { rev: revOf(1) });
    await run(b, a, { evidence: "wrong-build" });
    const c = newOp(b, { rev: revOf(2) });
    await run(b, c);
    const text = [...journal(b, a), ...journal(b, c), readOut(b, a), readOut(b, c), ...records(b).map((f) => record(b, f))].join("\n");
    expect(field(b, a, "done", "outcome")).toBe("undone");
    expect(field(b, c, "done", "outcome")).toBe("pass");
    for (const secret of [b.root, tmpdir(), "127.0.0.1", "/server/", "service-root", String(b.port)]) expect(text).not.toContain(secret);
    // Engine output is in the run's own log, and holds no environment value.
    const eng = readFileSync(join(opDir(b, c), "engine.log"), "utf8") + readFileSync(join(opDir(b, a), "engine.log"), "utf8");
    expect(eng).not.toContain("FLEET_WORKERS");
    expect(eng).not.toContain("worker-a");
  });
});

describe("the decider: bounds", () => {

  it("a whole promote and a whole undo run with every bound left at its default", async () => {
    const b = box();
    const a = newOp(b, { rev: revOf(1), defaults: true });
    expect(readFileSync(join(opDir(b, a), "plan"), "utf8")).not.toContain("b_");
    const u = await run(b, a, { evidence: "interrupted" });
    expect(u.out).toContain("UNDONE production is back on");
    expect(field(b, a, "verified", "offline_max")).toBe("1140");
    expect(field(b, a, "server-checked", "window")).toBe("120");
    const c = newOp(b, { rev: revOf(2), defaults: true });
    const p = await run(b, c);
    expect(p.out).toContain("PASS production runs");
  });


  it("the table is what the code can spend: every engine call of a pass, of a full undo and of the checks is in its sum, none is missing", async () => {
    const steps = (bx: Box, o: string) =>
      readFileSync(join(opDir(bx, o), "steps.log"), "utf8").split("\n").filter(Boolean).map((l) => l.split(" ") as [string, string]);
    // A health wait is ONE budget however many looks it takes: counted once, by its bound.
    const budgets: Record<string, number> = { "new-health": 20, "undo-health": 20 };
    const sumOf = (rows: [string, string][]) => {
      let sum = 0;
      const seen = new Set<string>();
      for (const [label, secs] of rows) {
        if (label in budgets) {
          if (!seen.has(label)) sum += budgets[label] as number;
          seen.add(label);
        } else sum += Number(secs);
      }
      return sum;
    };
    const figure = (bx: Box, o: string, name: string) =>
      Number(new RegExp(`${name}=(\\d+)`).exec(spawnSync(DASH, [DECIDER, "bounds", join(opDir(bx, o), "plan")], { encoding: "utf8" }).stdout)?.[1]);
    const fromStop = (rows: [string, string][]) => rows.slice(rows.findIndex(([label]) => label === "stop-previous"));
    const beforeStop = (rows: [string, string][]) => rows.slice(0, rows.findIndex(([label]) => label === "stop-previous"));

    // A full switch and a full undo: every call, the evidence window, the settle interval and the
    // record writes, plus the endings of the five steps that may run into their bound without
    // ending the undo (4 x 10, and 40 for the helper that counts the jobs). No more, no less.
    const b = box();
    const undone = newOp(b, { rev: revOf(1) });
    await run(b, undone, { evidence: "wrong-build" });
    expect(field(b, undone, "done", "outcome")).toBe("undone");
    expect(sumOf(fromStop(steps(b, undone))) + 60 + 1 + 10).toBe(figure(b, undone, "worst_case") - 80);

    // A pass: every call from the stop to the look after the commit, the evidence window and the
    // record writes, plus the ending of a stop that ran into its bound and was still seen stopped.
    const passed1 = newOp(b, { rev: revOf(2) });
    await run(b, passed1);
    expect(field(b, passed1, "done", "outcome")).toBe("pass");
    expect(sumOf(fromStop(steps(b, passed1))) + 60 + 10).toBe(figure(b, passed1, "pass_path") - 10);

    // The checks before the stop, for a first cutover, a later promote and a revert: within their row.
    const checksRow = figure(b, passed1, "before") - 10 - 30;
    expect(checksRow).toBe(18 * 10 + 3 * 30);
    const later = newOp(b, nextPlan(b, passed1, revOf(3)));
    await run(b, later);
    expect(field(b, later, "done", "outcome")).toBe("pass");
    const revert = newOp(b, { mode: "revert", target: later });
    await run(b, revert);
    expect(field(b, revert, "done", "outcome")).toBe("reverted");
    for (const o of [passed1, later]) expect(sumOf(beforeStop(steps(b, o))), o).toBeLessThanOrEqual(checksRow);
    const revertChecks = steps(b, revert);
    expect(sumOf(revertChecks.slice(0, revertChecks.findIndex(([label]) => label === "undo-quiet"))), "revert").toBeLessThanOrEqual(checksRow);
  });
});

describe("the decider: refusals before production is touched", () => {
  const refused = async (b: Box, op: string, why: string | RegExp, play = {}) => {
    const before = dockerLog(b).length;
    const r = await run(b, op, play);
    expect(r.out).toMatch(why);
    expect(r.out).toContain("nothing was changed in production");
    expect(r.status).toBe(1);
    expect(field(b, op, "done", "outcome")).toBe("unchanged");
    expect(states(b, op)).not.toContain("spent");
    expect(disruptive(b, before)).toEqual([]);
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    expect(lockIsFree(b)).toBe(true);
  };

  it("a hand-started container whose restart policy would bring it back at a reboot (the owner's step, never changed here)", async () => {
    // "always" comes back; "on-failure" is not known to stay stopped after a stop by hand. Neither passes.
    for (const policy of ["always", "on-failure"]) {
      const b = box({ policy });
      await refused(b, newOp(b, { rev: revOf(1) }), new RegExp(`restart policy \\(${policy}\\) would bring it back at a reboot.*the owner's step`));
      expect(containers(b).find((c) => c.name === HAND_NAME)?.policy).toBe(policy);
    }
    for (const policy of ["no", "unless-stopped"]) {
      const b = box({ policy });
      expect((await run(b, newOp(b, { rev: revOf(1) }))).out, policy).toContain("PASS production runs");
    }
  });

  it("the staged revision is read by the decider itself when it spends the yes: staged over since the Mac looked, it is not promoted", async () => {
    const b = box();
    const rev = revOf(1);
    // The Mac's own look passed; then the test copy staged something else (or cleared what is staged).
    for (const [last, now, what] of [[revOf(9), revOf(9), "another revision"], [rev, "", "cleared"]] as const) {
      const op = newOp(b, { rev });
      staged(b, last, now);
      const before = dockerLog(b).length;
      const r = await run(b, op);
      expect(r.out, what).toContain("REFUSED this revision is no longer the one the test copy passed and has staged");
      expect(field(b, op, "done", "outcome"), what).toBe("unchanged");
      // Read at the moment of spending: after every other check, and the yes is NOT spent.
      expect(states(b, op), what).toEqual(["begun", "go", "verified", "done"]);
      expect(disruptive(b, before), what).toEqual([]);
      expect(decider(b, op, "check").out, what).toContain("REFUSED this revision is no longer the one the test copy passed and has staged");
    }
    // An unreadable record is not taken for "still staged".
    const op = newOp(b, { rev });
    unlinkSync(join(b.stage, "stage-state"));
    expect((await run(b, op)).out).toContain("REFUSED the test copy's record of what is staged cannot be read");
    expect(states(b, op)).not.toContain("spent");
    staged(b, rev);
    expect((await run(b, newOp(b, { rev }))).out).toContain("PASS production runs");
  });

  it("a rehearsal is marked in both places: a throwaway control folder cannot be paired with a service root that may be production's", async () => {
    // The control folder carries the marker, the service root does not.
    const b = box({ rehearsal: true });
    unlinkSync(join(b.prodRoot, ".fleet-runner-promote-rehearsal"));
    await refused(b, newOp(b, { rev: revOf(1), rehearsal: true }), /this service root does not carry the rehearsal marker, so it may be production's own/);
    // And a real promote does not run on a root that carries it.
    const b2 = box();
    writeFileSync(join(b2.prodRoot, ".fleet-runner-promote-rehearsal"), "");
    await refused(b2, newOp(b2, { rev: revOf(1) }), /this service root is a rehearsal's; a real promote does not run on it/);
    const b3 = box({ rehearsal: true });
    expect((await run(b3, newOp(b3, { rev: revOf(1), rehearsal: true }))).out).toContain("PASS production runs");
  });


  it("an approval that was already used, an image that is not the receipt's, a config changed after it was checked", async () => {
    const b = box();
    const first = newOp(b, { rev: revOf(1), approval: "Yes, promote it (synthetic one)" });
    await run(b, first, { evidence: "wrong-build" });
    expect(field(b, first, "done", "outcome")).toBe("undone");
    // The same words with other spacing and case are the same yes (the Mac hashes them normalised).
    await refused(b, newOp(b, { rev: revOf(1), approval: "yes,  PROMOTE it (synthetic one)" }), /this approval was already used/);
    const img = newOp(b, { rev: revOf(2), override: { new_image: imageId("another") } });
    await refused(b, img, /not the one this Mac's receipt names/);
    const cfg = newOp(b, { rev: revOf(3) });
    writeFileSync(join(opDir(b, cfg), "resolved.json"), `${readFileSync(join(opDir(b, cfg), "resolved.json"), "utf8")} `);
    await refused(b, cfg, /is not the one that was checked/);
  });

  it("a production that is not in the form the plan says, enrolled keys that are not the plan's, a stray project container", async () => {
    const b = box();
    await refused(b, newOp(b, { rev: revOf(1), kind: "compose", prevOp: "some-run", prevCfg: "0".repeat(64), skipPrepare: true }), /the plan says production is a compose production, the journals say container/);
    await refused(b, newOp(b, { rev: revOf(1), override: { key_ids: "observer,owner" } }), /enrolled keys are not exactly the ones the plan names/);
    // A container of the project that an interrupted engine call created late and nobody started.
    const stray = newOp(b, { rev: revOf(2) });
    setFaults(b, { createOnly: { match: "up -d" } });
    spawnSync("docker", ["compose", "-p", PROJECT, "--env-file", "/dev/null", "-f", "-", "up", "-d", "--pull", "never"], {
      env: b.env,
      input: readFileSync(join(opDir(b, stray), "resolved.json")),
    });
    setFaults(b, {});
    expect(reality(b).strays).toBe(1);
    await refused(b, stray, /a container of the production project already exists/);
  });

  it("no go from the Mac: a start that arrives with nobody watching changes nothing", async () => {
    const b = box();
    const op = newOp(b, { rev: revOf(1), bounds: { b_go: 10 } });
    await refused(b, op, /the Mac's go did not arrive within 10 seconds/, { go: false });
    expect(field(b, op, "done", "reason")).toBe("no-go");
    // A go that does not answer THIS run's challenge is no go either.
    const other = newOp(b, { rev: revOf(1), bounds: { b_go: 10 } });
    const s = startDecider(b, other, "run");
    while (!states(b, other).includes("begun")) await sleep(40);
    putFile(b, other, "go", { nonce: "0".repeat(32) });
    await s.done;
    expect(field(b, other, "done", "reason")).toBe("no-go");
  });

  it("another operation is unfinished; this run already has a journal; a rehearsal outside a throwaway", async () => {
    const b = box();
    const stuckOp = newOp(b, { rev: revOf(1) });
    await killedAt(b, stuckOp, "stopped");
    const next = newOp(b, { rev: revOf(2), skipPrepare: true });
    const r = decider(b, next, "run");
    expect(r.out).toContain(`REFUSED operation ${stuckOp} is unfinished: run recover for it first`);
    expect(journal(b, next)).toEqual([]);
    // The read-only check the Mac makes before the start says the same, without the lock.
    const calls = dockerLog(b).length;
    const check = decider(b, next, "check");
    expect(check.status).toBe(1);
    expect(check.out).toContain(`REFUSED operation ${stuckOp} is unfinished: run recover for it first`);
    expect(disruptive(b, calls)).toEqual([]);
    expect(decider(b, stuckOp, "run").out).toContain("already has a journal");
    expect(decider(b, stuckOp, "recover").out).toContain("UNDONE production is back on");
    const reh = newOp(b, { rev: revOf(3), rehearsal: true });
    const rr = await run(b, reh);
    expect(rr.out).toContain("a rehearsal needs a throwaway production");
    expect(field(b, reh, "done", "outcome")).toBe("unchanged");
  });

  it("a plan for another operation, a service root inside the control folder, a control folder that was replaced by a copy", async () => {
    const b = box();
    const other = newOp(b, { rev: revOf(1), override: { op: "another-operation" } });
    expect(decider(b, other, "run").out).toContain("REFUSED the plan is for another operation");
    const inside = newOp(b, { rev: revOf(1), override: { root: join(b.ctl, "promote-runs") }, skipPrepare: true });
    expect(decider(b, inside, "run").out).toContain("REFUSED the service root is inside the control folder");
    // An earlier operation ran in a folder with another identity: this one is a copy of it.
    const first = newOp(b, { rev: revOf(1) });
    await run(b, first, { evidence: "wrong-build" });
    const j = join(opDir(b, first), "journal");
    writeFileSync(j, readFileSync(j, "utf8").replace(/ ctl=\S+/, " ctl=1:2"));
    const next = newOp(b, { rev: revOf(2) });
    const r = await run(b, next);
    expect(r.out).toContain("the control folder is not the folder earlier operations ran in");
    expect(field(b, next, "done", "outcome")).toBe("unchanged");
    // The decider only runs from promote-runs/<op> of a marked control folder: a plan cannot name another.
    expect(spawnSync(DASH, [DECIDER, "run", "some-op"], { encoding: "utf8" }).stdout).toContain("REFUSED this decider is not in promote-runs/some-op");
    expect(readFileSync(join(opDir(b, next), "plan"), "utf8")).not.toMatch(/^(ctl|control|deploy)/m);
  });

  it("check says the same refusals without the lock and without changing anything", () => {
    const b = box({ policy: "always" });
    const op = newOp(b, { rev: revOf(1) });
    const before = dockerLog(b).length;
    const r = decider(b, op, "check");
    expect(r.out).toMatch(/REFUSED the hand-started container's restart policy \(always\)/);
    expect(r.status).toBe(1);
    expect(disruptive(b, before)).toEqual([]);
    expect(journal(b, op)).toEqual([]);
    const ok = box();
    const good = newOp(ok, { rev: revOf(1) });
    const c = decider(ok, good, "check");
    expect(c.out).toContain("PASS every check the decider makes before it touches production");
    expect(c.out).toMatch(/disk: the state folder is \d+ MB, \d+ MB are free; the snapshot needs \d+ MB free/);
    expect(journal(ok, good)).toEqual([]);
  });
});

describe("the decider: it undoes, by itself, whatever fails once the yes is spent", () => {
  const undone = async (faults: Record<string, unknown>, play: Parameters<typeof run>[2], reason: string, starting: boolean) => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setFaults(b, faults);
    const r = await run(b, op, play);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason"), reason).toBe(reason);
    expect(r.out, reason).toContain("UNDONE production is back on the hand-started container");
    expect(r.out, reason).not.toContain("PASS");
    expect(r.status, reason).toBe(1);
    expect(states(b, op).includes("starting"), reason).toBe(starting);
    expect(wrong(b, op, HAND, imageId(rev)), reason).toEqual([]);
    return { b, op, r };
  };

  it("evidence that says the wrong build, a changed certificate, an interrupted Mac, another run, another plan", async () => {
    const cases = [
      ["wrong-build", "wrong-build"],
      ["tls-changed", "certificate-changed"],
      ["interrupted", "client-reported-failure"],
      ["other-run", "evidence-for-another-run"],
      ["other-plan", "evidence-for-another-run"],
    ] as const;
    await pool([...cases], POOL, async ([evidence, reason]) => {
      const { b, op } = await undone({}, { evidence }, reason, true);
      expect(record(b, `undo-${op}.txt`)).toContain(`reason: ${reason}`);
      expect(record(b, `undo-${op}.txt`)).toContain("jobs: the set-aside state holds 3; the snapshot held 3");
    });
  });

  it("no evidence at all: a Mac that goes silent ends in the undo when the window closes", async () => {
    const { b, op } = await undone({}, { evidence: "none" }, "no-evidence", true);
    const at = (state: string) => Date.parse(journal(b, op).find((l) => l.includes(` ${state}`))?.split(" ")[0] ?? "");
    expect(at("undoing") - at("server-checked")).toBeGreaterThanOrEqual(59_000);
    expect(at("undoing") - at("server-checked")).toBeLessThan(80_000);
  });

  it("evidence that does not answer this run's challenge is ignored, not treated as bad: the wait goes on", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // Evidence that was there before the run even began is not evidence.
    putFile(b, op, "evidence", { op, revision: rev, plan: planSha(b, op), nonce: "1".repeat(32), build: rev, tls: TLS, client: "ok" });
    const s = startDecider(b, op, "run");
    await playMac(b, op, { evidence: "no-nonce" }, () => states(b, op).includes("server-checked") && existsSync(join(opDir(b, op), "evidence")));
    await sleep(2500);
    expect(states(b, op)).not.toContain("undoing");
    expect(states(b, op)).not.toContain("committed");
    putFile(b, op, "evidence", { op, revision: rev, plan: planSha(b, op), nonce: field(b, op, "server-checked", "nonce"), build: rev, tls: TLS, client: "ok" });
    await s.done;
    expect(field(b, op, "done", "outcome")).toBe("pass");
  });

  it("a snapshot that fails its integrity check: the live state is left alone and the unverified copy is removed", async () => {
    const { b, op } = await undone({ corruptSnapshot: true }, {}, "snapshot-integrity-failed", false);
    expect(reality(b).stateFolders).toEqual(["state"]);
    expect(field(b, op, "undo-state-back", "skipped")).toBe("1");
    expect(field(b, op, "undo-state-aside", "skipped")).toBe("1");
  });

  it("a new revision that does not start, is not healthy, lost a job, or whose keys cannot be read", async () => {
    await pool(
      [
        [{ fail: { match: "up -d" } }, "start-failed"],
        [{ health: { [imageId(revOf(1))]: "unhealthy" } }, "new-not-healthy"],
        [{ dropJobs: { [imageId(revOf(1))]: 1 } }, "jobs-fewer"],
        [{ fail: { match: "exec " } }, "keys-unreadable"],
      ] as [Record<string, unknown>, string][],
      POOL,
      async ([faults, reason]) => {
        const { b, op } = await undone(faults, {}, reason, true);
        if (reason === "jobs-fewer") {
          // What the unconfirmed build did to the jobs is kept, and said.
          expect(jobsIn(join(b.prodRoot, `state.failed-${op}`, "fleet.sqlite"))).toBe(2);
          expect(record(b, `undo-${op}.txt`)).toContain("jobs: the set-aside state holds 2; the snapshot held 3");
        }
      },
    );
  });

  it("jobs the unconfirmed build accepted are counted in the undo record", async () => {
    const { b, op } = await undone({ addJobs: { [imageId(revOf(1))]: 2 } }, { evidence: "wrong-build" }, "wrong-build", true);
    expect(record(b, `undo-${op}.txt`)).toContain("jobs: the set-aside state holds 5; the snapshot held 3");
    expect(reality(b).jobs).toBe(3);
  });

  it("a config changed AFTER it was checked is never started: the check and the start use one buffer", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const file = join(opDir(b, op), "resolved.json");
    const checked = readFileSync(file, "utf8");
    const s = startDecider(b, op, "run");
    // After the decider verified the file, before it starts it: a privileged copy takes its place.
    await playMac(b, op, { vanish: (st) => st.includes("spent") }, () => false);
    writeFileSync(file, checked.replace('"read_only": true', '"read_only": false, "privileged": true'));
    await playMac(b, op, {}, () => !alive(s.pid));
    await s.done;
    expect(field(b, op, "undoing", "reason")).toBe("config-changed-after-check");
    expect(existsSync(join(b.fake, "started", `${PROJECT}.json`))).toBe(false);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a step that runs into its bound is ended, with its helper container, before the undo starts", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setFaults(b, { hang: { match: "cp -a", when: "after" } });
    const t0 = Date.now();
    const r = await run(b, op);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason")).toBe("snapshot-copy-failed");
    expect(r.out).toContain("UNDONE production is back on");
    expect(Date.now() - t0).toBeLessThan(45_000);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    // The helper container was removed by name and seen gone, and the unverified copy with it.
    expect(dockerLog(b).some((l) => l.startsWith(`rm -f fleet-promote-${op}-copy`))).toBe(true);
    expect(readdirSync(b.prodRoot).filter((f) => f.endsWith(".part"))).toEqual([]);
  });

  it("a later promote that fails goes back to the previous revision from this run's own checked copy of its config", async () => {
    const b = box();
    const first = await passed(b);
    const prevImage = imageId(revOf(1));
    const rev = revOf(2);
    const op = newOp(b, nextPlan(b, first, rev));
    const r = await run(b, op, { evidence: "wrong-build" });
    expect(r.out).toContain(`UNDONE production is back on revision ${revOf(1).slice(0, 12)} (run ${first})`);
    expect(wrong(b, op, { image: prevImage }, imageId(rev))).toEqual([]);
    expect(sha(readFileSync(join(b.fake, "started", `${PROJECT}.json`)))).toBe(field(b, first, "verified", "cfg"));
    // Before the new revision started, the previous CONTAINER itself is restarted, not recreated.
    const again = newOp(b, nextPlan(b, first, revOf(3)));
    const before = containers(b).find((c) => c.project === PROJECT)?.id;
    setFaults(b, { corruptSnapshot: true });
    await run(b, again);
    setFaults(b, {});
    expect(field(b, again, "undoing", "reason")).toBe("snapshot-integrity-failed");
    expect(containers(b).find((c) => c.project === PROJECT)?.id).toBe(before);
    expect(wrong(b, again, { image: prevImage }, imageId(revOf(3)))).toEqual([]);
  });

  it("what comes back must be what ran before: a previous container whose image changed during the switch is not started", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const s = startDecider(b, op, "run");
    await playMac(b, op, { vanish: (st) => st.includes("started") }, () => false);
    // Between the stop and the undo, the stopped container is no longer the one that was checked.
    const handFile = join(b.fake, "containers", `${"c".repeat(64)}.json`);
    const hand = JSON.parse(readFileSync(handFile, "utf8"));
    writeFileSync(handFile, JSON.stringify({ ...hand, image: imageId(rev) }));
    await playMac(b, op, { evidence: "wrong-build" }, () => !alive(s.pid));
    await s.done;
    expect(s.status()).toBe(4);
    expect(readOut(b, op)).toContain("HALTED the previous production's container no longer has the image it had; it was not started");
    expect(dockerLog(b).filter((l) => l.startsWith("start "))).toEqual([]);
    expect(states(b, op)).not.toContain("done");
    writeFileSync(handFile, JSON.stringify({ ...JSON.parse(readFileSync(handFile, "utf8")), image: OLD_IMAGE }));
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a changed copy of the previous config is never started: the undo halts, loudly, and blocks everything until it is resolved", async () => {
    const b = box();
    const first = await passed(b);
    const op = newOp(b, nextPlan(b, first, revOf(2)));
    const s = startDecider(b, op, "run");
    await playMac(b, op, { vanish: (st) => st.includes("started") }, () => false);
    const prev = join(opDir(b, op), "previous.json");
    writeFileSync(prev, readFileSync(prev, "utf8").replace('"read_only": true', '"read_only": false, "privileged": true'));
    await playMac(b, op, { evidence: "wrong-build" }, () => !alive(s.pid));
    await s.done;
    expect(s.status()).toBe(4);
    expect(readOut(b, op)).toContain("HALTED this run's copy of the previous config is not the one that was checked; it was not started and production is down");
    expect(states(b, op)).not.toContain("done");
    expect(reality(b).running).toEqual([]);
    // A halted operation has no terminal record, and blocks every other one.
    expect(records(b).filter((f) => f.includes(op))).toEqual([]);
    expect(wrong(b, op, { image: imageId(revOf(1)) }, imageId(revOf(2))).join()).toContain("no terminal outcome");
    const next = newOp(b, { rev: revOf(3), skipPrepare: true });
    expect(decider(b, next, "run").out).toContain(`operation ${op} is unfinished`);
    // recover refuses the same way, before touching anything, until the copy is the checked one again.
    const before = dockerLog(b).length;
    const rec = decider(b, op, "recover");
    expect(rec.status).toBe(4);
    expect(rec.out).toContain("this run's copy of the previous config is missing or changed");
    expect(disruptive(b, before)).toEqual([]);
    writeFileSync(prev, readFileSync(join(opDir(b, first), "resolved.json")));
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on revision");
    expect(wrong(b, op, { image: imageId(revOf(1)) }, imageId(revOf(2)))).toEqual([]);
  });
});
