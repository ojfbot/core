import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type Box,
  HAND_NAME,
  alive,
  completeLines,
  deciderAsync,
  destroyBoxAsync,
  dockerLog,
  field,
  imageId,
  lockIsFree,
  makeBox,
  newOp,
  perlCount,
  playMac,
  readOut,
  reality,
  records,
  revOf,
  run,
  setFaults,
  setPerlFaults,
  sleep,
  startDecider,
  states,
} from "./fakes/promote-harness.js";
import { CHANGING, HAND, LINE, POOL, killAll, killedAt, nextPlan, passed, pool, recoverOnce, useBoxes, wrong } from "./fakes/decider-kit.js";

// The kill sweeps of the promote's decider: SIGKILL at every engine call (before and after the
// call's effect) of a first cutover, a later promote, the undo, recover itself and a revert, and a
// failure or a kill at every journal append, record and flush; each followed by recover twice
// against ONE invariant (wrong(), in fakes/decider-kit.ts). About 300 sandboxes: by far the most
// expensive tests here, so they are not in `pnpm test`. CI runs them (vitest.promote-sweeps.config.ts)
// on every push to main and whenever a change touches the promote: see "Promote kill sweeps" in
// .github/workflows/ci.yml. To run them here:
//   pnpm exec vitest run --config vitest.promote-sweeps.config.ts
// EVERYTHING HERE IS SYNTHETIC. No server and no real engine are involved.
vi.setConfig({ testTimeout: 1_800_000 });
const box = useBoxes();

describe("the decider, killed at every step: recover", () => {
  it("SIGKILL of the decider at EVERY engine call, before and after the call's effect, then recover twice: one invariant", async () => {
    // How many engine calls a passing first cutover makes, counted from a reference run.
    const ref = box();
    const refOp = newOp(ref, { rev: revOf(1) });
    const first = dockerLog(ref).length + 1;
    await run(ref, refOp);
    const refLog = dockerLog(ref);
    const last = refLog.length;
    expect(last - first).toBeGreaterThan(20);
    // A call that changes something is interrupted before its effect and after it. A query has no
    // effect to be before or after: one kill.
    const points: [number, string][] = [];
    for (let n = first; n <= last; n++) for (const when of CHANGING.test(refLog[n - 1] ?? "") ? ["before", "after"] : ["before"]) points.push([n, when]);
    const failures: string[] = [];
    const outcomes = new Set<string>();
    await pool(points, POOL, async ([n, when]) => {
      const b = makeBox();
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        setFaults(b, { hang: { at: n, when } });
        const s = startDecider(b, op, "run");
        await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
        if (!existsSync(join(b.fake, "hung"))) {
          failures.push(`call ${n} ${when}: the run ended without reaching it (journal: ${states(b, op).join(",")}; ${readOut(b, op).slice(-200)})`);
          return;
        }
        const at = states(b, op).slice(-1)[0];
        killAll(b, op, s.pid);
        await s.done;
        setFaults(b, {});
        const r1 = await recoverOnce(b, op);
        const logAfter = dockerLog(b).length;
        const r2 = await deciderAsync(b, op, "recover");
        const bad = wrong(b, op, HAND, imageId(rev));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (!r2.out.includes("Nothing was changed")) bad.push("the second recover did not say it changed nothing");
        outcomes.add(field(b, op, "done", "outcome"));
        if (bad.length) failures.push(`call ${n} ${when} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-600)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    // The sweep really covered runs that never touched production, undone runs and a committed one.
    expect([...outcomes].sort()).toEqual(["pass", "unchanged", "undone"]);
  });

  it("the same sweep for a later promote (Compose to Compose), with the interrupted engine call taking effect after the kill", async () => {
    const ref = box();
    const refFirst = await passed(ref);
    const refOp = newOp(ref, nextPlan(ref, refFirst, revOf(2)));
    const runFrom = dockerLog(ref).length;
    await run(ref, refOp);
    const log = dockerLog(ref);
    // From the stop on (the checks before it are the first sweep's, whatever production is), one
    // kill per call, alternately before and after its effect; and, for every call that changes
    // something, the call accepted, its client killed, and its effect landing afterwards.
    const first = log.findIndex((l, i) => i >= runFrom && l.startsWith("stop -t")) + 1;
    const last = log.length;
    expect(first).toBeGreaterThan(1);
    const points: [number, string][] = [];
    for (let n = first; n <= last; n++) {
      points.push([n, n % 2 ? "after" : "before"]);
      if (CHANGING.test(log[n - 1] ?? "")) points.push([n, "late"]);
    }
    const failures: string[] = [];
    let lateHits = 0;
    await pool(points, POOL, async ([n, when]) => {
      const b = makeBox();
      try {
        const one = await passed(b);
        const rev = revOf(2);
        const op = newOp(b, nextPlan(b, one, rev));
        setFaults(b, when === "late" ? { late: { at: n, ms: 700 } } : { hang: { at: n, when } });
        const s = startDecider(b, op, "run");
        await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
        if (!existsSync(join(b.fake, "hung"))) {
          failures.push(`call ${n} ${when}: not reached (journal: ${states(b, op).join(",")}; ${readOut(b, op).slice(-200)})`);
          return;
        }
        if (when === "late") lateHits += 1;
        const at = states(b, op).slice(-1)[0];
        killAll(b, op, s.pid);
        await s.done;
        setFaults(b, {});
        await sleep(when === "late" ? 1200 : 0);
        const r1 = await recoverOnce(b, op);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, op, "recover");
        const bad = wrong(b, op, { image: imageId(revOf(1)) }, imageId(rev));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (reality(b).strays) bad.push("a stray project container was left");
        if (bad.length) failures.push(`call ${n} ${when} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-600)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    expect(lateHits).toBeGreaterThan(4);
  });

  it("SIGKILL during the undo and during recover itself ('undo half done'), at every engine call of the undo", async () => {
    const ref = box();
    const refOp = newOp(ref, { rev: revOf(1) });
    await run(ref, refOp, { evidence: "wrong-build" });
    // The undo's first call is its listing of this run's helper containers: the first one after the
    // new revision was started (the checks before the stop make the same listing).
    const refLog = dockerLog(ref);
    const up = refLog.findIndex((l) => /^compose .* up\b/.test(l));
    expect(up).toBeGreaterThan(0);
    const undoFrom = refLog.findIndex((l, i) => i > up && l.startsWith("ps -aq --filter name=")) + 1;
    const last = refLog.length;
    expect(undoFrom).toBeGreaterThan(up + 1);
    expect(last - undoFrom).toBeGreaterThan(10);
    const points: [number, string, string][] = [];
    for (let n = undoFrom; n <= last; n++) {
      for (const when of CHANGING.test(refLog[n - 1] ?? "") ? ["before", "after"] : ["before"]) points.push([n, when, "run"]);
      points.push([n, n % 2 ? "after" : "before", "recover"]);
    }
    const failures: string[] = [];
    let recoverHits = 0;
    await pool(points, POOL, async ([n, when, who]) => {
      const b = makeBox();
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        if (who === "run") {
          setFaults(b, { hang: { at: n, when } });
          const s = startDecider(b, op, "run");
          await playMac(b, op, { evidence: "wrong-build" }, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
          if (!existsSync(join(b.fake, "hung"))) {
            failures.push(`call ${n} ${when} ${who}: not reached (journal: ${states(b, op).join(",")}; ${readOut(b, op).slice(-200)})`);
            return;
          }
          killAll(b, op, s.pid);
          await s.done;
        } else {
          // The decider dies with the new revision up; recover itself is then killed mid-undo.
          // (recover first checks the undo's prerequisites: three calls before the undo's first.)
          await killedAt(b, op, "server-checked");
          setFaults(b, { hang: { at: dockerLog(b).length + 3 + (n - undoFrom) + 1, when } });
          const rec = startDecider(b, op, "recover");
          while (!existsSync(join(b.fake, "hung")) && alive(rec.pid)) await sleep(40);
          if (existsSync(join(b.fake, "hung"))) recoverHits += 1;
          killAll(b, op, rec.pid);
          await rec.done;
        }
        const at = states(b, op).slice(-1)[0];
        setFaults(b, {});
        const r1 = await recoverOnce(b, op);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, op, "recover");
        const bad = wrong(b, op, HAND, imageId(rev));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (bad.length) failures.push(`call ${n} ${when} ${who} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-600)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    expect(recoverHits).toBeGreaterThan(10);
  });
});

describe("the decider, failing or killed at every write: the journal and the records", () => {
  it("a failure, a torn line, a write that reports failure, and a kill at EVERY journal append, record and flush of a pass and of an undo; recover twice", async () => {
    // Count the persistence calls of a passing run and of an undone one.
    const count = async (evidence: "ok" | "wrong-build") => {
      const b = box();
      setPerlFaults(b, ["append 0 none"]);
      await run(b, newOp(b, { rev: revOf(1) }), { evidence });
      return { append: perlCount(b, "append"), publish: perlCount(b, "publish"), sync: perlCount(b, "sync-path") };
    };
    const pass = await count("ok");
    const undo = await count("wrong-build");
    expect(pass.append).toBe(12);
    expect(undo.append).toBe(18);
    expect(pass.publish).toBe(1);
    const points: [string, string, number, string][] = [];
    for (const [evidence, c] of [["ok", pass], ["wrong-build", undo]] as const) {
      // Every append: a failure (nothing written, as on a full disk) and a kill right after it.
      // A torn line (a short write) and a write that reports failure though the line is there:
      // at every third append, and at the lines everything hinges on (the last three of each run,
      // and "starting").
      for (let n = 1; n <= c.append; n++) {
        const modes = ["fail", "kill-after"];
        if (n % 3 === 0 || n === 7 || n > c.append - 3) modes.push("torn", "wrote-failed");
        for (const mode of modes) points.push([evidence, "append", n, mode]);
      }
      for (let n = 1; n <= c.publish; n++) for (const mode of ["fail", "kill-before", "kill-after"]) points.push([evidence, "publish", n, mode]);
      for (let n = 1; n <= c.sync; n++) points.push([evidence, "sync-path", n, "fail"]);
    }
    const failures: string[] = [];
    const exits = new Set<number | null>();
    await pool(points, POOL, async ([evidence, call, n, mode]) => {
      const b = makeBox();
      const tag = `${evidence} ${call} ${n} ${mode}`;
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        setPerlFaults(b, [`${call} ${n} ${mode}`]);
        const r = await run(b, op, { evidence: evidence as "ok" });
        exits.add(r.status);
        const hit = existsSync(join(b.fake, "perl-faults.hit"));
        setPerlFaults(b, []);
        if (!hit) {
          failures.push(`${tag}: the fault was never reached (journal: ${states(b, op).join(",")}; ${r.out.slice(-200)})`);
          return;
        }
        const bad: string[] = [];
        // What it said must be true at the moment it said it.
        const outcome = field(b, op, "done", "outcome");
        if (r.out.includes("PASS production runs") && outcome !== "pass") bad.push("it printed PASS without a done line");
        if (/^UNDONE production/m.test(r.out) && outcome !== "undone") bad.push("it printed UNDONE without a done line");
        if (r.status === 0 && outcome !== "pass") bad.push("exit 0 without a recorded pass");
        if (states(b, op).includes("committed") && states(b, op).includes("undoing")) bad.push("a committed line AND an undo in one journal");
        // No complete line of the journal is ever two lines run together.
        for (const l of completeLines(b, op)) if (!LINE.test(l)) bad.push(`a malformed journal line: ${l.slice(0, 60)}`);
        const r1 = await recoverOnce(b, op);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, op, "recover");
        bad.push(...wrong(b, op, HAND, imageId(rev)));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (bad.length) failures.push(`${tag}: ${[...new Set(bad)].join("; ")}\n${r.out.slice(-300)}\n${r1.all.slice(-300)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    // Among them: runs that ended "record incomplete" (3), never as a success.
    expect(exits.has(3)).toBe(true);
  });
});

describe("a revert, killed at every step", () => {
  const revertPlan = (b: Box, target: string, approval?: string) => newOp(b, { mode: "revert", target, approval });

  it("SIGKILL at every engine call of a revert, then recover twice: it is completed, never rolled back, and the promote's history stands", async () => {
    const ref = box();
    const refFirst = await passed(ref);
    const refZ = revertPlan(ref, refFirst);
    const first = dockerLog(ref).length + 1;
    await run(ref, refZ);
    const last = dockerLog(ref).length;
    const points: [number, string][] = [];
    for (let n = first; n <= last; n++) points.push([n, n % 2 ? "after" : "before"]);
    const failures: string[] = [];
    const outcomes = new Set<string>();
    await pool(points, POOL, async ([n, when]) => {
      const b = makeBox();
      try {
        const target = await passed(b);
        const z = revertPlan(b, target);
        setFaults(b, { hang: { at: n, when } });
        const s = startDecider(b, z, "run");
        await playMac(b, z, {}, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
        if (!existsSync(join(b.fake, "hung"))) {
          failures.push(`call ${n} ${when}: not reached (journal: ${states(b, z).join(",")}; ${readOut(b, z).slice(-200)})`);
          return;
        }
        const at = states(b, z).slice(-1)[0];
        killAll(b, z, s.pid);
        await s.done;
        setFaults(b, {});
        const r1 = await recoverOnce(b, z);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, z, "recover");
        const outcome = field(b, z, "done", "outcome");
        outcomes.add(outcome);
        const now = reality(b);
        const bad: string[] = [];
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (!lockIsFree(b)) bad.push("the lock is held");
        if (now.helpers) bad.push("helper containers left");
        if (now.running.length !== 1) bad.push(`${now.running.length} containers run`);
        if (field(b, target, "done", "outcome") !== "pass" || states(b, target).includes("undoing")) bad.push("the promote's journal was rewritten");
        if (outcome === "reverted") {
          if (now.running[0]?.name !== HAND_NAME) bad.push("reverted, but the hand-started container does not run");
          if (now.jobs !== 3 || !now.stateFolders.includes(`state.failed-${z}`)) bad.push("reverted, but the snapshot is not the state folder");
          if (!records(b).includes(`revert-${z}.txt`)) bad.push("reverted without its record");
        } else if (outcome === "unchanged") {
          if (now.running[0]?.image !== imageId(revOf(1))) bad.push("unchanged, but the promoted revision does not run");
          if (states(b, z).includes("spent")) bad.push("unchanged after the yes was spent");
        } else bad.push(`no terminal outcome (${outcome || "none"})`);
        if (bad.length) failures.push(`call ${n} ${when} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-500)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    expect([...outcomes].sort()).toEqual(["reverted", "unchanged"]);
  });
});
